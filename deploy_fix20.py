#!/usr/bin/env python3
"""
deploy_fix20: projectmanager.com prior + known bot-blocked / hard-to-crawl domains
that fall through to weak signals without an explicit prior.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # SaaS / Project management (Magento FP on homepage)
    "projectmanager.com": "Saas",
    "basecamp.com": "Saas",
    "clickup.com": "Saas",
    "smartsheet.com": "Saas",
    "wrike.com": "Saas",
    "teamwork.com": "Saas",
    "notion.so": "Saas",
    "airtable.com": "Saas",
    "linear.app": "Saas",
    "height.app": "Saas",

    # Bot-blocked law firm aggregators / legal directories
    "avvo.com": "Directory",
    "justia.com": "Directory",
    "lawyers.com": "Directory",
    "martindale.com": "Directory",
    "findlaw.com": "Directory",
    "legalmatch.com": "Directory",
    "hg.org": "Directory",

    # Bot-blocked financial services
    "creditkarma.com": "Service",
    "nerdwallet.com": "Directory",
    "bankrate.com": "Directory",
    "creditcards.com": "Directory",
    "valuepenguin.com": "Directory",
    "magnifymoney.com": "Blog",
    "experian.com": "Service",
    "equifax.com": "Service",
    "transunion.com": "Service",

    # Bot-blocked insurance comparison
    "policygenius.com": "Directory",
    "insurify.com": "Directory",
    "gabi.com": "Directory",
    "thezerbraco.com": "Service",

    # Bot-blocked health information
    "webmd.com": "Blog",
    "mayoclinic.org": "Service",
    "clevelandclinic.org": "Service",
    "hopkinsmedicine.org": "Service",
    "mountsinai.org": "Service",
    "drugs.com": "Directory",
    "rxlist.com": "Directory",
    "everydayhealth.com": "Blog",
    "healthgrades.com": "Directory",
    "zocdoc.com": "Directory",

    # Bot-blocked e-commerce / retail
    "etsy.com": "E-commerce",
    "target.com": "E-commerce",
    "costco.com": "E-commerce",
    "kohls.com": "E-commerce",
    "macys.com": "E-commerce",
    "nordstrom.com": "E-commerce",
    "gap.com": "E-commerce",
    "oldnavy.com": "E-commerce",
    "hm.com": "E-commerce",
    "zara.com": "E-commerce",
    "shein.com": "E-commerce",
    "temu.com": "E-commerce",

    # Bot-blocked news / media
    "wsj.com": "Newspaper",
    "ft.com": "Newspaper",
    "economist.com": "Newspaper",
    "bloomberg.com": "Newspaper",
    "reuters.com": "Newspaper",
    "apnews.com": "Newspaper",
    "axios.com": "Newspaper",
    "politico.com": "Newspaper",
    "thehill.com": "Newspaper",
    "rollcall.com": "Newspaper",

    # Bot-blocked travel
    "tripadvisor.com": "Directory",
    "booking.com": "Directory",
    "hotels.com": "Directory",
    "expedia.com": "Directory",
    "kayak.com": "Directory",
    "priceline.com": "Directory",
    "airbnb.com": "Directory",
    "vrbo.com": "Directory",
}


def main():
    if not EXACT_PATH.exists():
        print(f"ERROR: {EXACT_PATH} not found — run from repo root", file=sys.stderr)
        sys.exit(1)

    data = json.loads(EXACT_PATH.read_text())
    added, updated = [], []

    for domain, label in NEW_PRIORS.items():
        if domain in data:
            if data[domain] != label:
                updated.append(f"  {domain}: {data[domain]!r} -> {label!r}")
                data[domain] = label
        else:
            added.append(f"  {domain}: {label!r}")
            data[domain] = label

    EXACT_PATH.write_text(json.dumps(data, indent=2) + "\n")

    print(f"Done -- {len(added)} added, {len(updated)} updated, {len(data)} total priors")
    if added:
        print("Added:\n" + "\n".join(added))
    if updated:
        print("Updated:\n" + "\n".join(updated))


if __name__ == "__main__":
    main()
