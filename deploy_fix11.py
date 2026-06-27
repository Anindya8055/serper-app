import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    # Symptoms of diabetes — remaining hospital/health sites misclassified
    "healthdirect.gov.au": "Service",           # Australian government health service
    "dartmouth-hitchcock.org": "Service",        # Dartmouth Health hospital system
    "hackensackmeridianhealth.org": "Service",   # NJ hospital system
    "guthrie.org": "Service",                    # Guthrie health system
    "nguyenmed.com": "Service",                  # medical practice blog

    # Common health systems that may appear for medical keywords
    "ucsfhealth.org": "Service",
    "stanfordhealthcare.org": "Service",
    "mayoclinichealthsystem.org": "Service",
    "dignityhealth.org": "Service",
    "commonspirit.org": "Service",
    "bannerhealth.com": "Service",
    "ssmhealth.com": "Service",
    "mdanderson.org": "Service",
    "cancer.org": "Service",
    "cancer.net": "Service",
    "heart.org": "Service",
    "lung.org": "Service",
    "kidney.org": "Service",
    "arthritis.org": "Service",
    "alzheimers.org": "Service",
    "alz.org": "Service",

    # Best hotels in Paris — travel blog with WooCommerce cart
    "francevoyager.com": "Blog",
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

n = len([c for c in changed if 'added' in c or 'updated' in c])
print(f'exact.json patched ({n} changes):')
for line in changed:
    print(line)
print('Done!')
