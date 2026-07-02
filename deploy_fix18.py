#!/usr/bin/env python3
"""
Phase 2 domain prior fixes -- batch 18.
Bulk proactive coverage across all major keyword categories not yet covered:
VPN, web hosting, legal/lawyer, insurance, home security, health/medical,
travel, food delivery, education, jobs, software reviews, finance, streaming,
fitness, real estate, local services, automotive.
"""
import json, pathlib, sys

EXACT_PATH = pathlib.Path("backend/config/domain-priors/exact.json")

NEW_PRIORS = {
    # -- CREDIT CARDS (fix17 follow-up) ----------------------------------------
    "creditkarma.com": "Service",           # Credit Karma -- free credit monitoring platform

    # -- VPN -------------------------------------------------------------------
    "nordvpn.com": "Saas",                  # NordVPN
    "expressvpn.com": "Saas",              # ExpressVPN
    "surfshark.com": "Saas",               # Surfshark VPN
    "privateinternetaccess.com": "Saas",   # Private Internet Access
    "cyberghostvpn.com": "Saas",           # CyberGhost VPN
    "protonvpn.com": "Saas",              # ProtonVPN
    "ipvanish.com": "Saas",               # IPVanish
    "purevpn.com": "Saas",                # PureVPN
    "mullvad.net": "Saas",                # Mullvad VPN
    "tunnelbear.com": "Saas",             # TunnelBear VPN
    "vpnmentor.com": "Blog",              # VPN Mentor -- VPN review blog
    "tomsguide.com": "Blog",              # Tom's Guide -- tech review blog
    "techradar.com": "Blog",              # TechRadar -- tech review blog
    "pcmag.com": "Blog",                  # PCMag -- tech review blog
    "cnet.com": "Blog",                   # CNET -- tech review/news blog
    "techcrunch.com": "Newspaper",        # TechCrunch -- tech news
    "theverge.com": "Newspaper",          # The Verge -- tech news
    "wired.com": "Newspaper",             # Wired -- tech news/magazine
    "zdnet.com": "Blog",                  # ZDNet -- tech review blog
    "engadget.com": "Newspaper",          # Engadget -- tech news
    "arstechnica.com": "Newspaper",       # Ars Technica -- tech news

    # -- WEB HOSTING -----------------------------------------------------------
    "bluehost.com": "Service",            # Bluehost -- web hosting
    "hostgator.com": "Service",           # HostGator -- web hosting
    "siteground.com": "Service",          # SiteGround -- web hosting
    "godaddy.com": "Service",             # GoDaddy -- domain/hosting
    "namecheap.com": "Service",           # Namecheap -- domain/hosting
    "kinsta.com": "Service",              # Kinsta -- managed WordPress hosting
    "wpengine.com": "Service",            # WP Engine -- managed WordPress hosting
    "a2hosting.com": "Service",           # A2 Hosting
    "dreamhost.com": "Service",           # DreamHost -- web hosting
    "inmotion.com": "Service",            # InMotion Hosting
    "inmotionhosting.com": "Service",     # InMotion Hosting (alt domain)
    "hostinger.com": "Service",           # Hostinger -- web hosting
    "cloudflare.com": "Saas",            # Cloudflare -- CDN/security SaaS
    "digitalocean.com": "Saas",          # DigitalOcean -- cloud hosting SaaS
    "linode.com": "Saas",                # Linode/Akamai -- cloud hosting
    "vultr.com": "Saas",                 # Vultr -- cloud hosting

    # -- LEGAL / LAWYER --------------------------------------------------------
    "lawyers.com": "Directory",           # Lawyers.com -- lawyer directory
    "martindale.com": "Directory",        # Martindale-Hubbell -- lawyer directory
    "superlawyers.com": "Directory",      # Super Lawyers -- lawyer directory
    "justia.com": "Directory",            # Justia -- legal directory/resource
    "nolo.com": "Blog",                  # Nolo -- legal self-help/editorial blog
    "legalzoom.com": "Service",          # LegalZoom -- online legal service
    "law.com": "Newspaper",              # Law.com -- legal news
    "americanbar.org": "Service",        # American Bar Association
    "hg.org": "Directory",               # HG.org -- lawyer directory

    # -- INSURANCE (general/home/life -- car already covered) ------------------
    "statefarm.com": "Service",          # State Farm -- insurance
    "geico.com": "Service",              # GEICO -- insurance
    "allstate.com": "Service",           # Allstate -- insurance
    "nationwide.com": "Service",         # Nationwide -- insurance
    "metlife.com": "Service",            # MetLife -- life insurance
    "sunlife.com": "Service",            # Sun Life -- life insurance
    "newyorklife.com": "Service",        # New York Life -- life insurance
    "massmutual.com": "Service",         # MassMutual -- life insurance
    "guardian.com": "Service",           # Guardian Life -- insurance
    "pacificlife.com": "Service",        # Pacific Life -- life insurance
    "coverhound.com": "Directory",       # CoverHound -- insurance comparison
    "policygenius.com": "Directory",     # PolicyGenius -- insurance comparison directory
    "ehealthinsurance.com": "Directory", # eHealth -- health insurance marketplace
    "healthcare.gov": "Service",         # HealthCare.gov -- gov marketplace
    "cigna.com": "Service",              # Cigna -- health insurance
    "uhc.com": "Service",               # UnitedHealthcare
    "humana.com": "Service",            # Humana -- health insurance
    "anthem.com": "Service",            # Anthem -- health insurance
    "bcbs.com": "Service",              # Blue Cross Blue Shield
    "aetna.com": "Service",             # Aetna -- health insurance (already in list but confirm)

    # -- HOME SECURITY ---------------------------------------------------------
    "ring.com": "E-commerce",           # Ring -- home security e-commerce
    "adt.com": "Service",               # ADT -- home security monitoring service
    "simplisafe.com": "Service",        # SimpliSafe -- home security
    "vivint.com": "Service",            # Vivint -- home security
    "frontpoint.com": "Service",        # Frontpoint -- home security
    "brinks.com": "Service",            # Brinks Home Security
    "abodeapp.com": "Saas",             # Abode -- smart home security SaaS
    "cove.com": "Service",              # Cove -- home security

    # -- HEALTH / MEDICAL ------------------------------------------------------
    "mayoclinic.org": "Service",        # Mayo Clinic -- medical institution
    "webmd.com": "Blog",                # WebMD -- health information blog
    "medicalnewstoday.com": "Blog",     # Medical News Today -- health blog
    "everydayhealth.com": "Blog",       # Everyday Health -- health blog
    "verywell.com": "Blog",             # Verywell -- health blog
    "verywellhealth.com": "Blog",       # Verywell Health
    "verywellmind.com": "Blog",         # Verywell Mind
    "psychologytoday.com": "Blog",      # Psychology Today -- mental health blog/directory
    "medlineplus.gov": "Service",       # MedlinePlus -- NIH health resource
    "cdc.gov": "Service",               # CDC -- government health agency
    "who.int": "Service",               # World Health Organization
    "rxlist.com": "Blog",               # RxList -- drug information blog
    "drugs.com": "Blog",                # Drugs.com -- drug information
    "goodrx.com": "Service",           # GoodRx -- prescription pricing service
    "teladoc.com": "Service",          # Teladoc -- telehealth service
    "zocdoc.com": "Directory",         # ZocDoc -- doctor booking directory
    "healthgrades.com": "Directory",   # Healthgrades -- doctor directory

    # -- TRAVEL ----------------------------------------------------------------
    "priceline.com": "Directory",       # Priceline -- travel comparison/booking
    "travelocity.com": "Directory",     # Travelocity -- travel booking
    "hotwire.com": "Directory",         # Hotwire -- travel deals
    "skyscanner.com": "Directory",      # Skyscanner -- flight comparison
    "skyscanner.net": "Directory",      # Skyscanner (alt TLD)
    "momondo.com": "Directory",         # Momondo -- flight comparison
    "google.com/travel": "Directory",  # Google Travel
    "lonelyplanet.com": "Blog",        # Lonely Planet -- travel editorial blog
    "nomadicmatt.com": "Blog",         # Nomadic Matt -- travel blog
    "theplanetd.com": "Blog",          # The Planet D -- travel blog
    "afar.com": "Blog",               # AFAR -- travel magazine/blog
    "cntraveler.com": "Blog",         # Condé Nast Traveler -- travel magazine
    "travelandleisure.com": "Newspaper", # Travel + Leisure -- (already in list, confirm)
    "timeout.com": "Blog",            # Time Out -- city/travel guide
    "viator.com": "Directory",        # Viator -- tours/experiences directory
    "getyourguide.com": "Directory",  # GetYourGuide -- tours directory
    "rentalcars.com": "Directory",     # RentalCars.com -- car rental comparison
    "enterprise.com": "Service",      # Enterprise -- car rental
    "hertz.com": "Service",           # Hertz -- car rental
    "avis.com": "Service",            # Avis -- car rental
    "budget.com": "Service",          # Budget -- car rental
    "marriott.com": "Service",        # Marriott -- hotel chain
    "hilton.com": "Service",          # Hilton -- hotel chain
    "hyatt.com": "Service",           # Hyatt -- hotel chain
    "ihg.com": "Service",             # IHG -- hotel chain
    "wyndhamhotels.com": "Service",   # Wyndham -- hotel chain

    # -- FOOD DELIVERY ---------------------------------------------------------
    "doordash.com": "Service",         # DoorDash -- food delivery
    "ubereats.com": "Service",         # Uber Eats -- food delivery
    "grubhub.com": "Service",          # Grubhub -- food delivery
    "postmates.com": "Service",        # Postmates -- food delivery
    "seamless.com": "Service",         # Seamless -- food delivery
    "yelp.com": "Directory",           # Yelp -- local business directory (already in list)
    "opentable.com": "Directory",      # OpenTable -- restaurant booking directory
    "resy.com": "Directory",           # Resy -- restaurant booking
    "zomato.com": "Directory",         # Zomato -- restaurant directory
    "allrecipes.com": "Blog",          # Allrecipes -- recipe blog
    "foodnetwork.com": "Blog",         # Food Network -- food blog/TV
    "seriouseats.com": "Blog",         # Serious Eats -- food editorial blog
    "bonappetit.com": "Blog",          # Bon Appétit -- food magazine/blog
    "epicurious.com": "Blog",          # Epicurious -- recipe/food blog
    "tasty.co": "Blog",               # Tasty -- recipe blog
    "thekitchn.com": "Blog",          # The Kitchn -- food blog

    # -- EDUCATION -------------------------------------------------------------
    "udemy.com": "Saas",              # Udemy -- online learning platform
    "coursera.org": "Saas",           # Coursera -- online learning (already in list)
    "edx.org": "Saas",               # edX -- online learning
    "khanacademy.org": "Saas",        # Khan Academy (already in list)
    "skillshare.com": "Saas",         # Skillshare -- online learning
    "linkedin.com/learning": "Saas",  # LinkedIn Learning
    "masterclass.com": "Saas",        # MasterClass -- online courses
    "pluralsight.com": "Saas",        # Pluralsight -- tech learning
    "codecademy.com": "Saas",         # Codecademy -- coding education
    "treehouse.com": "Saas",          # Treehouse -- coding education
    "study.com": "Saas",              # Study.com -- online education
    "chegg.com": "Saas",              # Chegg -- student learning platform
    "tutoring.com": "Service",        # Tutoring.com

    # -- JOBS / RECRUITING -----------------------------------------------------
    "indeed.com": "Directory",        # Indeed -- job directory
    "glassdoor.com": "Directory",     # Glassdoor -- job/company directory
    "monster.com": "Directory",       # Monster -- job directory
    "ziprecruiter.com": "Directory",  # ZipRecruiter -- job directory
    "simplyhired.com": "Directory",   # SimplyHired -- job directory
    "careerbuilder.com": "Directory", # CareerBuilder -- job directory
    "dice.com": "Directory",          # Dice -- tech jobs directory
    "flexjobs.com": "Directory",      # FlexJobs -- remote job directory
    "remote.co": "Directory",         # Remote.co -- remote job directory
    "upwork.com": "Directory",        # Upwork -- freelance marketplace
    "fiverr.com": "Directory",        # Fiverr -- freelance marketplace
    "toptal.com": "Directory",        # Toptal -- freelance network

    # -- SOFTWARE REVIEWS / B2B ------------------------------------------------
    "g2.com": "Directory",            # G2 -- software review directory
    "capterra.com": "Directory",      # Capterra -- software review directory
    "getapp.com": "Directory",        # GetApp -- software directory
    "softwareadvice.com": "Directory", # Software Advice -- software directory
    "trustradius.com": "Directory",   # TrustRadius -- software review directory
    "gartner.com": "Blog",            # Gartner -- tech research/advisory
    "forrester.com": "Blog",          # Forrester -- tech research
    "techrepublic.com": "Blog",       # TechRepublic -- tech editorial blog

    # -- STREAMING / ENTERTAINMENT ---------------------------------------------
    "netflix.com": "Saas",            # Netflix -- streaming
    "hulu.com": "Saas",              # Hulu -- streaming
    "disneyplus.com": "Saas",        # Disney+ -- streaming
    "hbomax.com": "Saas",            # HBO Max -- streaming
    "max.com": "Saas",               # Max (HBO Max) -- streaming
    "peacocktv.com": "Saas",         # Peacock -- streaming
    "paramountplus.com": "Saas",     # Paramount+ -- streaming
    "appletv.com": "Saas",           # Apple TV+ -- streaming
    "primevideo.com": "Saas",        # Amazon Prime Video
    "spotify.com": "Saas",           # Spotify -- music streaming
    "pandora.com": "Saas",           # Pandora -- music streaming
    "tidal.com": "Saas",             # Tidal -- music streaming
    "rottentomatoes.com": "Directory", # Rotten Tomatoes -- movie/show directory
    "imdb.com": "Directory",          # IMDb -- movie/show directory
    "commonsensemedia.org": "Blog",   # Common Sense Media -- review blog
    "variety.com": "Newspaper",       # Variety -- entertainment news
    "hollywoodreporter.com": "Newspaper", # Hollywood Reporter -- entertainment news
    "deadline.com": "Newspaper",      # Deadline -- entertainment news
    "tvline.com": "Blog",            # TVLine -- TV news/blog

    # -- AUTOMOTIVE ------------------------------------------------------------
    "edmunds.com": "Directory",       # Edmunds -- car directory/reviews
    "motortrend.com": "Blog",         # MotorTrend -- auto review blog
    "caranddriver.com": "Blog",       # Car and Driver -- auto review blog
    "roadandtrack.com": "Blog",       # Road & Track -- auto review blog
    "consumerreports.org": "Blog",    # Consumer Reports -- review blog (already in list)
    "carvana.com": "E-commerce",      # Carvana -- online car sales
    "vroom.com": "E-commerce",        # Vroom -- online car sales
    "carmax.com": "E-commerce",       # CarMax -- used car sales
    "kbb.com": "Directory",          # Kelley Blue Book (already in list)
    "cars.com": "Directory",         # Cars.com (already in list)
    "autotrader.com": "Directory",   # AutoTrader (already in list)
    "truecar.com": "Directory",      # TrueCar -- car pricing directory

    # -- LOCAL SERVICES --------------------------------------------------------
    "homeadvisor.com": "Directory",   # HomeAdvisor -- home services directory
    "angieslist.com": "Directory",    # Angie's List -- home services directory
    "angi.com": "Directory",          # Angi (merged Angie's List)
    "porch.com": "Directory",         # Porch -- home services directory
    "houzz.com": "Directory",         # Houzz -- home design/contractor directory
    "bark.com": "Directory",          # Bark.com -- local services directory

    # -- PRODUCTIVITY / SAAS TOOLS ---------------------------------------------
    "asana.com": "Saas",             # Asana -- project management SaaS
    "monday.com": "Saas",            # Monday.com -- work OS SaaS
    "clickup.com": "Saas",           # ClickUp -- productivity SaaS
    "trello.com": "Saas",            # Trello -- project management
    "basecamp.com": "Saas",          # Basecamp -- project management
    "zendesk.com": "Saas",           # Zendesk -- customer service SaaS
    "freshdesk.com": "Saas",         # Freshdesk -- customer service SaaS
    "intercom.com": "Saas",          # Intercom -- customer messaging SaaS
    "mailchimp.com": "Saas",         # Mailchimp -- email marketing SaaS
    "constantcontact.com": "Saas",   # Constant Contact -- email marketing
    "activecampaign.com": "Saas",    # ActiveCampaign -- marketing automation
    "klaviyo.com": "Saas",           # Klaviyo -- ecom email marketing
    "shopify.com": "Saas",           # Shopify -- ecom SaaS
    "wix.com": "Saas",               # Wix -- website builder SaaS
    "squarespace.com": "Saas",       # Squarespace -- website builder SaaS
    "wordpress.com": "Saas",         # WordPress.com -- website/blog SaaS
    "webflow.com": "Saas",           # Webflow -- website builder SaaS
    "zoom.us": "Saas",               # Zoom -- video conferencing SaaS
    "docusign.com": "Saas",          # DocuSign -- e-signature SaaS
    "dropbox.com": "Saas",           # Dropbox -- cloud storage SaaS
    "box.com": "Saas",               # Box -- cloud storage SaaS
    "quickbooks.com": "Saas",        # QuickBooks -- accounting SaaS
    "freshbooks.com": "Saas",        # FreshBooks -- accounting SaaS
    "xero.com": "Saas",              # Xero -- accounting SaaS
    "gusto.com": "Saas",             # Gusto -- HR/payroll SaaS
    "rippling.com": "Saas",          # Rippling -- HR SaaS
    "workday.com": "Saas",           # Workday -- HR/finance SaaS
    "bamboohr.com": "Saas",          # BambooHR -- HR SaaS

    # -- FINANCE (additional) --------------------------------------------------
    "nerdwallet.com": "Blog",         # NerdWallet -- personal finance blog/comparison
    "thebalance.com": "Blog",         # The Balance -- personal finance blog
    "thebalancemoney.com": "Blog",    # The Balance Money
    "fool.com": "Blog",              # Motley Fool -- investment editorial blog
    "marketwatch.com": "Newspaper",  # MarketWatch -- financial news
    "barrons.com": "Newspaper",      # Barron's -- financial news
    "morningstar.com": "Blog",       # Morningstar -- investment research blog
    "creditwise.com": "Service",     # CreditWise -- credit monitoring
    "mint.com": "Saas",             # Mint -- personal finance SaaS
    "personalcapital.com": "Saas",  # Personal Capital -- wealth management SaaS
    "sofi.com": "Service",          # SoFi -- fintech service
    "chime.com": "Service",         # Chime -- online banking
    "discover.com": "Service",      # Discover -- financial services
    "capitalone.com": "Service",    # Capital One -- bank/financial service
    "chase.com": "Service",         # Chase -- bank
    "wellsfargo.com": "Service",    # Wells Fargo -- bank
    "citibank.com": "Service",      # Citibank -- bank
    "americanexpress.com": "Service", # American Express -- financial service
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
