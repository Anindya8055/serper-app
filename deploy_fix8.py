import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    # Dentist near me fixes
    "smilecalifornia.org": "Service",   # California dental benefits org
    "dentaquest.com": "Service",         # Dental insurance/benefits
    "dentaldreams.com": "Small business", # Dental chain (bot-blocked → Blog)

    # Plumber near me — WordPress local business sites misclassified as Blog
    # (analyzer.js fix should handle these generically, but add priors as safety net)
    "maplewoodplumbing.com": "Small business",
    "archplumbingstl.com": "Small business",
    "stlplumbing.net": "Small business",
    "mikesplumbingchicago.com": "Small business",
    "plumbing-solutions-inc.com": "Small business",
    "cartwrightsplumbing.com": "Small business",

    # Other common local service sites that may appear for local keywords
    "theplumberguy.com": "Small business",
    "brothersplumbing.com": "Small business",
    "hoffmannbros.com": "Small business",
    "planetplumbinganddrain.com": "Small business",
    "shumateheatingandair.com": "Small business",
    "aaastl.com": "Small business",
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

print(f'exact.json patched:')
for line in changed:
    print(line)
print('Done!')
