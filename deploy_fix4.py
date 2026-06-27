
import re, os

# ── 1. server.js patch ──────────────────────────────────────────────────────
sjs = open('backend/server.js', encoding='utf-8').read()

OLD = '''    const rulePageResult = inferTypeFromSignals(
      item.url,
      pageData.title ?? "",
      pageData.metaDescription ?? "",
      pageData.bodyText ?? "",
      pageData.linksText ?? "",
      pageData.schemaText ?? "",
      {
        hasCart: !!pageData.hasCart,
        hasSearchAndFilter: !!pageData.hasSearchAndFilter,
        hasPhone: !!pageData.hasPhone,
        hasAddress: !!pageData.hasAddress,
        hasMap: !!pageData.hasMap,
        hasReviews: !!pageData.hasReviews,
        hasBusinessListingSchema: !!pageData.hasBusinessListingSchema,
        hasProductSchema: !!pageData.hasProductSchema,
        hasArticleSchema: !!pageData.hasArticleSchema,
      },
      knownPrior || domainAnalysis?.siteType || null
    );

    const fastTextResult = await classifyWithFastText(item.url, pageData);
    const mergedPageResult = mergeRuleBasedWithFastText(rulePageResult, fastTextResult);

    const lowerUrl = String(item.url || "").toLowerCase();
    const isHomepage = /^https?:\\/\\/[^/]+\\/?$/.test(lowerUrl);
    const serpUrlIsShop = /\\/collections\\/|\\/products?\\/|\\/shop\\/|\\/store\\/|\\/cart\\/|\\/checkout\\/|\\/buy\\/|\\/catalog\\//i.test(lowerUrl);

    // If the domain was classified as E-commerce purely from a Magento fingerprint on the
    // homepage, don't blindly inherit that for SERP URLs that are clearly not shop pages.
    // Magento is used by many non-ecommerce sites (blogs, directories, news sites).
    const domainFromMagentoOnly =
      domainAnalysis?.siteType === "E-commerce" &&
      domainAnalysis?.matchedSignals?.[0] === "Platform fingerprint: Magento" &&
      !serpUrlIsShop;
    const effectiveDomainSiteType = domainFromMagentoOnly ? null : domainAnalysis?.siteType;'''

NEW = '''    const lowerUrl = String(item.url || "").toLowerCase();
    const isHomepage = /^https?:\\/\\/[^/]+\\/?$/.test(lowerUrl);
    const serpUrlIsShop = /\\/collections\\/|\\/products?\\/|\\/shop\\/|\\/store\\/|\\/cart\\/|\\/checkout\\/|\\/buy\\/|\\/catalog\\//i.test(lowerUrl);
    const serpUrlIsContentPage = /\\/blog\\/|\\/blogs\\/|\\/news\\/|\\/article\\/|\\/articles\\/|\\/guide\\/|\\/review\\/|\\/reviews\\/|\\/post\\/|\\/posts\\/|\\/video\\/|\\/videos\\/|\\/select\\/|\\/picks\\/|\\/ranked\\/|\\/roundup\\/|\\/forum\\/|\\/opinion\\/|\\/best\\//i.test(lowerUrl);

    // If the domain was classified as E-commerce purely from a Magento or WooCommerce fingerprint
    // on the homepage, don\'t blindly inherit that for SERP URLs that are clearly content pages.
    // Magento is used by many non-ecommerce sites; WooCommerce appears on blogs that sell nothing.
    const domainSignal = domainAnalysis?.matchedSignals?.[0] || "";
    const domainFromPlatformFP =
      domainAnalysis?.siteType === "E-commerce" &&
      (domainSignal === "Platform fingerprint: Magento" ||
       domainSignal === "Platform fingerprint: WooCommerce") &&
      !serpUrlIsShop &&
      (domainSignal === "Platform fingerprint: Magento" || serpUrlIsContentPage);
    const effectiveDomainSiteType = domainFromPlatformFP ? null : domainAnalysis?.siteType;

    const rulePageResult = inferTypeFromSignals(
      item.url,
      pageData.title ?? "",
      pageData.metaDescription ?? "",
      pageData.bodyText ?? "",
      pageData.linksText ?? "",
      pageData.schemaText ?? "",
      {
        hasCart: !!pageData.hasCart,
        hasSearchAndFilter: !!pageData.hasSearchAndFilter,
        hasPhone: !!pageData.hasPhone,
        hasAddress: !!pageData.hasAddress,
        hasMap: !!pageData.hasMap,
        hasReviews: !!pageData.hasReviews,
        hasBusinessListingSchema: !!pageData.hasBusinessListingSchema,
        hasProductSchema: !!pageData.hasProductSchema,
        hasArticleSchema: !!pageData.hasArticleSchema,
      },
      knownPrior || effectiveDomainSiteType || null
    );

    const fastTextResult = await classifyWithFastText(item.url, pageData);
    const mergedPageResult = mergeRuleBasedWithFastText(rulePageResult, fastTextResult);'''

if OLD in sjs:
    sjs = sjs.replace(OLD, NEW, 1)
    open('backend/server.js', 'w', encoding='utf-8').write(sjs)
    print('server.js patched OK')
else:
    print('ERROR: server.js patch target not found - already patched or mismatched')

# ── 2. exact.json patch ─────────────────────────────────────────────────────
ej = open('backend/config/domain-priors/exact.json', encoding='utf-8').read()

NEW_ENTRIES = ''',

  "abcnews.go.com": "Newspaper",
  "abcnews.com": "Newspaper",
  "telegraph.co.uk": "Newspaper",
  "thetelegraph.co.uk": "Newspaper",
  "theweek.com": "Newspaper",
  "nymag.com": "Newspaper",
  "runrepeat.com": "Blog",
  "letsrun.com": "Blog",
  "fleetfeet.com": "E-commerce",
  "sixminutemile.com": "Blog",

  "gq.com": "Newspaper",
  "esquire.com": "Newspaper",
  "menshealth.com": "Newspaper",
  "womenshealthmag.com": "Newspaper",
  "self.com": "Newspaper",
  "shape.com": "Newspaper",
  "outsideonline.com": "Newspaper",
  "verywellfit.com": "Newspaper",
  "forum.videofitness.com": "Blog",
  "doctorsofrunning.com": "Blog",
  "theruntesters.com": "Blog",
  "rtings.com": "Blog",
  "outdoorgearlab.com": "Blog",
  "gearjunkie.com": "Newspaper"
}'''

if '"sixminutemile.com": "Blog"' in ej and NEW_ENTRIES.strip('"') not in ej:
    if ej.rstrip().endswith('}'):
        # Replace the closing brace to inject new entries
        ej = ej.rstrip()
        # Find last entry and replace closing }
        last_brace = ej.rfind('}')
        # Check if sixminutemile is the last entry
        trimmed = ej[:last_brace].rstrip().rstrip(',')
        if trimmed.endswith('"Blog"'):
            ej = trimmed + NEW_ENTRIES
            open('backend/config/domain-priors/exact.json', 'w', encoding='utf-8').write(ej)
            print('exact.json patched OK')
        else:
            print('exact.json: sixminutemile is not the last entry, skipping to avoid duplicate')
    else:
        print('exact.json format unexpected')
elif '"abcnews.com": "Newspaper"' in ej:
    print('exact.json already patched')
else:
    print('ERROR: exact.json patch target not found')

print('All done!')
