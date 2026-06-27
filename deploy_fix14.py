#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 14.
Covers: international real estate portals, AU/UK property sites,
gov dental/health portals, dental price comparison.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- HOMES FOR SALE (international portals) --------------------------------
    "rightmove.co.uk": "Directory",       # UK's #1 property listing portal
    "zoopla.co.uk": "Directory",          # UK property listing portal
    "onthemarket.com": "Directory",       # UK property listing portal
    "realting.com": "Directory",          # international real estate portal
    "christiesrealestate.com": "Directory",  # luxury real estate franchise
    "vietnam-real.estate": "Directory",   # Vietnam real estate portal
    "dotproperty.com.vn": "Directory",    # SE Asia property portal
    "dotproperty.com": "Directory",       # SE Asia property portal (root)
    "global.remax.com": "Directory",      # RE/MAX global subdomain
    "localrealestateonline.com": "Directory",  # real estate directory (bot-blocked)
    "beachandhouses.com": "Directory",    # international beach property portal
    "househunter.com": "Directory",       # real estate portal
    "propertyguru.com.vn": "Directory",   # Vietnam property portal
    "batdongsan.com.vn": "Directory",     # Vietnam real estate portal
    "lamudi.com": "Directory",            # emerging markets real estate portal
    "iproperty.com": "Directory",         # SE Asia property portal
    "propertyguru.com.sg": "Directory",   # Singapore property portal
    "99.co": "Directory",                 # Singapore real estate portal

    # -- DENTIST AU (gov health portals) ---------------------------------------
    "health.nsw.gov.au": "Service",       # NSW Government Health portal
    "dental.wa.gov.au": "Service",        # WA Government dental health service
    "health.qld.gov.au": "Service",       # QLD Government Health portal
    "sunshinecoast.health.qld.gov.au": "Service",  # Sunshine Coast Health -- QLD gov
    "health.act.gov.au": "Service",       # ACT Government Health
    "sahealth.sa.gov.au": "Service",      # SA Government Health
    "health.nt.gov.au": "Service",        # NT Government Health
    "fixeddental.com.au": "Directory",    # dental price comparison/finder -- AU
    "dental99.com.au": "Small business",  # multi-location dental chain -- AU
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
