import re
import os

html_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\Gurjot\DataVault_Public_Landing_index.html"
target_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\src\components\datavault\views\landing.tsx"

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
styles = style_match.group(1) if style_match else ""

# Extract body contents (inside <body>)
body_match = re.search(r'<body>(.*?)<script>', html, re.DOTALL)
body = body_match.group(1) if body_match else ""

# Basic JSX conversions
body = body.replace('class=', 'className=')
body = body.replace('onclick=', 'onClick=')
body = body.replace('for=', 'htmlFor=')
body = body.replace('style="display:inline-flex;align-items:center;margin-top:22px"', 'style={{ display: "inline-flex", alignItems: "center", marginTop: "22px" }}')
body = body.replace('style="font-size:12px;margin-top:0"', 'style={{ fontSize: "12px", marginTop: "0" }}')
body = body.replace('style="color:#12264b"', 'style={{ color: "#12264b" }}')
body = body.replace('style="justify-content:center"', 'style={{ justifyContent: "center" }}')

# Fix image tags and br tags (make self-closing)
body = re.sub(r'<img([^>]*[^/])>', r'<img\1 />', body)
body = re.sub(r'<br>', r'<br />', body)
body = re.sub(r'<hr>', r'<hr />', body)

# the theme function
# The user's app uses useAppStore() maybe?
# But we can just use local state or effect for theme

component_code = f"""
"use client";
import React, {{ useEffect }} from "react";
import {{ navigate }} from "@/lib/client/router";

export function LandingView() {{
  useEffect(() => {{
    const saved = localStorage.getItem("dv-theme");
    if (saved === "dark") {{
      theme("dark");
    }}
  }}, []);

  const theme = (mode: string) => {{
    if (mode === "dark") {{
      document.body.classList.add("dark");
      document.getElementById("light")?.classList.remove("active");
      document.getElementById("dark")?.classList.add("active");
    }} else {{
      document.body.classList.remove("dark");
      document.getElementById("light")?.classList.add("active");
      document.getElementById("dark")?.classList.remove("active");
    }}
    localStorage.setItem("dv-theme", mode);
  }};

  const launchDemo = () => {{
    navigate("login");
  }};

  return (
    <div className="dv-landing-wrapper">
      <style dangerouslySetInnerHTML={{{{ __html: `{styles}` }}}} />
      {body}
    </div>
  );
}}
"""

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(component_code)

print("Landing page converted and saved.")
