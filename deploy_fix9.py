import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    # findinmyzip.com — local business directory ranked by zip, not a small business
    "findinmyzip.com": "Directory",
    # plumbersnearmenwa.com — thin local aggregator page, not SaaS
    "plumbersnearmenwa.com": "Small business",
    # kliniknearme.com.my — Malaysian "top 10" listicle site
    "kliniknearme.com.my": "Blog",
    # gleneagles.com.my — Malaysian hospital chain
    "gleneagles.com.my": "Service",
    # pantai.com.my — Malaysian hospital chain (already correct as Service, but ensure)
    "pantai.com.my": "Service",
}

changed = []
for domain, site_type in additions.items():
    if domain not in data:
        data[domain] = site_type
        changed.append(f"  added {domain} -> {site_type}")
    elif data[domain] != site_type:
        old = data[domain]
        data[domain] = site_type
        changed.append(f"  updated {domain}: {old} -> {site_type}")
    else:
        changed.append(f"  already correct: {domain} -> {site_type}")

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('exact.json patched:')
for line in changed:
    print(line)
print('Done!')
