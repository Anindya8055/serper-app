#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 13: additional priors from test results.
Covers: golf tour, real estate (weichert), crypto (kucoin), health systems,
AU dental chains.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- GOLF ------------------------------------------------------------------
    "pgatour.com": "Service",            # PGA Tour -- national golf tour org
    "golflink.com.au": "Directory",      # AU golf course directory/review
    "golfdigest.com": "Blog",            # golf editorial magazine/blog
    "golfchannel.com": "Newspaper",      # golf news & TV media
    "golf.com": "Blog",                  # golf editorial site

    # -- HOMES FOR SALE --------------------------------------------------------
    "weichert.com": "Directory",         # real estate franchise directory

    # -- BITCOIN / CRYPTO ------------------------------------------------------
    "kucoin.com": "Saas",               # crypto exchange platform
    "bybit.com": "Saas",                # crypto exchange platform
    "gate.io": "Saas",                  # crypto exchange platform
    "okx.com": "Saas",                  # crypto exchange platform
    "bitget.com": "Saas",               # crypto exchange platform

    # -- WEIGHT LOSS / HEALTH SYSTEMS ------------------------------------------
    "sutterhealth.org": "Service",       # Sutter Health -- hospital system
    "carondelet.org": "Service",         # Carondelet Health Network -- hospital
    "piedmont.org": "Service",           # Piedmont Healthcare -- hospital system
    "inova.org": "Service",              # Inova Health -- hospital system
    "dignity-health.org": "Service",     # Dignity Health -- hospital system
    "commonspirit.org": "Service",       # CommonSpirit Health -- hospital system

    # -- DENTIST AU ------------------------------------------------------------
    "mcdental.com.au": "Small business", # dental chain AU (Magento FP wrong)
    "nogapsdental.com.au": "Directory",  # dental chain/directory AU
    "primarydental.com.au": "Small business",     # dental chain AU
    "pacificsmilesdental.com.au": "Small business",  # dental chain AU
    "totalcaredental.com.au": "Small business",   # dental clinic AU
    "mysmilesdental.com.au": "Small business",    # dental chain AU
    "dentalcaredirect.com.au": "Small business",  # dental clinic AU
    "affordabledentist.com.au": "Small business", # dental clinic AU
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
