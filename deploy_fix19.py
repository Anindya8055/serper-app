#!/usr/bin/env python3
"""
Phase 2 -- fix19: placeholder to trigger server.js commit.
The real change in this batch is the expanded classifyFromSnippet() in server.js
which now covers Service, Directory, Saas, and Newspaper from Serper snippets alone,
reducing crawler dependency and bot-block misclassifications.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

# Minor additional priors to accompany the snippet classifier upgrade
NEW_PRIORS = {
    # Streaming (missed in fix18)
    "disneyplus.com": "Saas",
    "hbomax.com": "Saas",
    "peacocktv.com": "Saas",
    "paramountplus.com": "Saas",

    # Tech news (should be Newspaper, not Blog)
    "techcrunch.com": "Newspaper",
    "theverge.com": "Newspaper",
    "wired.com": "Newspaper",
    "engadget.com": "Newspaper",
    "arstechnica.com": "Newspaper",

    # Finance blogs
    "fool.com": "Blog",
    "thebalancemoney.com": "Blog",

    # Additional service providers
    "progressive.com": "Service",
    "libertymutual.com": "Service",
    "farmers.com": "Service",
    "travelers.com": "Service",
    "usaa.com": "Service",
    "lemonade.com": "Service",

    # Real estate
    "zillow.com": "Directory",
    "realtor.com": "Directory",
    "redfin.com": "Directory",
    "trulia.com": "Directory",
    "homes.com": "Directory",
    "apartments.com": "Directory",
    "century21.com": "Service",
    "coldwellbanker.com": "Service",
    "remax.com": "Service",

    # Health
    "healthline.com": "Blog",
    "verywellhealth.com": "Blog",
    "verywellmind.com": "Blog",
    "medicalnewstoday.com": "Blog",

    # Additional directories
    "angieslist.com": "Directory",
    "thumbtack.com": "Directory",
    "porch.com": "Directory",
    "bark.com": "Directory",
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
