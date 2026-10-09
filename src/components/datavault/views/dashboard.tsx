
"use client";
import React, { useEffect, useRef } from "react";
import { navigate, type Route } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";
import { toast } from "sonner";

export function DashboardView() {
  const { user, logout, theme, setTheme: setStoreTheme } = useAppStore();
  const chartsRef = useRef<any[]>([]);

  useEffect(() => {
    function initDashboard() {
      const isDark = document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
      const chartFont = {
        family: "Inter, ui-sans-serif, system-ui, sans-serif"
      };

      const gridColor = isDark ? "rgba(126, 145, 165, .14)" : "rgba(220, 231, 241, .6)";
      const tickColor = isDark ? "#71829a" : "#64748b";

    function createAccuracyChart() {
      const ctx = document.getElementById("accuracyChart");
      new Chart(ctx, {
        type: "line",
        data: {
          labels: Array.from({length:16}, (_,i) => i + 1),
          datasets: [
            {
              label: "Cancer Risk Prediction",
              data: [49,56,62,67,71,75,78,81,84,86,87,88,89,89,89,89],
              borderColor: "#2f80ed",
              backgroundColor: "rgba(47,128,237,.08)",
              tension: .38,
              pointRadius: 2.5,
              borderWidth: 2.5,
              fill: true
            },
            {
              label: "Card Fraud Detection",
              data: [43,51,57,62,66,70,73,76,79,81,84,87,89,90,91,91.5],
              borderColor: "#16b98a",
              backgroundColor: "rgba(22,185,138,.06)",
              tension: .38,
              pointRadius: 2.5,
              borderWidth: 2.5,
              fill: false
            },
            {
              label: "Crop Yield Prediction",
              data: [18,25,31,37,41,45,48,52,55,58,61,64,66,68,70,69.2],
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245,158,11,.05)",
              tension: .38,
              pointRadius: 2.5,
              borderWidth: 2.5,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                boxWidth: 7,
                padding: 20,
                font: { ...chartFont, size: 10 }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "Federation Round", color: tickColor, font: {size: 10} },
              grid: { color: gridColor },
              ticks: { color: tickColor, font: {size: 9} }
            },
            y: {
              min: 0,
              max: 100,
              ticks: { color: tickColor, font: {size: 9}, callback: v => v + "%" },
              grid: { color: gridColor }
            }
          }
        }
      });
    }

    function createBarChart() {
      new Chart(document.getElementById("orgChart"), {
        type: "bar",
        data: {
          labels: ["AIIMS","Apollo","Deccan","Green","HDFC","ICICI","Max","Punjab","SBI"],
          datasets: [{
            label: "Contribution score",
            data: [1280, 1900, 1320, 640, 1210, 2040, 980, 1570, 760],
            backgroundColor: ["#17b995","#17b995","#17b995","#17b995","#17b995","#2f80ed","#17b995","#17b995","#17b995"],
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: {display:false}, ticks:{color:tickColor,font:{size:9}} },
            y: { grid:{color:gridColor}, ticks:{color:tickColor,font:{size:9}} }
          }
        }
      });
    }

    function createActivityChart() {
      new Chart(document.getElementById("activityChart"), {
        type: "bar",
        data: {
          labels: ["09-25","09-28","10-01","10-04","10-07"],
          datasets: [
            { label:"Federation rounds", data:[6,9,12,8,10], backgroundColor:"#2f80ed", borderRadius:5 },
            { label:"Protected updates", data:[3,5,7,4,6], backgroundColor:"#16b98a", borderRadius:5 }
          ]
        },
        options: {
          responsive:true,
          maintainAspectRatio:false,
          plugins:{
            legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,font:{size:9}}}
          },
          scales:{
            x:{grid:{display:false},ticks:{color:tickColor,font:{size:9}}},
            y:{grid:{color:gridColor},ticks:{color:tickColor,font:{size:9}}}
          }
        }
      });
    }

    function createSparks() {
      document.querySelectorAll(".spark").forEach(canvas => {
        const values = canvas.dataset.values.split(",").map(Number);
        new Chart(canvas, {
          type: "line",
          data: {
            labels: values.map((_,i)=>i),
            datasets: [{
              data: values,
              borderColor: "#13b998",
              borderWidth: 2,
              pointRadius: 0,
              tension: .4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: {display:false}, tooltip:{enabled:false} },
            scales: { x:{display:false}, y:{display:false} }
          }
        });
      });
    }

    function setTheme(mode) {
      document.body.classList.toggle("dark", mode === "dark");
      document.getElementById("lightBtn").classList.toggle("active", mode === "light");
      document.getElementById("darkBtn").classList.toggle("active", mode === "dark");
      localStorage.setItem("datavault-theme", mode);
    }

    function runFederation() {
      const button = document.querySelector(".primary");
      const old = button.innerHTML;
      button.innerHTML = "⟳ &nbsp; Running federation...";
      button.disabled = true;
      setTimeout(() => {
        button.innerHTML = "✓ &nbsp; Federation round completed";
        setTimeout(() => {
          button.innerHTML = old;
          button.disabled = false;
        }, 1600);
      }, 1400);
    }

    
      const saved = localStorage.getItem("datavault-theme") || "dark";
      setTheme(saved);
      createAccuracyChart();
      createBarChart();
      createActivityChart();
      createSparks();

      document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
          document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
          item.classList.add("active");
        });
      });
    }

    if (typeof window !== "undefined") {
      if (!(window as any).Chart) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
        script.onload = () => initDashboard();
        document.head.appendChild(script);
      } else {
        initDashboard();
      }
    }
  }, []);

  const setTheme = (mode: string) => {
    setStoreTheme(mode as "dark" | "light");
    document.getElementById("lightBtn")?.classList.toggle("active", mode === "light");
    document.getElementById("darkBtn")?.classList.toggle("active", mode === "dark");
  };

  const runFederation = () => {
    const button = document.querySelector(".primary");
    if (!button) return;
    const old = button.innerHTML;
    button.innerHTML = "⟳ &nbsp; Running federation...";
    (button as HTMLButtonElement).disabled = true;
    setTimeout(() => {
      button.innerHTML = "✓ &nbsp; Federation round completed";
      setTimeout(() => {
        button.innerHTML = old;
        (button as HTMLButtonElement).disabled = false;
      }, 1600);
    }, 1400);
  };

  return (
    <div className="dv-dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
    :root {
      --bg: #f7faff;
      --surface: rgba(255,255,255,.92);
      --surface-2: #f1f6fb;
      --border: #dce7f1;
      --text: #0c1738;
      --muted: #64748b;
      --navy: #071738;
      --teal: #10bfa8;
      --cyan: #18bde0;
      --blue: #2f80ed;
      --green: #16b98a;
      --orange: #f59e0b;
      --shadow: 0 12px 35px rgba(18, 45, 75, .08);
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    button, input, select { font: inherit; }
    button { cursor: pointer; }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 248px 1fr;
    }

    /* SIDEBAR */
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 248px;
      background: rgba(255,255,255,.96);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 20;
    }

    .brand {
      height: 76px;
      padding: 18px 22px;
      display: flex;
      align-items: center;
      gap: 11px;
      border-bottom: 1px solid #edf2f7;
    }

    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      color: white;
      font-size: 20px;
      font-weight: 900;
      background: linear-gradient(145deg, #19d5bd, #1599d7);
      box-shadow: 0 8px 18px rgba(18, 190, 177, .25);
    }

    .brand-name {
      font-size: 19px;
      font-weight: 800;
      line-height: 1;
    }

    .brand-sub {
      font-size: 10px;
      color: var(--muted);
      margin-top: 5px;
    }

    .nav {
      padding: 22px 14px;
      overflow-y: auto;
    }

    .nav-label {
      padding: 0 12px 10px;
      font-size: 11px;
      color: #8190a7;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 700;
    }

    .nav-item {
      width: 100%;
      height: 44px;
      border: 0;
      background: transparent;
      color: #243452;
      border-radius: 11px;
      display: flex;
      align-items: center;
      gap: 13px;
      padding: 0 13px;
      margin: 3px 0;
      text-align: left;
      transition: .2s ease;
    }

    .nav-item:hover { background: #edf7f9; color: #087e83; }
    .nav-item.active {
      background: linear-gradient(90deg, #d9fbf3, #e5f7ff);
      color: #087f78;
      font-weight: 750;
    }

    .nav-icon {
      width: 20px;
      text-align: center;
      font-size: 17px;
    }

    .nav-divider {
      height: 1px;
      background: #e8eef5;
      margin: 18px 8px;
    }

    .privacy-mini {
      margin: auto 14px 16px;
      padding: 15px;
      border: 1px solid #cdece7;
      background: linear-gradient(145deg, #effdfa, #f5fbff);
      border-radius: 14px;
    }

    .privacy-mini .shield {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: #d8f8ef;
      color: #078b79;
      margin-bottom: 10px;
    }

    .privacy-mini strong {
      display: block;
      font-size: 12px;
      line-height: 1.35;
    }

    .privacy-mini span {
      display: block;
      font-size: 10px;
      color: var(--muted);
      margin-top: 5px;
    }

    /* MAIN */
    .main {
      grid-column: 2;
      min-width: 0;
    }

    .topbar {
      height: 76px;
      background: rgba(255,255,255,.9);
      backdrop-filter: blur(18px);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 0 28px;
      position: sticky;
      top: 0;
      z-index: 15;
    }

    .search {
      width: min(420px, 45vw);
      height: 40px;
      border: 1px solid #d6e2ed;
      border-radius: 10px;
      background: #fff;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 13px;
      color: #8290a3;
    }

    .search input {
      border: 0;
      outline: 0;
      width: 100%;
      color: var(--text);
      background: transparent;
      font-size: 13px;
    }

    .top-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .theme-toggle {
      height: 38px;
      border: 1px solid #d8e4ef;
      border-radius: 20px;
      background: #f5f9fc;
      padding: 3px;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .theme-toggle button {
      width: 34px;
      height: 30px;
      border: 0;
      border-radius: 16px;
      background: transparent;
      color: #65758d;
    }

    .theme-toggle button.active {
      background: #087f78;
      color: #fff;
      font-weight: bold;
    }

    .live {
      height: 38px;
      border: 1px solid #bcefe4;
      border-radius: 20px;
      background: #f1fffb;
      color: #087c6d;
      padding: 0 16px;
      font-weight: 700;
      font-size: 12px;
    }

    .live::before {
      content: "";
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #13c79c;
      border-radius: 50%;
      margin-right: 8px;
      box-shadow: 0 0 0 4px rgba(19,199,156,.12);
    }

    .bell {
      position: relative;
      width: 38px;
      height: 38px;
      border: 0;
      background: transparent;
      color: #53627a;
      font-size: 17px;
    }

    .dot {
      position: absolute;
      top: 7px;
      right: 6px;
      width: 7px;
      height: 7px;
      background: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
    }

    .profile {
      display: flex;
      align-items: center;
      gap: 9px;
      padding-left: 8px;
      border-left: 1px solid #e4ebf2;
    }

    .avatar {
      width: 39px;
      height: 39px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #10bfa8, #18bde0);
      color: white;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 0 4px 12px rgba(16, 191, 168, 0.25);
    }

    .profile strong {
      font-size: 12px;
      display: block;
    }

    .profile small {
      color: var(--muted);
      display: block;
      font-size: 10px;
      margin-top: 2px;
    }

    .content {
      padding: 24px 28px 28px;
      max-width: 1700px;
      margin: auto;
    }

    /* HERO */
    .hero {
      position: relative;
      overflow: hidden;
      min-height: 174px;
      border-radius: 18px;
      padding: 28px 30px;
      background:
        linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.95) 38%, rgba(255,255,255,.48) 70%, rgba(235,249,251,.72) 100%),
        radial-gradient(circle at 80% 40%, rgba(30,195,181,.18), transparent 35%),
        #eef7fb;
      border: 1px solid #dcebf2;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
    }

    .hero::after {
      content: "";
      position: absolute;
      width: 470px;
      height: 220px;
      right: -70px;
      top: -50px;
      background:
        radial-gradient(circle at 50% 50%, rgba(20,186,178,.22), transparent 38%),
        linear-gradient(135deg, transparent 45%, rgba(255,255,255,.8) 46%, transparent 47%),
        linear-gradient(45deg, transparent 45%, rgba(29,137,189,.12) 46%, transparent 47%);
      opacity: .9;
      pointer-events: none;
    }

    .hero-copy {
      position: relative;
      z-index: 2;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(25px, 3vw, 35px);
      letter-spacing: -.03em;
    }

    .hero p {
      margin: 8px 0 20px;
      color: #61708a;
      font-size: 13px;
    }

    .hero-actions {
      display: flex;
      gap: 10px;
    }

    .primary {
      border: 0;
      border-radius: 10px;
      height: 42px;
      padding: 0 18px;
      background: linear-gradient(135deg, #0ba593, #087f78);
      color: white;
      font-weight: 750;
      box-shadow: 0 8px 18px rgba(5, 79, 91, .18);
    }

    .secondary {
      height: 42px;
      padding: 0 17px;
      border: 1px solid #d3e1ec;
      border-radius: 10px;
      background: rgba(255,255,255,.9);
      color: #253754;
      font-weight: 650;
    }

    .privacy-badge {
      position: absolute;
      right: 25px;
      bottom: 25px;
      z-index: 3;
      width: 300px;
      padding: 14px;
      border-radius: 12px;
      background: rgba(255,255,255,.84);
      border: 1px solid rgba(196,224,229,.85);
      backdrop-filter: blur(10px);
      box-shadow: 0 12px 25px rgba(28,65,90,.08);
    }

    .privacy-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 13px;
      color: #08796f;
    }

    .privacy-title .picon {
      width: 31px;
      height: 31px;
      border-radius: 9px;
      background: #d9f8ef;
      display: grid;
      place-items: center;
    }

    .privacy-badge p {
      margin: 7px 0 0 41px;
      font-size: 10px;
      color: #687991;
    }

    /* STATS */
    .stats {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin: 14px 0;
    }

    .stat {
      min-height: 94px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 7px 22px rgba(27,53,80,.045);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stat-icon {
      width: 43px;
      height: 43px;
      flex: 0 0 43px;
      border-radius: 13px;
      display: grid;
      place-items: center;
      font-size: 18px;
      background: #e8f2ff;
      color: #2174e5;
    }

    .stat:nth-child(2) .stat-icon { background: #f0e8ff; color: #7541d9; }
    .stat:nth-child(3) .stat-icon { background: #e4fbf4; color: #0b9a7a; }
    .stat:nth-child(4) .stat-icon { background: #fff5df; color: #d88700; }
    .stat:nth-child(5) .stat-icon { background: #fff0d7; color: #d98600; }

    .stat strong {
      display: block;
      font-size: 21px;
      letter-spacing: -.02em;
    }

    .stat span {
      color: #62718a;
      font-size: 11px;
      display: block;
      margin-top: 3px;
    }

    /* GRID */
    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(320px, .95fr);
      gap: 14px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 15px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .card-head {
      min-height: 66px;
      padding: 17px 19px 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 800;
    }

    .card-sub {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
    }

    .select {
      border: 1px solid #dce6ef;
      border-radius: 8px;
      background: white;
      padding: 7px 10px;
      font-size: 10px;
      color: #53627a;
      outline: 0;
    }

    .chart-wrap {
      height: 290px;
      padding: 4px 16px 15px;
    }

    .right-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .models {
      padding: 2px 17px 15px;
    }

    .model-row {
      display: grid;
      grid-template-columns: 37px 1fr auto 78px;
      align-items: center;
      gap: 10px;
      min-height: 61px;
      border-bottom: 1px solid #edf2f6;
    }

    .model-row:last-child { border-bottom: 0; }

    .model-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: #e7f2ff;
      color: #2d7ce9;
    }

    .model-row:nth-child(2) .model-icon { background: #e4fbf4; color: #099878; }
    .model-row:nth-child(3) .model-icon { background: #fff2dc; color: #df8c00; }

    .model-name {
      font-size: 11px;
      font-weight: 700;
    }

    .model-delta {
      font-size: 9px;
      color: #0a9a79;
      margin-top: 3px;
    }

    .model-value {
      font-size: 15px;
      font-weight: 850;
      color: #069b7d;
      white-space: nowrap;
    }

    .spark {
      height: 32px;
    }

    .rounds {
      padding: 3px 15px 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }

    th {
      color: #8290a5;
      font-weight: 700;
      text-align: left;
      padding: 7px 5px;
      border-bottom: 1px solid #e7edf3;
    }

    td {
      padding: 8px 5px;
      border-bottom: 1px solid #eef2f6;
      color: #42536d;
    }

    td:first-child { font-weight: 800; color: #1b2b49; }

    .status {
      display: inline-block;
      background: #ddf8ef;
      color: #07896f;
      border-radius: 20px;
      padding: 4px 7px;
      font-weight: 750;
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }

    .small-chart {
      height: 220px;
      padding: 0 14px 14px;
    }

    .blockchain {
      margin-top: 14px;
      padding: 17px 19px;
      display: grid;
      grid-template-columns: 1.2fr repeat(4, .55fr) auto;
      align-items: center;
      gap: 12px;
    }

    .chain-title {
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .chain-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #eee9ff;
      color: #7048db;
      display: grid;
      place-items: center;
      font-size: 18px;
    }

    .chain-title strong { font-size: 12px; display: block; }
    .chain-title span { color: var(--muted); font-size: 10px; display: block; margin-top: 4px; }

    .chain-stat {
      padding-left: 13px;
      border-left: 1px solid #e5ebf1;
    }

    .chain-stat strong { display: block; font-size: 17px; }
    .chain-stat span { display: block; font-size: 9px; color: var(--muted); margin-top: 3px; }

    .explorer {
      height: 39px;
      border: 1px solid #cddff0;
      background: #f6fbff;
      color: #1269b5;
      border-radius: 9px;
      padding: 0 13px;
      font-size: 10px;
      font-weight: 750;
    }

    .footer {
      padding: 18px 3px 4px;
      color: #8491a5;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
    }

    /* DARK MODE */
    html.dark body, body.dark {
      --bg: #07101e;
      --surface: #0d1828;
      --surface-2: #101e31;
      --border: #1b3046;
      --text: #eaf4ff;
      --muted: #8fa3ba;
      --navy: #dcecff;
      --shadow: 0 12px 35px rgba(0,0,0,.22);
    }

    :is(.dark, body.dark) .sidebar,
    :is(.dark, body.dark) .topbar { background: rgba(7,16,30,.96); }

    :is(.dark, body.dark) .brand { border-color: #16283b; }
    :is(.dark, body.dark) .nav-item { color: #8fa3ba; font-size: 13px; font-weight: 500; border-radius: 12px; }
    :is(.dark, body.dark) .nav-item.active { background: #0b2b48; color: #38e1cf; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    :is(.dark, body.dark) .nav-item.active .nav-icon { color: #38e1cf; }
    :is(.dark, body.dark) .nav-item:hover { background: #0d2238; color: #eaf4ff; }
    :is(.dark, body.dark) .nav-divider { background: #17293b; }
    :is(.dark, body.dark) .privacy-mini { background: linear-gradient(145deg, #071929, #08222d); border-color: rgba(45, 212, 191, 0.2); }
    :is(.dark, body.dark) .search,
    :is(.dark, body.dark) .secondary,
    :is(.dark, body.dark) .select,
    :is(.dark, body.dark) .theme-toggle { background: #0d1b2b; color: #c9d6e5; border-color: #21384e; }
    :is(.dark, body.dark) .theme-toggle button.active { background: #0b2b48; color: #38e1cf; }
    :is(.dark, body.dark) .search input { color: #eaf4ff; }
    :is(.dark, body.dark) .live { background: #092620; border-color: #15574d; }
    :is(.dark, body.dark) .profile { border-color: #203347; }
    :is(.dark, body.dark) .hero {
      background: linear-gradient(90deg,#0d1828 0%,#0d1e2d 55%,#12343a 100%);
      border-color: #1d394b;
    }
    :is(.dark, body.dark) .hero p { color: #8ea4ba; }
    :is(.dark, body.dark) .privacy-badge { background: rgba(10,27,39,.88); border-color: #244653; }
    :is(.dark, body.dark) .privacy-badge p { color: #8ea4ba; }
    :is(.dark, body.dark) .card,
    :is(.dark, body.dark) .stat { background: #0d1828; border-color: #1b3046; }
    :is(.dark, body.dark) th { color: #71869f; border-color: #1b3046; }
    :is(.dark, body.dark) td { color: #a9b9cb; border-color: #182b40; }
    :is(.dark, body.dark) td:first-child { color: #dbe9f7; }
    :is(.dark, body.dark) .model-row { border-color: #192c40; }
    :is(.dark, body.dark) .chain-stat { border-color: #1b3046; }
    :is(.dark, body.dark) .explorer { background: #0d2134; border-color: #24435b; }
    :is(.dark, body.dark) .footer { color: #71869b; }

    /* RESPONSIVE */
    @media (max-width: 1250px) {
      .stats { grid-template-columns: repeat(3, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
      .right-stack { display: grid; grid-template-columns: 1fr 1fr; }
      .blockchain { grid-template-columns: 1fr repeat(4, .6fr); }
      .explorer { grid-column: 1 / -1; }
    }

    @media (max-width: 900px) {
      .app { grid-template-columns: 72px 1fr; }
      .sidebar { width: 72px; }
      .brand { padding: 18px 16px; }
      .brand > div:not(.brand-icon) { display: none; }
      .nav-label, .nav-item span:not(.nav-icon), .privacy-mini { display: none; }
      .nav-item { justify-content: center; padding: 0; }
      .main { grid-column: 2; }
      .content { padding: 18px; }
      .topbar { padding: 0 18px; }
      .search { width: 42vw; }
      .privacy-badge { position: relative; right: auto; bottom: auto; margin-left: 20px; }
      .hero { align-items: flex-start; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .bottom-grid { grid-template-columns: 1fr; }
      .right-stack { grid-template-columns: 1fr; }
      .blockchain { grid-template-columns: repeat(2, 1fr); }
      .chain-title { grid-column: 1 / -1; }
    }

    @media (max-width: 620px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { position: static; width: 100%; height: auto; }
      .brand { height: 62px; }
      .brand > div:not(.brand-icon) { display: block; }
      .nav { display: none; }
      .privacy-mini { display: none; }
      .main { grid-column: 1; }
      .topbar { position: static; height: auto; padding: 12px; flex-wrap: wrap; }
      .search { width: 100%; order: 2; }
      .top-actions { width: 100%; margin-left: 0; justify-content: flex-end; }
      .profile { display: none; }
      .content { padding: 12px; }
      .hero { padding: 21px; min-height: 250px; display: block; }
      .privacy-badge { margin: 22px 0 0; width: 100%; }
      .stats { grid-template-columns: 1fr; }
      .chart-wrap { height: 240px; }
      .blockchain { grid-template-columns: 1fr 1fr; }
      .chain-title { grid-column: 1 / -1; }
      .footer { flex-direction: column; gap: 8px; }
    }
  ` }} />
      
  <div className="app">

    <aside className="sidebar">
      <div className="brand" onClick={() => navigate("dashboard")} style={{ cursor: "pointer" }}>
        <div className="brand-icon">⬡</div>
        <div>
          <div className="brand-name">DataVault</div>
          <div className="brand-sub">Privacy-First AI Marketplace</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">Platform</div>

        <button className="nav-item active" onClick={() => navigate("dashboard")}><span className="nav-icon">▦</span><span>Dashboard</span></button>
        <button className="nav-item" onClick={() => navigate("federation")}><span className="nav-icon">♧</span><span>Federation</span></button>
        <button className="nav-item" onClick={() => navigate("models")}><span className="nav-icon">◈</span><span>Models</span></button>
        <button className="nav-item" onClick={() => navigate("organizations")}><span className="nav-icon">▥</span><span>Organizations</span></button>
        <button className="nav-item" onClick={() => navigate("datasets")}><span className="nav-icon">▤</span><span>Datasets</span></button>
        <button className="nav-item" onClick={() => navigate("privacy")}><span className="nav-icon">♢</span><span>Privacy Center</span></button>
        <button className="nav-item" onClick={() => navigate("blockchain")}><span className="nav-icon">⌁</span><span>Blockchain</span></button>
        <button className="nav-item" onClick={() => navigate("rewards")}><span className="nav-icon">◉</span><span>Rewards</span></button>
        <button className="nav-item" onClick={() => navigate("marketplace")}><span className="nav-icon">▱</span><span>Marketplace</span></button>
        <button className="nav-item" onClick={() => navigate("audit")}><span className="nav-icon">▤</span><span>Audit Log</span></button>

        <div className="nav-divider"></div>
        <div className="nav-label">Public</div>
        <button className="nav-item" onClick={() => navigate("about")}><span className="nav-icon">✣</span><span>Architecture &amp; About</span></button>
      </nav>

      <div className="privacy-mini">
        <div className="shield">♢</div>
        <strong>Raw Data Never<br />Leaves the Organization</strong>
        <span>Secure · Private · Federated</span>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <label className="search">
          <span>⌕</span>
          <input placeholder="Search models, datasets, organizations..." />
        </label>

        <div className="top-actions">
          <div className="theme-toggle">
            <button id="lightBtn" onClick={() => setTheme('light')}>☼</button>
            <button id="darkBtn" className="active" onClick={() => setTheme('dark')}>●</button>
          </div>

          <button className="live" onClick={() => navigate("federation")}>Live Federation</button>
          <button className="bell" onClick={() => toast.info("No unread alerts")}>♧<span className="dot"></span></button>

          <div
            className="profile"
            style={{ cursor: "pointer" }}
            title="Click to sign out"
            onClick={async () => {
              await logout();
              toast.success("Signed out");
              navigate("landing");
            }}
          >
            <div className="avatar">{user?.name ? user.name.slice(0, 2).toUpperCase() : "AL"}</div>
            <div>
              <strong>{user?.name || "Alice Rao"} ⌄</strong>
              <small>{user?.role || "ORG_ADMIN"} · {user?.organizationName || "Apollo Demo Hospital"}</small>
            </div>
          </div>
        </div>
      </header>

      <section className="content">

        <section className="hero">
          <div className="hero-copy">
            <h1>Welcome back, {user?.name ? user.name.split(" ")[0] : "Alice"} 👋</h1>
            <p>Train together. Share nothing. Real federated learning on synthetic data.</p>

            <div className="hero-actions">
              <button className="primary" onClick={() => runFederation()}>▷ &nbsp; Run federated round</button>
              <button className="secondary" onClick={() => location.reload()}>⟳ &nbsp; Refresh</button>
            </div>
          </div>

          <div className="privacy-badge">
            <div className="privacy-title">
              <div className="picon">♢</div>
              Privacy Protected
            </div>
            <p>Raw data shared: <b>0 bytes</b> · Secure aggregation enabled</p>
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <div className="stat-icon">♟</div>
            <div><strong>10</strong><span>Organizations</span></div>
          </div>
          <div className="stat">
            <div className="stat-icon">◇</div>
            <div><strong>3</strong><span>Active Models</span></div>
          </div>
          <div className="stat">
            <div className="stat-icon">▱</div>
            <div><strong>16</strong><span>Federation Rounds</span></div>
          </div>
          <div className="stat">
            <div className="stat-icon">ϟ</div>
            <div><strong>48</strong><span>Total Contributions</span></div>
          </div>
          <div className="stat">
            <div className="stat-icon">◉</div>
            <div><strong>16,000 DATA</strong><span>Rewards Distributed</span></div>
          </div>
        </section>

        <section className="dashboard-grid">

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Model Accuracy</div>
                <div className="card-sub">Performance across federation rounds</div>
              </div>
              <select className="select">
                <option>All Models</option>
                <option>Cancer Risk</option>
                <option>Card Fraud</option>
                <option>Crop Yield</option>
              </select>
            </div>
            <div className="chart-wrap">
              <canvas id="accuracyChart"></canvas>
            </div>
          </div>

          <div className="right-stack">

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Models Performance</div>
                  <div className="card-sub">Primary model metrics</div>
                </div>
                <button onClick={() => navigate("models")} style={{ fontSize: "10px", color: "#1877df", textDecoration: "none", background: "none", border: 0, padding: 0, cursor: "pointer" }}>View all →</button>
              </div>

              <div className="models">
                <div className="model-row">
                  <div className="model-icon">♧</div>
                  <div><div className="model-name">Cancer Risk Prediction</div><div className="model-delta">+5.3 vs silo</div></div>
                  <div className="model-value">89.0%</div>
                  <canvas className="spark" data-values="74,79,77,83,81,89"></canvas>
                </div>
                <div className="model-row">
                  <div className="model-icon">♢</div>
                  <div><div className="model-name">Card Fraud Detection</div><div className="model-delta">+0.7 vs silo</div></div>
                  <div className="model-value">91.5%</div>
                  <canvas className="spark" data-values="83,87,86,89,90,91.5"></canvas>
                </div>
                <div className="model-row">
                  <div className="model-icon">✣</div>
                  <div><div className="model-name">Crop Yield Prediction</div><div className="model-delta">+3.9 vs silo</div></div>
                  <div className="model-value">R² 0.692</div>
                  <canvas className="spark" data-values="35,44,48,55,62,69"></canvas>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Recent Federation Rounds</div>
                  <div className="card-sub">Latest protected training runs</div>
                </div>
                <button onClick={() => navigate("federation")} style={{ fontSize: "10px", color: "#1877df", textDecoration: "none", background: "none", border: 0, padding: 0, cursor: "pointer" }}>View all →</button>
              </div>

              <div className="rounds">
                <table>
                  <thead>
                    <tr><th>#</th><th>Model</th><th>Result</th><th>Δ</th><th>Updates</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>#5</td><td>Crop Yield</td><td>R² .692</td><td style={{ color: "#0a9a79" }}>+.14</td><td>3 masked</td><td><span className="status">Completed</span></td></tr>
                    <tr><td>#4</td><td>Crop Yield</td><td>R² .691</td><td style={{ color: "#0a9a79" }}>+.21</td><td>3 masked</td><td><span className="status">Completed</span></td></tr>
                    <tr><td>#3</td><td>Crop Yield</td><td>R² .689</td><td style={{ color: "#0a9a79" }}>+.30</td><td>3 masked</td><td><span className="status">Completed</span></td></tr>
                    <tr><td>#2</td><td>Card Fraud</td><td>91.5%</td><td style={{ color: "#0a9a79" }}>+.74</td><td>3 masked</td><td><span className="status">Completed</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>

        <section className="bottom-grid">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Organization Contributions</div>
                <div className="card-sub">Lifetime contribution scores</div>
              </div>
              <select className="select"><option>All Organizations</option></select>
            </div>
            <div className="small-chart"><canvas id="orgChart"></canvas></div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Network Activity</div>
                <div className="card-sub">Rounds &amp; protected updates per day</div>
              </div>
              <select className="select"><option>Last 14 Days</option></select>
            </div>
            <div className="small-chart"><canvas id="activityChart"></canvas></div>
          </div>
        </section>

        <section className="card blockchain">
          <div className="chain-title">
            <div className="chain-icon">◇</div>
            <div>
              <strong>Local Blockchain Network</strong>
              <span>Chain: Local Test Network · 31337</span>
            </div>
          </div>
          <div className="chain-stat"><strong>19</strong><span>Blocks</span></div>
          <div className="chain-stat"><strong>105</strong><span>Transactions</span></div>
          <div className="chain-stat"><strong>3</strong><span>Listings</span></div>
          <div className="chain-stat"><strong>9</strong><span>Participants</span></div>
          <button className="explorer" onClick={() => navigate("blockchain")}>Open explorer ↗</button>
        </section>

        <footer className="footer">
          <span>© 2026 DataVault — Train Together. Share Nothing.</span>
          <span>Research / hackathon demonstration. Synthetic data only.</span>
        </footer>

      </section>
    </main>
  </div>

  
    </div>
  );
}
