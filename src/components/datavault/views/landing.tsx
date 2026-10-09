"use client";
import React, { useEffect } from "react";
import { navigate } from "@/lib/client/router";
import { useAppStore } from "@/lib/client/store";

export function LandingView() {
  const { theme, setTheme } = useAppStore();

  const launchDemo = () => {
    navigate("login");
  };

  return (
    <div className="dv-landing-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
:root {
  --navy: #07152f;
  --navy2: #0b2142;
  --ink: #0c1738;
  --muted: #64748b;
  --line: #dce8f2;
  --soft: #f7faff;
  --white: #fff;
  --cyan: #10bfa8;
  --teal: #16c6a3;
  --green: #20b985;
  --blue: #2e7cf6;
  --orange: #f3a51b;
  --shadow: 0 14px 40px rgba(15,47,79,.08);
  --radius: 18px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--ink);
  background: #ffffff;
}
a { text-decoration: none; color: inherit; }
button { font: inherit; cursor: pointer; }
.container { width: min(1180px, calc(100% - 40px)); margin: auto; }

/* NAVBAR */
.navbar {
  position: sticky; top: 0; z-index: 100;
  height: 74px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(220, 232, 242, 0.9);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.nav-inner { height: 100%; display: flex; align-items: center; gap: 34px; }
.logo { display: flex; align-items: center; gap: 10px; min-width: 220px; }
.logo-mark {
  width: 38px; height: 38px; border-radius: 11px;
  display: grid; place-items: center; color: #fff; font-weight: 900;
  background: linear-gradient(145deg, #12d2bb, #159bdc);
  box-shadow: 0 9px 22px rgba(19, 189, 221, 0.24);
}
.logo strong { font-size: 19px; display: block; line-height: 1; color: #0c1738; }
.logo small { display: block; color: #72839a; font-size: 9px; letter-spacing: .08em; margin-top: 5px; }
.nav-links { display: flex; align-items: center; gap: 27px; font-size: 12px; color: #51627b; }
.nav-links a:hover { color: #078e8d; }
.nav-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.mode {
  height: 34px; padding: 3px; border: 1px solid var(--line);
  border-radius: 20px; background: #f4f8fc; display: flex; gap: 2px;
}
.mode button { width: 30px; height: 26px; border: 0; border-radius: 14px; background: transparent; color: #607188; font-size: 13px; }
.mode button.active { background: #087f78; color: #fff; font-weight: bold; }
.signin { border: 1px solid #cbdbe8; border-radius: 9px; padding: 9px 15px; color: #0c1738; font-weight: 700; font-size: 12px; background: #fff; }
.demo { border: 0; border-radius: 9px; padding: 10px 17px; color: #fff; font-weight: 800; font-size: 12px; background: linear-gradient(135deg, #08b7d5, #10c9b0); box-shadow: 0 8px 22px rgba(14, 190, 193, 0.24); }
.mobile-menu { display: none; border: 0; background: none; font-size: 22px; }

/* HERO */
.hero {
  position: relative; overflow: hidden;
  background:
    radial-gradient(circle at 80% 30%, rgba(21, 190, 218, 0.16), transparent 30%),
    radial-gradient(circle at 55% 100%, rgba(26, 198, 163, 0.10), transparent 30%),
    linear-gradient(105deg, #ffffff 0%, #f5fbff 47%, #eaf8fb 100%);
  border-bottom: 1px solid #e2edf4;
}
.hero-grid {
  min-height: 560px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: center;
}
.badge {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid #bfe8ee; background: #effcfd; color: #078b8e;
  border-radius: 30px; padding: 8px 13px; font-size: 11px; font-weight: 800;
}
.badge i { width: 7px; height: 7px; background: #14c8a5; border-radius: 50%; }
.hero h1 {
  margin: 19px 0 13px;
  font-size: clamp(43px, 5.4vw, 72px);
  line-height: .98; letter-spacing: -.055em;
  color: #0c1738;
}
.hero h1 span {
  background: linear-gradient(90deg, #0bbbd4, #12c7a5);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p { max-width: 620px; color: #51627b; font-size: 15px; line-height: 1.75; margin: 0; }
.hero-buttons { display: flex; gap: 11px; margin-top: 25px; flex-wrap: wrap; }
.btn-primary, .btn-outline {
  height: 45px; padding: 0 18px; border-radius: 10px; font-size: 12px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-primary {
  border: 0; color: #fff;
  background: linear-gradient(135deg, #08b7d5, #10c9b0);
  box-shadow: 0 10px 25px rgba(16, 191, 168, 0.28);
}
.btn-outline {
  border: 1px solid #bdd2e2; background: #fff; color: #12345b;
  box-shadow: 0 4px 12px rgba(18, 45, 75, 0.04);
}
.btn-outline:hover { background: #f0fbf9; border-color: #10bfa8; color: #078b79; }
.hero-note { font-size: 10px; color: #7890a8; margin-top: 18px; }

/* NETWORK VISUAL */
.network {
  min-height: 410px; position: relative; display: grid; place-items: center;
}
.glow {
  position: absolute; width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(18, 196, 210, 0.23), transparent 67%);
  filter: blur(5px);
}
.globe {
  position: relative; width: 225px; height: 225px; border-radius: 50%;
  background:
    radial-gradient(circle at 34% 29%, #8ff7ee 0 2%, transparent 3%),
    radial-gradient(circle at 70% 60%, #2bcbd5 0 1.5%, transparent 2%),
    radial-gradient(circle, #0a3155, #07152f 68%, #061021);
  border: 1px solid rgba(40, 222, 220, 0.65);
  box-shadow: 0 0 55px rgba(15, 206, 211, 0.28), inset 0 0 40px rgba(22, 204, 190, 0.16);
}
.globe:before, .globe:after {
  content: ""; position: absolute; inset: 17px; border: 1px solid rgba(74, 226, 223, 0.32); border-radius: 50%;
}
.globe:after { transform: rotate(60deg) scaleX(.48); }
.shield { position: absolute; inset: 0; display: grid; place-items: center; font-size: 56px; color: #48e6d3; text-shadow: 0 0 25px rgba(72, 230, 211, 0.5); }
.global {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  background: #ffffff; color: #0c1738; border: 1px solid #1bbfca; border-radius: 12px;
  padding: 10px 19px; text-align: center; box-shadow: 0 10px 30px rgba(4, 29, 55, 0.12);
}
.global small { display: block; color: #64748b; font-size: 9px; font-weight: 600; }
.global b { font-size: 19px; color: #087f78; }
.org {
  position: absolute; width: 150px; padding: 10px 12px; border-radius: 11px;
  background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(22, 198, 163, 0.45);
  color: #0c1738; font-size: 10px; box-shadow: 0 10px 25px rgba(0, 30, 50, 0.08);
}
.org b { display: block; font-size: 11px; color: #0c1738; }
.org span { color: #087f78; font-size: 8px; font-weight: 600; }
.org.aiims { left: 3%; top: 21%; }
.org.apollo { right: 3%; top: 20%; }
.org.deccan { left: 4%; bottom: 19%; }
.org.hdfc { right: 4%; bottom: 18%; }
.connector { position: absolute; height: 1px; background: linear-gradient(90deg, transparent, #1bcfd2, transparent); width: 145px; }
.c1 { left: 24%; top: 37%; transform: rotate(-19deg); }
.c2 { right: 24%; top: 37%; transform: rotate(19deg); }
.c3 { left: 24%; bottom: 37%; transform: rotate(19deg); }
.c4 { right: 24%; bottom: 37%; transform: rotate(-19deg); }
.chain-proof {
  position: absolute; bottom: 17px; left: 50%; transform: translateX(-50%);
  white-space: nowrap; padding: 9px 15px; border: 1px solid #20c5c1;
  border-radius: 25px; background: rgba(255, 255, 255, 0.95); color: #087f78; font-size: 9px; font-weight: 700;
  box-shadow: 0 10px 25px rgba(0, 30, 50, 0.08);
}

/* STATS */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 22px 0; }
.stat {
  background: #ffffff; border: 1px solid var(--line); border-radius: 14px; padding: 18px;
  display: flex; align-items: center; gap: 13px; box-shadow: 0 8px 25px rgba(30, 65, 90, 0.05);
}
.stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: #e8f3ff; color: #2679e8; font-size: 16px; }
.stat:nth-child(2) .stat-icon { background: #e4fbf5; color: #0b9d80; }
.stat:nth-child(3) .stat-icon { background: #eef0ff; color: #6c54db; }
.stat:nth-child(4) .stat-icon { background: #fff2d9; color: #d88900; }
.stat b { font-size: 21px; display: block; color: #0c1738; }
.stat span { font-size: 10px; color: var(--muted); display: block; margin-top: 3px; font-weight: 500; }

/* SECTIONS */
section.block { padding: 86px 0; }
.eyebrow { color: #0a9b91; font-size: 10px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
.section-title { font-size: clamp(29px, 3.3vw, 44px); letter-spacing: -.04em; margin: 8px 0 13px; line-height: 1.05; color: #0c1738; }
.section-title span { color: #0ab79f; }
.section-desc { color: #51627b; font-size: 13px; line-height: 1.7; max-width: 650px; }

/* PROBLEM */
.problem { background: #ffffff; }
.problem-grid { display: grid; grid-template-columns: .85fr 1.45fr; gap: 45px; align-items: start; }
.problem-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px; }
.info-card { border: 1px solid var(--line); border-radius: 14px; padding: 18px; background: #ffffff; transition: .2s; }
.info-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: #bfe8ee; }
.info-icon { width: 35px; height: 35px; border-radius: 10px; background: #eef7ff; color: #2078e7; display: grid; place-items: center; margin-bottom: 11px; }
.info-card:nth-child(2) .info-icon { background: #e8fbf6; color: #0b9d80; }
.info-card:nth-child(3) .info-icon { background: #fff4e5; color: #d88900; }
.info-card:nth-child(4) .info-icon { background: #f2eefa; color: #7c3aed; }
.info-card:nth-child(5) .info-icon { background: #e0f2fe; color: #0284c7; }
.info-card:nth-child(6) .info-icon { background: #fee2e2; color: #dc2626; }
.info-card b { font-size: 13px; display: block; color: #0c1738; }
.info-card p { font-size: 11px; color: #64748b; line-height: 1.55; margin: 6px 0 0; }

/* HOW */
.dark-section {
  color: #0c1738;
  background: linear-gradient(135deg, #effdfa, #f5fbff);
  border-top: 1px solid #dce8f2;
  border-bottom: 1px solid #dce8f2;
}
.dark-section .section-title { color: #0c1738; }
.dark-section .section-desc { color: #51627b; }
.steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 32px; }
.step {
  position: relative; padding: 20px 15px; border: 1px solid #cdece7; border-radius: 13px;
  background: #ffffff; box-shadow: 0 4px 15px rgba(18, 45, 75, 0.04);
}
.step:not(:last-child):after { content: "→"; position: absolute; right: -12px; top: 50%; color: #10bfa8; font-size: 18px; z-index: 2; font-weight: bold; }
.step-num { font-size: 10px; color: #087f78; font-weight: 900; }
.step-icon { font-size: 24px; margin: 15px 0 10px; }
.step b { font-size: 12px; display: block; color: #0c1738; }
.step p { font-size: 9.5px; line-height: 1.55; color: #64748b; margin: 4px 0 0; }

/* ARCHITECTURE */
.arch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; }
.arch-card { border: 1px solid var(--line); border-radius: 16px; padding: 22px; background: #ffffff; box-shadow: 0 8px 25px rgba(24, 62, 88, 0.04); }
.arch-card h3 { font-size: 15px; margin: 10px 0 7px; color: #0c1738; }
.arch-card p { font-size: 11px; line-height: 1.55; color: #64748b; }
.arch-list { list-style: none; padding: 0; margin: 14px 0 0; }
.arch-list li { font-size: 10.5px; color: #51627b; padding: 7px 0; border-top: 1px solid #edf2f6; }
.arch-list li:before { content: "✓"; color: #0aa789; font-weight: 900; margin-right: 7px; }
.arch-tag { display: inline-block; padding: 6px 8px; border-radius: 8px; background: #edf9f7; color: #078a77; font-size: 9px; font-weight: 800; }

/* USE CASES */
.usecases { background: #f6fbfe; }
.use-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 30px; }
.use-card { background: #ffffff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(24, 62, 88, 0.05); }
.use-img { height: 135px; display: grid; place-items: center; background: linear-gradient(135deg, #d9eef8, #e6fbf4); font-size: 55px; }
.use-body { padding: 18px; }
.use-label { font-size: 9px; color: #0a9c90; font-weight: 850; text-transform: uppercase; }
.use-body h3 { font-size: 15px; margin: 7px 0; color: #0c1738; }
.use-body p { font-size: 11px; line-height: 1.6; color: #64748b; margin-bottom: 12px; }
.metric { font-size: 16px; color: #079a7d; font-weight: 850; }
.metric small { font-size: 10px; color: #64748b; font-weight: 500; }

/* SECURITY */
.security-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
.check-list { margin: 23px 0 0; padding: 0; list-style: none; }
.check-list li { padding: 9px 0; font-size: 12px; color: #51627b; border-bottom: 1px solid #edf2f6; }
.check-list b { color: #0c1738; font-weight: 700; }
.live-panel { border-radius: 18px; padding: 21px; background: linear-gradient(145deg, #f0fdf9, #f7faff); border: 1px solid #cdece7; color: #0c1738; box-shadow: 0 15px 40px rgba(18, 45, 75, 0.06); }
.live-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.live-head b { font-size: 15px; color: #0c1738; }
.live-pill { font-size: 9px; background: #d8f8ef; color: #078b79; border-radius: 20px; padding: 6px 10px; font-weight: 800; }
.live-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.live-stat { border: 1px solid var(--line); background: #ffffff; border-radius: 10px; padding: 12px; box-shadow: 0 4px 12px rgba(18, 45, 75, 0.03); }
.live-stat span { display: block; color: #64748b; font-size: 10px; font-weight: 500; }
.live-stat b { display: block; color: #087f78; font-size: 14px; margin-top: 5px; }

/* MARKETPLACE */
.market { background: #ffffff; color: #0c1738; border-top: 1px solid #dce8f2; border-bottom: 1px solid #dce8f2; }
.market .section-title { color: #0c1738; }
.market .section-desc { color: #51627b; }
.market-grid { display: grid; grid-template-columns: 1fr 1fr .8fr; gap: 13px; margin-top: 30px; }
.market-card { padding: 20px; border-radius: 15px; background: #f7faff; border: 1px solid #dce8f2; }
.market-card.bad { border-color: #fca5a5; background: #fef2f2; }
.market-card.good { border-color: #99f6e4; background: #f0fdf9; }
.market-card h3 { font-size: 13px; color: #0c1738; }
.market-card .quote { font-size: 18px; font-weight: 800; margin: 12px 0; }
.bad .quote { color: #dc2626; }
.good .quote { color: #087f78; }
.market-card p { font-size: 11px; line-height: 1.6; color: #51627b; }
.rewards { padding: 20px; border: 1px solid #dce8f2; border-radius: 15px; background: #f7faff; }
.reward-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e5edf5; font-size: 11px; color: #51627b; }
.reward-row b { color: #087f78; font-family: monospace; font-size: 12px; }

/* CTA */
.cta {
  position: relative; overflow: hidden; text-align: center; color: #fff;
  padding: 90px 20px;
  background: linear-gradient(135deg, #099485, #087f78);
  box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.08);
}
.cta h2 { font-size: clamp(34px, 4vw, 52px); margin: 0 0 12px; letter-spacing: -.04em; color: #fff; }
.cta p { color: #e0fbf4; font-size: 14px; max-width: 600px; margin: 0 auto 24px; line-height: 1.65; }
.cta .demo { background: #ffffff; color: #087f78; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); }
.cta .btn-outline { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.45); color: #ffffff; }

/* FOOTER */
footer { border-top: 1px solid var(--line); padding: 25px 0; background: #ffffff; }
.footer-inner { display: flex; justify-content: space-between; align-items: center; color: #73839a; font-size: 10px; }
.footer-links { display: flex; gap: 20px; }

/* DARK MODE OVERRIDES */
html.dark body, body.dark {
  background: #07101d;
  color: #eaf5ff;
  --line: #1b3348;
  --muted: #91a5bb;
}
html.dark .navbar, body.dark .navbar, html.dark footer, body.dark footer {
  background: rgba(7, 16, 29, 0.95);
  border-color: #183047;
}
html.dark .logo strong, body.dark .logo strong { color: #ffffff; }
html.dark .nav-links, body.dark .nav-links { color: #91a5bb; }
html.dark .nav-links a:hover, body.dark .nav-links a:hover { color: #38e1cf; }
html.dark .mode, body.dark .mode { background: #0c1d30; border-color: #1b3348; }
html.dark .mode button, body.dark .mode button { color: #8fa3ba; }
html.dark .mode button.active, body.dark .mode button.active { background: #0b2b48; color: #38e1cf; }
html.dark .signin, body.dark .signin { color: #eaf5ff; border-color: #284258; background: #0c1d30; }
html.dark .hero, body.dark .hero {
  background: radial-gradient(circle at 80% 30%, rgba(21, 190, 218, 0.18), transparent 30%), linear-gradient(105deg, #07101d, #0b2035);
  border-color: #183047;
}
html.dark .hero h1, body.dark .hero h1 { color: #ffffff; }
html.dark .hero p, body.dark .hero p, html.dark .section-desc, body.dark .section-desc { color: #91a5bb; }
html.dark .btn-outline, body.dark .btn-outline {
  background: #0c1d30; color: #eaf5ff; border-color: #284258;
}
html.dark .btn-outline:hover, body.dark .btn-outline:hover {
  background: #10263e; border-color: #38e1cf; color: #38e1cf;
}
html.dark .stat, body.dark .stat,
html.dark .info-card, body.dark .info-card,
html.dark .arch-card, body.dark .arch-card,
html.dark .use-card, body.dark .use-card {
  background: #0d1b2b; border-color: #1b3348;
}
html.dark .stat b, body.dark .stat b,
html.dark .section-title, body.dark .section-title,
html.dark .info-card b, body.dark .info-card b,
html.dark .arch-card h3, body.dark .arch-card h3,
html.dark .use-body h3, body.dark .use-body h3,
html.dark .live-head b, body.dark .live-head b {
  color: #ffffff;
}
html.dark .info-card p, body.dark .info-card p,
html.dark .arch-card p, body.dark .arch-card p,
html.dark .use-body p, body.dark .use-body p,
html.dark .arch-list li, body.dark .arch-list li {
  color: #8ea4ba;
}
html.dark .arch-list li, body.dark .arch-list li { border-top-color: #1b3348; }
html.dark .problem, body.dark .problem,
html.dark .usecases, body.dark .usecases {
  background: #081321;
}
html.dark .dark-section, body.dark .dark-section {
  color: #fff;
  background:
    radial-gradient(circle at 70% 20%, rgba(11, 184, 205, 0.15), transparent 35%),
    linear-gradient(135deg, #07152f, #091f3d);
  border-color: #1c4961;
}
html.dark .dark-section .section-title, body.dark .dark-section .section-title { color: #fff; }
html.dark .dark-section .section-desc, body.dark .dark-section .section-desc { color: #a6bdd0; }
html.dark .step, body.dark .step {
  border-color: #1c4961; background: rgba(9, 37, 65, 0.72);
}
html.dark .step b, body.dark .step b { color: #ffffff; }
html.dark .step p, body.dark .step p { color: #91abc0; }
html.dark .step:not(:last-child):after, body.dark .step:not(:last-child):after { color: #1cd5c8; }
html.dark .check-list li, body.dark .check-list li { color: #92a7bb; border-color: #1a3043; }
html.dark .check-list b, body.dark .check-list b { color: #e5f2ff; }
html.dark .live-panel, body.dark .live-panel {
  background: #07182e; border-color: #1c3a50; color: #fff;
}
html.dark .live-stat, body.dark .live-stat {
  border-color: #1c3a50; background: #0a2039;
}
html.dark .live-stat span, body.dark .live-stat span { color: #8ca7bb; }
html.dark .live-stat b, body.dark .live-stat b { color: #40d9c1; }
html.dark .market, body.dark .market {
  background: #07152f; border-color: #183047; color: #fff;
}
html.dark .market .section-title, body.dark .market .section-title { color: #fff; }
html.dark .market .section-desc, body.dark .market .section-desc { color: #9cb5c9; }
html.dark .market-card, body.dark .market-card {
  background: #0b2340; border-color: #1a4860; color: #fff;
}
html.dark .market-card h3, body.dark .market-card h3 { color: #fff; }
html.dark .market-card p, body.dark .market-card p { color: #9db5c7; }
html.dark .rewards, body.dark .rewards {
  background: #0b2340; border-color: #1a4860; color: #fff;
}
html.dark .rewards h3, body.dark .rewards h3 { color: #fff; }
html.dark .reward-row, body.dark .reward-row {
  border-bottom-color: #17394e; color: #9db5c7;
}
html.dark .reward-row b, body.dark .reward-row b { color: #40dbc3; }
html.dark .cta, body.dark .cta {
  background:
    radial-gradient(circle at 70% 50%, rgba(13, 200, 210, 0.22), transparent 28%),
    linear-gradient(135deg, #07152f, #0a2947);
}
html.dark .cta .btn-outline, body.dark .cta .btn-outline {
  background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.3); color: #fff;
}
html.dark .global, body.dark .global {
  background: #092442; color: #fff; border-color: #1bbfca;
}
html.dark .global small, body.dark .global small { color: #8eb2c7; }
html.dark .global b, body.dark .global b { color: #43e2cf; }
html.dark .org, body.dark .org {
  background: rgba(7, 27, 50, 0.92); border-color: rgba(28, 202, 211, 0.55); color: #fff;
}
html.dark .org b, body.dark .org b { color: #fff; }
html.dark .org span, body.dark .org span { color: #75cfd0; }
html.dark .chain-proof, body.dark .chain-proof {
  background: rgba(6, 28, 49, 0.93); border-color: #20c5c1; color: #b9e8e6;
}
html.dark footer, body.dark footer { color: #7890a5; }

/* RESPONSIVE */
@media(max-width: 1000px) {
  .nav-links { display: none; }
  .mobile-menu { display: block; margin-left: auto; }
  .nav-right { margin-left: 0; }
  .logo { min-width: 0; }
  .hero-grid { grid-template-columns: 1fr; min-height: auto; padding: 75px 0 40px; }
  .network { min-height: 390px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .steps { grid-template-columns: repeat(2, 1fr); }
  .step:not(:last-child):after { display: none; }
  .arch-grid, .use-grid { grid-template-columns: 1fr; }
  .problem-grid, .security-grid { grid-template-columns: 1fr; }
  .market-grid { grid-template-columns: 1fr; }
}
@media(max-width: 620px) {
  .container { width: min(100% - 24px, 1180px); }
  .nav-right .mode, .signin { display: none; }
  .hero h1 { font-size: 43px; }
  .hero p { font-size: 13px; }
  .network { transform: scale(.9); margin: -15px; }
  .stats { grid-template-columns: 1fr; }
  section.block { padding: 62px 0; }
  .problem-cards { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr; }
  .live-grid { grid-template-columns: 1fr; }
  .footer-inner { flex-direction: column; gap: 12px; }
}
` }} />
      
      <header className="navbar">
        <div className="container nav-inner">
          <a className="logo" href="#">
            <div className="logo-mark">◇</div>
            <div><strong>DataVault</strong><small>PRIVACY-FIRST AI MARKETPLACE</small></div>
          </a>

          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#architecture">Architecture</a>
            <a href="#usecases">Use cases</a>
            <a href="#marketplace">Marketplace</a>
          </nav>

          <div className="nav-right">
            <div className="mode" role="group" aria-label="Theme switcher">
              <button
                id="light"
                type="button"
                className={theme === "light" ? "active" : ""}
                onClick={() => setTheme("light")}
                title="Light theme"
                aria-label="Light theme"
              >
                ☼
              </button>
              <button
                id="dark"
                type="button"
                className={theme === "dark" ? "active" : ""}
                onClick={() => setTheme("dark")}
                title="Dark theme"
                aria-label="Dark theme"
              >
                ●
              </button>
            </div>
            <button className="signin" onClick={() => navigate("login")}>Sign in</button>
            <button className="demo" onClick={() => launchDemo()}>Launch Demo →</button>
          </div>
          <button className="mobile-menu" aria-label="Toggle navigation">☰</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <div className="badge"><i></i> Raw data never leaves the data owner</div>
              <h1>Train AI together.<br /><span>Keep your data.</span></h1>
              <p>
                DataVault enables organizations to collaboratively build AI models without sharing raw data.
                Federated learning, secure aggregation and blockchain-verified rewards — designed for
                privacy-conscious collaborative AI in India&apos;s data-rich but siloed ecosystem.
              </p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => launchDemo()}>▷ &nbsp; Launch Demo</button>
                <a className="btn-outline" href="#architecture">Explore Architecture</a>
                <a className="btn-outline" href="#how">⌘ &nbsp; View Live Network</a>
              </div>
              <div className="hero-note">Research / Hackathon Demonstration · 100% synthetic demo data</div>
            </div>

            <div className="network">
              <div className="glow"></div>
              <div className="global"><small>GLOBAL MODEL</small><b>83.2%</b></div>
              <div className="globe"><div className="shield">♢</div></div>

              <div className="connector c1"></div><div className="connector c2"></div>
              <div className="connector c3"></div><div className="connector c4"></div>

              <div className="org aiims"><b>AIIMS</b><span>Local data · encrypted Δ</span></div>
              <div className="org apollo"><b>Apollo</b><span>Local data · encrypted Δ</span></div>
              <div className="org deccan"><b>Deccan</b><span>Local data · encrypted Δ</span></div>
              <div className="org hdfc"><b>HDFC</b><span>Local data · encrypted Δ</span></div>

              <div className="chain-proof">◈ On-chain proofs · 19 blocks · 16,000 DATA rewarded</div>
            </div>
          </div>
        </section>

        <section className="container">
          <div className="stats">
            <div className="stat"><div className="stat-icon">♟</div><div><b>10</b><span>Organizations</span></div></div>
            <div className="stat"><div className="stat-icon">▱</div><div><b>16</b><span>Federation Rounds</span></div></div>
            <div className="stat"><div className="stat-icon">◇</div><div><b>48</b><span>Protected Updates</span></div></div>
            <div className="stat"><div className="stat-icon">◉</div><div><b>16,000 DATA</b><span>Rewards Distributed</span></div></div>
          </div>
        </section>

        <section className="block problem" id="problem">
          <div className="container problem-grid">
            <div>
              <div className="eyebrow">The Problem</div>
              <h2 className="section-title">Why <span>data silos</span> matter</h2>
              <p className="section-desc">
                Organizations sit on valuable data but cannot share it — privacy regulations,
                security concerns, competitive sensitivity and data ownership make centralizing
                raw data impossible. The result: every organization trains weaker models alone.
              </p>
              <a className="btn-outline" style={{ display: "inline-flex", alignItems: "center", marginTop: "22px" }} href="#how">Learn more →</a>
            </div>

            <div className="problem-cards">
              <div className="info-card"><div className="info-icon">▣</div><b>Privacy regulations</b><p>DPDP, HIPAA-style and sectoral rules restrict raw data movement.</p></div>
              <div className="info-card"><div className="info-icon">♢</div><b>Security & compliance</b><p>Centralizing sensitive records creates honeypots and breach risks.</p></div>
              <div className="info-card"><div className="info-icon">▥</div><b>Competitive sensitivity</b><p>Customer records and transactions are strategic assets.</p></div>
              <div className="info-card"><div className="info-icon">♙</div><b>Data ownership</b><p>Legal ownership and consent remain with the data controller.</p></div>
              <div className="info-card"><div className="info-icon">▤</div><b>Siloed learning</b><p>Single-organization models can inherit local bias.</p></div>
              <div className="info-card"><div className="info-icon">⚠</div><b>No fair incentives</b><p>Verifiable contribution tracking creates a trust and reward layer.</p></div>
            </div>
          </div>
        </section>

        <section className="block dark-section" id="how">
          <div className="container">
            <div className="eyebrow">How DataVault Works</div>
            <h2 className="section-title">Three privacy layers, one network</h2>
            <p className="section-desc">
              A global model travels to each organization. Only privacy-protected model updates travel back.
              Contributions are proven on-chain and rewarded in DATA tokens.
            </p>

            <div className="steps">
              <div className="step"><div className="step-num">01</div><div className="step-icon">▤</div><b>Local Data</b><p>Raw data stays inside the organization.</p></div>
              <div className="step"><div className="step-num">02</div><div className="step-icon">⚙</div><b>Local Training</b><p>Models train locally on participant data.</p></div>
              <div className="step"><div className="step-num">03</div><div className="step-icon">♢</div><b>Encrypted Updates</b><p>Masked and encrypted model updates travel back.</p></div>
              <div className="step"><div className="step-num">04</div><div className="step-icon">⌘</div><b>Secure Aggregation</b><p>Individual updates are hidden from the aggregator.</p></div>
              <div className="step"><div className="step-num">05</div><div className="step-icon">▥</div><b>Better AI</b><p>The global model improves across the network.</p></div>
            </div>
          </div>
        </section>

        <section className="block" id="architecture">
          <div className="container">
            <div className="eyebrow">Architecture</div>
            <h2 className="section-title">Privacy-preserving by construction</h2>
            <p className="section-desc">End-to-end system design combining federated learning, privacy protection and blockchain incentives.</p>

            <div className="arch-grid">
              <div className="arch-card">
                <span className="arch-tag">DATA OWNER SIDE</span>
                <h3>Organization</h3><p>Local raw data never leaves the participant environment.</p>
                <ul className="arch-list">
                  <li>Local Training (SGD)</li><li>Model Update Δ</li><li>Masking + AES-256-GCM</li><li>Raw data: 0 bytes transferred</li>
                </ul>
              </div>
              <div className="arch-card">
                <span className="arch-tag">PLATFORM SIDE</span>
                <h3>Secure Aggregator</h3><p>Privacy-protected updates are combined to create the next global model.</p>
                <ul className="arch-list">
                  <li>Secure aggregation</li><li>FedAvg → Global Model</li><li>Model registry + hashes</li><li>Contribution scoring</li>
                </ul>
              </div>
              <div className="arch-card">
                <span className="arch-tag">TRUST LAYER</span>
                <h3>Blockchain Ledger</h3><p>Contribution proofs and rewards create an auditable incentive layer.</p>
                <ul className="arch-list">
                  <li>SHA-256 contribution proofs</li><li>1000 DATA reward pool</li><li>Smart contract (EVM)</li><li>Wallets + claim transactions</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="block usecases" id="usecases">
          <div className="container">
            <div className="eyebrow">Use Cases</div>
            <h2 className="section-title">Built for India&apos;s <span>data ecosystem</span></h2>
            <p className="section-desc">Healthcare, banking, agriculture, insurance, research and the public sector — data-rich, siloed, privacy-first.</p>

            <div className="use-grid">
              <article className="use-card">
                <div className="use-img">🏥</div>
                <div className="use-body"><div className="use-label">Healthcare</div><h3>Federated Cancer Prediction</h3><p>Hospitals co-train risk models across synthetic biomarker datasets without moving raw patient records.</p><div className="metric">89.0% <small>accuracy · +5.3 vs silo</small></div></div>
              </article>
              <article className="use-card">
                <div className="use-img">🏦</div>
                <div className="use-body"><div className="use-label">Finance</div><h3>Cross-Bank Fraud Detection</h3><p>Banks detect fraud patterns across institutions without exposing transaction streams.</p><div className="metric">91.5% <small>accuracy · +0.7 vs silo</small></div></div>
              </article>
              <article className="use-card">
                <div className="use-img">🌾</div>
                <div className="use-body"><div className="use-label">Agriculture</div><h3>Crop Yield Prediction</h3><p>Farmer collectives predict yields from soil and weather telemetry with privacy-preserving collaboration.</p><div className="metric">R² 0.69 <small>vs R² 0.65 siloed</small></div></div>
              </article>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="container security-grid">
            <div>
              <div className="eyebrow">Security & Privacy</div>
              <h2 className="section-title">Your raw data remains <span>inside your organization</span></h2>
              <p className="section-desc">DataVault is architected so that exposing raw records is not an option. Privacy controls protect the collaboration layer.</p>
              <ul className="check-list">
                <li><b>Raw Data:</b> NOT SHARED — stays in participant environments</li>
                <li><b>Model Updates:</b> SHARED — privacy-protected only</li>
                <li><b>Secure Aggregation:</b> ENABLED — individual updates hidden</li>
                <li><b>Blockchain Audit:</b> ENABLED — contribution proofs</li>
                <li><b>Access:</b> RBAC + JWT sessions + rate limiting</li>
              </ul>
            </div>

            <div className="live-panel">
              <div className="live-head"><b>Live privacy posture</b><span className="live-pill">● LIVE</span></div>
              <div className="live-grid">
                <div className="live-stat"><span>Raw data shared</span><b>0 bytes</b></div>
                <div className="live-stat"><span>Encryption</span><b>AES-256-GCM</b></div>
                <div className="live-stat"><span>Encrypted updates</span><b>48</b></div>
                <div className="live-stat"><span>Secure aggregation</span><b>Enabled</b></div>
                <div className="live-stat"><span>Data owners</span><b>9+</b></div>
                <div className="live-stat"><span>Blockchain audit</span><b>19 blocks</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="block market" id="marketplace">
          <div className="container">
            <div className="eyebrow">Marketplace & Rewards</div>
            <h2 className="section-title">Collaborate on AI — <span>never sell data</span></h2>
            <p className="section-desc">Federated models, training collaborations and privacy-preserving computation services — with performance and contribution visibility.</p>

            <div className="market-grid">
              <div className="market-card bad">
                <h3>What DataVault IS NOT</h3>
                <div className="quote">“Sell your customer data.”</div>
                <p>No raw datasets are listed, transferable or downloadable. Raw-access attempts are blocked and logged.</p>
              </div>
              <div className="market-card good">
                <h3>What DataVault IS</h3>
                <div className="quote">“Collaborate on AI without transferring raw data.”</div>
                <p>Federated models, privacy-preserving computation and transparent contribution tracking.</p>
              </div>
              <div className="rewards">
                <h3 style={{ fontSize: "13px", marginTop: "0" }}>Top reward claimers</h3>
                <div className="reward-row"><span>AIIMS Demo Center</span><b>2,136 DATA</b></div>
                <div className="reward-row"><span>Apollo Demo Hospital</span><b>2,431 DATA</b></div>
                <div className="reward-row"><span>Deccan Agri Collective</span><b>1,564 DATA</b></div>
                <div className="reward-row"><span>Green Valley Farm</span><b>1,599 DATA</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <div className="eyebrow" style={{ color: "#d9fbf3" }}>DataVault</div>
            <h2>Train Together. Share Nothing.</h2>
            <p>Spin up the demo network, run a federated round and watch privacy-protected updates get aggregated, proven and rewarded — all on synthetic data.</p>
            <div className="hero-buttons" style={{ justifyContent: "center" }}>
              <button className="demo" onClick={() => launchDemo()}>▷ &nbsp; Launch the demo</button>
              <a className="btn-outline" href="#architecture">Read the architecture</a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <div><b style={{ color: "inherit" }}>DataVault</b> · Privacy-First AI Marketplace</div>
          <div className="footer-links"><a href="#how">How it works</a><a href="#architecture">Architecture</a><a href="#usecases">Use cases</a><span>© 2026</span></div>
        </div>
      </footer>
    </div>
  );
}
