#!/usr/bin/env python3
"""
deploy_fix29: Remaining misfires from fix28 test round.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- RENTAL LISTING PLATFORMS (classified as Small business) ---------------
    "zumper.com": "Directory",           # rental listing/search platform
    "krgre.com": "Directory",            # KSL real estate search

    # -- KSL SUBDOMAINS -------------------------------------------------------
    "homes.ksl.com": "Directory",        # KSL real estate listings (Magento FP)

    # -- GOVERNMENT NUTRITION SITES -------------------------------------------
    "nutrition.gov": "Service",          # USDA nutrition information portal

    # -- PET GROOMING SAAS ----------------------------------------------------
    "booking.moego.pet": "SaaS",         # MoeGo pet grooming booking platform
    "moego.pet": "SaaS",
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
