"""Idempotent demo-network seeding (demo-specs.ts is the single source of truth).

Creates the 10 demo organizations, 10 demo users (password ``demo1234``),
wallets, dataset metadata (raw rows stay in the ml-service), the 3 federated
models and their participants. Runs at startup when the DB is empty —
mirrors the TS demo seed so the gateway is demo-ready out of the box.
"""
from __future__ import annotations

import hashlib
import hmac

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.db import Dataset, Model, Organization, Participant, SystemSetting, User, Wallet

ORGS = [
    ("Apollo Demo Hospital", "hospital-a", "Hospital", "Healthcare", "Chennai, IN", "HEALTHCARE",
     "Synthetic demo hospital network with an oncology research division. All patient records are generated synthetic data."),
    ("AIIMS Demo Center", "hospital-b", "Hospital", "Healthcare", "New Delhi, IN", "HEALTHCARE",
     "Synthetic demo medical research center focused on diagnostic biomarkers. All records are generated synthetic data."),
    ("Max Demo Research Lab", "hospital-c", "Research Institution", "Healthcare", "Mumbai, IN", "HEALTHCARE",
     "Synthetic demo clinical research lab. All patient records are generated synthetic data."),
    ("HDFC Demo Bank", "bank-a", "Bank", "Finance", "Mumbai, IN", "FINANCE",
     "Synthetic demo retail bank monitoring card fraud. All transactions are generated synthetic data."),
    ("ICICI Demo Bank", "bank-b", "Bank", "Finance", "Hyderabad, IN", "FINANCE",
     "Synthetic demo universal bank with digital payments telemetry. All transactions are generated synthetic data."),
    ("SBI Demo Regional", "bank-c", "Bank", "Finance", "Kolkata, IN", "FINANCE",
     "Synthetic demo regional banking circle. All transactions are generated synthetic data."),
    ("Green Valley Farm Group", "farm-a", "Agricultural Organization", "Agriculture", "Nashik, IN", "AGRICULTURE",
     "Synthetic demo farmer collective optimizing crop yield. All field data is generated synthetic data."),
    ("Deccan Agri Collective", "farm-b", "Agricultural Organization", "Agriculture", "Hyderabad, IN", "AGRICULTURE",
     "Synthetic demo agri cooperative on precision farming. All field data is generated synthetic data."),
    ("Punjab Farm Co-op", "farm-c", "Agricultural Organization", "Agriculture", "Ludhiana, IN", "AGRICULTURE",
     "Synthetic demo farming cooperative. All field data is generated synthetic data."),
    ("DataVault Research Core", "datavault-core", "Research Institution", "Research", "Bengaluru, IN", "RESEARCH",
     "Platform coordinator organization (demo). Runs the secure aggregator and model registry."),
]

USERS = [  # (email, name, role, org-slug) — password demo1234 for all
    ("admin@datavault.demo", "Ada Platform", "ADMIN", "datavault-core"),
    ("alice@apollo.demo", "Alice Rao", "ORG_ADMIN", "hospital-a"),
    ("arjun@aiims.demo", "Arjun Mehta", "ORG_ADMIN", "hospital-b"),
    ("priya@max.demo", "Priya Nair", "ORG_ADMIN", "hospital-c"),
    ("vikram@hdfc.demo", "Vikram Shah", "ORG_ADMIN", "bank-a"),
    ("meera@greenvalley.demo", "Meera Iyer", "ORG_ADMIN", "farm-a"),
    ("raj@datavault.demo", "Raj Malhotra", "ML_OPERATOR", "datavault-core"),
    ("sunita@aiims.demo", "Sunita Devi", "PARTICIPANT", "hospital-b"),
    ("karan@icici.demo", "Karan Patel", "PARTICIPANT", "bank-b"),
    ("viewer@datavault.demo", "Guest Viewer", "VIEWER", "datavault-core"),
]

DATASETS = {  # slug → (name, privacy classification) + generator spec stats
    "hospital-a": ("Apollo Synthetic Oncology Records", "RESTRICTED", 900, 12, "HEALTHCARE", "CLASSIFICATION", "cancer_risk", 1101),
    "hospital-b": ("AIIMS Synthetic Biomarker Cohort", "RESTRICTED", 650, 12, "HEALTHCARE", "CLASSIFICATION", "cancer_risk", 1102),
    "hospital-c": ("Max Synthetic Clinical Trials", "CONFIDENTIAL", 1100, 12, "HEALTHCARE", "CLASSIFICATION", "cancer_risk", 1103),
    "bank-a": ("HDFC Synthetic Card Transactions", "RESTRICTED", 1400, 8, "FINANCE", "CLASSIFICATION", "is_fraud", 2201),
    "bank-b": ("ICICI Synthetic Payment Streams", "RESTRICTED", 1000, 8, "FINANCE", "CLASSIFICATION", "is_fraud", 2202),
    "bank-c": ("SBI Synthetic Regional Transactions", "CONFIDENTIAL", 1200, 8, "FINANCE", "CLASSIFICATION", "is_fraud", 2203),
    "farm-a": ("Green Valley Synthetic Field Data", "INTERNAL", 800, 7, "AGRICULTURE", "REGRESSION", "yield_t_per_ha", 3301),
    "farm-b": ("Deccan Synthetic Crop Telemetry", "INTERNAL", 700, 7, "AGRICULTURE", "REGRESSION", "yield_t_per_ha", 3302),
    "farm-c": ("Punjab Synthetic Farm Records", "INTERNAL", 950, 7, "AGRICULTURE", "REGRESSION", "yield_t_per_ha", 3303),
}

MODELS = [
    ("Cancer Risk Prediction", "cancer-risk", "Binary classification of elevated cancer risk from synthetic biomarkers",
     "Healthcare", "CLASSIFICATION",
     "Federated cancer-risk classifier trained across three hospital environments without any patient record leaving a hospital. 100% synthetic data.",
     ["hospital-a", "hospital-b", "hospital-c"]),
    ("Card Fraud Detection", "fraud-detection", "Real-time fraud vs legitimate transaction classification",
     "Finance", "CLASSIFICATION",
     "Cross-bank federated fraud model — banks co-train on their own synthetic transaction streams, sharing only protected model updates.",
     ["bank-a", "bank-b", "bank-c"]),
    ("Crop Yield Prediction", "crop-yield", "Regional crop yield regression (t/ha) from soil & weather features",
     "Agriculture", "REGRESSION",
     "Federated yield prediction across farmer collectives. Rewards redeem for seed & fertilizer subsidies (demo concept).",
     ["farm-a", "farm-b", "farm-c"]),
]


def derive_wallet_address(slug: str) -> str:
    digest = hmac.new(b"datavault-wallet-derivation-v1", slug.encode(), hashlib.sha256).hexdigest()
    return f"0x{digest[:40]}"


def spec_hash(slug: str, seed: int, samples: int, features: int) -> str:
    """Deterministic dataset-spec integrity hash (raw data lives in the
    ml-service participant environments, spec §15)."""
    return hashlib.sha256(f"spec:{slug}:{seed}:{samples}:{features}".encode()).hexdigest()


async def seed_if_empty(db: AsyncSession) -> bool:
    count = (await db.execute(select(func.count(Organization.id)))).scalar_one_or_none() or 0
    if count > 0:
        return False

    org_ids = {}
    for name, slug, otype, industry, location, domain, description in ORGS:
        oid = f"org_{slug.replace('-', '_')}"
        db.add(Organization(id=oid, name=name, slug=slug, type=otype, industry=industry,
                            location=location, domain=domain, description=description))
        db.add(Wallet(id=f"wal_{slug.replace('-', '_')}", address=derive_wallet_address(slug), organization_id=oid))
        org_ids[slug] = oid

    for email, name, role, org_slug in USERS:
        db.add(User(id=f"usr_{email.split('@')[0].replace('.', '_')}", email=email, name=name,
                    password_hash=hash_password("demo1234"), role=role, organization_id=org_ids[org_slug]))

    for slug, (dname, privacy, samples, features, domain, task, target, seed) in DATASETS.items():
        db.add(Dataset(id=f"ds_{slug.replace('-', '_')}", name=dname, owner_id=org_ids[slug], domain=domain,
                       task=task, privacy_classification=privacy, sample_count=samples, feature_count=features,
                       target_name=target, metadata_hash=spec_hash(slug, seed, samples, features)))

    for name, slug, use_case, industry, task, description, participants in MODELS:
        mid = f"mdl_{slug.replace('-', '_')}"
        db.add(Model(id=mid, name=name, slug=slug, use_case=use_case, industry=industry,
                     task_type=task, description=description))
        for pslug in participants:
            db.add(Participant(id=f"prt_{slug.replace('-', '_')}_{pslug.replace('-', '_')}",
                               model_id=mid, organization_id=org_ids[pslug]))

    db.add(SystemSetting(key="demo_seeded", value="true"))
    db.add(SystemSetting(key="reward_pool", value="1000"))
    await db.commit()
    return True
