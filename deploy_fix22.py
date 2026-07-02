#!/usr/bin/env python3
"""
deploy_fix22: Fix remaining misclassifications from keyword testing round 2.
Covers: travel insurance providers, telehealth Saas, Amazon subdomain,
security review sites, bot-blocked service sites, Magento FP on editorial blogs.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- TRAVEL INSURANCE PROVIDERS (not comparison directories) ---------------
    "worldtrips.com": "Service",            # WorldTrips -- actual insurance provider
    "travelinsured.com": "Service",         # Travel Insured -- insurance provider (Magento FP)
    "worldnomads.com": "Service",           # World Nomads -- travel insurance provider
    "allianztravelinsurance.com": "Service", # Allianz Travel Insurance
    "generalitravel.com": "Service",
    "imglobal.com": "Service",
    "hthtravelinsurance.com": "Service",
    "sevenCorners.com": "Service",
    "sevencorners.com": "Service",
    "geoblue.com": "Service",
    "travelguard.com": "Service",
    "battleface.com": "Service",

    # -- TELEHEALTH / ONLINE THERAPY SAAS (bot-blocked, thin extraction) -------
    "online-therapy.com": "Saas",           # Online-Therapy.com -- subscription therapy platform
    "teladochealth.com": "Saas",            # Teladoc Health -- telehealth SaaS
    "patients.amwell.com": "Saas",          # Amwell patient portal (subdomain)
    "doctorondemand.com": "Saas",           # Doctor On Demand -- telehealth
    "optum.com": "Service",                 # Optum -- health services
    "growtherapy.com": "Directory",         # Grow Therapy -- therapist marketplace/directory
    "therapyden.com": "Directory",          # Therapy Den -- therapist directory
    "zencare.co": "Directory",              # Zencare -- therapist directory
    "psychologytoday.com": "Directory",     # Psychology Today -- therapist directory
    "thriveworks.com": "Service",           # Thriveworks -- in-person/online therapy chain

    # -- SECURITY REVIEW / EDITORIAL SITES ------------------------------------
    "security.org": "Blog",                # Security.org -- editorial home security review blog
    "safehome.org": "Blog",                # SafeHome.org -- editorial review blog
    "safewise.com": "Blog",                # SafeWise -- editorial review blog

    # -- BOT-BLOCKED SERVICE SITES --------------------------------------------
    "vectorsecurity.com": "Service",       # Vector Security -- home security monitoring service
    "monitronics.com": "Service",          # Monitronics -- home security service
    "protect-america.com": "Service",      # Protect America -- security service

    # -- AMAZON SUBDOMAINS ---------------------------------------------------
    "us.amazon.com": "E-commerce",         # Amazon US storefront subdomain
    "smile.amazon.com": "E-commerce",

    # -- MAGENTO FP ON PERSONAL FINANCE EDITORIAL BLOGS -----------------------
    "ramseysolutions.com": "Blog",          # Ramsey Solutions -- personal finance editorial blog
    "daveramsey.com": "Blog",              # Dave Ramsey -- personal finance blog
    "clarkhoward.com": "Blog",             # Clark Howard -- consumer advice blog

    # -- ADDITIONAL TAX / FINANCE SERVICE SITES --------------------------------
    "taxfoundation.org": "Blog",           # Tax Foundation -- nonprofit tax policy blog
    "efile.com": "Saas",                   # eFile.com -- tax filing software

    # -- ADDITIONAL COMPARISON SITES ------------------------------------------
    "policyadvice.net": "Blog",
    "insurancebusinessmag.com": "Blog",
    "valuechampion.sg": "Directory",
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
