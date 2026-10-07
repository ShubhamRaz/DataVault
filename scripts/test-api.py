#!/usr/bin/env python3
"""DataVault — end-to-end API test: login → start ENCRYPTION round → check SSE + results."""
import json, subprocess, sys, threading, time
import urllib.request

BASE = "http://localhost:3000"
TOKEN = None

def req(method, path, body=None, raw=False):
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Cookie"] = f"datavault_session={TOKEN}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    resp = urllib.request.urlopen(r, timeout=300)
    text = resp.read().decode()
    if raw:
        return resp.status, text
    return resp.status, json.loads(text) if text else {}

def main():
    global TOKEN
    # login
    status, body = req("POST", "/api/auth/login", {"email": "admin@datavault.demo", "password": "demo1234"})
    assert body["ok"], body
    print("✓ login admin")

    # SSE listener thread
    events = []
    def listen():
        r = urllib.request.Request(BASE + "/api/federation/events", headers={"Cookie": f"datavault_session={TOKEN}"})
        try:
            resp = urllib.request.urlopen(r, timeout=60)
            for raw in resp:
                line = raw.decode().strip()
                if line.startswith("data:"):
                    try:
                        events.append(json.loads(line[5:]))
                    except Exception:
                        pass
        except Exception as e:
            print("SSE closed:", e)
    t = threading.Thread(target=listen, daemon=True)
    t.start()
    time.sleep(1)

    # get cancer model
    _, models = req("GET", "/api/models")
    model = [m for m in models["data"]["models"] if m["slug"] == "cancer-risk"][0]
    print(f"✓ model: {model['name']} accuracy={model['accuracyAfter']} rounds={model['trainingRounds']}")

    # start ONE round in ENCRYPTION mode
    t0 = time.time()
    status, body = req("POST", "/api/federation/rounds", {
        "modelId": model["id"], "rounds": 1, "pacingMs": 120, "privacyMode": "ENCRYPTION",
    })
    assert body["ok"], body
    res = body["data"]["result"]
    print(f"✓ round completed in {time.time()-t0:.1f}s: before={res['accuracyBefore']:.4f} after={res['accuracyAfter']:.4f} (+{res['improvement']*100:.2f} pts)")

    time.sleep(2)
    types = [e.get("type") for e in events if e.get("type") != "STREAM_CONNECTED"]
    print(f"✓ SSE events: {len(types)}")
    for e in events:
        if e.get("type") in ("ROUND_STARTED", "MODEL_DISTRIBUTED", "SECURE_AGGREGATION", "GLOBAL_MODEL_UPDATED", "BLOCKCHAIN_RECORDED", "ROUND_COMPLETED", "UPDATE_ENCRYPTED"):
            print(f"   {e['type']:24} {e['message'][:84]}")

    # verify encrypted updates recorded
    _, rounds = req("GET", f"/api/federation/rounds?modelId={model['id']}&take=1")
    r = rounds["data"]["rounds"][0]
    print(f"✓ latest round: encryptedUpdates={r['encryptedUpdates']} contributions={len(r['contributions'])} rewards={len(r['rewards'])}")
    assert r["encryptedUpdates"] == 3, "expected 3 encrypted updates in ENCRYPTION mode"

    # verify chain integrity after the round
    _, verify = req("GET", "/api/blockchain/verify")
    print(f"✓ ledger valid={verify['data']['ledger']['valid']} audit={verify['data']['auditChain']['valid']}")

    # claim rewards for hospital-a as its org admin
    global_login = None
    status, body = req("POST", "/api/auth/logout")
    status, body = req("POST", "/api/auth/login", {"email": "alice@apollo.demo", "password": "demo1234"})
    assert body["ok"], body
    org_id = body["data"]["organizationId"]
    status, body = req("POST", "/api/rewards/claim", {"organizationId": org_id})
    assert body["ok"], body
    print(f"✓ rewards claimed: {body['data']['claimed']} rewards, {body['data']['total']} DATA, block #{body['data']['blockNumber']}")

    # privacy guard
    _, datasets = req("GET", "/api/datasets")
    ds = datasets["data"]["datasets"][0]
    status, raw = req("GET", f"/api/datasets/{ds['id']}/raw", raw=True)
    guard = json.loads(raw)
    assert guard["data"]["blocked"], "privacy guard must block raw access"
    print(f"✓ privacy guard: {guard['data']['reason']}")

    print("\nALL API TESTS PASSED")

if __name__ == "__main__":
    # login first to get token
    r = urllib.request.Request(BASE + "/api/auth/login", data=json.dumps({"email": "admin@datavault.demo", "password": "demo1234"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    resp = urllib.request.urlopen(r, timeout=30)
    TOKEN = resp.headers.get("Set-Cookie", "").split("datavault_session=")[1].split(";")[0]
    main()
