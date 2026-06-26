import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    "rei.com": "E-commerce",
    "highsnobiety.com": "Newspaper",
}

changed = []
for domain, siteType in additions.items():
    if domain not in data:
        data[domain] = siteType
        changed.append(f"  added {domain} → {siteType}")
    elif data[domain] != siteType:
        data[domain] = siteType
        changed.append(f"  updated {domain} → {siteType}")
    else:
        changed.append(f"  already correct: {domain} → {siteType}")

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('exact.json patched:')
for line in changed:
    print(line)
print('Done!')
