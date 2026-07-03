#!/usr/bin/env python3
"""
deploy_fix28: Remaining misfires from 4-keyword test round 2
(groomer paws domain, nutrition blogs, apartment/jobs portals, travel blogs).
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- PET GROOMING (Magento FP on paws/pet domain names) -------------------
    "rainbowpawspet.com": "Small business",
    "groomhaven.com": "Small business",
    "thegroomeryltd.com": "Small business",
    "doggydazeaz.com": "Small business",
    "primpedpooches.com": "Small business",
    "pawpartner.com": "SaaS",              # pet care management SaaS platform

    # -- RECIPE / NUTRITION BLOGS (Magento FP) ---------------------------------
    "frugalnutrition.com": "Blog",
    "delicious.com.au": "Blog",            # Australian food magazine
    "wholesomeyum.com": "Blog",
    "healthyrecipesblogs.com": "Blog",
    "recipetineats.com": "Blog",
    "masonfit.com": "Blog",

    # -- APARTMENT / REAL ESTATE (Magento FP or bot-blocked) ------------------
    "apartmentguide.com": "Directory",
    "leasingkc.com": "Service",            # local property management
    "lemon8-app.com": "SaaS",             # social content platform (TikTok-owned)

    # -- TRAVEL BLOGS (remaining Magento FP / classifier issues) ---------------
    "whirled-away.com": "Blog",
    "travelwithbender.com": "Blog",
    "anywhere.com": "Directory",           # custom travel booking/directory
    "bemytravelmuse.com": "Blog",
    "laneisgoingplaces.com": "Blog",
    "theworldtravelguy.com": "Blog",
    "thetraveltextbook.com": "Blog",
    "under30experiences.com": "Blog",
    "travelblog.org": "Directory",         # user-submitted travel blog directory

    # -- JOB SITES (Magento FP / bot-blocked / classifier issues) -------------
    "jobs.ksl.com": "Directory",           # KSL (Utah) classifieds job board
    "craigslist.org": "Directory",
    "jobcase.com": "Directory",
    "showbizjobs.com": "Directory",
    "roberthalf.com": "Service",           # staffing/recruiting agency
    "talent.lowes.com": "Service",         # Lowe's career portal
    "pa.gov": "Service",
    "kentucky.gov": "Service",
    "ohiomeansjobs.ohio.gov": "Service",
    "jobs.virginia.gov": "Service",
    "dol.ny.gov": "Service",

    # -- GENERAL JOB BOARDS (missing from fix27) ------------------------------
    "simplyhired.com": "Directory",
    "usajobs.com": "Directory",
    "jobtrees.com": "Directory",
    "careerjet.com": "Directory",
    "adzuna.com": "Directory",
    "jora.com": "Directory",
    "talent.com": "Directory",
    "joblist.com": "Directory",
    "flexjobs.com": "Directory",
    "remoteok.io": "Directory",
    "weworkremotely.com": "Directory",
    "workatastartup.com": "Directory",
    "builtinnyc.com": "Directory",
    "builtinchicago.com": "Directory",
    "builtinboston.com": "Directory",
    "builtin.com": "Directory",

    # -- STAFFING AGENCIES (Service, not Small business) ----------------------
    "manpower.com": "Service",
    "kellyservices.com": "Service",
    "adecco.com": "Service",
    "randstadusa.com": "Service",
    "accountemps.com": "Service",
    "officeTeam.com": "Service",
    "michaelpage.com": "Service",
    "heidrick.com": "Service",
    "spencerstuart.com": "Service",
    "kornferry.com": "Service",

    # -- MISC / SPAM DOMAINS (should not rank as real business type) ----------
    "exclusive.herlan.com": "Small business",  # odd URL pattern, treat as small biz
    "livelikeitstheweekend.com": "Blog",       # travel/lifestyle blog (ensure set)
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
