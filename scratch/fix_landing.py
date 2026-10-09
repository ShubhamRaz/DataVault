import re

target_path = r"c:\Users\SHUBHAM RAJ\Desktop\Others\DataVault\src\components\datavault\views\landing.tsx"

with open(target_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix onClick handlers in JSX
content = re.sub(r'onClick="([^"]+)"', lambda m: f"onClick={{() => {m.group(1).replace('launchDemo()', 'launchDemo()').replace('theme(', 'theme(')}}}", content)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed onClick handlers.")
