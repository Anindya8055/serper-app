#!/usr/bin/env python3
"""
Phase 2 domain prior fixes — batch covering new keyword categories:
bitcoin price, homes for sale, dentist AU, weight loss, project mgmt,
golf, hotels, laptops, plumbers.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # ── GOLF ──────────────────────────────────────────────────────────────
    "pga.com": "Service",               # PGA of America — national sports org
    "twincitiesgolf.com": "Small business",  # local golf retailer (Magento FP but no cart)

    # ── BEST HOTELS IN PARIS ──────────────────────────────────────────────
    "trivago.com": "Directory",         # hotel price comparison/aggregator

    # ── BEST LAPTOPS ──────────────────────────────────────────────────────
    "gadgetreview.com": "Blog",         # tech review editorial site

    # ── BEST PROJECT MANAGEMENT SOFTWARE ─────────────────────────────────
    "project-management.com": "Blog",   # editorial review/comparison site
    "icagile.com": "Blog",              # agile certification blog/review content
    "actitime.com": "Blog",             # writes comparison articles (Saas FP wrong)
    "efficient.app": "Blog",            # editorial review/list (bot-blocked → Blog)

    # ── PLUMBERS NEAR ME ──────────────────────────────────────────────────
    "todayshomeowner.com": "Directory", # home services review & contractor directory

    # ── WEIGHT LOSS TIPS ─────────────────────────────────────────────────
    "goodrx.com": "Service",            # drug pricing & health service platform
    "bhf.org.uk": "Service",            # British Heart Foundation — health charity
    "snhhealth.org": "Service",         # Southern NH Health — hospital system
    "health.clevelandclinic.org": "Service",  # Cleveland Clinic health portal
    "clevelandclinic.org": "Service",   # Cleveland Clinic root domain
    "helpguide.org": "Blog",            # mental health editorial / nonprofit blog
    "betterhealth.vic.gov.au": "Service",  # Victorian Government health portal
    "lafayettefamilyymca.org": "Service",  # YMCA nonprofit health service
    "us.womensbest.com": "Blog",        # health/fitness brand blog (was Newspaper)

    # ── BITCOIN PRICE ─────────────────────────────────────────────────────
    "coinmarketcap.com": "Directory",   # crypto price tracker / data directory
    "coingecko.com": "Directory",       # crypto data aggregator / directory
    "coindesk.com": "Newspaper",        # crypto news publication
    "barchart.com": "Newspaper",        # financial market data & news
    "binance.com": "Saas",             # crypto exchange platform
    "gemini.com": "Saas",              # crypto exchange platform
    "kraken.com": "Saas",              # crypto exchange platform
    "crypto.com": "Saas",              # crypto trading platform
    "bitflyer.com": "Saas",            # crypto exchange
    "moonpay.com": "Saas",             # crypto payment/onramp service
    "etoro.com": "Saas",               # social trading platform
    "robinhood.com": "Saas",           # retail trading/investing platform
    "bitbo.io": "Saas",                # Bitcoin dashboard/analytics
    "tradingview.com": "Saas",         # charting & trading platform
    "uphold.com": "Saas",              # multi-asset trading platform
    "blockchain.com": "Saas",          # crypto wallet & exchange
    "coinbase.com": "Saas",            # crypto exchange platform
    "luno.com": "Saas",                # crypto exchange platform
    "bitstamp.net": "Saas",            # crypto exchange
    "bitpanda.com": "Saas",            # crypto/investment platform
    "cointelegraph.com": "Newspaper",  # crypto news publication
    "theblock.co": "Newspaper",        # crypto news publication
    "decrypt.co": "Newspaper",         # crypto news/media

    # ── HOMES FOR SALE ────────────────────────────────────────────────────
    "har.com": "Directory",            # Houston MLS real estate directory
    "movoto.com": "Directory",         # real estate listing portal
    "utahrealestate.com": "Directory", # Utah MLS real estate directory
    "homerealestate.com": "Directory", # real estate listing portal
    "shorewest.com": "Directory",      # Wisconsin real estate portal
    "thegellmanteam.com": "Small business",  # real estate agent team site
    "redfin.com": "Directory",         # real estate listing portal
    "trulia.com": "Directory",         # real estate listing aggregator
    "homes.com": "Directory",          # real estate directory
    "realtor.com": "Directory",        # NAR real estate directory
    "zillow.com": "Directory",         # real estate marketplace
    "century21.com": "Directory",      # real estate franchise directory
    "coldwellbanker.com": "Directory", # real estate franchise directory
    "remax.com": "Directory",          # real estate franchise directory
    "berkshirehathaway.com": "Directory",  # real estate/financial group

    # ── DENTIST NEAR ME (AU) ──────────────────────────────────────────────
    "smile.com.au": "Directory",       # dental practice finder — AU
    "bupadental.com.au": "Directory",  # Bupa dental find-a-dentist — AU
    "hotdoc.com.au": "Directory",      # health appointment booking directory — AU
    "healthengine.com.au": "Directory",# health appointment directory — AU
    "health.tas.gov.au": "Service",    # Tasmanian Government health portal
    "dental.sa.gov.au": "Service",     # SA Government dental service
    "ohv.org.au": "Service",           # Oral Health Victoria — gov-funded nonprofit
    "batteryhilldental.com": "Small business",  # dental clinic (Magento FP wrong)
    "1300smiles.com.au": "Directory",  # dental chain/directory — AU
    "austaliandentalassociation.org.au": "Service",  # professional body
    "ada.org.au": "Service",           # Australian Dental Association
    "bupa.com.au": "Directory",        # health insurer with provider directory
    "nib.com.au": "Directory",         # health insurer with provider directory
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
                updated.append(f"  {domain}: {data[domain]!r} → {label!r}")
                data[domain] = label
        else:
            added.append(f"  {domain}: {label!r}")
            data[domain] = label

    EXACT_PATH.write_text(json.dumps(data, indent=2) + "\n")

    print(f"Done — {len(added)} added, {len(updated)} updated, {len(data)} total priors")
    if added:
        print("Added:\n" + "\n".join(added))
    if updated:
        print("Updated:\n" + "\n".join(updated))


if __name__ == "__main__":
    main()
