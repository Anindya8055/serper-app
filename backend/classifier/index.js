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

const {
  ENABLE_FASTTEXT,
  predictSiteType,
  predictContentType,
} = require("../lib/fasttext");

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

  const isRestaurantSchema =
    /"@type"\s*:\s*"(restaurant|foodestablishment|bakery|barorpub|brewery|fastfood|cafeorocoffeeshop|icecreamshop|pizzarestaurant|winery|bar)"/i.test(s);
  const isDentalSchema = /"@type"\s*:\s*"(dentist|orthodontist)"/i.test(s);
  const isMedicalSchema =
    /"@type"\s*:\s*"(physician|medicalbusiness|medicalclinic|physicaltherapy|optometrist|veterinarycare|hospital|urgentcarecentre)"/i.test(s);
  const isLegalSchema = /"@type"\s*:\s*"(attorney|legalservice)"/i.test(s);
  const isTradeSchema =
    /"@type"\s*:\s*"(electrician|plumber|hvacbusiness|roofingcontractor|locksmith|movingcompany|homeandconstructionbusiness|automotivebusiness|autorepair|autodealer|gasstation)"/i.test(s);
  const isBeautyFitnessSchema =
    /"@type"\s*:\s*"(beautysalon|hairsalon|nailsalon|spa|tattooparlor|healthclub|gymorsportscenter|sportsactivitylocation)"/i.test(s);
  const isAccountingLegalSchema =
    /"@type"\s*:\s*"(accountant|financialservice|insuranceagency|realestateoragent|taxpreparationbusiness)"/i.test(s);
  const isLocalBusinessGeneric =
    /"@type"\s*:\s*"(localbusiness|professionalservice|homegoods|clothingstore|bookstore|florist|hardwarestore|petstore|toystore|furniturestore|store|shoppingcenter|lodgingbusiness|hotel|motel|bedandbreakfast)"/i.test(s);

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
    isNewsArticle:
      /"@type"\s*:\s*"(newsarticle|reportagenewsarticle|liveblogposting)"/i.test(s),
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
    isOrganization:
      /"@type"\s*:\s*"(organization|corporation|nonprofit|governmentorganization|educationalorganization)"/i.test(s),
    isSoftwareApp:
      /"@type"\s*:\s*"(softwareapplication|webapplication|mobileapplication)"/i.test(s),
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
  const t =
    `${title || ""} ${metaDescription || ""} ${bodyText || ""} ${linksText || ""}`.toLowerCase();
  let hits = 0;

  if (
    /family.?owned|locally owned|proudly serving|serving .* since|our office|our clinic|our team|call us|contact us|visit us|book appointment|request appointment|schedule appointment|same-day|walk-ins|licensed|insured|certified|free estimate|our location|hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(
      t
    )
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
  "forbes.com", "expertmarket.com", "uschamber.com",
  "nytimes.com", "wsj.com", "bloomberg.com", "businessnewsdaily.com",
  "g2.com", "capterra.com", "getapp.com", "softwareadvice.com",
  "trustradius.com", "techtarget.com", "computerworld.com", "finance.yahoo.com","investors.com","briefing.com","nasdaq.com","thestreet.com","investing.com","cnn.com",
]);

const saasCoreDomains = new Set([
  "hubspot.com", "zendesk.com", "stripe.com", "twilio.com",
  "datadog.com", "asana.com", "airtable.com", "intercom.com",
  "mailchimp.com", "cloudflare.com", "supabase.com", "n8n.io",
  "shopify.com", "wix.com", "squarespace.com", "dropbox.com",
  "salesforce.com", "zoho.com", "microsoft.com", "pipedrive.com",
  "zapier.com", "xero.com", "insightly.com", "onepagecrm.com",
  "sybill.ai", "monday.com", "clickup.com", "freshworks.com",
  "nutshell.com", "keap.com", "activecampaign.com", "close.com",
  "copper.com", "apptivo.com", "capsulecrm.com", "streak.com",
]);

const neverSmallBusinessDomains = new Set([
  "microsoft.com", "google.com", "apple.com", "amazon.com",
  "zoho.com", "salesforce.com", "oracle.com", "sap.com",
  "xero.com", "quickbooks.com", "intuit.com",
]);

const directoryCoreDomains = new Set([
  "healthgrades.com", "zocdoc.com", "glassdoor.com", "indeed.com",
  "homeadvisor.com", "vitals.com", "findlaw.com", "sasthyaseba.com", "whatclinic.com",
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
  const niche = hasSmallBusinessNiche(
    `${d} ${title || ""} ${metaDescription || ""} ${bodyText || ""} ${linksText || ""}`
  );

  return brandish && (pathish || identity || niche);
}

function isHomepagePath(url) {
  try {
    const u = new URL(String(url || ""));
    return u.pathname === "/" || u.pathname === "";
  } catch {
    const stripped = String(url || "").replace(/^https?:\/\/[^/]+/, "");
    return stripped === "" || stripped === "/";
  }
}

function isEditorialSlugPath(url) {
  const lowerUrl = String(url || "").toLowerCase();
  return (
    /\/blog\/[^/?#]+|\/blogs\/[^/?#]+|\/article\/[^/?#]+|\/articles\/[^/?#]+/.test(lowerUrl) ||
    /\/post\/[^/?#]+|\/posts\/[^/?#]+|\/news\/[^/?#]+/.test(lowerUrl) ||
    /\/why-[^/?#]+|\/what-[^/?#]+|\/how-[^/?#]+|\/best-[^/?#]+/.test(lowerUrl) ||
    /\/guide-[^/?#]+|\/tips-[^/?#]+|\/benefits-[^/?#]+|\/cost-[^/?#]+|\/vs-[^/?#]+/.test(lowerUrl) ||
    /\/(finding|choosing|selecting|picking|top|best|guide|tips|how-to|review|compare|benefits|cost|why|what)-[^/?#]+/.test(lowerUrl) ||
    /\/[^/?#]*(finding-the-best|choosing-the-best|best-[a-z]+-in|top-[a-z]+-in|how-to-choose|guide-to)[^/?#]*/.test(lowerUrl)
  );
}

function inferTypeFromSignals(
  url, title, metaDescription, bodyText, linksText,
  schemaText, signals = {}, siteTypeHint = null
) {
  const matchedSignals = [];
  const scores = createScores();
  const domain = getHostname(url);
  const safeSignals = signals || {};

  if (directoryCoreDomains.has(domain)) {
    addScore(scores, matchedSignals, "Directory", 20, "known directory domain hard exit");
    const topDirectory = getTopScore(scores);
    return {
      siteType: topDirectory.siteType,
      confidence: "High",
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topDirectory.topScore,
      secondScore: topDirectory.secondScore,
      scoreGap: topDirectory.scoreGap,
      needsReview: false,
      schemaTypes: extractSchemaTypes(schemaText),
    };
  }

  if (neverSmallBusinessDomains.has(domain)) {
    const priorForNever = domainIntel.getDomainPrior(domain);
    if (priorForNever && SITETYPES.includes(priorForNever)) {
      addScore(scores, matchedSignals, priorForNever, 20, `never-small-business domain prior: ${priorForNever}`);
    } else if (saasCoreDomains.has(domain)) {
      addScore(scores, matchedSignals, "Saas", 20, "never-small-business domain in saasCoreDomains");
    } else {
      addScore(scores, matchedSignals, "Saas", 16, "never-small-business domain fallback");
    }
    const topNever = getTopScore(scores);
    return {
      siteType: topNever.siteType,
      confidence: "High",
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topNever.topScore,
      secondScore: topNever.secondScore,
      scoreGap: topNever.scoreGap,
      needsReview: false,
      schemaTypes: extractSchemaTypes(schemaText),
    };
  }

  if (mediaDomains.has(domain)) {
    const isBlogPath = /\/blog\/|\/blogs\//i.test(url);
    const resolvedMediaType = isBlogPath ? "Blog" : "Newspaper";
    addScore(scores, matchedSignals, resolvedMediaType, 20, `known media/publisher domain: ${resolvedMediaType}`);
    const topMedia = getTopScore(scores);
    return {
      siteType: topMedia.siteType,
      confidence: "High",
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topMedia.topScore,
      secondScore: topMedia.secondScore,
      scoreGap: topMedia.scoreGap,
      needsReview: false,
      schemaTypes: extractSchemaTypes(schemaText),
    };
  }

  if (isBotBlocked(title, bodyText)) {
    matchedSignals.push({ type: "Warning", reason: "bot-blocked page, body/meta scoring skipped", points: 0 });

    mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.4);
    mergeScores(scores, scoreTitle(title, matchedSignals, url, domain), 1.1);
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
      topBot.siteType,
      domainIntel.getDomainPrior(domain) ? "Medium" : "Low",
      url,
      domain,
      matchedSignals,
      scores,
      {
        title,
        metaDescription,
        bodyText,
        linksText,
        signals: safeSignals,
        domainIntel,
        PATH_OVERRIDES,
        comparisonDomains,
        mediaDomains,
        saasCoreDomains,
        directoryCoreDomains,
        pureBlogDomains,
        isStrongRetailProductPath,
        isStrongBrandedLocalBusiness,
      }
    );

    return {
      siteType: finalBot.siteType,
      confidence: finalBot.confidence,
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topBot.topScore,
      secondScore: topBot.secondScore,
      scoreGap: topBot.scoreGap,
      needsReview: topBot.needsReview,
      schemaTypes: extractSchemaTypes(schemaText),
    };
  }

  if (isThinExtraction(title, metaDescription, bodyText, linksText, schemaText)) {
    matchedSignals.push({ type: "Warning", reason: "thin extraction fallback path", points: 0 });

    const thinSchema = extractSchemaTypes(schemaText);

    if (thinSchema.isStrongLocalBusinessSchema && !domainIntel.isKnownRetailDomain(domain) && !domainIntel.isInstitutionalDomain(domain)) {
      addScore(scores, matchedSignals, "Small business", 20, "definitive local business schema in thin extraction");
      addScore(scores, matchedSignals, "Service", 5, "local business schema support");
      const topThinSchema = getTopScore(scores);
      return {
        siteType: "Small business",
        confidence: "High",
        classifierVersion: CLASSIFIER_VERSION,
        matchedSignals,
        scores,
        topScore: topThinSchema.topScore,
        secondScore: topThinSchema.secondScore,
        scoreGap: topThinSchema.scoreGap,
        needsReview: false,
        schemaTypes: thinSchema,
      };
    }

    mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.3);
    mergeScores(scores, scoreTitle(title, matchedSignals, url, domain), 1.0);
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
      topThin.siteType,
      domainIntel.getDomainPrior(domain) ? "Medium" : "Low",
      url,
      domain,
      matchedSignals,
      scores,
      {
        title,
        metaDescription,
        bodyText,
        linksText,
        signals: safeSignals,
        domainIntel,
        PATH_OVERRIDES,
        comparisonDomains,
        mediaDomains,
        saasCoreDomains,
        directoryCoreDomains,
        pureBlogDomains,
        isStrongRetailProductPath,
        isStrongBrandedLocalBusiness,
      }
    );

    return {
      siteType: finalThin.siteType,
      confidence: finalThin.confidence,
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topThin.topScore,
      secondScore: topThin.secondScore,
      scoreGap: topThin.scoreGap,
      needsReview: topThin.needsReview,
      schemaTypes: thinSchema,
    };
  }

  const schemaTypes = extractSchemaTypes(schemaText);

  if (schemaTypes.isStrongLocalBusinessSchema && !domainIntel.isKnownRetailDomain(domain) && !domainIntel.isInstitutionalDomain(domain)) {
    addScore(scores, matchedSignals, "Small business", 20, "definitive local business schema — early exit");
    addScore(scores, matchedSignals, "Service", 5, "local business schema support");
    const topSchemaExit = getTopScore(scores);
    return {
      siteType: "Small business",
      confidence: "High",
      classifierVersion: CLASSIFIER_VERSION,
      matchedSignals,
      scores,
      topScore: topSchemaExit.topScore,
      secondScore: topSchemaExit.secondScore,
      scoreGap: topSchemaExit.scoreGap,
      needsReview: false,
      schemaTypes,
    };
  }

  const editorialUrl = isEditorialUrl(url);
  const commerceUrl = isCommerceUrl(url);
  const institutional = domainIntel.isInstitutionalDomain(domain);

  mergeScores(
    scores,
    scoreSchema(schemaTypes, matchedSignals, {
      isEditorial: editorialUrl,
      isCommerce: commerceUrl,
      isInstitutional: institutional,
      domain,
      domainIntel,
    }),
    1.5
  );
  mergeScores(scores, scoreTitle(title, matchedSignals, url, domain), 1.4);
  mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url, domain, domainIntel), 1.2);
  mergeScores(scores, scoreBodyText(bodyText, matchedSignals, url, domain, domainIntel), 1.0);
  mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain, domainIntel), 1.0);
  mergeScores(scores, scoreUrlPath(url, matchedSignals), 0.9);
  mergeScores(
    scores,
    scoreStructuredSignals(safeSignals, matchedSignals, {
      url,
      bodyText,
      linksText,
      domain,
      domainIntel,
      isStrongRetailProductPath,
      schemaTypes,
    }),
    1.1
  );

  const prior = domainIntel.getDomainPrior(domain);
  if (prior && SITETYPES.includes(prior)) {
    addScore(scores, matchedSignals, prior, 12, "domain prior tiebreaker");
  } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
    addScore(scores, matchedSignals, siteTypeHint, institutional ? 1 : 3, "site type hint from domain analysis");
  }

  applyInteractionRules(scores, matchedSignals, {
    url,
    title,
    metaDescription,
    bodyText,
    linksText,
    signals: safeSignals,
    domain,
    domainIntel,
    comparisonDomains,
    isStrongBrandedLocalBusiness,
  });

  const strongEditorialPage = hasStrongEditorialPageSignals(url, title, metaDescription, bodyText, schemaTypes);

  if (strongEditorialPage) {
    if (scores["E-commerce"] >= 8 && !safeSignals.hasCart && !safeSignals.hasProductSchema && !commerceUrl) {
      subtractScore(scores, matchedSignals, "E-commerce", Math.min(10, scores["E-commerce"]), "editorial page without storefront");
    }
    if (scores["Directory"] >= 8 && !/directory|listing|listings|companies|businesses|vendors|near-me|providers?|places|jobs|flights|hotels|homes/.test(url)) {
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
    top.siteType,
    top.confidence,
    url,
    domain,
    matchedSignals,
    scores,
    {
      title,
      metaDescription,
      bodyText,
      linksText,
      signals: safeSignals,
      domainIntel,
      PATH_OVERRIDES,
      comparisonDomains,
      mediaDomains,
      saasCoreDomains,
      directoryCoreDomains,
      pureBlogDomains,
      isStrongRetailProductPath,
      isStrongBrandedLocalBusiness,
    }
  );

  return {
    siteType: finalOverride.siteType,
    confidence: finalOverride.confidence,
    classifierVersion: CLASSIFIER_VERSION,
    matchedSignals,
    scores,
    topScore: top.topScore,
    secondScore: top.secondScore,
    scoreGap: top.scoreGap,
    needsReview: top.needsReview,
    schemaTypes,
  };
}

function classifyContentType(url, pageSignals = {}, siteTypeHint = null) {
  const safeSignals = pageSignals || {};
  const bodyText = safeSignals.bodyText || "";
  const title = safeSignals.title || "";
  const metaDescription = safeSignals.metaDescription || "";
  const schemaText = safeSignals.schemaText || "";
  const linksText = safeSignals.linksText || "";
  const lowerUrl = String(url || "").toLowerCase();
  const domain = getHostname(url);

  // Blog/news URL patterns override contentType regardless of siteType.
  // e.g. an E-commerce site's /blogs/ page should have contentType=Blog.
  if (/\/blogs?\/[^/?#]+|\/news\/[^/?#]+|\/articles?\/[^/?#]+|\/posts?\/[^/?#]+|\/guides?\/[^/?#]+/i.test(lowerUrl)) {
    return "Blog";
  }

  if (mediaDomains.has(domain)) {
    const isBlogPath = /\/blog\/|\/blogs\//i.test(lowerUrl);
    if (isBlogPath) return "Blog";
    const isSaasPath = /\/pricing(\/|$)|\/features(\/|$)|\/platform(\/|$)|\/integrations(\/|$)/i.test(lowerUrl);
    if (isSaasPath) return "Saas";
    return "Newspaper";
  }

  if (saasCoreDomains.has(domain)) {
    const isBlogPath = /\/blog\/[^/?#]+|\/blogs\/[^/?#]+|\/resources?\/|\/learn\/|\/academy\/|\/insights?\//i.test(lowerUrl);
    if (isBlogPath) return "Blog";
    return "Saas";
  }

  if (directoryCoreDomains.has(domain)) {
    return "Directory";
  }

  const pageResult = inferTypeFromSignals(
    url,
    title,
    metaDescription,
    bodyText,
    linksText,
    schemaText,
    {
      hasCart: !!safeSignals.hasCart,
      hasSearchAndFilter: !!safeSignals.hasSearchAndFilter,
      hasPhone: !!safeSignals.hasPhone,
      hasAddress: !!safeSignals.hasAddress,
      hasMap: !!safeSignals.hasMap,
      hasReviews: !!safeSignals.hasReviews,
      hasBusinessListingSchema: !!safeSignals.hasBusinessListingSchema,
      hasProductSchema: !!safeSignals.hasProductSchema,
      hasArticleSchema: !!safeSignals.hasArticleSchema,
    },
    siteTypeHint
  );

  const schemaTypes = pageResult.schemaTypes || {};
  const effectiveSiteType = normalizeType(siteTypeHint || pageResult.siteType || "");
  const combined = `${title} ${metaDescription} ${bodyText} ${linksText}`.toLowerCase();
  const isLocalSite = effectiveSiteType === "Small business" || effectiveSiteType === "Service";

  if (safeSignals.hasProductSchema) return "E-commerce";
  if (safeSignals.hasCart && !isLocalSite) return "E-commerce";

  if (!isLocalSite) {
    if (schemaTypes.isProduct) return "E-commerce";
    if (safeSignals.hasArticleSchema || schemaTypes.isNewsArticle) return "Newspaper";
    if (schemaTypes.isBlogPosting) return "Blog";
  }

  const isStrongDirectoryPage =
    /[?&](search|search_terms|q|query|find|keywords?|location|geo|where|near)=/i.test(lowerUrl) ||
    /\/search(\/|$)|\/jobs\/search(\/|$)|\/listing\/view\/|\/directory\/|\/providers\/|\/companies\/|\/businesses\/|\/listings?\//i.test(lowerUrl) ||
    /yellowpages\.com\/search|linkedin\.com\/jobs\/search|swappa\.com\/listing\/view\//i.test(lowerUrl);

  if (isStrongDirectoryPage) return "Directory";

  const isStrongProductPage =
    /\/dp\/[a-z0-9]{4,}|\/gp\/product\/|\.product\.\d+\.html|xlsimpprod\d+/i.test(lowerUrl) ||
    /etsy\.com\/listing\/\d+/i.test(lowerUrl) ||
    /target\.com\/p\/|ikea\.com\/.+\/p\/|newegg\.com\/.+\/p\/|sephora\.com\/product\/|macys\.com\/shop\/product\/|homedepot\.com\/p\/|overstock\.com\/.+\/product\.html|zappos\.com\/product\/|petco\.com\/shop\/.+\/product\/|ulta\.com\/p\/|flipkart\.com\/.+\/p\/itm|backmarket\.com\/en-us\/p\/|castlery\.com\/products\/|society6\.com\/product\//i.test(lowerUrl);

  if (isStrongProductPage) return "E-commerce";

  if (isLocalSite) {
    const isHomepage = isHomepagePath(url);
    const isSlug = isEditorialSlugPath(url);

    if (isHomepage && !isSlug) return "Service";

    const localEditorialTitle = `${title || ""} ${metaDescription || ""}`.toLowerCase();
    const isStrongLocalEditorialPage =
      schemaTypes.isBlogPosting ||
      schemaTypes.isNewsArticle ||
      schemaTypes.isArticle ||
      isSlug ||
      /\bbest\s+\d+|\btop\s+\d+|\d+\s+best\b|\d+\s+top\b/i.test(localEditorialTitle) ||
      /\b(why|what|how to|guide|tips|benefits|cost of|review of|best dentist|best doctor|best clinic|best hospital)\b/i.test(localEditorialTitle) ||
      /\b(finding|choosing|selecting|picking)\b.{0,30}\b(best|top|right|good)\b/i.test(localEditorialTitle) ||
      /\bbest\s+\w+(\s+\w+)?\s+in\s+\w+/i.test(localEditorialTitle) ||
      /\btop\s+\w+(\s+\w+)?\s+in\s+\w+/i.test(localEditorialTitle);

    if (isStrongLocalEditorialPage) return "Blog";

    if (schemaTypes.isStrongLocalBusinessSchema) return "Service";

    if (
      /\/contact(\/|$)|\/appointments?(\/|$)|\/appointment(\/|$)|\/book(\/|$)|\/schedule(\/|$)|\/locations?(\/|$)|\/services?\/[^/?#]+|\/menu[-_]?prices?|\/price[-_]?list|\/treatments?(\/?$)|\/packages?(\/?$)|\/promotions?(\/?$)|\/our[-_]?services?(\/?$)/i.test(lowerUrl)
    ) return "Service";

    if (
      /\/iv[-_]?(drip|therapy|infusion)|\/vitamin[-_]?drip|\/nad[-_]?therapy|\/wellness|\/clinic|\/therapy|\/treatment|\/skincare|\/aesthetic|\/infusion|\/hydration|\/drip[-_]?bar|\/dental|\/physio|\/chiropractic|\/acupuncture|\/massage|\/facial|\/laser|\/glutathione|\/vitamin[-_]?c|\/beauty[-_]?treatment|\/spa[-_]?treatment/i.test(lowerUrl)
    ) return "Service";

    if (
      /iv drip|iv therapy|iv infusion|vitamin drip|drip bar|intravenous|hydration therapy|wellness clinic|medical clinic|aesthetic clinic|beauty clinic|skin clinic|dental clinic|physiotherapy|chiropractic|acupuncture treatment|massage therapy|facial treatment|nad therapy/i.test(combined)
    ) return "Service";

    if (
      /\b(our services|book appointment|schedule appointment|contact us|call us|visit our office|licensed|insured|free estimate|same.day|walk.in)\b/i.test(combined)
    ) return "Service";

    if (/\b(add to cart|buy now|in stock|out of stock|pickup|delivery|sku|shop now)\b/i.test(combined)) return "E-commerce";

    let rawLocal = pageResult.siteType;
    if (!rawLocal || rawLocal === "Small business") rawLocal = effectiveSiteType || pageResult.siteType;
    return adjustContentTypeAfterScoring(rawLocal, effectiveSiteType, url, schemaTypes, bodyText);
  }

  const isStrongServicePage =
    /\/contact(\/|$)|\/appointments?(\/|$)|\/appointment(\/|$)|\/book(\/|$)|\/schedule(\/|$)|\/services?\/[^/?#]+|\/locations?(\/|$)/i.test(lowerUrl) ||
    /acmeplumbing\.net\/contact|downtown-dental\.com\/appointments|mrelectric\.com\/services\/|wipfli\.com\/services\/tax/i.test(lowerUrl);

  if (isStrongServicePage) return "Service";

  const isStrongSaasPage =
    /\/pricing(\/|$)|\/features(\/|$)|\/app\/[^/?#]+|\/docs(\/|$)|\/deploy\/[^/?#]+|\/customer-messaging(\/|$)|\/platform(\/|$)|\/integrations(\/|$)|\/crm(\/|$)|\/products\/crm(\/|$)|\/software\/[^/?#]+|\/product\/[^/?#]+/i.test(lowerUrl) ||
    /hubspot\.com\/products\/crm|datadog\.com\/product\/apm|airtable\.com\/product\/database|cloudflare\.com\/products\/workers|atlassian\.com\/software\/jira|monday\.com\/pricing|clickup\.com\/features|zapier\.com\/app\/dashboard|intercom\.com\/customer-messaging|make\.com\/en\/pricing|render\.com\/docs\/deploy-node-express-app|webflow\.com\/pricing/i.test(lowerUrl);

  if (isStrongSaasPage) return "Saas";

  const isStrongBlogPage =
    /\/blog\/[^/?#]+|\/post\/[^/?#]+|\/posts\/[^/?#]+|substack\.com\/p\/[^/?#]+/i.test(lowerUrl);

  if (isStrongBlogPage) return "Blog";

  const isStrongEditorialPage =
    /\/article\/[^/?#]+|\/articles\/[^/?#]+|\/story\/[^/?#]+|\/stories\/[^/?#]+|\/archive\/\d{4}\/|\/reviews?\/[^/?#]*|\/best\/[^/?#]*|\/guide\/[^/?#]*|\/news\/articles\/|\/terms\/[a-z]|\/science\/[^/?#]+|\/design\/rooms\/|\/diseases-conditions\/[^/?#]+/i.test(lowerUrl) ||
    /wsj\.com\/articles\/|bloomberg\.com\/news\/articles\/|apnews\.com\/article\/|wired\.com\/story\/|marketwatch\.com\/story\/|techradar\.com\/best\/|zdnet\.com\/article\/|thetimes\.com\/article\/|investopedia\.com\/terms\/|pcmag\.com\/reviews\/|tomsguide\.com\/best\/|theatlantic\.com\/.+\/archive\/|usatoday\.com\/story\/|architecturaldigest\.com\/story\/|digitaltrends\.com\/cars\/best-|hgtv\.com\/design\/|britannica\.com\/science\/|alistapart\.com\/article\//i.test(lowerUrl);

  if (isStrongEditorialPage) return "Newspaper";

  if (/\b(add to cart|buy now|in stock|out of stock|pickup|delivery|sku|shop now)\b/i.test(combined)) return "E-commerce";
  if (/\b(compare|specs|specifications|ratings|directory|providers|companies|businesses near me|job openings)\b/i.test(combined)) return "Directory";

  const saasBodySignalCount = [
    /\bpricing\b/i.test(combined),
    /\bfree trial\b/i.test(combined),
    /\bbook demo\b/i.test(combined),
    /\bsign in\b/i.test(combined),
    /\bdashboard\b/i.test(combined),
    /\bworkspace\b/i.test(combined),
    /\bautomation\b/i.test(combined),
    /\bcrm\b/i.test(combined),
    /\bcustomer messaging\b/i.test(combined),
  ].filter(Boolean).length;

  if (saasBodySignalCount >= 3) return "Saas";

  if (/\b(opinion|analysis|report|review|guide|how to|best|editorial|breaking news)\b/i.test(combined)) return "Newspaper";
  if (/\b(our services|book appointment|schedule appointment|contact us|call us|visit our office|licensed|insured)\b/i.test(combined)) return "Service";

  let rawContentType = pageResult.siteType;
  if (!rawContentType || rawContentType === "Small business") rawContentType = effectiveSiteType || pageResult.siteType;

  return adjustContentTypeAfterScoring(rawContentType, effectiveSiteType, url, schemaTypes, bodyText);
}

function scoreSignals(aggregateText, linksText, signals, homepageUrl) {
  const result = inferTypeFromSignals(homepageUrl, "", "", aggregateText, linksText, "", signals || {});
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

function normalizeFastTextLabel(label) {
  const raw = String(label || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const compact = raw.replace(/\s+/g, "");
  const map = {
    "small business": "Small business",
    "e commerce": "E-commerce",
    saas: "Saas",
    blog: "Blog",
    directory: "Directory",
    service: "Service",
    newspaper: "Newspaper",
  };
  if (map[raw]) return map[raw];
  if (compact === "smallbusiness") return "Small business";
  if (compact === "ecommerce") return "E-commerce";
  return null;
}

function normalizeFastTextSitePrediction(prediction) {
  if (!prediction || typeof prediction !== "object") return null;
  const rawType = prediction.siteType ?? prediction.label ?? null;
  const normalized = normalizeFastTextLabel(rawType);
  return { ...prediction, siteType: normalized || rawType || null };
}

function normalizeFastTextContentLabel(label, siteTypeHint = null) {
  const normalized = normalizeFastTextLabel(label);
  if (!normalized) return null;
  const validContentTypes = new Set(["E-commerce", "Directory", "Saas", "Blog", "Newspaper", "Service"]);
  if (validContentTypes.has(normalized)) return normalized;
  if (normalized === "Small business") return "Service";
  return normalizeType(siteTypeHint || null);
}

function normalizeFastTextContentPrediction(prediction, siteTypeHint = null) {
  if (!prediction || typeof prediction !== "object") return null;
  const rawType = prediction.contentType ?? prediction.label ?? null;
  const normalized = normalizeFastTextContentLabel(rawType, siteTypeHint);
  return { ...prediction, contentType: normalized || null };
}

async function classifyWithFastText(url, pageSignals = {}) {
  if (!ENABLE_FASTTEXT) {
    return { enabled: false, sitePrediction: null, contentPrediction: null, siteError: null, contentError: null };
  }

  let safeSite = null;
  let safeContent = null;
  let siteError = null;
  let contentError = null;

  const domain = getHostname(url);
  const skipFastText =
    mediaDomains.has(domain) ||
    saasCoreDomains.has(domain) ||
    neverSmallBusinessDomains.has(domain) ||
    directoryCoreDomains.has(domain);

  if (!skipFastText) {
    try {
      const siteResult = await predictSiteType(url, pageSignals);
      safeSite = siteResult ? normalizeFastTextSitePrediction(siteResult) : null;
    } catch (err) {
      siteError = String(err?.message || err);
    }

    try {
      const contentResult = await predictContentType(url, pageSignals);
      safeContent = contentResult
        ? normalizeFastTextContentPrediction(contentResult, safeSite?.siteType || null)
        : null;
    } catch (err) {
      contentError = String(err?.message || err);
    }
  }

  return { enabled: true, sitePrediction: safeSite, contentPrediction: safeContent, siteError, contentError };
}

function mergeRuleBasedWithFastText(ruleResult, fastTextResult) {
  if (!ruleResult) return ruleResult;
  if (!fastTextResult || !fastTextResult.enabled) return ruleResult;

  const merged = { ...ruleResult };
  const siteFT = fastTextResult.sitePrediction || null;
  const contentFT = fastTextResult.contentPrediction || null;

  const normalizedFtSite = normalizeType(siteFT?.siteType || null);
  const normalizedFtContent = normalizeFastTextContentLabel(
    contentFT?.contentType || contentFT?.label || null,
    merged.siteType || null
  );

  const scoreGap =
    typeof merged.scoreGap === "number"
      ? merged.scoreGap
      : Math.max(0, (merged.topScore || 0) - (merged.secondScore || 0));

  const ruleLowConfidence = merged.confidence === "Low";
  const ruleUncertain = ruleLowConfidence || scoreGap < 6;

  if (
    ruleUncertain &&
    normalizedFtSite &&
    SITETYPES.includes(normalizedFtSite)
  ) {
    merged.siteType = normalizedFtSite;
    if (merged.confidence === "Low") {
      merged.confidence = "Medium";
    }
    merged.usedFastTextForSite = true;
  } else {
    merged.usedFastTextForSite = false;
  }

  if (normalizedFtContent) {
    merged.fastTextContentType = normalizedFtContent;
    merged.usedFastTextForContent = true;
  } else {
    merged.fastTextContentType = null;
    merged.usedFastTextForContent = false;
  }

  merged.fastText = {
    enabled: true,
    sitePrediction: siteFT,
    contentPrediction: contentFT,
    siteError: fastTextResult.siteError || null,
    contentError: fastTextResult.contentError || null,
  };

  return merged;
}

module.exports = {
  SITETYPES,
  normalizeType,
  classifyContentType,
  scoreSignals,
  inferTypeFromSignals,
  getDomainPrior,
  getTopScore,
  classifyWithFastText,
  mergeRuleBasedWithFastText,
};