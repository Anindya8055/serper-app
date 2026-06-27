#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 15.
Covers: car insurance companies, grocery chains, immigration orgs,
solar energy companies.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- CAR INSURANCE (bot-blocked companies) ---------------------------------
    "libertymutual.com": "Service",      # Liberty Mutual -- insurance company
    "farmers.com": "Service",            # Farmers Insurance -- insurance company
    "thegeneral.com": "Service",         # The General -- auto insurance
    "lemonade.com": "Saas",              # Lemonade -- digital insurance platform
    "directauto.com": "Service",         # Direct Auto Insurance
    "usnews.com": "Newspaper",           # US News -- editorial/news publisher
    "money.usnews.com": "Newspaper",     # US News Money -- editorial
    "compare.com": "Directory",          # insurance comparison directory
    "thezebra.com": "Directory",         # insurance comparison directory
    "insurify.com": "Directory",         # insurance comparison directory
    "policygenius.com": "Directory",     # insurance comparison marketplace
    "progressive.com": "Service",        # Progressive Insurance
    "travelers.com": "Service",          # Travelers Insurance
    "usaa.com": "Service",               # USAA -- insurance/financial services
    "aaa.com": "Service",                # AAA -- roadside/insurance services
    "mwg.aaa.com": "Service",            # AAA Mid-Atlantic insurance subdomain
    "autoinsurance.com": "Directory",    # insurance comparison directory
    "money.com": "Newspaper",            # Money magazine/editorial

    # -- ONLINE GROCERY DELIVERY (thin-extracted chains) ----------------------
    "freshdirect.com": "E-commerce",     # FreshDirect -- online grocery delivery
    "safeway.com": "E-commerce",         # Safeway -- grocery chain
    "albertsons.com": "E-commerce",      # Albertsons -- grocery chain
    "foodlion.com": "E-commerce",        # Food Lion -- grocery chain
    "marianos.com": "E-commerce",        # Mariano's -- Kroger-owned grocery chain
    "shipt.com": "Saas",                 # Shipt -- grocery delivery platform
    "instacart.com": "Saas",             # Instacart -- grocery delivery platform
    "yummy.com": "Saas",                 # Yummy -- grocery delivery app
    "shoprite.com": "E-commerce",        # ShopRite -- grocery chain
    "peapod.com": "E-commerce",          # Peapod -- online grocery delivery
    "thrivemarket.com": "E-commerce",    # Thrive Market -- online grocery
    "heb.com": "E-commerce",             # H-E-B -- Texas grocery chain
    "publix.com": "E-commerce",          # Publix -- grocery chain
    "wegmans.com": "E-commerce",         # Wegmans -- grocery chain

    # -- IMMIGRATION LAWYER ---------------------------------------------------
    "aila.org": "Service",               # American Immigration Lawyers Assoc (Magento FP)
    "ailalawyer.com": "Directory",       # AILA lawyer search directory
    "kcba.org": "Service",               # King County Bar Association
    "informedimmigrant.com": "Blog",     # immigration info/resource blog
    "ilrc.org": "Service",               # Immigrant Legal Resource Center

    # -- SOLAR PANELS ---------------------------------------------------------
    "energysage.com": "Directory",       # solar marketplace/comparison directory
    "tesla.com": "Saas",                 # Tesla -- EV/energy product platform
    "sunrun.com": "Service",             # Sunrun -- solar installation company
    "us.sunpower.com": "Service",        # SunPower US -- solar installation
    "sunpower.com": "Service",           # SunPower -- solar company
    "solarreviews.com": "Blog",          # solar review/editorial blog
    "solar.com": "Directory",            # solar marketplace/directory
    "ecowatch.com": "Blog",              # environmental/energy news blog
    "georgiastatesolar.org": "Blog",     # solar info/guide blog
    "nrgcleanpower.com": "Service",      # local solar installer (CA)
    "greenmatch.co.uk": "Directory",     # UK solar comparison directory
    "which.co.uk": "Blog",              # UK consumer review/editorial
}


def main():
    if not EXACT_PATH.exists():
        print(f"ERROR: {EXACT_PATH} not found -- run from repo root", file=sys.stderr)
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
