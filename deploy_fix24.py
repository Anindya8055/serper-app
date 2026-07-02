#!/usr/bin/env python3
"""
deploy_fix24: Remaining small fixes from e-commerce testing round 2.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- BEAUTY / SKINCARE E-COMMERCE (thin extraction, international) ---------
    "purplle.com": "E-commerce",            # Indian beauty marketplace
    "nykaabeauty.com": "E-commerce",
    "smashbox.com": "E-commerce",
    "charlottetilbury.com": "E-commerce",
    "fentybeauty.com": "E-commerce",
    "toofaced.com": "E-commerce",
    "urbandecay.com": "E-commerce",
    "tatcha.com": "E-commerce",
    "paulaschoice.com": "E-commerce",
    "skinceuticals.com": "E-commerce",
    "murad.com": "E-commerce",
    "peterthomasroth.com": "E-commerce",
    "origins.com": "E-commerce",
    "beautybar.com": "E-commerce",
    "beautybar.com.ph": "E-commerce",
    "revolve.com": "E-commerce",

    # -- CHAMBER OF COMMERCE / LOCAL DIRECTORIES ------------------------------
    "potsdamchamber.com": "Directory",
    "chamber.com": "Directory",

    # -- FURNITURE / APPLIANCE STORES (bot-blocked, thin extraction) ----------
    "bicknellappliance.com": "E-commerce",
    "furniture-time.com": "E-commerce",
    "ethanallen.com": "E-commerce",
    "bassettfurniture.com": "E-commerce",
    "la-z-boy.com": "E-commerce",
    "lazy-boy.com": "E-commerce",
    "kingslynfurniture.com": "E-commerce",
    "nebraskafurnituremart.com": "E-commerce",
    "nfm.com": "E-commerce",
    "rc-willey.com": "E-commerce",
    "rcwilley.com": "E-commerce",
    "badcock.com": "E-commerce",
    "gardnerwhite.com": "E-commerce",
    "levinsfurniture.com": "E-commerce",
    "steinhafels.com": "E-commerce",
    "vanguardfurniture.com": "E-commerce",
    "hooker.com": "E-commerce",
    "hookedfurniture.com": "E-commerce",

    # -- MISC DIRECTORIES (WordPress FP on non-blog sites) --------------------
    "chamberofcommerce.com": "Directory",
    "manta.com": "Directory",
    "merchantcircle.com": "Directory",
    "superpages.com": "Directory",
    "mapquest.com": "Directory",
    "bbb.org": "Directory",                 # Better Business Bureau
    "angieslist.com": "Directory",
    "angi.com": "Directory",
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
