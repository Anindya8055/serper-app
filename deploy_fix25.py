#!/usr/bin/env python3
"""
deploy_fix25: Domain priors for small business keyword misfires —
carfax, booksy, eater, infatuation, travel blogs, kerastase, gotolouisville.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- AUTO / CAR SERVICES --------------------------------------------------
    "carfax.com": "Directory",              # car history lookup & listings aggregator
    "cars.com": "Directory",
    "autotrader.com": "Directory",
    "cargurus.com": "Directory",
    "kbb.com": "Directory",                 # Kelley Blue Book
    "edmunds.com": "Directory",

    # -- BOOKING / MARKETPLACE DIRECTORIES ------------------------------------
    "booksy.com": "Directory",              # salon booking marketplace
    "vagaro.com": "Directory",              # spa/salon booking marketplace
    "fresha.com": "Directory",              # beauty booking marketplace
    "styleseat.com": "Directory",           # salon booking directory
    "mindbodyonline.com": "Directory",      # fitness/wellness booking
    "classpass.com": "Directory",

    # -- RESTAURANT & FOOD EDITORIAL BLOGS ------------------------------------
    "eater.com": "Blog",
    "houston.eater.com": "Blog",
    "la.eater.com": "Blog",
    "ny.eater.com": "Blog",
    "chicago.eater.com": "Blog",
    "theinfatuation.com": "Blog",
    "thrillist.com": "Blog",
    "seriouseats.com": "Blog",
    "chowhound.com": "Blog",
    "bonappetit.com": "Blog",
    "foodandwine.com": "Blog",
    "epicurious.com": "Blog",
    "tastingtable.com": "Blog",
    "mortadellahead.com": "Blog",           # Italian food blog
    "diningout.com": "Blog",               # dining editorial/guide
    "bontraveler.com": "Blog",             # travel/food blog

    # -- TRAVEL / TOURISM EDITORIAL -------------------------------------------
    "livelikeitstheweekend.com": "Blog",
    "gotolouisville.com": "Directory",      # Louisville tourism/directory
    "wisdells.com": "Directory",            # Wisconsin Dells tourism
    "visitmusiccity.com": "Directory",
    "timeout.com": "Blog",
    "tripadvisor.com": "Directory",
    "yelp.com": "Directory",
    "zomato.com": "Directory",
    "opentable.com": "Directory",

    # -- BEAUTY / HAIR BRANDS (DTC e-commerce, not blogs) --------------------
    "kerastase-usa.com": "E-commerce",
    "kerastase.com": "E-commerce",
    "loreal.com": "E-commerce",
    "schwarzkopf.com": "E-commerce",
    "redken.com": "E-commerce",
    "wella.com": "E-commerce",

    # -- RESTAURANT CHAINS (Service, not E-commerce) --------------------------
    "mcdonalds.com": "Service",
    "subway.com": "Service",
    "dominos.com": "Service",
    "pizzahut.com": "Service",
    "papajohns.com": "Service",
    "tacobell.com": "Service",
    "wendys.com": "Service",
    "burgerking.com": "Service",
    "chilis.com": "Service",
    "applebees.com": "Service",
    "olivegarden.com": "Service",
    "redlobster.com": "Service",
    "dennys.com": "Service",
    "ihop.com": "Service",
    "outbacksteakhouse.com": "Service",
    "childrens.com": "Service",
    "sonicdrivein.com": "Service",
    "arbys.com": "Service",
    "jackinthebox.com": "Service",
    "whataburger.com": "Service",
    "crackerbarrel.com": "Service",
    "firstwatch.com": "Service",
    "goldencorral.com": "Service",
    "chickfila.com": "Service",
    "chick-fil-a.com": "Service",
    "popeyes.com": "Service",
    "kfc.com": "Service",
    "panera.com": "Service",
    "panerabread.com": "Service",
    "chipotle.com": "Service",
    "shakeshack.com": "Service",
    "fiveguys.com": "Service",
    "smashburger.com": "Service",
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
