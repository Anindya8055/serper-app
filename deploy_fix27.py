#!/usr/bin/env python3
"""
deploy_fix27: Fixes from 8-keyword test round (groomer, apartments, hotels, jobs, travel blogs, recipe blogs).
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- APARTMENT / RENTAL DIRECTORIES ----------------------------------------
    "hotpads.com": "Directory",
    "rent.com": "Directory",
    "apartmentfinder.com": "Directory",
    "rentcafe.com": "Directory",
    "apartmentlist.com": "Directory",
    "apartmenthomeliving.com": "Directory",
    "rentalsource.com": "Directory",
    "forrent.com": "Directory",
    "rentals.com": "Directory",
    "myapartmentmap.com": "Directory",
    "abodo.com": "Directory",
    "cozy.co": "Directory",
    "padmapper.com": "Directory",
    "doorsteps.com": "Directory",

    # -- HOTEL / TRAVEL BOOKING DIRECTORIES ------------------------------------
    "hoteltonight.com": "Directory",
    "hopper.com": "Directory",
    "traveloka.com": "Directory",
    "makemytrip.com": "Directory",
    "makemytrip.global": "Directory",
    "cleartrip.com": "Directory",
    "yatra.com": "Directory",
    "goibibo.com": "Directory",
    "trivago.com": "Directory",
    "kayak.com": "Directory",
    "skyscanner.com": "Directory",
    "momondo.com": "Directory",
    "hotels.com": "Directory",
    "hotelscombined.com": "Directory",
    "agoda.com": "Directory",
    "priceline.com": "Directory",
    "orbitz.com": "Directory",
    "travelocity.com": "Directory",
    "cheaptickets.com": "Directory",
    "cheapoair.com": "Directory",
    "onetravel.com": "Directory",
    "hipmunk.com": "Directory",
    "wotif.com": "Directory",

    # -- JOB SITES (government / state workforce portals) ---------------------
    "jobs.myflorida.com": "Service",
    "workforcewv.org": "Service",
    "kansasworks.com": "Directory",
    "careers.illinois.gov": "Service",
    "wisc.jobs": "Directory",
    "jobs.ca.gov": "Service",
    "labor.ny.gov": "Service",
    "jobs.texas.gov": "Service",
    "ncworks.gov": "Service",
    "works.georgia.gov": "Service",
    "ajb.doe.lara.state.mi.us": "Service",

    # -- JOB SITES (general) --------------------------------------------------
    "usajobs.gov": "Service",
    "jobtrees.com": "Directory",
    "jobing.com": "Directory",
    "nexxt.com": "Directory",
    "localwise.com": "Directory",
    "snagajob.com": "Directory",
    "livecareer.com": "Blog",
    "resume.io": "SaaS",
    "resumegenius.com": "Blog",
    "theladders.com": "Directory",
    "dice.com": "Directory",
    "careerbuilder.com": "Directory",
    "ziprecruiter.com": "Directory",
    "monster.com": "Directory",
    "glassdoor.com": "Directory",
    "indeed.com": "Directory",
    "linkedin.com": "Directory",

    # -- RECIPE / FOOD BLOGS (Magento FP victims) -----------------------------
    "skinnytaste.com": "Blog",
    "eatyourselfskinny.com": "Blog",
    "skinnyms.com": "Blog",
    "100daysofrealfood.com": "Blog",
    "minimalistbaker.com": "Blog",
    "cookieandkate.com": "Blog",
    "ohsheglows.com": "Blog",
    "pinchofyum.com": "Blog",
    "ambitiouskitchen.com": "Blog",
    "sallysbakingaddiction.com": "Blog",
    "gimmesomeoven.com": "Blog",
    "wholefully.com": "Blog",
    "detoxinista.com": "Blog",
    "mywholefoodlife.com": "Blog",
    "peasandcrayons.com": "Blog",
    "thecookierookie.com": "Blog",
    "diethood.com": "Blog",
    "thecleaneatingcouple.com": "Blog",

    # -- TRAVEL BLOGS (Magento/WooCommerce FP victims) ------------------------
    "noelleacrossthepond.com": "Blog",
    "wandering-everywhere.com": "Blog",
    "travellikeanna.com": "Blog",
    "ytravelblog.com": "Blog",
    "thepackablelife.com": "Blog",
    "brendansadventures.com": "Blog",
    "pocketwanderings.com": "Blog",
    "gr8traveltips.com": "Blog",
    "adventurouskate.com": "Blog",
    "theblondeabroad.com": "Blog",
    "heckticravels.com": "Blog",
    "heartmybackpack.com": "Blog",
    "gobackpacking.com": "Blog",
    "worldpackers.com": "Directory",
    "workaway.info": "Directory",
    "helpx.net": "Directory",
    "nomadlist.com": "Directory",
    "remoteok.com": "Directory",

    # -- PET SERVICES ---------------------------------------------------------
    "petsuppliesplus.com": "E-commerce",
    "stores.petco.com": "E-commerce",
    "petco.com": "E-commerce",
    "petsmart.com": "E-commerce",
    "chewy.com": "E-commerce",
    "petfinder.com": "Directory",
    "adoptapet.com": "Directory",
    "rescueme.org": "Directory",
    "akc.org": "Directory",
    "zoomingroomin.com": "Service",       # mobile pet grooming chain

    # -- DOG GROOMING CHAINS / DIRECTORIES ------------------------------------
    "petgroomer.com": "Directory",
    "groomarts.com": "Service",
    "groomingbyappointment.com": "Service",

    # -- PERSONAL FINANCE EDITORIAL -------------------------------------------
    "creditdonkey.com": "Blog",
    "nerdwallet.com": "Blog",
    "bankrate.com": "Blog",
    "thebalancemoney.com": "Blog",
    "thepennyhoarder.com": "Blog",
    "moneysavingexpert.com": "Blog",
    "investopedia.com": "Blog",
    "financialsamurai.com": "Blog",
    "wisebread.com": "Blog",
    "moneyunder30.com": "Blog",
    "frugalwoods.com": "Blog",
    "mrmoneymustache.com": "Blog",
    "budgetsaresexy.com": "Blog",
    "affordanything.com": "Blog",
    "getrichslowly.org": "Blog",

    # -- INSURANCE / FINANCE SERVICES -----------------------------------------
    "sunlife.com": "Service",
    "sunlife.com.ph": "Service",
    "sunlife.ca": "Service",
    "manulife.com": "Service",
    "prudential.com": "Service",
    "metlife.com": "Service",
    "aflac.com": "Service",
    "cigna.com": "Service",
    "aetna.com": "Service",
    "anthem.com": "Service",
    "humana.com": "Service",
    "unitedhealthcare.com": "Service",
    "bcbs.com": "Service",
    "bluecross.com": "Service",
    "blueshield.com": "Service",
    "allstate.com": "Service",
    "statefarm.com": "Service",
    "geico.com": "Service",
    "progressive.com": "Service",
    "libertymutual.com": "Service",
    "nationwide.com": "Service",
    "travelers.com": "Service",
    "usaa.com": "Service",
    "farmers.com": "Service",
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
