import re

html_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\Gurjot\DataVault_Dashboard_index.html"
target_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\src\components\datavault\views\dashboard.tsx"

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
styles = style_match.group(1) if style_match else ""

# Extract body contents (inside <body> but not script)
body_match = re.search(r'<body>(.*?)<script>', html, re.DOTALL)
body = body_match.group(1) if body_match else ""

# Extract script contents (inside <script> before </body>)
script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
script_code = script_match.group(1) if script_match else ""

# Basic JSX conversions
body = body.replace('class=', 'className=')
body = body.replace('onclick=', 'onClick=')
body = body.replace('for=', 'htmlFor=')
body = body.replace('style="font-size:10px;color:#1877df;text-decoration:none"', 'style={{ fontSize: "10px", color: "#1877df", textDecoration: "none" }}')
body = body.replace('style="color:#0a9a79"', 'style={{ color: "#0a9a79" }}')

# Fix onClick handlers in JSX
body = re.sub(r'onClick="([^"]+)"', lambda m: f"onClick={{() => {m.group(1)}}}", body)

# Fix image tags, input tags, hr tags, br tags (make self-closing)
body = re.sub(r'<img([^>]*[^/])>', r'<img\1 />', body)
body = re.sub(r'<input([^>]*[^/])>', r'<input\1 />', body)
body = re.sub(r'<br>', r'<br />', body)
body = re.sub(r'<hr>', r'<hr />', body)

# Clean up script code to put inside useEffect
# Remove document.addEventListener("DOMContentLoaded", ...)
# and just extract the function calls
script_code = script_code.replace('document.addEventListener("DOMContentLoaded", () => {', 'setTimeout(() => {')
script_code = script_code.replace('});', '}, 100);')

component_code = f"""
"use client";
import React, {{ useEffect }} from "react";
import {{ navigate }} from "@/lib/client/router";

export function DashboardView() {{
  useEffect(() => {{
    // Load Chart.js from CDN if not already present
    const loadChartJs = () => {{
      if (typeof window !== "undefined" && !(window as any).Chart) {{
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
        script.onload = () => initDashboard();
        document.head.appendChild(script);
      }} else {{
        initDashboard();
      }}
    }};

    loadChartJs();

    const initDashboard = () => {{
      {script_code}
    }};
  }}, []);

  const setTheme = (mode: string) => {{
    document.body.classList.toggle("dark", mode === "dark");
    document.getElementById("lightBtn")?.classList.toggle("active", mode === "light");
    document.getElementById("darkBtn")?.classList.toggle("active", mode === "dark");
    localStorage.setItem("datavault-theme", mode);
  }};

  const runFederation = () => {{
    const button = document.querySelector(".primary");
    if (!button) return;
    const old = button.innerHTML;
    button.innerHTML = "⟳ &nbsp; Running federation...";
    (button as HTMLButtonElement).disabled = true;
    setTimeout(() => {{
      button.innerHTML = "✓ &nbsp; Federation round completed";
      setTimeout(() => {{
        button.innerHTML = old;
        (button as HTMLButtonElement).disabled = false;
      }}, 1600);
    }}, 1400);
  }};

  return (
    <div className="dv-dashboard-wrapper">
      <style dangerouslySetInnerHTML={{{{ __html: `{styles}` }}}} />
      {body}
    </div>
  );
}}
"""

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(component_code)

print("Dashboard page converted and saved.")
