import re

path = 'backend/analyzer.js'
src = open(path, encoding='utf-8').read()

# Fix the platform fingerprint short-circuit in analyzeDomain().
# This is the root cause of WordPress local business sites being classified as Blog:
# the domain analysis short-circuits to Blog for ALL WordPress sites, then that
# Blog hint (+3 "site type hint from domain analysis") poisons the SERP URL classifier.
#
# Fix: apply the same guards as server.js:
#   1. Never short-circuit on WordPress alone.
#   2. Don't short-circuit Magento/WooCommerce as E-commerce without cart evidence.

OLD = '''  // Platform fingerprint shortcut — skip full domain analysis (homepages always qualify)
  const platformMatch = homepageRaw._platformMatch;
  if (platformMatch) {
    delete homepageRaw._platformMatch;
    return {
      domain: getBaseDomain(homepageUrl),
      homepageUrl,
      classifierVersion: null,
      siteType: platformMatch.siteType,
      confidence: "High",
      topScore: 1,
      secondScore: 0,
      scoreGap: 1,
      scores: null,
      analyzedPages: [homepageUrl],
      pageTitles: [homepageRaw.title].filter(Boolean),
      pageClassifications: [],
      matchedSignals: [`Platform fingerprint: ${platformMatch.platform}`],
    };
  }'''

NEW = '''  // Platform fingerprint shortcut — skip full domain analysis (homepages always qualify)
  // Guards (mirrors server.js):
  //   1. WordPress is used by blogs AND local businesses equally — never short-circuit.
  //   2. Magento/WooCommerce without cart evidence: many local service sites run on these
  //      without selling products. Only short-circuit when hasCart is true.
  const platformMatch = homepageRaw._platformMatch;
  const isEcomPlatformFP = platformMatch?.siteType === "E-commerce";
  const platformNeedsCartCheck =
    isEcomPlatformFP &&
    !homepageRaw.hasCart &&
    (platformMatch?.platform === "Magento" || platformMatch?.platform === "WooCommerce");
  const usePlatformShortCircuit =
    platformMatch &&
    platformMatch.platform !== "WordPress" &&
    !platformNeedsCartCheck;

  if (usePlatformShortCircuit) {
    delete homepageRaw._platformMatch;
    return {
      domain: getBaseDomain(homepageUrl),
      homepageUrl,
      classifierVersion: null,
      siteType: platformMatch.siteType,
      confidence: "High",
      topScore: 1,
      secondScore: 0,
      scoreGap: 1,
      scores: null,
      analyzedPages: [homepageUrl],
      pageTitles: [homepageRaw.title].filter(Boolean),
      pageClassifications: [],
      matchedSignals: [`Platform fingerprint: ${platformMatch.platform}`],
    };
  }
  if (platformMatch) {
    delete homepageRaw._platformMatch;
    // Store platform info for downstream use but let full classifier run
    homepageRaw._platformNote = platformMatch.platform;
  }'''

if OLD in src:
    src = src.replace(OLD, NEW, 1)
    print('analyzeDomain platform fingerprint guard patched OK')
else:
    print('ERROR: analyzeDomain patch target not found')

open(path, 'w', encoding='utf-8').write(src)
print('analyzer.js written.')
print('All done!')
