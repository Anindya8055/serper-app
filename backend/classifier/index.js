const fs = require("fs");
const path = require("path");
const CLASSIFIER_VERSION = "classifier_v1";

const {
  createDomainIntelligence,
  DEFAULT_SITE_TYPES,
} = require("../lib/domain-intelligence");

const {
  getHostname,
  getPathname,
  isEditorialUrl,
  isEditorialPath,
  isCommerceUrl,
  isStrongSmallBusinessPath,
  hasSmallBusinessNiche,
} = require("../lib/url-utils");

function loadJson(relativePath) {
  const filePath = path.join(__dirname, "..", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const EXACT = loadJson("./config/domain-priors/exact.json");
const SUFFIX = loadJson("./config/domain-priors/suffix.json");
const PATH_OVERRIDES = loadJson("./config/domain-priors/path-overrides.json");

const domainIntel = createDomainIntelligence({
  exact: EXACT,
  suffix: SUFFIX,
  siteTypes: DEFAULT_SITE_TYPES,
});

const {
  SITETYPES,
  normalizeType,
  createScores,
  addScore,
  subtractScore,
  mergeScores,
  getTopScore,
  hasStrongNonSmallBusiness,
  getDomainPrior,
} = require("./helpers");

const {
  scoreUrlPath,
  scoreSchema,
  scoreTitle,
  scoreMetaDescription,
  scoreBodyText,
  scoreLinksText,
  scoreStructuredSignals,
} = require("./scorer");

const { applyInteractionRules } = require("./interaction-rules");
const { applyFinalDomainOverrides } = require("./overrides");
const { adjustContentTypeAfterScoring } = require("./content-type");

function isBotBlocked(title, bodyText) {
  const t = String(title || "").toLowerCase();
  const b = String(bodyText || "").toLowerCase().slice(0, 1200);

  const blockPhrases = [
    "just a moment",
    "robot or human",
    "access denied",
    "attention required",
    "are you human",
    "enable javascript",
    "please verify",
    "ddos protection",
    "checking your browser",
    "403 forbidden",
    "temporarily unavailable",
    "this site has determined a security issue with your request",
    "security issue with your request",
    "you do not have permission to access this page",
    "request blocked",
    "the request could not be satisfied",
    "sorry, you have been blocked",
    "verify you are human",
    "press and hold",
    "cf challenge",
    "cloudflare",
    "akamai",
    "perimeterx",
    "incapsula",
    "access to this page has been denied",
  ];

  return blockPhrases.some((p) => t.includes(p) || b.includes(p));
}

function isThinExtraction(title, metaDescription, bodyText, linksText, schemaText) {
  const titleLen = String(title || "").trim().length;
  const metaLen = String(metaDescription || "").trim().length;
  const bodyLen = String(bodyText || "").trim().length;
  const linksLen = String(linksText || "").trim().length;
  const schemaLen = String(schemaText || "").trim().length;

  const veryThinText = bodyLen < 160 && titleLen < 18 && metaLen < 40;
  const almostNothingExtracted = bodyLen < 80 && linksLen < 80 && schemaLen < 40;

  return veryThinText || almostNothingExtracted;
}

function extractSchemaTypes(schemaText) {
  const s = String(schemaText || "");

  const isRestaurantSchema = /"@type"\s*:\s*"(restaurant|foodestablishment|bakery|barorpub|brewery|fastfood|cafeorocoffeeshop|icecreamshop|pizzarestaurant|winery|bar)"/i.test(s);
  const isDentalSchema = /"@type"\s*:\s*"(dentist|orthodontist)"/i.test(s);
  const isMedicalSchema = /"@type"\s*:\s*"(physician|medicalbusiness|medicalclinic|physicaltherapy|optometrist|veterinarycare|hospital|urgentcarecentre)"/i.test(s);
  const isLegalSchema = /"@type"\s*:\s*"(attorney|legalservice)"/i.test(s);
  const isTradeSchema = /"@type"\s*:\s*"(electrician|plumber|hvacbusiness|roofingcontractor|locksmith|movingcompany|homeandconstructionbusiness|automotivebusiness|autorepair|autodealer|gasstation)"/i.test(s);
  const isBeautyFitnessSchema = /"@type"\s*:\s*"(beautysalon|hairsalon|nailsalon|spa|tattooparlor|healthclub|gymorsportscenter|sportsactivitylocation)"/i.test(s);
  const isAccountingLegalSchema = /"@type"\s*:\s*"(accountant|financialservice|insuranceagency|realestateoragent|taxpreparationbusiness)"/i.test(s);
  const isLocalBusinessGeneric = /"@type"\s*:\s*"(localbusiness|professionalservice|homegoods|clothingstore|bookstore|florist|hardwarestore|petstore|toystore|furniturestore|store|shoppingcenter|lodgingbusiness|hotel|motel|bedandbreakfast)"/i.test(s);

  const isStrongLocalBusinessSchema =
    isRestaurantSchema ||
    isDentalSchema ||
    isMedicalSchema ||
    isLegalSchema ||
    isTradeSchema ||
    isBeautyFitnessSchema ||
    isAccountingLegalSchema;

  const isLocalBusiness = isStrongLocalBusinessSchema || isLocalBusinessGeneric;

  return {
    isNewsArticle: /"@type"\s*:\s*"(newsarticle|reportagenewsarticle|liveblogposting)"/i.test(s),
    isBlogPosting: /"@type"\s*:\s*"(blogposting)"/i.test(s),
    isArticle: /"@type"\s*:\s*"(article|techarticle|scholarlyarticle|recipe)"/i.test(s),
    isProduct: /"@type"\s*:\s*"(product)"/i.test(s),
    isLocalBusiness,
    isStrongLocalBusinessSchema,
    isRestaurantSchema,
    isDentalSchema,
    isMedicalSchema,
    isLegalSchema,
    isTradeSchema,
    isBeautyFitnessSchema,
    isAccountingLegalSchema,
    isLocalBusinessGeneric,
    isOrganization: /"@type"\s*:\s*"(organization|corporation|nonprofit|governmentorganization|educationalorganization)"/i.test(s),
    isSoftwareApp: /"@type"\s*:\s*"(softwareapplication|webapplication|mobileapplication)"/i.test(s),
    isReview: /"@type"\s*:\s*"(review|aggregaterating)"/i.test(s),
  };
}

function hasStrongEditorialPageSignals(url, title, metaDescription, bodyText, schemaTypes) {
  const combined = `${title || ""} ${metaDescription || ""} ${bodyText || ""}`.toLowerCase();
  const editorialTitle =
    /what to expect|outlook|forecast|predictions?|analysis|opinion|editorial|market outlook|investment outlook|learn|insights|best|top|review|guide|how to|recipe/i.test(
      combined
    );

  return (
    !!isEditorialUrl(url) ||
    !!isEditorialPath(getPathname(url)) ||
    schemaTypes.isNewsArticle ||
    schemaTypes.isBlogPosting ||
    schemaTypes.isArticle ||
    editorialTitle
  );
}

function hasStrongLocalBusinessIdentity(title, metaDescription, bodyText, linksText, signals = {}) {
  const t = `${title || ""} ${metaDescription || ""} ${bodyText || ""} ${linksText || ""}`.toLowerCase();
  let hits = 0;

  if (
    /family.?owned|locally owned|proudly serving|serving .* since|our office|our clinic|our team|call us|contact us|visit us|book appointment|request appointment|schedule appointment|same-day|walk-ins|licensed|insured|certified|free estimate|our location|hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(t)
  ) hits += 1;
  if (hasSmallBusinessNiche(t)) hits += 1;
  if (signals.hasPhone) hits += 1;
  if (signals.hasAddress) hits += 1;
  if (signals.hasMap) hits += 1;
  if (/appointments?|services?|contact|about|locations?|reviews|testimonials/i.test(t)) hits += 1;

  return hits >= 4;
}

function isStrongRetailProductPath(url, domain) {
  const u = String(url || "").toLowerCase();
  const d = String(domain || "").toLowerCase();

  if (!domainIntel.isKnownRetailDomain(d)) return false;

  return (
    /\/dp\/|\/gp\/|\/product\/|\/products\/|\/p\/|\/pd\/|\/shop\/product\/|\.product\.\d+\.html|\/s\/[^/]+\/\d+|\/color\/\d+|\/en\/.*\/product\/|\/itm\/|\/ip\/|\/dpg\//i.test(u) ||
    /chewy\.com\/.*\/dp\/\d+/i.test(u) ||
    /sephora\.com\/product\/.+/i.test(u) ||
    /nordstrom\.com\/s\/.+\/\d+/i.test(u) ||
    /macys\.com\/shop\/product\/.+/i.test(u) ||
    /homedepot\.com\/p\/.+\/\d+/i.test(u) ||
    /lowes\.com\/pd\/.+\/\d+/i.test(u) ||
    /costco\.com\/.+\.product\.\d+\.html/i.test(u) ||
    /overstock\.com\/.+\/product\.html/i.test(u) ||
    /zappos\.com\/product\/\d+/i.test(u) ||
    /petco\.com\/shop\/.+\/product\/.+/i.test(u) ||
    /ulta\.com\/p\/.+/i.test(u)
  );
}

const comparisonDomains = new Set([
  "91mobiles.com", "smartprix.com", "kimovil.com", "gadgets360.com",
  "gsmarena.com", "phonearena.com", "versus.com", "mobile57.com",
]);

const mediaDomains = new Set([
  "theguardian.com", "reuters.com", "apnews.com", "techcrunch.com",
  "theverge.com", "wired.com", "cnbc.com", "marketwatch.com",
  "businessinsider.com", "ft.com", "economist.com", "techradar.com",
  "cnet.com", "engadget.com", "arstechnica.com", "zdnet.com",
  "thetimes.com", "timeout.com", "travelandleisure.com", "morningstar.com",
  "consumerreports.org", "time.com", "pcmag.com", "tomsguide.com",
  "digitaltrends.com", "androidauthority.com", "fortune.com", "inc.com",
  "theatlantic.com", "usatoday.com", "politico.com", "thehill.com",
  "entrepreneur.com", "investopedia.com",
]);

const saasCoreDomains = new Set([
  "hubspot.com", "zendesk.com", "stripe.com", "twilio.com", "datadog.com",
  "asana.com", "airtable.com", "intercom.com", "mailchimp.com",
  "cloudflare.com", "supabase.com", "n8n.io", "shopify.com", "wix.com",
  "squarespace.com", "dropbox.com",
]);

const directoryCoreDomains = new Set([
  "healthgrades.com", "zocdoc.com", "glassdoor.com", "indeed.com",
  "homeadvisor.com", "vitals.com", "findlaw.com",
]);

const pureBlogDomains = new Set([
  "neilpatel.com", "backlinko.com", "copyblogger.com", "medium.com",
  "dev.to", "smashingmagazine.com", "markmanson.net", "waitbutwhy.com",
  "paulgraham.com", "simonwillison.net", "jvns.ca", "overreacted.io",
  "rachelandrew.co.uk", "healthyblog.com", "mybookreviews.net", "substack.com",
]);

function isStrongBrandedLocalBusiness(url, domain, title, metaDescription, bodyText, linksText, signals = {}) {
  const d = String(domain || "").toLowerCase();
  if (!domainIntel.isLikelyLocalBusinessDomain(d)) return false;
  if (domainIntel.getDomainPrior(d)) return false;
  if (comparisonDomains.has(d)) return false;

  const brandish = /^[a-z0-9-]+\.(com|net|org|co|biz|us|ca|io)$/i.test(d);
  const pathish = isStrongSmallBusinessPath(url);
  const identity = hasStrongLocalBusinessIdentity(title, metaDescription, bodyText, linksText, signals);
  const niche = hasSmallBusinessNiche(`${d} ${title} ${metaDescription} ${bodyText} ${linksText}`);

  return brandish && (pathish || identity || niche);
}

function inferTypeFromSignals(
  url, title, metaDescription, bodyText, linksText,
  schemaText, signals, siteTypeHint = null
) {
  const matchedSignals = [];
  const scores = createScores();
  const domain = getHostname(url);

  // ── Bot-blocked path ──────────────────────────────────────────────────────
  if (isBotBlocked(title, bodyText)) {
    matchedSignals.push({ type: "Warning", reason: "bot-blocked page, body/meta scoring skipped", points: 0 });

    mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.4);
    mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.1);
    mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain, domainIntel), 0.8);

    const prior = domainIntel.getDomainPrior(domain);
    if (prior && SITETYPES.includes(prior)) {
      addScore(scores, matchedSignals, prior, 16, "domain prior bot-blocked fallback");
    } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
      addScore(scores, matchedSignals, siteTypeHint, 3, "site type hint bot-blocked fallback");
    }

    if (domainIntel.isInstitutionalDomain(domain)) {
      subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"] || 0, "institutional blocked domain without storefront");
      addScore(scores, matchedSignals, "Service", 4, "institutional domain fallback");
    }

    const topBot = getTopScore(scores);
    const finalBot = applyFinalDomainOverrides(
      topBot.siteType, domainIntel.getDomainPrior(domain) ? "Medium" : "Low",
      url, domain, matchedSignals, scores,
      { title, metaDescription, bodyText, linksText, signals, domainIntel, PATH_OVERRIDES, comparisonDomains, mediaDomains, saasCoreDomains, directoryCoreDomains, pureBlogDomains, isStrongRetailProductPath, isStrongBrandedLocalBusiness }
    );

    return {
      siteType: finalBot.siteType, confidence: finalBot.confidence,
      classifierVersion: CLASSIFIER_VERSION, matchedSignals, scores,
      topScore: topBot.topScore, secondScore: topBot.secondScore,
      scoreGap: topBot.scoreGap, needsReview: topBot.needsReview,
      schemaTypes: extractSchemaTypes(schemaText),
    };
  }

  // ── Thin extraction path ──────────────────────────────────────────────────
  if (isThinExtraction(title, metaDescription, bodyText, linksText, schemaText)) {
    matchedSignals.push({ type: "Warning", reason: "thin extraction fallback path", points: 0 });

    // Even in thin mode, schema in <script> tags may have been captured
    const thinSchema = extractSchemaTypes(schemaText);

    if (thinSchema.isStrongLocalBusinessSchema &&
      !domainIntel.isKnownRetailDomain(domain) &&
      !domainIntel.isInstitutionalDomain(domain)
    ) {
      addScore(scores, matchedSignals, "Small business", 20, "definitive local business schema in thin extraction");
      addScore(scores, matchedSignals, "Service", 5, "local business schema support");
      const topThinSchema = getTopScore(scores);
      return {
        siteType: "Small business", confidence: "High",
        classifierVersion: CLASSIFIER_VERSION, matchedSignals, scores,
        topScore: topThinSchema.topScore, secondScore: topThinSchema.secondScore,
        scoreGap: topThinSchema.scoreGap, needsReview: false,
        schemaTypes: thinSchema,
      };
    }

    mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.3);
    mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.0);
    mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url, domain, domainIntel), 0.8);

    const prior = domainIntel.getDomainPrior(domain);
    if (prior && SITETYPES.includes(prior)) {
      addScore(scores, matchedSignals, prior, 16, "domain prior thin-extraction fallback");
    } else if (domainIntel.isKnownRetailDomain(domain)) {
      addScore(scores, matchedSignals, "E-commerce", 14, "known retail domain fallback");
    } else if (domainIntel.isInstitutionalDomain(domain)) {
      addScore(scores, matchedSignals, "Service", 14, "institutional domain fallback");
    } else if (domainIntel.isLargeFinancialInstitutionDomain(domain)) {
      addScore(scores, matchedSignals, "Service", 15, "large financial institution fallback");
    } else if (domainIntel.isLikelyLocalBusinessDomain(domain)) {
      addScore(scores, matchedSignals, "Small business", 13, "likely local business domain fallback");
      addScore(scores, matchedSignals, "Service", 4, "local business thin-extraction support");
    } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
      addScore(scores, matchedSignals, siteTypeHint, 4, "site type hint thin-extraction fallback");
    }

    const topThin = getTopScore(scores);
    const finalThin = applyFinalDomainOverrides(
      topThin.siteType, domainIntel.getDomainPrior(domain) ? "Medium" : "Low",
      url, domain, matchedSignals, scores,
      { title, metaDescription, bodyText, linksText, signals, domainIntel, PATH_OVERRIDES, comparisonDomains, mediaDomains, saasCoreDomains, directoryCoreDomains, pureBlogDomains, isStrongRetailProductPath, isStrongBrandedLocalBusiness }
    );

    return {
      siteType: finalThin.siteType, confidence: finalThin.confidence,
      classifierVersion: CLASSIFIER_VERSION, matchedSignals, scores,
      topScore: topThin.topScore, secondScore: topThin.secondScore,
      scoreGap: topThin.scoreGap, needsReview: topThin.needsReview,
      schemaTypes: thinSchema,
    };
  }

  // ── Normal scoring path ───────────────────────────────────────────────────
  const schemaTypes = extractSchemaTypes(schemaText);

  // Schema-first definitive early exit for strong LocalBusiness subtypes
  if (
    schemaTypes.isStrongLocalBusinessSchema &&
    !domainIntel.isKnownRetailDomain(domain) &&
    !domainIntel.isInstitutionalDomain(domain)
  ) {
    addScore(scores, matchedSignals, "Small business", 20, "definitive local business schema — early exit");
    addScore(scores, matchedSignals, "Service", 5, "local business schema support");

    const topSchemaExit = getTopScore(scores);
    return {
      siteType: "Small business", confidence: "High",
      classifierVersion: CLASSIFIER_VERSION, matchedSignals, scores,
      topScore: topSchemaExit.topScore, secondScore: topSchemaExit.secondScore,
      scoreGap: topSchemaExit.scoreGap, needsReview: false,
      schemaTypes,
    };
  }

  const editorialUrl = isEditorialUrl(url);
  const commerceUrl = isCommerceUrl(url);
  const institutional = domainIntel.isInstitutionalDomain(domain);

  mergeScores(scores, scoreSchema(schemaTypes, matchedSignals, {
    isEditorial: editorialUrl, isCommerce: commerceUrl,
    isInstitutional: institutional, domain, domainIntel,
  }), 1.5);

  mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.4);
  mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url, domain, domainIntel), 1.2);
  mergeScores(scores, scoreBodyText(bodyText, matchedSignals, url, domain, domainIntel), 1.0);
  mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain, domainIntel), 1.0);
  mergeScores(scores, scoreUrlPath(url, matchedSignals), 0.9);
  mergeScores(scores, scoreStructuredSignals(signals || {}, matchedSignals, {
    url, bodyText, linksText, domain, domainIntel, isStrongRetailProductPath,
  }), 1.1);

  const prior = domainIntel.getDomainPrior(domain);
  if (prior && SITETYPES.includes(prior)) {
    addScore(scores, matchedSignals, prior, 12, "domain prior tiebreaker");
  } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
    addScore(scores, matchedSignals, siteTypeHint, institutional ? 1 : 3, "site type hint from domain analysis");
  }

  applyInteractionRules(scores, matchedSignals, {
    url, title, metaDescription, bodyText, linksText,
    signals: signals || {}, domain, domainIntel,
    comparisonDomains, isStrongBrandedLocalBusiness,
  });

  const strongEditorialPage = hasStrongEditorialPageSignals(url, title, metaDescription, bodyText, schemaTypes);

  if (strongEditorialPage) {
    if (scores["E-commerce"] >= 8 && !signals.hasCart && !signals.hasProductSchema && !commerceUrl) {
      subtractScore(scores, matchedSignals, "E-commerce", Math.min(10, scores["E-commerce"]), "editorial page without storefront");
    }

    if (
      scores["Directory"] >= 8 &&
      !/directory|listing|listings|companies|businesses|vendors|near-me|providers?|places|jobs|flights|hotels|homes/.test(url)
    ) {
      subtractScore(scores, matchedSignals, "Directory", Math.min(10, scores["Directory"]), "editorial page without listing structure");
    }

    if (domainIntel.isLargeFinancialInstitutionDomain(domain)) {
      addScore(scores, matchedSignals, "Service", 6, "large financial institution domain");
      addScore(scores, matchedSignals, "Blog", 4, "institutional editorial content");
      addScore(scores, matchedSignals, "Newspaper", 3, "research/article content on finance site");
      subtractScore(scores, matchedSignals, "Directory", Math.min(8, scores["Directory"]), "financial institution is not a directory");
    }
  }

  const top = getTopScore(scores);
  const finalOverride = applyFinalDomainOverrides(
    top.siteType, top.confidence, url, domain, matchedSignals, scores,
    { title, metaDescription, bodyText, linksText, signals, domainIntel, PATH_OVERRIDES, comparisonDomains, mediaDomains, saasCoreDomains, directoryCoreDomains, pureBlogDomains, isStrongRetailProductPath, isStrongBrandedLocalBusiness }
  );

  return {
    siteType: finalOverride.siteType, confidence: finalOverride.confidence,
    classifierVersion: CLASSIFIER_VERSION, matchedSignals, scores,
    topScore: top.topScore, secondScore: top.secondScore,
    scoreGap: top.scoreGap, needsReview: top.needsReview,
    schemaTypes,
  };
}

function classifyContentType(url, pageSignals = {}, siteTypeHint = null) {
  const pageResult = inferTypeFromSignals(
    url,
    pageSignals.title || "",
    pageSignals.metaDescription || "",
    pageSignals.bodyText || "",
    pageSignals.linksText || "",
    pageSignals.schemaText || "",
    {
      hasCart: !!pageSignals.hasCart,
      hasSearchAndFilter: !!pageSignals.hasSearchAndFilter,
      hasPhone: !!pageSignals.hasPhone,
      hasAddress: !!pageSignals.hasAddress,
      hasMap: !!pageSignals.hasMap,
      hasReviews: !!pageSignals.hasReviews,
      hasBusinessListingSchema: !!pageSignals.hasBusinessListingSchema,
      hasProductSchema: !!pageSignals.hasProductSchema,
      hasArticleSchema: !!pageSignals.hasArticleSchema,
    },
    siteTypeHint
  );

  const rawContentType = pageResult.siteType;
  return adjustContentTypeAfterScoring(
    rawContentType,
    siteTypeHint || pageResult.siteType,
    url,
    pageResult.schemaTypes || {},
    pageSignals.bodyText || ""
  );
}

function scoreSignals(aggregateText, linksText, signals, homepageUrl) {
  const result = inferTypeFromSignals(homepageUrl, "", "", aggregateText, linksText, "", signals);
  return {
    siteType: result.siteType,
    confidence: result.confidence,
    classifierVersion: CLASSIFIER_VERSION,
    matchedSignals: result.matchedSignals,
    scores: result.scores,
    topScore: result.topScore,
    secondScore: result.secondScore,
    scoreGap: result.scoreGap,
    needsReview: result.needsReview,
  };
}

module.exports = {
  SITETYPES,
  normalizeType,
  classifyContentType,
  scoreSignals,
  inferTypeFromSignals,
  getDomainPrior,
  getTopScore,
};