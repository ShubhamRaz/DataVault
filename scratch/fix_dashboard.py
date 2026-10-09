import re

target_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\src\components\datavault\views\dashboard.tsx"
html_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\Gurjot\DataVault_Dashboard_index.html"

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract script contents properly
script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
script_code = script_match.group(1) if script_match else ""

# Just remove the DOMContentLoaded wrapper since we run it in useEffect
script_code = re.sub(r'document\.addEventListener\("DOMContentLoaded", \(\) => \{', '', script_code)
# Remove the last });
script_code = script_code.rsplit('});', 1)[0] + script_code.rsplit('});', 1)[1]

# Now let's inject this fixed script code back into dashboard.tsx
with open(target_path, 'r', encoding='utf-8') as f:
    dashboard_code = f.read()

dashboard_code = re.sub(r'const initDashboard = \(\) => \{.*?\};.*?\}, \[\]\);', lambda m: f"""const initDashboard = () => {{
{script_code}
}};
}}, []);""", dashboard_code, flags=re.DOTALL)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(dashboard_code)

print("Dashboard script fixed.")
