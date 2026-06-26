
import json, os

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

to_add = {
    "abcnews.go.com": "Newspaper",
    "abcnews.com": "Newspaper",
    "telegraph.co.uk": "Newspaper",
    "thetelegraph.co.uk": "Newspaper",
    "theweek.com": "Newspaper",
    "nymag.com": "Newspaper",
    "runrepeat.com": "Blog",
    "letsrun.com": "Blog",
    "fleetfeet.com": "E-commerce",
    "sixminutemile.com": "Blog",
    "gq.com": "Newspaper",
    "esquire.com": "Newspaper",
    "menshealth.com": "Newspaper",
    "womenshealthmag.com": "Newspaper",
    "self.com": "Newspaper",
    "shape.com": "Newspaper",
    "outsideonline.com": "Newspaper",
    "verywellfit.com": "Newspaper",
    "forum.videofitness.com": "Blog",
    "doctorsofrunning.com": "Blog",
    "theruntesters.com": "Blog",
    "rtings.com": "Blog",
    "outdoorgearlab.com": "Blog",
    "gearjunkie.com": "Newspaper",
}

added = []
for domain, stype in to_add.items():
    if domain not in data:
        data[domain] = stype
        added.append(domain)

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

if added:
    print(f"Added {len(added)} domains: {', '.join(added)}")
else:
    print("All domains already present, nothing to add")
print("Done!")
