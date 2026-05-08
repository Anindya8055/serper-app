// backend/classifier/interaction-rules.js
const {
  addScore,
  subtractScore,
  hasStrongNonSmallBusiness,
} = require("./helpers");

const {
  getPathname,
  isEditorialUrl,
  isEditorialPath,
  isCommerceUrl,
  hasSmallBusinessNiche,
} = require("../lib/url-utils");

// ─── Path helpers ─────────────────────────────────────────────────────────────

// Legal-directory path patterns (lawyers, attorneys, etc.)
const LEGAL_DIRECTORY_PATH_RE =
  /\/(lawyers|attorneys|all-lawyers|find-a-lawyer|find-a-attorney|legal-directory)(\/|$|\?)/i;

// Health-system / clinic location path patterns
const HEALTH_LOCATION_PATH_RE =
  /\/(locations?|dental-clinic|dental-care|dental-center|dentistry|clinic|clinics?|offices?|our-locations?|profile)(\/|$)/i;

// Generic strong-directory path (provider / professional finders)
const STRONG_DIRECTORY_PATH_RE =
  /\/(directory|listing|listings|find-a-|near-me|search\?|providers?|professionals?|results)(\/|$|\?)/i;

// Known legal-directory domains (redundant safety net here too)
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

// Known health-system domains
const HEALTH_SYSTEM_DOMAINS = new Set([
  "sanfordhealth.org",
  "centracare.com",
  "carilionclinic.org",
  "denverhealth.org",
  "valley-widehealth.org",
  "stanncenter.org",
  "fhcsd.org",
  "healthlinkdental.org",
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
  "bswhealth.com",
]);

function applyInteractionRules(scores, matchedSignals, context = {}) {
  const t = String(context.bodyText || "").toLowerCase();
  const nav = String(context.linksText || "").toLowerCase();
  const url = String(context.url || "").toLowerCase();
  const title = String(context.title || "").toLowerCase();
  const metaDescription = String(context.metaDescription || "").toLowerCase();
  const signals = context.signals || {};
  const domain = String(context.domain || "").toLowerCase();
  const domainIntel = context.domainIntel;
  const comparisonDomains = context.comparisonDomains || new Set();

  if (!domainIntel) return;

  const pathname = getPathname(url);
  const isEditorial = isEditorialUrl(url) || isEditorialPath(pathname);
  const isInstitutional = domainIntel.isInstitutionalDomain(domain);
  const isLargeFI = domainIntel.isLargeFinancialInstitutionDomain(domain);

  const blogScore    = scores["Blog"]           || 0;
  const newsScore    = scores["Newspaper"]       || 0;
  const ecomScore    = scores["E-commerce"]      || 0;
  const saasScore    = scores["Saas"]            || 0;
  const sbScore      = scores["Small business"]  || 0;
  const serviceScore = scores["Service"]         || 0;
  const dirScore     = scores["Directory"]       || 0;

  // ── FIX 1: Legal directory domains → hard Directory, skip all interaction rules ──
  if (LEGAL_DIRECTORY_DOMAINS.has(domain)) {
    const boost = Math.max(0, 15 - dirScore);
    if (boost > 0) {
      addScore(scores, matchedSignals, "Directory", boost, "legal directory domain hard override");
    }
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      scores["Small business"] || 0,
      "legal directory domain removes Small business"
    );
    subtractScore(
      scores,
      matchedSignals,
      "Service",
      Math.min(8, scores["Service"] || 0),
      "legal directory domain suppresses Service"
    );
    return; // no further rules needed
  }

  // ── FIX 2: Health system domains → hard Service ───────────────────────────
  if (HEALTH_SYSTEM_DOMAINS.has(domain)) {
    const boost = Math.max(0, 15 - serviceScore);
    if (boost > 0) {
      addScore(scores, matchedSignals, "Service", boost, "health system domain hard override");
    }
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      scores["Small business"] || 0,
      "health system domain removes Small business"
    );
    subtractScore(
      scores,
      matchedSignals,
      "Saas",
      scores["Saas"] || 0,
      "health system domain removes SaaS"
    );
    return; // no further rules needed
  }

  // ── FIX 3: Health .org/.edu domains not in the set but clearly institutional ──
  const isHealthOrgOrEdu =
    /\.(org|edu)$/.test(domain) &&
    /health|medical|clinic|dental|hospital|care|hospice|rehab|therapy|pharma|medicine/i.test(
      domain
    );

  if (isHealthOrgOrEdu && !isInstitutional) {
    if (sbScore > serviceScore) {
      addScore(
        scores,
        matchedSignals,
        "Service",
        sbScore - serviceScore + 4,
        "health .org/.edu domain upgrades Small business to Service"
      );
      subtractScore(
        scores,
        matchedSignals,
        "Small business",
        sbScore,
        "health .org/.edu domain removes Small business"
      );
    }
  }

  // ── FIX 4: Suppress SaaS on clinic/location paths ────────────────────────
  if (HEALTH_LOCATION_PATH_RE.test(pathname) && saasScore > 0) {
    subtractScore(
      scores,
      matchedSignals,
      "Saas",
      saasScore,
      "clinic/location path suppresses SaaS"
    );
    // and boost Service if institutional or health-looking domain
    if (isInstitutional || isHealthOrgOrEdu) {
      addScore(
        scores,
        matchedSignals,
        "Service",
        6,
        "clinic/location path on institutional domain boosts Service"
      );
    }
  }

  // ── FIX 5: Legal-directory URL paths → boost Directory ────────────────────
  if (LEGAL_DIRECTORY_PATH_RE.test(pathname) || STRONG_DIRECTORY_PATH_RE.test(pathname)) {
    if (dirScore < sbScore || dirScore < serviceScore) {
      addScore(
        scores,
        matchedSignals,
        "Directory",
        8,
        "directory/finder URL path boosts Directory"
      );
      subtractScore(
        scores,
        matchedSignals,
        "Small business",
        Math.min(8, scores["Small business"] || 0),
        "directory path dampens Small business"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // All existing rules below — unchanged
  // ─────────────────────────────────────────────────────────────────────────

  const hasSingleLocationSignals =
    (signals.hasPhone && signals.hasAddress) ||
    (signals.hasPhone && signals.hasMap) ||
    (signals.hasAddress && signals.hasMap);

  const hasLocalIdentity =
    /family.?owned|locally owned|proudly serving|serving .* since|our office|our clinic|our team|visit us|call us|contact us|hours|our location|same-day|walk-ins|licensed|insured|certified|free estimate/i.test(
      `${title} ${metaDescription} ${t} ${nav}`
    ) || hasSmallBusinessNiche(`${title} ${metaDescription} ${t} ${nav}`);

  const hasAppointmentOrBooking =
    /appointment|appointments|schedule|book now|book online|request appointment|consultation|visit us|session/i.test(
      `${url} ${title} ${metaDescription} ${t} ${nav}`
    );

  const hasLocalServiceTerms =
    /menu|catering|private events|membership|repair|collision repair|teeth whitening|services|free estimate|quote|treatment|massage|floral|bakery|pizza|dental|fitness|gym|landscaping|handyman|autobody|brewery|spa|tax preparation|custom furniture|panel upgrades|home repairs|custom cakes|weddings|beers/i.test(
      `${url} ${title} ${metaDescription} ${t} ${nav}`
    );

  const hasHardStorefrontEvidence =
    !!signals.hasCart ||
    !!signals.hasProductSchema ||
    /add to cart|buy now|checkout|shop now|official store|free shipping|in stock|best sellers/i.test(
      `${title} ${metaDescription} ${t} ${nav}`
    );

  const isLikelyLocal =
    domainIntel.isLikelyLocalBusinessDomain(domain) &&
    !domainIntel.getDomainPrior(domain) &&
    !comparisonDomains.has(domain) &&
    !isInstitutional &&
    !isLargeFI;

  const hasQuoteIntent =
    /request a?\s?quote|get a?\sfree?\sestimate|free estimate|instant quote|book now|book online|schedule|appointment|consultation/i.test(
      `${url} ${title} ${metaDescription} ${t} ${nav}`
    );

  const hasLocalBusinessIdentity =
    /family.?owned|locally owned|proudly serving|serving .{0,40} since|our office|our clinic|our team|visit us|call us|contact us|hours|our location|service area|same-day|walk-ins|licensed|insured|certified/i.test(
      `${title} ${metaDescription} ${t} ${nav}`
    ) || hasSmallBusinessNiche(`${url} ${title} ${metaDescription} ${t} ${nav}`);

  const hasSingleLocationProof =
    (signals.hasPhone && signals.hasAddress) ||
    (signals.hasPhone && signals.hasMap) ||
    (signals.hasAddress && signals.hasMap);

  const hasWeakStorefrontOnly =
    ecomScore > 0 &&
    !signals.hasCart &&
    !signals.hasProductSchema &&
    !/add to cart|buy now|checkout|official store|free shipping|in stock|best sellers/i.test(
      `${title} ${metaDescription} ${t} ${nav}`
    );

  // Blog vs Newspaper disambiguation
  if (blogScore > 0 && newsScore > 0 && Math.abs(blogScore - newsScore) <= 6) {
    if (/reuters|ap news|associated press|bloomberg|afp/i.test(t)) {
      addScore(scores, matchedSignals, "Newspaper", 8, "wire service attribution");
    } else if (
      /i tested|tried|used|bought|reviewed|my review|experience|take|opinion|in my opinion/i.test(
        t
      )
    ) {
      addScore(scores, matchedSignals, "Blog", 8, "first-person narrative");
    } else if (/staff reporter|writer|correspondent|managing editor|newsroom/i.test(t)) {
      addScore(scores, matchedSignals, "Newspaper", 6, "staff editorial titles");
    } else if (/subscribe to (my|this) blog|newsletter|join .* readers/i.test(t)) {
      addScore(scores, matchedSignals, "Blog", 6, "personal subscriber CTA");
    } else if (/world|politics|science|health|entertainment|breaking/i.test(nav)) {
      addScore(scores, matchedSignals, "Newspaper", 5, "news section nav");
    }
  }

  // Editorial pages should usually suppress storefront behavior
  if (isEditorial && blogScore + newsScore >= 8 && ecomScore > 0) {
    subtractScore(scores, matchedSignals, "E-commerce", 8, "editorial suppresses E-commerce");
  }

  // Strong SaaS pages should suppress false E-commerce drift
  if (saasScore >= 10 && ecomScore > 0) {
    subtractScore(
      scores,
      matchedSignals,
      "E-commerce",
      Math.min(ecomScore, 8),
      "SaaS suppresses E-commerce"
    );
  }

  // Narrow local-business correction
  if (
    isLikelyLocal &&
    hasSingleLocationSignals &&
    (hasLocalIdentity || hasLocalServiceTerms || hasAppointmentOrBooking)
  ) {
    addScore(scores, matchedSignals, "Small business", 7, "single-location local service/business");
    addScore(scores, matchedSignals, "Service", 3, "local service/business workflow");

    if (!hasHardStorefrontEvidence && ecomScore > 0) {
      subtractScore(
        scores,
        matchedSignals,
        "E-commerce",
        Math.min(8, scores["E-commerce"] || 0),
        "local service page without storefront"
      );
    }

    if ((scores["Saas"] || 0) > 0 && hasAppointmentOrBooking) {
      subtractScore(
        scores,
        matchedSignals,
        "Saas",
        Math.min(10, scores["Saas"] || 0),
        "local appointment page is not SaaS"
      );
    }

    if (
      (scores["Directory"] || 0) > 0 &&
      !/browse all|view all listings|search results|showing results|top .* near|businesses|providers|pros|companies/i.test(
        `${title} ${metaDescription} ${t} ${nav} ${url}`
      )
    ) {
      subtractScore(
        scores,
        matchedSignals,
        "Directory",
        Math.min(8, scores["Directory"] || 0),
        "single business is not a directory"
      );
    }
  }

  // Strong local small-business rescue
  if (
    !isInstitutional &&
    !isLargeFI &&
    hasLocalBusinessIdentity &&
    hasQuoteIntent &&
    (hasSingleLocationProof || signals.hasHours)
  ) {
    addScore(scores, matchedSignals, "Small business", 10, "strong local small-business rescue");
    addScore(scores, matchedSignals, "Service", 2, "local service business");
    subtractScore(
      scores,
      matchedSignals,
      "Directory",
      Math.min(6, scores["Directory"] || 0),
      "single-location local business is not a directory"
    );

    if (hasWeakStorefrontOnly) {
      subtractScore(
        scores,
        matchedSignals,
        "E-commerce",
        Math.min(10, scores["E-commerce"] || 0),
        "local service business without real storefront evidence"
      );
    }
  }

  // Small business vs Service
  if (sbScore > 0 && serviceScore > 0) {
    const hasServiceWorkflow =
      /schedule an? ?(appointment|consultation|call|service)|book an? ?(appointment|service|session)|request a ?quote|get a ?free ?estimate|emergency service|repair call|report a crime|submit a tip|victim assistance|public safety|investigation|banking|insurance|mortgage|retirement/i.test(
        t
      );

    const hasLocalRetailIdentity =
      /family.?owned|locally owned|our little|our store|come visit|visit us|stop in|neighborhood|our office|our clinic|call us/i.test(
        t
      ) || hasSmallBusinessNiche(`${title} ${metaDescription} ${t} ${nav}`);

    if (hasServiceWorkflow && !hasLocalRetailIdentity && serviceScore >= sbScore + 4) {
      addScore(scores, matchedSignals, "Service", 4, "service workflow language");
    } else if (hasLocalRetailIdentity) {
      addScore(scores, matchedSignals, "Small business", 8, "local identity language");
      subtractScore(scores, matchedSignals, "Service", 4, "local business dampens service");
    }
  }

  // Directory vs single-business page
  if (dirScore > 0 && serviceScore > 0) {
    const isMultiListingPage =
      /browse all|view all listings|compare .* providers|find .* near|search results|showing results|businesses|jobs|flights|hotels/i.test(
        t
      );

    if (!isMultiListingPage && signals.hasAddress && signals.hasPhone) {
      subtractScore(scores, matchedSignals, "Directory", 5, "single-business page");
      addScore(scores, matchedSignals, "Service", 3, "single-business page");
    }
  }

  // Directory vs E-commerce
  if ((scores["Directory"] || 0) > 0 && (scores["E-commerce"] || 0) > 0) {
    const isMultiListingPage =
      /browse all|view all listings|compare .* providers|find .* near|search results|showing results|businesses|top .* near|jobs|flights|hotels/i.test(
        t
      );

    const hasCartOrProduct =
      !!signals.hasCart || !!signals.hasProductSchema || isCommerceUrl(url);

    if (isMultiListingPage && !hasCartOrProduct) {
      addScore(scores, matchedSignals, "Directory", 4, "multi-listing page");
    } else if (hasCartOrProduct) {
      addScore(scores, matchedSignals, "E-commerce", 4, "storefront/cart evidence");
    }
  }

  // Blog vs Service
  if ((scores["Blog"] || 0) > 0 && (scores["Service"] || 0) > 0) {
    const isPureHowToOrGuide =
      /guide|how to|tutorial|explained|in-depth|step by step|recipe/i.test(t) &&
      !/book now|online|schedule|appointment|request a ?quote|get a ?free ?estimate/i.test(t);

    if (isPureHowToOrGuide) {
      addScore(scores, matchedSignals, "Blog", 4, "pure guide/how-to");
    }
  }

  // Institutional suppression
  if (isInstitutional) {
    const hasHardStorefront =
      !!signals.hasCart ||
      !!signals.hasProductSchema ||
      /add to cart|buy now|checkout|shop now|official store|free shipping/i.test(nav);

    if (!hasHardStorefront && (scores["E-commerce"] || 0) > 0) {
      subtractScore(
        scores,
        matchedSignals,
        "E-commerce",
        scores["E-commerce"],
        "institutional without storefront evidence"
      );
    }

    if (
      /report a crime|submit a tip|victim assistance|investigate|federal bureau|department of|office of|public safety|law enforcement|human trafficking/i.test(
        nav
      ) ||
      /report a crime|submit a tip|victim assistance|public safety|law enforcement|human trafficking/i.test(
        url
      )
    ) {
      addScore(scores, matchedSignals, "Service", 6, "institutional/public safety");
    }
  }

  // Large financial institutions
  if (isLargeFI) {
    if (isEditorial) {
      addScore(scores, matchedSignals, "Service", 6, "financial editorial section");
      addScore(scores, matchedSignals, "Blog", 4, "institutional editorial");
      addScore(scores, matchedSignals, "Newspaper", 3, "finance article style");
    }

    subtractScore(
      scores,
      matchedSignals,
      "Directory",
      Math.min(8, scores["Directory"] || 0),
      "financial institution is not a directory"
    );

    if (!signals.hasCart && !signals.hasProductSchema && !isCommerceUrl(url)) {
      subtractScore(
        scores,
        matchedSignals,
        "E-commerce",
        Math.min(8, scores["E-commerce"] || 0),
        "finance page without storefront"
      );
    }
  }

  // Special-case platform
  if (domain === "polymarket.com" || domain.endsWith(".polymarket.com")) {
    addScore(scores, matchedSignals, "Saas", 8, "prediction market platform");
    subtractScore(
      scores,
      matchedSignals,
      "Newspaper",
      Math.min(8, scores["Newspaper"] || 0),
      "platform event page is not newspaper"
    );
  }

  // Narrow branded/single-location small business rescue
  const looksLikeLocalBusinessDomain =
    domainIntel.isLikelyLocalBusinessDomain(domain) &&
    !domainIntel.getDomainPrior(domain) &&
    !domainIntel.isInstitutionalDomain(domain) &&
    !domainIntel.isLargeFinancialInstitutionDomain(domain) &&
    !comparisonDomains.has(domain);

  const hasLocalBusinessIntent =
    /family.?owned|locally owned|visit us|call us|our office|our clinic|our location|hours|appointments?|services?|menu|catering|repair|treatment|massage|dental|pizza|bakery|floral|landscaping|autobody|gym|fitness|handyman/i.test(
      `${title} ${metaDescription} ${t} ${nav} ${url}`
    ) || hasSmallBusinessNiche(`${title} ${metaDescription} ${t} ${nav} ${url}`);

  const strongCompetingClass =
    (scores["E-commerce"] || 0) >= 10 ||
    (scores["Saas"] || 0) >= 10 ||
    (scores["Directory"] || 0) >= 10 ||
    (scores["Blog"] || 0) >= 12 ||
    (scores["Newspaper"] || 0) >= 12;

  if (
    looksLikeLocalBusinessDomain &&
    hasSingleLocationSignals &&
    hasLocalBusinessIntent &&
    !strongCompetingClass
  ) {
    addScore(scores, matchedSignals, "Small business", 6, "narrow local-business rescue");
    subtractScore(scores, matchedSignals, "Directory", 4, "single business dampens directory");
    subtractScore(scores, matchedSignals, "Saas", 3, "local business dampens SaaS");

    if (!signals.hasCart && !signals.hasProductSchema && !isCommerceUrl(url)) {
      subtractScore(scores, matchedSignals, "E-commerce", 4, "local business without storefront");
    }
  }

  // Branded local business preference
  if (
    typeof context.isStrongBrandedLocalBusiness === "function" &&
    context.isStrongBrandedLocalBusiness(
      url,
      domain,
      title,
      metaDescription,
      context.bodyText,
      context.linksText,
      signals
    ) &&
    !comparisonDomains.has(domain)
  ) {
    if (!hasStrongNonSmallBusiness(scores, 8)) {
      addScore(scores, matchedSignals, "Small business", 8, "branded local business preference");
      subtractScore(scores, matchedSignals, "Directory", 4, "local business dampens Directory");
      subtractScore(scores, matchedSignals, "Saas", 4, "local business dampens SaaS");
    }
  }
}

module.exports = {
  applyInteractionRules,
};