#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 16.
Covers: car insurance stragglers, credit cards, grocery delivery stragglers,
immigration fixes, travel blog FP fix.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- CAR INSURANCE (thin-extraction / small-business FP) -------------------
    "safeauto.com": "Service",          # Safe Auto Insurance -- insurance company
    "plymouthrock.com": "Service",      # Plymouth Rock Assurance -- insurance company

    # -- CREDIT CARDS ----------------------------------------------------------
    "creditcards.com": "Directory",     # credit card comparison/directory
    "mastercard.com": "Service",        # Mastercard -- payment network
    "thriftytraveler.com": "Blog",      # Thrifty Traveler -- travel points blog

    # -- ONLINE GROCERY DELIVERY (stragglers) ----------------------------------
    "mercato.com": "E-commerce",        # Mercato -- local grocery delivery marketplace
    "misfitsmarket.com": "E-commerce",  # Misfits Market -- online grocery delivery

    # -- IMMIGRATION -----------------------------------------------------------
    "lincolngoldfinch.com": "Small business",   # immigration law firm (WooCommerce FP)
    "immigrationadvocates.org": "Directory",    # immigration legal directory
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
