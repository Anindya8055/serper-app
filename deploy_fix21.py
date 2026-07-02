#!/usr/bin/env python3
"""
deploy_fix21: Fix systematic misclassifications from keyword testing.
Covers: tax software → Saas, online therapy → Saas, travel insurance → Directory,
home security → Service, comparison sites, usnews subdomains, misc fixes.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- TAX SOFTWARE / FILING (Magento FP fix) --------------------------------
    "turbotax.intuit.com": "Saas",
    "turbotax.com": "Saas",
    "freetaxusa.com": "Saas",
    "taxact.com": "Saas",
    "taxslayer.com": "Saas",
    "1040.com": "Saas",
    "hrblock.com": "Saas",
    "ultimatetax.com": "Saas",
    "drakesoftware.com": "Saas",
    "e-file.com": "Saas",
    "olt.com": "Saas",
    "taxhawk.com": "Saas",
    "fileyourtaxes.com": "Saas",
    "expresstaxrefund.com": "Saas",
    "taxslayer.com": "Saas",
    "jackson-hewitt.com": "Service",       # in-person tax prep service
    "jacksonhewitt.com": "Service",
    "libertytax.com": "Service",

    # -- ONLINE THERAPY / MENTAL HEALTH SAAS ----------------------------------
    "talkspace.com": "Saas",
    "betterhelp.com": "Saas",
    "cerebral.com": "Saas",
    "headspace.com": "Saas",
    "sondermind.com": "Saas",
    "talkiatry.com": "Saas",
    "brightside.com": "Saas",
    "teladoc.com": "Saas",
    "mdlive.com": "Saas",
    "amwell.com": "Saas",
    "doctor-on-demand.com": "Saas",
    "openpathcollective.org": "Directory",  # therapist marketplace/directory

    # -- TRAVEL INSURANCE COMPARISON ------------------------------------------
    "squaremouth.com": "Directory",
    "insuremytrip.com": "Directory",
    "americanvisitorinsurance.com": "Directory",
    "travelinsurance.com": "Directory",
    "covermytrip.com": "Directory",
    "insurancenavigator.com": "Directory",

    # -- HOME SECURITY (bot-blocked, need priors) ------------------------------
    "brinkshome.com": "Service",
    "alliedhomesecurity.net": "Service",
    "vivint.com": "Service",
    "simplisafe.com": "Service",
    "frontpointsecurity.com": "Service",
    "cove.com": "Service",
    "abode.com": "Service",
    "guardianprotection.com": "Service",
    "homesecuritysystems.net": "Directory",  # comparison/directory not service

    # -- COMPARISON / REVIEW SITES (wrongly classified) -----------------------
    "canstar.com.au": "Directory",           # Australian comparison directory
    "finder.com.au": "Directory",            # Australian comparison directory
    "finder.com": "Directory",
    "comparethemarket.com": "Directory",
    "moneysupermarket.com": "Directory",
    "gocompare.com": "Directory",
    "confused.com": "Directory",
    "uswitch.com": "Directory",

    # -- USNEWS SUBDOMAINS -----------------------------------------------------
    "usnews.com": "Newspaper",
    "cars.usnews.com": "Newspaper",
    "money.usnews.com": "Newspaper",
    "realestate.usnews.com": "Newspaper",
    "health.usnews.com": "Newspaper",
    "education.usnews.com": "Newspaper",
    "travel.usnews.com": "Newspaper",

    # -- MORTGAGE / LENDING ---------------------------------------------------
    "credible.com": "Directory",
    "bankrate.com": "Directory",             # override fix17 Blog → Directory
    "mortgagecalculator.org": "Blog",
    "zillow.com": "Directory",
    "realtor.com": "Directory",
    "redfin.com": "Directory",
    "homes.com": "Directory",
    "trulia.com": "Directory",
    "loandepot.com": "Service",
    "rocketmortgage.com": "Service",
    "loanstream.com": "Service",
    "bettercom": "Saas",
    "better.com": "Saas",                    # digital mortgage platform
    "sofi.com": "Saas",
    "lendio.com": "Directory",
    "fundera.com": "Directory",

    # -- ELECTRIC CARS / AUTO -------------------------------------------------
    "tesla.com": "E-commerce",
    "rivian.com": "E-commerce",
    "lucidmotors.com": "E-commerce",
    "caranddriver.com": "Blog",
    "motortrend.com": "Blog",
    "edmunds.com": "Directory",
    "truecar.com": "Directory",
    "autotrader.com": "Directory",
    "cars.com": "Directory",
    "carmax.com": "Directory",
    "carvana.com": "E-commerce",
    "vroom.com": "E-commerce",

    # -- PLUMBER / LOCAL SERVICE (ensure Small business) ----------------------
    "yell.com": "Directory",
    "checkatrade.com": "Directory",
    "homeadvisor.com": "Directory",
    "thumbtack.com": "Directory",
    "bark.com": "Directory",
    "taskrabbit.com": "Directory",
    "porch.com": "Directory",

    # -- PERSONAL INJURY / LEGAL -----------------------------------------------
    "lawinfo.com": "Directory",
    "superlawyers.com": "Directory",
    "nolo.com": "Blog",
    "alllaw.com": "Blog",
    "legalnature.com": "Saas",
    "legalzoom.com": "Saas",
    "rocketlawyer.com": "Saas",
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
