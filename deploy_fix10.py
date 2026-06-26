import json

path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
    # ── Symptoms of diabetes — health orgs misclassified as Small business ──────
    "jackson-hospital.com": "Service",
    "cityofhope.org": "Service",
    "wayneunc.org": "Service",
    "onlinefirstaid.com": "Blog",       # WooCommerce but it's a first-aid blog/training
    "diabetes.org.nz": "Service",
    "diabetes.org.uk": "Service",
    "diabetes.org": "Service",
    "www2.hse.ie": "Service",
    "hse.ie": "Service",                # Ireland Health Service Executive
    "heart.org": "Service",             # American Heart Association
    "yalemedicine.org": "Service",
    "tmh.org": "Service",
    "rghospitals.com": "Service",
    "swhcoronaregional.com": "Service",
    "communityhealth.uams.edu": "Service",
    "pmc.ncbi.nlm.nih.gov": "Service",
    "ncbi.nlm.nih.gov": "Service",

    # Other common health/medical orgs that may appear
    "hopkinsmedicine.org": "Service",
    "clevelandclinic.org": "Service",
    "ucsf.edu": "Service",
    "uchicagomedicine.org": "Service",
    "mountsinai.org": "Service",
    "pennmedicine.org": "Service",
    "brighamandwomens.org": "Service",
    "massgeneral.org": "Service",
    "cedars-sinai.org": "Service",
    "uchealth.org": "Service",
    "scripps.org": "Service",
    "baptisthealth.net": "Service",
    "adventhealth.com": "Service",
    "ascension.org": "Service",
    "providence.org": "Service",
    "bjc.org": "Service",
    "intermountainhealthcare.org": "Service",
    "geisinger.org": "Service",
    "rwjbh.org": "Service",
    "northwell.edu": "Service",
    "nyu.edu": "Service",
    "diabetes.ca": "Service",           # Diabetes Canada
    "diabetes.co.uk": "Service",
    "joslin.org": "Service",            # Joslin Diabetes Center
    "jdrf.org": "Service",              # JDRF (diabetes research)
    "beyond-type1.org": "Service",
    "diabetesforum.net": "Blog",
    "diapedia.org": "Service",

    # ── Best hotels in Paris — travel booking & blog sites ───────────────────────
    "travel.usnews.com": "Newspaper",
    "mrandmrssmith.com": "Directory",   # boutique hotel booking
    "slh.com": "Directory",             # Small Luxury Hotels booking
    "lartisien.com": "Directory",       # luxury hotel booking
    "designhotels.com": "Directory",    # design hotel collection/booking
    "agoda.com": "Directory",           # hotel booking OTA
    "travelocity.com": "Directory",     # travel booking OTA
    "lesfrenchiestravel.com": "Blog",   # travel blog
    "santorinidave.com": "Blog",        # travel review blog
    "everydayparisian.com": "Blog",     # Paris travel blog
    "forbestravelguide.com": "Newspaper",  # Forbes travel guide
    "us.frenchbee.com": "Service",      # French Bee airline
    "frenchbee.com": "Service",
    "carrieamitchell.substack.com": "Blog",

    # Other common travel OTAs / hotel booking sites
    "booking.com": "Directory",
    "hotels.com": "Directory",
    "kayak.com": "Directory",
    "priceline.com": "Directory",
    "orbitz.com": "Directory",
    "hotwire.com": "Directory",
    "airbnb.com": "Directory",
    "vrbo.com": "Directory",
    "marriott.com": "E-commerce",
    "hilton.com": "E-commerce",
    "hyatt.com": "E-commerce",
    "ihg.com": "E-commerce",
    "fourseasons.com": "E-commerce",
    "ritz-carlton.com": "E-commerce",
    "accor.com": "E-commerce",

    # Travel blogs / review sites
    "thepointsguy.com": "Blog",
    "travelandleisure.com": "Newspaper",
    "cntraveler.com": "Newspaper",
    "lonelyplanet.com": "Blog",
    "fodors.com": "Blog",
    "frommers.com": "Blog",
    "ricksteves.com": "Blog",
    "tripadvisor.com": "Directory",
    "hotels.com": "Directory",
    "kayak.com": "Directory",
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
print(f'exact.json patched ({n} new/updated):')
for line in changed:
    print(line)
print('Done!')
