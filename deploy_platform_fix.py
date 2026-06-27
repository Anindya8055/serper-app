import json, re

# ── 1. server.js: fix platform fingerprint short-circuit ────────────────────
sjs = open('backend/server.js', encoding='utf-8').read()

OLD = '''    // Platform fingerprint (Shopify, WooCommerce, etc.) — high-confidence shortcut.
    // Guard: if the SERP URL itself is a content page, don't inherit E-commerce siteType
    // from the domain fingerprint — let the normal classifier determine siteType from page content.
    const platformMatch = pageData._platformMatch;
    delete pageData._platformMatch;
    const serpUrlIsContent = /\\/blog\\/|\\/blogs\\/|\\/news\\/|\\/article\\/|\\/articles\\/|\\/guide\\/|\\/review\\/|\\/reviews\\/|\\/post\\/|\\/posts\\/|\\/video\\/|\\/videos\\/|\\/select\\/|\\/picks\\/|\\/ranked\\/|\\/roundup\\/|\\/forum\\/|\\/opinion\\//i.test(item.url);
    if (platformMatch && !(platformMatch.siteType === "E-commerce" && serpUrlIsContent)) {
      const platformSiteType = normalizeType(platformMatch.siteType);
      const platformContentType = normalizeType(
        classifyContentType(item.url, pageData, platformSiteType)
      );
      return {
        ...item,
        siteType: platformSiteType,
        contentType: platformContentType,
        confidence: "High",
        classifierVersion: CLASSIFIER_VERSION,
        matchedSignals: [
          `Platform fingerprint: ${platformMatch.platform}`,
          ...(knownPrior ? [`Known domain prior: ${knownPrior}`] : []),
        ],
        analyzedPages: [item.url],
        analysisStatus: "done",
        pageData,
      };
    }'''

NEW = '''    // Platform fingerprint (Shopify, WooCommerce, etc.) — high-confidence shortcut.
    // Guards:
    // 1. WordPress is used equally by blogs AND small businesses/service companies.
    //    Never short-circuit on WordPress alone — let the full classifier run.
    // 2. Magento/WooCommerce without cart evidence: many local service sites (dental clinics,
    //    plumbers, agencies) run on these platforms without actually selling products.
    //    Only short-circuit to E-commerce when there is real cart/shop evidence.
    // 3. Don't inherit E-commerce when the SERP URL is clearly a content page.
    const platformMatch = pageData._platformMatch;
    delete pageData._platformMatch;
    const serpUrlIsContent = /\\/blog\\/|\\/blogs\\/|\\/news\\/|\\/article\\/|\\/articles\\/|\\/guide\\/|\\/review\\/|\\/reviews\\/|\\/post\\/|\\/posts\\/|\\/video\\/|\\/videos\\/|\\/select\\/|\\/picks\\/|\\/ranked\\/|\\/roundup\\/|\\/forum\\/|\\/opinion\\//i.test(item.url);
    const serpUrlIsShopFP = /\\/collections\\/|\\/products?\\/|\\/shop\\/|\\/store\\/|\\/cart\\/|\\/checkout\\/|\\/buy\\/|\\/catalog\\//i.test(item.url.toLowerCase());
    const isEcomPlatformFP = platformMatch?.siteType === "E-commerce";
    // Magento/WooCommerce need cart evidence to be trusted as E-commerce
    const platformNeedsCartCheck =
      isEcomPlatformFP &&
      !pageData.hasCart &&
      !serpUrlIsShopFP &&
      (platformMatch?.platform === "Magento" || platformMatch?.platform === "WooCommerce");
    const usePlatformShortCircuit =
      platformMatch &&
      platformMatch.platform !== "WordPress" &&
      !(isEcomPlatformFP && serpUrlIsContent) &&
      !platformNeedsCartCheck;

    if (usePlatformShortCircuit) {
      const platformSiteType = normalizeType(platformMatch.siteType);
      const platformContentType = normalizeType(
        classifyContentType(item.url, pageData, platformSiteType)
      );
      return {
        ...item,
        siteType: platformSiteType,
        contentType: platformContentType,
        confidence: "High",
        classifierVersion: CLASSIFIER_VERSION,
        matchedSignals: [
          `Platform fingerprint: ${platformMatch.platform}`,
          ...(knownPrior ? [`Known domain prior: ${knownPrior}`] : []),
        ],
        analyzedPages: [item.url],
        analysisStatus: "done",
        pageData,
      };
    }'''

if OLD in sjs:
    sjs = sjs.replace(OLD, NEW, 1)
    print('platform fingerprint fix patched OK')
else:
    print('ERROR: platform fingerprint patch target not found')

open('backend/server.js', 'w', encoding='utf-8').write(sjs)
print('server.js written.')

# ── 2. exact.json: add service/directory priors for known local-keyword sites ─
path = 'backend/config/domain-priors/exact.json'
with open(path, encoding='utf-8') as f:
    data = json.load(f)

additions = {
  # Delta Dental variants (insurance — Service)
  "deltadental.com": "Service",
  "deltadentalca.com": "Service",
  "deltadentalil.com": "Service",
  "deltadentalma.com": "Service",
  "deltadentaloh.com": "Service",
  "deltadentalins.com": "Service",
  "deltadentalwa.com": "Service",
  "deltadentalmo.com": "Service",
  "deltadentalmi.com": "Service",
  "deltadentaltn.com": "Service",
  "deltadentalco.com": "Service",

  # Other dental/health insurance (Service)
  "cigna.com": "Service",
  "humana.com": "Service",
  "unitedhealthcare.com": "Service",
  "anthem.com": "Service",
  "bcbs.com": "Service",
  "bluecrossca.com": "Service",
  "bcbsil.com": "Service",
  "bcbsnc.com": "Service",
  "medicaid.gov": "Service",
  "medicare.gov": "Service",

  # Local service directories
  "homeguide.com": "Directory",
  "networx.com": "Directory",
  "servicemagic.com": "Directory",
  "hireahelpernearme.com": "Directory",
  "fixr.com": "Directory",
  "homedepot.com/services": "Directory",
  "taskrabbit.com": "Directory",
  "handy.com": "Directory",
  "care.com": "Directory",
  "sittercity.com": "Directory",
  "rover.com": "Directory",
  "wyzant.com": "Directory",
  "tutors.com": "Directory",
  "zocdoc.com": "Directory",
  "healthgrades.com": "Directory",
  "vitals.com": "Directory",
  "ratemds.com": "Directory",
  "webmd.com/find-a-doctor": "Directory",
  "usnews.com/doctors": "Directory",
  "npiprofile.com": "Directory",
  "doximity.com": "Directory",
  "1800dentist.com": "Directory",
  "askthedentist.com": "Blog",

  # Home services
  "rotorooter.com": "Small business",
  "aspendental.com": "Small business",
  "aspendentalcare.com": "Small business",
  "heartland.com": "Service",

  # Contractor/service marketplaces
  "buildzoom.com": "Directory",
  "contractors.com": "Directory",
  "remodelingexpense.com": "Blog",
  "homewyse.com": "Blog",
  "houselogic.com": "Blog",
  "bobvila.com": "Blog",
  "thisoldhouse.com": "Newspaper",
  "angieslist.com": "Directory",
  "homeadvisor.com": "Directory",
}

changed = 0
for domain, site_type in additions.items():
    if domain not in data:
        data[domain] = site_type
        changed += 1

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f'exact.json: added {changed} new priors.')
print('All done!')
