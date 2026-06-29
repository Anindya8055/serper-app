#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 17.
Covers: financial editorial/blog sites misclassified as Saas/Service/Small business.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- CREDIT CARDS / FINANCIAL EDITORIAL ------------------------------------
    "wallethub.com": "Directory",           # WalletHub -- credit card comparison/directory
    "financebuzz.com": "Blog",              # FinanceBuzz -- financial editorial/review blog
    "upgradedpoints.com": "Blog",           # Upgraded Points -- travel rewards editorial blog
    "iwillteachyoutoberich.com": "Blog",    # I Will Teach You To Be Rich -- personal finance blog
    "thriftytraveler.com": "Blog",          # Thrifty Traveler -- travel points editorial blog (fix16 repeat)

    # -- ADDITIONAL FINANCE BLOGS (pre-emptive for common finance queries) -----
    "bankrate.com": "Blog",                 # Bankrate -- financial comparison/editorial
    "valuepenguin.com": "Blog",             # ValuePenguin -- financial comparison blog
    "lendingtree.com": "Directory",         # LendingTree -- financial comparison directory
    "experian.com": "Service",              # Experian -- credit bureau/financial service
    "equifax.com": "Service",               # Equifax -- credit bureau
    "transunion.com": "Service",            # TransUnion -- credit bureau
    "annualcreditreport.com": "Service",    # AnnualCreditReport.com -- gov-mandated credit report site
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
