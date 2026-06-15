const {
  SITETYPES,
  hasStrongNonSmallBusiness,
  normalizeType,
} = require("./helpers");

const { getPathname } = require("../lib/url-utils");

// ─── Known legal directory domains ───────────────────────────────────────────
const LEGAL_DIRECTORY_DOMAINS = new Set([
  "avvo.com",
  "justia.com",
  "bestlawyers.com",
  "bestlawfirms.com",
  "martindale.com",
  "lawyers.com",
  "superlawyers.com",
  "attorneys.superlawyers.com",
  "lawinfo.com",
  "hg.org",
  "findlaw.com",
  "legalmatch.com",
  "expertise.com",
  "americastop50lawyers.com",
  "topattorney.com",
  "lawyers.law.cornell.edu",
  "thervo.com",
]);

// ─── Known health-system / institutional-service domains ─────────────────────
const HEALTH_SYSTEM_DOMAINS = new Set([
  "sanfordhealth.org",
  "centracare.com",
  "carilionclinic.org",
  "denverhealth.org",
  "valley-widehealth.org",
  "stanncenter.org",
  "fhcsd.org",
  "healthlinkdental.org",
  "centuryhealth.org",
  "ssm-health.com",
  "fairview.org",
  "allina.com",
  "hcahealthcare.com",
  "baptisthealth.com",
  "adventhealth.com",
  "ascension.org",
  "dignityhealth.org",
  "commonspirit.org",
  "geisinger.org",
  "intermountainhealthcare.org",
  "uhs.com",
  "multicare.org",
  "uchealth.org",
  "vumc.org",
  "northwell.edu",
  "nyulangone.org",
  "mountsinai.org",
  "cedars-sinai.org",
  "ohiohealth.com",
  "bjc.org",
  "mercy.com",
  "premierhealth.com",
  "baycare.org",
  "wellstar.org",
  "piedmont.org",
  "tenethealth.com",
  "lifespan.org",
  "christushealth.org",
  "provhealth.org",
  "scottandwhite.com",
  "bswhealth.com",
]);

// ─── Domains that should always behave like editorial/publisher properties ───
const HARD_MEDIA_DOMAINS = new Set([
  "forbes.com",
  "pcmag.com",
  "expertmarket.com",
  "uschamber.com",
  "techradar.com",
  "zdnet.com",
  "cnet.com",
  "tomsguide.com",
  "digitaltrends.com",
  "theverge.com",
  "wired.com",
  "reuters.com",
  "apnews.com",
  "marketwatch.com",
  "businessinsider.com",
  "fortune.com",
  "inc.com",
  "entrepreneur.com",
  "investopedia.com",
  "usatoday.com",
  "politico.com",
  "thehill.com",
  "theatlantic.com",
  "time.com",
  "consumerreports.org",
  "morningstar.com",
]);

// ─── Domains that should never resolve to Small business ─────────────────────
const NEVER_SMALL_BUSINESS_DOMAINS = new Set([
  "microsoft.com",
  "zoho.com",
  "salesforce.com",
  "xero.com",
  "hubspot.com",
  "pipedrive.com",
  "zapier.com",
  "insightly.com",
  "onepagecrm.com",
  "sybill.ai",
  "oracle.com",
  "sap.com",
  "intuit.com",
  "quickbooks.com",
  "google.com",
  "apple.com",
  "amazon.com",
]);

// ─── Strong SaaS vendor domains ──────────────────────────────────────────────
const HARD_SAAS_DOMAINS = new Set([
  "microsoft.com",
  "zoho.com",
  "salesforce.com",
  "xero.com",
  "hubspot.com",
  "pipedrive.com",
  "zapier.com",
  "insightly.com",
  "onepagecrm.com",
  "sybill.ai",
]);

// ─── URL path patterns that are clearly directory/listing pages ──────────────
const DIRECTORY_PATH_RE =
  /\/(lawyers|attorneys|all-lawyers|find-a-lawyer|find-a-dentist|find-a-doctor|search\?find_desc|dentists|directory|listings?|providers?|professionals?|search-results|near-me|companies|businesses)(\/|$|\?)/i;

// ─── URL path patterns that are clearly a location/clinic page (not SaaS) ───
const LOCATION_PAGE_RE =
  /\/(locations?|dental-clinic|dental-care|dental-center|dentistry|clinic|clinics?|offices?|branches?|our-locations?)(\/|$)/i;

// ─── Blog / editorial-like paths ─────────────────────────────────────────────
const BLOG_LIKE_PATH_RE =
  /\/(blog|blogs|resources?|articles?|learn|insights?|guides?|posts?|stories|tips|tutorials?)($|\/)/i;

// ─── SaaS product / conversion paths ─────────────────────────────────────────
const SAAS_PRODUCT_PATH_RE =
  /\/(product|products|pricing|plans|platform|features|database|automation|email-marketing|workers|upgrade|payments|communications|customer-service|customer-messaging|crm|software|integrations|demo|free-trial)($|\/)/i;

// ─── Strong editorial content paths ──────────────────────────────────────────
const EDITORIAL_PATH_RE =
  /\/(article|articles|story|stories|reviews?|best|guide|guides|how-to|analysis|opinion|news|resources?)($|\/)/i;

function applyPathOverrides(url, currentType, matchedSignals, PATH_OVERRIDES = {}) {
  const pathname = getPathname(url);

  for (const [pattern, forcedType] of Object.entries(PATH_OVERRIDES || {})) {
    try {
      const re = new RegExp(pattern, "i");
      if (re.test(pathname)) {
        matchedSignals.push({
          type: "Post-process",
          reason: `path override matched: ${pattern} -> ${forcedType}`,
          points: 0,
        });
        return normalizeType(forcedType);
      }
    } catch {
      continue;
    }
  }

  return currentType;
}

function isLocalBusinessLooking(domain) {
  const knownNationalBrands =
    /amazon|walmart|target|bestbuy|homedepot|lowes|costco|ebay|etsy|wayfair|ikea|macys|nordstrom|sephora|shopify|stripe|salesforce|hubspot|notion|github|gitlab|vercel|netlify|figma|slack|zapier|monday|asana|clickup|dropbox|box|zendesk|datadog|atlassian|mailchimp|cloudflare|supabase|linear|newrelic|twilio|intercom|airtable|yelp|tripadvisor|yellowpages|angi|zillow|realtor|booking|airbnb|expedia|kayak|cars\.com|autotrader|houzz|healthgrades|zocdoc|avvo|glassdoor|indeed|thumbtack|bbb|homeadvisor|linkedin|findlaw|kbb|orbitz|hotels\.com|turo|carrentals|medium|substack|dev\.to|neilpatel|moz\.com|ahrefs|semrush|backlinko|buffer|wordpress|blogger|blogspot|wix|squarespace|webflow|microsoft|zoho|xero/i;

  if (knownNationalBrands.test(domain)) return false;

  const localServicePattern =
    /plumb|roof|electr|landscap|dental|pizza|bakery|barber|salon|spa|gym|yoga|florist|cafe|coffee|catering|accounting|tax|law|legal|attorney|chiropract|optom|eyecare|eyewear|vision|autobody|autorepair|carrepair|painting|construct|remodel|photography|wedding|hvac|pest|cleaning|maid|moving|storage|fencing|pool|massage|physicaltherapy|brewery|winery|vineyard|realty|realestate|mortgage|insurance|financial|invest|coach|tutoring|martial|dance|music|petcare|veterinar|animal/i;

  return localServicePattern.test(domain);
}

function isLocalWithoutStorefront(domain, scores, context) {
  if (!isLocalBusinessLooking(domain)) return false;

  const signals = context.signals || {};
  const hasCart = !!signals.hasCart;
  const hasProductSchema = !!signals.hasProductSchema;

  const combined = `${String(context.bodyText || "")} ${String(
    context.linksText || ""
  )}`.toLowerCase();

  const strongStorefrontCopy =
    /add to cart|buy now|checkout|proceed to checkout|add to bag|place order|order online now|shop now|view cart|your cart|continue shopping/i.test(
      combined
    );

  const ecomScore = scores["E-commerce"] || 0;

  return !hasCart && !hasProductSchema && !strongStorefrontCopy && ecomScore < 18;
}

function applyFinalDomainOverrides(
  siteType,
  confidence,
  url,
  domain,
  matchedSignals,
  scores,
  context = {}
) {
  let finalType = siteType;
  let finalConfidence = confidence;
  const pathname = getPathname(url);

  const {
    domainIntel,
    PATH_OVERRIDES,
    comparisonDomains = new Set(),
    mediaDomains = new Set(),
    saasCoreDomains = new Set(),
    directoryCoreDomains = new Set(),
    pureBlogDomains = new Set(),
    isStrongRetailProductPath,
    isStrongBrandedLocalBusiness,
  } = context;

  if (!domainIntel) {
    return { siteType: finalType, confidence: finalConfidence };
  }

  const prior = domainIntel.getDomainPrior(domain);

  finalType = applyPathOverrides(url, finalType, matchedSignals, PATH_OVERRIDES);

  // ── FIX 1: Legal directory domains always → Directory ─────────────────────
  if (LEGAL_DIRECTORY_DOMAINS.has(domain)) {
    if (finalType !== "Directory") {
      matchedSignals.push({
        type: "Post-process",
        reason: "known legal directory domain -> Directory",
        points: 0,
      });
    }
    finalType = "Directory";
    finalConfidence = "High";
    return { siteType: finalType, confidence: finalConfidence };
  }

  // ── FIX 2: Known health systems → Service ─────────────────────────────────
  if (HEALTH_SYSTEM_DOMAINS.has(domain)) {
    if (finalType !== "Service") {
      matchedSignals.push({
        type: "Post-process",
        reason: "known health system domain -> Service",
        points: 0,
      });
    }
    finalType = "Service";
    finalConfidence = "High";
    return { siteType: finalType, confidence: finalConfidence };
  }

  // ── FIX 3: hard media domains force Newspaper/Blog, never Saas ───────────
  if (HARD_MEDIA_DOMAINS.has(domain) || mediaDomains.has(domain)) {
    const isBlogLikePath = BLOG_LIKE_PATH_RE.test(pathname);
    const resolvedMediaType = isBlogLikePath ? "Blog" : "Newspaper";

    if (finalType !== resolvedMediaType) {
      matchedSignals.push({
        type: "Post-process",
        reason: `hard media domain -> ${resolvedMediaType}`,
        points: 0,
      });
    }

    finalType = resolvedMediaType;
    finalConfidence = "High";
    return { siteType: finalType, confidence: finalConfidence };
  }

  // ── FIX 4: SaaS vendor domains should never become Small business ─────────
  if (NEVER_SMALL_BUSINESS_DOMAINS.has(domain) && finalType === "Small business") {
    const resolvedType =
      HARD_SAAS_DOMAINS.has(domain) || saasCoreDomains.has(domain) ? "Saas" : "Service";

    matchedSignals.push({
      type: "Post-process",
      reason: `never-small-business domain -> ${resolvedType}`,
      points: 0,
    });

    finalType = resolvedType;
    finalConfidence = "High";
  }

  // ── FIX 5: hard SaaS vendor domains: product paths -> Saas, blog paths -> Blog
  if (HARD_SAAS_DOMAINS.has(domain) || saasCoreDomains.has(domain)) {
    if (BLOG_LIKE_PATH_RE.test(pathname)) {
      if (finalType !== "Blog") {
        matchedSignals.push({
          type: "Post-process",
          reason: "SaaS domain on blog/resource path -> Blog",
          points: 0,
        });
      }
      finalType = "Blog";
      finalConfidence = "High";
    } else if (SAAS_PRODUCT_PATH_RE.test(pathname) || pathname === "/" || pathname === "") {
      if (finalType !== "Saas") {
        matchedSignals.push({
          type: "Post-process",
          reason: "core SaaS domain on homepage/product/pricing path -> Saas",
          points: 0,
        });
      }
      finalType = "Saas";
      finalConfidence = "High";
    }
  }

  // ── FIX 6: Suppress SaaS on clear location/clinic pages ───────────────────
  if (finalType === "Saas" && LOCATION_PAGE_RE.test(pathname)) {
    const serviceScore = scores["Service"] || 0;
    const sbScore = scores["Small business"] || 0;
    const resolvedType = serviceScore >= sbScore ? "Service" : "Small business";

    matchedSignals.push({
      type: "Post-process",
      reason: `Saas suppressed on location/clinic path -> ${resolvedType}`,
      points: 0,
    });
    finalType = resolvedType;
    finalConfidence = "Medium";
  }

  // ── FIX 7: Boost Directory for clear listing/search paths ─────────────────
  if (
    finalType !== "Directory" &&
    DIRECTORY_PATH_RE.test(pathname) &&
    !HEALTH_SYSTEM_DOMAINS.has(domain) &&
    !LEGAL_DIRECTORY_DOMAINS.has(domain)
  ) {
    const dirScore = scores["Directory"] || 0;
    const currentScore = scores[finalType] || 0;

    if (dirScore >= currentScore - 5) {
      matchedSignals.push({
        type: "Post-process",
        reason: "directory-pattern URL path -> Directory",
        points: 0,
      });
      finalType = "Directory";
      finalConfidence = "Medium";
    }
  }

  // ── FIX 8: .org/.edu health/medical domains that slipped through → Service ─
  const isHealthOrgOrEdu =
    /\.(org|edu)$/.test(domain) &&
    /health|medical|clinic|dental|hospital|care|hospice|rehab|therapy|pharma|medicine/i.test(
      domain
    );

  if (isHealthOrgOrEdu && finalType === "Small business") {
    matchedSignals.push({
      type: "Post-process",
      reason: "health .org/.edu domain classified Small business -> Service",
      points: 0,
    });
    finalType = "Service";
    finalConfidence = "Medium";
  }

  // Core directory domains
  if (directoryCoreDomains.has(domain)) {
    if (finalType !== "Directory") {
      matchedSignals.push({
        type: "Post-process",
        reason: "core directory domain -> Directory",
        points: 0,
      });
      finalType = "Directory";
      finalConfidence = "High";
    }
  }

  // Pure blog domains
  if (pureBlogDomains.has(domain)) {
    if (
      finalType === "Small business" ||
      finalType === "Service" ||
      finalType === "E-commerce" ||
      finalType === "Newspaper"
    ) {
      matchedSignals.push({
        type: "Post-process",
        reason: "pure blog/essay domain -> Blog",
        points: 0,
      });
      finalType = "Blog";
      finalConfidence = "High";
    }
  }

  // Comparison domains
  if (
    comparisonDomains.has(domain) &&
    (finalType === "Small business" || finalType === "Service")
  ) {
    const dirScore = scores["Directory"] || 0;
    const sbScore = scores["Small business"] || 0;
    const svcScore = scores["Service"] || 0;

    if (dirScore >= sbScore && dirScore >= svcScore) {
      matchedSignals.push({
        type: "Post-process",
        reason: "comparison domain resolves to Directory",
        points: 0,
      });
      finalType = "Directory";
      finalConfidence = "High";
    }
  }

  // Known retail hard override
  if (
    typeof isStrongRetailProductPath === "function" &&
    domainIntel.isKnownRetailDomain(domain) &&
    isStrongRetailProductPath(url, domain)
  ) {
    if (finalType !== "E-commerce") {
      matchedSignals.push({
        type: "Post-process",
        reason: "known retail + strong product path -> E-commerce (hard override)",
        points: 0,
      });
    }
    finalType = "E-commerce";
    finalConfidence = "High";
  }

  // Local business wrongly classified as E-commerce
  if (
    finalType === "E-commerce" &&
    !domainIntel.isKnownRetailDomain(domain) &&
    isLocalWithoutStorefront(domain, scores, context)
  ) {
    matchedSignals.push({
      type: "Post-process",
      reason:
        "local-looking domain classified E-commerce without cart/product evidence -> Small business",
      points: 0,
    });
    finalType = "Small business";
    finalConfidence = "Medium";
  }

  // Institutional authority domains
  const isInstitutionalDomain =
    domainIntel.isInstitutionalDomain(domain) ||
    /mayoclinic\.org|khanacademy\.org|coursera\.org|edx\.org|nyse\.com|investopedia\.com|irs\.gov|uscis\.gov|cdc\.gov/.test(
      domain
    );

  const isDiseaseOrConditionPath =
    /\/diseases?-conditions?\/|\/symptoms?\/|\/treatments?\/|\/tests?\/|\/procedures?\/|\/drugs?-supplements?\//i.test(
      pathname
    );

  if (isInstitutionalDomain) {
    if (
      finalType === "Small business" ||
      (domain === "coursera.org" && finalType === "Blog") ||
      isDiseaseOrConditionPath
    ) {
      matchedSignals.push({
        type: "Post-process",
        reason: "institutional/edu/authority domain cannot be Small business here -> Service",
        points: 0,
      });
      finalType = "Service";
      finalConfidence = "High";
    }
  }

  if (domain === "nyse.com") {
    finalType = "Service";
    finalConfidence = "High";
  }

  if (domain === "irs.gov" && /\/filing\//i.test(pathname)) {
    finalType = "Service";
    finalConfidence = "High";
  }

  // Strong branded local business
  if (
    typeof isStrongBrandedLocalBusiness === "function" &&
    isStrongBrandedLocalBusiness(
      url,
      domain,
      context.title,
      context.metaDescription,
      context.bodyText,
      context.linksText,
      context.signals || {}
    ) &&
    !comparisonDomains.has(domain) &&
    !NEVER_SMALL_BUSINESS_DOMAINS.has(domain) &&
    !HARD_MEDIA_DOMAINS.has(domain)
  ) {
    if (!hasStrongNonSmallBusiness(scores, 8)) {
      matchedSignals.push({
        type: "Post-process",
        reason: "branded local-business domain/path -> Small business (no strong alternative)",
        points: 0,
      });
      finalType = "Small business";
      finalConfidence = "High";
    }
  }

  // Second-pass local E-commerce suppression
  if (
    finalType === "E-commerce" &&
    !domainIntel.isKnownRetailDomain(domain) &&
    isLocalWithoutStorefront(domain, scores, context)
  ) {
    matchedSignals.push({
      type: "Post-process",
      reason: "second-pass: local domain without storefront evidence -> Small business",
      points: 0,
    });
    finalType = "Small business";
    finalConfidence = "Medium";
  }

  // ── FIX 9: editorial-looking paths on mixed domains should not stay Saas ──
  if (
    finalType === "Saas" &&
    EDITORIAL_PATH_RE.test(pathname) &&
    !HARD_SAAS_DOMAINS.has(domain)
  ) {
    matchedSignals.push({
      type: "Post-process",
      reason: "editorial-looking path on mixed domain -> Newspaper",
      points: 0,
    });
    finalType = "Newspaper";
    finalConfidence = "Medium";
  }

  // Domain prior wins unless classifier strongly disagrees
  if (prior && SITETYPES.includes(prior)) {
    const currentScore = scores[finalType] || 0;
    const priorScore = scores[prior] || 0;
    const strongDisagreement =
      finalType !== prior &&
      currentScore >= priorScore + 10 &&
      currentScore >= 22;

    if (!strongDisagreement) {
      matchedSignals.push({
        type: "Post-process",
        reason: `domain prior wins -> ${prior}`,
        points: 0,
      });
      finalType = prior;
      finalConfidence = "High";
    }
  }

  return {
    siteType: finalType,
    confidence: finalConfidence,
  };
}

module.exports = {
  applyPathOverrides,
  applyFinalDomainOverrides,
};