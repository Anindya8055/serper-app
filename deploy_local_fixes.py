import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    # Missing Delta Dental state variants
    "deltadentalva.com": "Service",
    "deltadentalnc.com": "Service",
    "deltadentalins.com": "Service",
    "deltadentalut.com": "Service",
    "deltadentalky.com": "Service",
    "deltadentalsc.com": "Service",
    "deltadentalga.com": "Service",
    "deltadentalpa.com": "Service",
    "deltadentalnj.com": "Service",
    "deltadentalny.com": "Service",
    "deltadentaltx.com": "Service",
    "deltadentalaz.com": "Service",
    "deltadentalor.com": "Service",
    "deltadentalne.com": "Service",
    "deltadentalnd.com": "Service",
    "deltadentalsd.com": "Service",
    "deltadentalid.com": "Service",
    "deltadentalwv.com": "Service",
    "deltadentalhi.com": "Service",
    "deltadentalak.com": "Service",
    "deltadentalnh.com": "Service",
    "deltadentalvt.com": "Service",
    "deltadentalmn.com": "Service",
    "deltadentaliowa.com": "Service",
    "deltadentalms.com": "Service",
    "deltadentalok.com": "Service",
    "deltadentalct.com": "Service",
    "deltadentalri.com": "Service",
    "deltadentalkansas.com": "Service",
    # Also handle www1 subdomain by adding the base domain (subdomain stripping handles www)
    # www1 is NOT stripped by standard www. stripping, so add it explicitly
    "www1.deltadentalins.com": "Service",

    # Plumber/HVAC local businesses
    "williamscomfortair.com": "Small business",
    "dashingdans.com": "Small business",
    "stadlerplumbing.com": "Small business",
    "reliableair.com": "Small business",

    # Common local plumber/HVAC domains that may appear
    "rotorouter.com": "Small business",
    "mrrooter.com": "Small business",

    # Other dental chains (Small business rather than Service)
    "aspendentalcare.com": "Small business",
    "greatsmilesdentalcare.com": "Small business",
    "familydentistry.com": "Small business",
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

print(f'exact.json patched ({len([c for c in changed if "added" in c or "updated" in c])} changes):')
for line in changed:
    print(line)
print('Done!')
