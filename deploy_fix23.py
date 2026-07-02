#!/usr/bin/env python3
"""
deploy_fix23: E-commerce domain priors for bot-blocked beauty/furniture/retail sites,
plus misc fixes from e-commerce keyword testing.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- FURNITURE RETAILERS (bot-blocked) ------------------------------------
    "mybobs.com": "E-commerce",             # Bob's Discount Furniture
    "jordans.com": "E-commerce",            # Jordan's Furniture
    "thefurnituremall.com": "E-commerce",
    "bobmillsfurniture.com": "E-commerce",
    "thefurnituremart.com": "E-commerce",
    "muellerfurniture.com": "E-commerce",
    "furniturerow.com": "E-commerce",
    "levinfurniture.com": "E-commerce",
    "regencyfurniture.com": "E-commerce",
    "bigsandysuperstore.com": "E-commerce",
    "morfurniture.com": "E-commerce",
    "belfurniture.com": "E-commerce",
    "canalesfurniture.com": "E-commerce",
    "furnitureworldnw.com": "E-commerce",
    "rooms-to-go.com": "E-commerce",
    "roomstogo.com": "E-commerce",
    "havertys.com": "E-commerce",
    "valuecityfurniture.com": "E-commerce",
    "americanfurniturewarehouse.com": "E-commerce",
    "slumberland.com": "E-commerce",

    # -- BEAUTY / SKINCARE E-COMMERCE (bot-blocked) --------------------------
    "sephora.ph": "E-commerce",
    "yesstyle.com": "E-commerce",
    "fresh.com": "E-commerce",              # Fresh beauty brand DTC
    "skinbetter.com": "E-commerce",         # SkinBetter Science DTC
    "nykaa.com": "E-commerce",              # Major Indian beauty retailer
    "tirabeauty.com": "E-commerce",
    "watsons.com.ph": "E-commerce",
    "lookatme.com.ph": "E-commerce",
    "provenskincare.com": "E-commerce",
    "glossier.com": "E-commerce",
    "kiehlscom": "E-commerce",
    "kiehls.com": "E-commerce",
    "clinique.com": "E-commerce",
    "esteelauder.com": "E-commerce",
    "lancome.com": "E-commerce",
    "cerave.com": "E-commerce",
    "neutrogena.com": "E-commerce",
    "olay.com": "E-commerce",
    "skinstore.com": "E-commerce",
    "dermstore.com": "E-commerce",
    "spacenk.com": "E-commerce",
    "cultbeauty.co.uk": "E-commerce",
    "lookfantastic.com": "E-commerce",
    "beautybay.com": "E-commerce",
    "fragrancenet.com": "E-commerce",

    # -- MAJOR FURNITURE / HOME DECOR (bot-blocked) --------------------------
    "ashleyfurniture.com": "E-commerce",    # Ashley Furniture (Magento FP + bot-blocked)
    "haworth.com": "E-commerce",
    "hermanmiller.com": "E-commerce",
    "steelcase.com": "E-commerce",
    "knoll.com": "E-commerce",
    "article.com": "E-commerce",
    "burrow.com": "E-commerce",
    "castlery.com": "E-commerce",
    "allmodern.com": "E-commerce",
    "joybird.com": "E-commerce",
    "article.com": "E-commerce",

    # -- PHOTOGRAPHY / CREATIVE BLOGS -----------------------------------------
    "fstoppers.com": "Blog",               # Fstoppers -- photography industry blog
    "petapixel.com": "Blog",               # PetaPixel -- photography blog
    "dpreview.com": "Blog",                # DPReview -- camera review blog
    "lensrentals.com": "Blog",             # LensRentals blog + rental service
    "bhphotovideo.com": "E-commerce",      # B&H Photo -- major camera retailer

    # -- OFFICE / TECH RETAILERS ----------------------------------------------
    "store.hermanmiller.com": "E-commerce",
    "store.haworth.com": "E-commerce",
    "officechairsusa.com": "E-commerce",
    "officechairsunlimited.com": "E-commerce",
    "branchfurniture.com": "E-commerce",
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
