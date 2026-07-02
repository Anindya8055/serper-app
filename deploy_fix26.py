#!/usr/bin/env python3
"""
deploy_fix26: Remaining misfires from small business + restaurant keyword testing round 2.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- FOOD EDITORIAL BLOGS (Magento/WooCommerce FP) -------------------------
    "grubstreet.com": "Blog",               # NY Mag food blog
    "thesmokies.com": "Blog",               # Smoky Mountain tourism/dining guide
    "gatlinburg.com": "Directory",          # Tourism directory
    "sheneedsless.com": "Blog",             # Lifestyle/travel blog

    # -- TRAVEL / TOURISM DIRECTORIES ------------------------------------------
    "visittheusa.com": "Directory",
    "visitflorida.com": "Directory",
    "iloveny.com": "Directory",
    "visitcalifornia.com": "Directory",
    "azfamily.com": "Newspaper",            # Phoenix TV news station

    # -- YELP SUBDOMAINS -------------------------------------------------------
    "m.yelp.com": "Directory",              # Mobile Yelp

    # -- AUTO PARTS / RETAIL ---------------------------------------------------
    "autozone.com": "E-commerce",
    "oreillyauto.com": "E-commerce",        # O'Reilly Auto Parts
    "napaonline.com": "E-commerce",
    "pepboys.com": "E-commerce",
    "advanceautoparts.com": "E-commerce",

    # -- AUTO REPAIR CHAINS ---------------------------------------------------
    "jiffylube.com": "Service",
    "midas.com": "Service",
    "meineke.com": "Service",
    "maaco.com": "Service",
    "monroequicklubeandtires.com": "Service",
    "firestone.com": "Service",
    "firestonecompleteautocare.com": "Service",
    "brakes.com": "Service",
    "goodyear.com": "Service",
    "ntbonline.com": "Service",
    "discounttire.com": "Service",
    "tirebuyer.com": "E-commerce",
    "tirerack.com": "E-commerce",

    # -- HAIR SALON CHAINS ----------------------------------------------------
    "greatclips.com": "Service",
    "smartstyle.com": "Service",
    "supercuts.com": "Service",
    "sportclips.com": "Service",
    "regiscorp.com": "Service",
    "flowersalon.com": "Service",
    "hairclub.com": "Service",
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
