const SITE_TYPES = [
  "Blog",
  "E-commerce",
  "Small business",
  "Newspaper",
  "Saas",
  "Directory",
  "Service"
];

const KNOWN_DOMAIN_PRIORS = {
  "amazon.com": "E-commerce",
  "ebay.com": "E-commerce",
  "walmart.com": "E-commerce",
  "etsy.com": "E-commerce",
  "aliexpress.com": "E-commerce",
  "flipkart.com": "E-commerce",
  "daraz.com": "E-commerce",
  "newegg.com": "E-commerce",
  "backmarket.com": "E-commerce",
  "swappa.com": "E-commerce",

  "yelp.com": "Directory",
  "tripadvisor.com": "Directory",
  "yellowpages.com": "Directory",
  "angi.com": "Directory",
  "zillow.com": "Directory",
  "realtor.com": "Directory",
  "cars.com": "Directory",
  "autotrader.com": "Directory",
  "kbb.com": "Directory",
  "houzz.com": "Directory",

  "github.com": "Saas",
  "gitlab.com": "Saas",
  "slack.com": "Saas",
  "figma.com": "Saas",
  "notion.so": "Saas",
  "linear.app": "Saas",
  "vercel.com": "Saas",
  "netlify.com": "Saas"
};

function getDomainPrior(domain) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  for (const [key, type] of Object.entries(KNOWN_DOMAIN_PRIORS)) {
    if (d === key || d.endsWith("." + key)) return type;
  }
  return null;
}

function normalizeType(type) {
  return SITE_TYPES.includes(type) ? type : "Small business";
}

function createScores() {
  return {
    Blog: 0,
    "E-commerce": 0,
    "Small business": 0,
    Newspaper: 0,
    Saas: 0,
    Directory: 0,
    Service: 0
  };
}

function addScore(scores, matchedSignals, type, points, reason) {
  if (scores[type] === undefined) return;
  scores[type] += points;
  if (matchedSignals) matchedSignals.push(`${type}: ${reason} (+${points})`);
}

function subtractScore(scores, matchedSignals, type, points, reason) {
  if (scores[type] === undefined) return;
  scores[type] = Math.max(0, scores[type] - points);
  if (matchedSignals) matchedSignals.push(`${type}: ${reason} (-${points})`);
}

function mergeScores(base, extra, multiplier = 1) {
  for (const key of Object.keys(base)) {
    base[key] += (extra[key] || 0) * multiplier;
  }
  return base;
}

function getTopScore(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [siteType, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] || 0;

  if (topScore <= 0) {
    return {
      siteType: "Small business",
      confidence: "Low",
      topScore,
      secondScore,
      sorted
    };
  }

  let confidence = "Low";
  if (topScore >= 16 && topScore - secondScore >= 6) confidence = "High";
  else if (topScore >= 9 && topScore - secondScore >= 3) confidence = "Medium";

  return {
    siteType: normalizeType(siteType),
    confidence,
    topScore,
    secondScore,
    sorted
  };
}

function hasStrongNonSmallBusiness(scores, threshold = 8) {
  return Object.entries(scores).some(([type, score]) => {
    if (type === "Small business") return false;
    return score >= threshold;
  });
}

function pickBestNonSmallBusiness(scores) {
  const candidates = Object.entries(scores)
    .filter(([type]) => type !== "Small business")
    .sort((a, b) => b[1] - a[1]);
  const [type, score] = candidates[0] || ["Small business", 0];
  return { type, score };
}

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
    "access to this page has been denied"
  ];

  return blockPhrases.some((p) => t.includes(p) || b.includes(p));
}

function isEditorialUrl(url) {
  return /\/(review|reviews|article|articles|blog|blogs|news|post|posts|opinion|editorial|story|stories|features?|analysis|guide|guides|how-?to)\//i.test(
    String(url || "")
  );
}

function isCommerceUrl(url) {
  return /\/(product|products|shop|store|cart|checkout|collections?|categories?|dp\/|gp\/|buy\/|browse\/|c\/)|[?&](k|rh|i|node)=/i.test(
    String(url || "")
  );
}

function isKnownRetailDomain(domain) {
  return /(amazon\.|walmart\.|ebay\.|target\.|bestbuy\.|aliexpress\.|etsy\.|flipkart\.|daraz\.|newegg\.|backmarket\.)/i.test(
    String(domain || "")
  );
}

function isInstitutionalDomain(domain) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");

  return (
    d.endsWith(".gov") ||
    d.endsWith(".mil") ||
    d.endsWith(".edu") ||
    /(^|\.)(fbi|cia|nsa|dhs|uscis|justice|state|treasury|irs|cdc|nih|nasa|noaa|acf)\.gov$/.test(d) ||
    /(^|\.)(police|sheriff|county|city|state|court|courts|university|college|school)\./.test(d)
  );
}

function extractSchemaTypes(schemaText) {
  const s = String(schemaText || "").toLowerCase();
  return {
    isNewsArticle: /"@type"\s*:\s*"(newsarticle|reportagenewsarticle|liveblogposting)"/i.test(s),
    isBlogPosting: /"@type"\s*:\s*"blogposting"/i.test(s),
    isArticle: /"@type"\s*:\s*"(article|techarticle|scholarlyarticle)"/i.test(s),
    isProduct: /"@type"\s*:\s*"product"/i.test(s),
    isLocalBusiness: /"@type"\s*:\s*"(localbusiness|restaurant|dentist|attorney|medicalbusiness|store|hotel|lodgingbusiness|automotivebusiness|homeandconstructionbusiness)"/i.test(s),
    isOrganization: /"@type"\s*:\s*"(organization|corporation|nonprofit|governmentorganization|educationalorganization)"/i.test(s),
    isSoftwareApp: /"@type"\s*:\s*"(softwareapplication|webapplication|mobileapplication)"/i.test(s),
    isReview: /"@type"\s*:\s*"(review|aggregaterating)"/i.test(s)
  };
}

function scoreUrlPath(url, matchedSignals) {
  const scores = createScores();
  const u = String(url || "").toLowerCase();

  if (
    /\/(world|politics|science|health|sports|entertainment|business|technology|opinion|editorial|breaking|live|local|national|international)\//i.test(u)
  ) {
    addScore(scores, matchedSignals, "Newspaper", 8, "news section URL path");
  }

  if (/(\/blog|\/post|\/posts|\/author|\/authors|\/category|\/tag|\/archive)\//i.test(u)) {
    addScore(scores, matchedSignals, "Blog", 7, "blog content URL path");
  }

  if (
    /\/(article|articles|story|stories|guide|guides|review|reviews|analysis|how-?to|features?)\//i.test(u)
  ) {
    addScore(scores, matchedSignals, "Blog", 4, "article URL path");
    addScore(scores, matchedSignals, "Newspaper", 3, "article URL path");
  }

  if (
    /\/(product|products|shop|store|cart|checkout|collections?|categories?|browse|c\/|dp\/|gp\/)|[?&](k|rh|i|node|q)=/i.test(u)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 9, "commerce URL path");
  }

  if (
    /\/(pricing|demo|free-trial|trial|signup|sign-up|login|sign-in|app|platform|software|dashboard|workspace|integrations)\//i.test(u)
  ) {
    addScore(scores, matchedSignals, "Saas", 7, "SaaS URL path");
  }

  if (
    /\/(directory|listing|listings|companies|businesses|vendors|near-me|biz|providers?|contractors?|places)\//i.test(u)
  ) {
    addScore(scores, matchedSignals, "Directory", 7, "directory listing URL path");
  }

  if (
    /\/(services?|book|booking|appointment|consultation|quote|our-work|portfolio|case-study|investigate|programs|resources|support)\//i.test(u)
  ) {
    addScore(scores, matchedSignals, "Service", 6, "service/institutional URL path");
  }

  return scores;
}

function scoreSchema(schemaTypes, matchedSignals, context = {}) {
  const scores = createScores();
  const { isEditorial, isCommerce, isInstitutional } = context;

  if (schemaTypes.isNewsArticle) {
    addScore(scores, matchedSignals, "Newspaper", 14, "NewsArticle schema — definitive");
    subtractScore(scores, matchedSignals, "Blog", 4, "NewsArticle schema overrides Blog");
  }

  if (schemaTypes.isBlogPosting) {
    addScore(scores, matchedSignals, "Blog", 14, "BlogPosting schema — definitive");
    subtractScore(scores, matchedSignals, "Newspaper", 4, "BlogPosting schema overrides Newspaper");
  }

  if (schemaTypes.isArticle && !schemaTypes.isNewsArticle && !schemaTypes.isBlogPosting) {
    addScore(scores, matchedSignals, "Newspaper", 5, "Article schema (ambiguous)");
    addScore(scores, matchedSignals, "Blog", 5, "Article schema (ambiguous)");
  }

  if (schemaTypes.isProduct) {
    if (isEditorial) {
      addScore(scores, matchedSignals, "Blog", 5, "Product schema on editorial page = review markup");
      addScore(scores, matchedSignals, "Newspaper", 4, "Product schema on editorial page = review markup");
    } else if (isCommerce) {
      addScore(scores, matchedSignals, "E-commerce", 12, "Product schema on commerce page");
    } else if (!isInstitutional) {
      addScore(scores, matchedSignals, "E-commerce", 6, "Product schema detected");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 4, "Product schema on institutional page");
    }
  }

  if (schemaTypes.isLocalBusiness) {
    addScore(scores, matchedSignals, "Directory", 8, "LocalBusiness schema detected");
    addScore(scores, matchedSignals, "Small business", 5, "LocalBusiness schema (could be single business)");
    addScore(scores, matchedSignals, "Service", 4, "LocalBusiness schema (could be service)");
  }

  if (schemaTypes.isSoftwareApp) {
    addScore(scores, matchedSignals, "Saas", 14, "SoftwareApplication schema — definitive");
  }

  if (!schemaTypes.isLocalBusiness && !schemaTypes.isSoftwareApp && schemaTypes.isOrganization) {
    if (isInstitutional) {
      addScore(scores, matchedSignals, "Service", 4, "institutional organization schema");
      addScore(scores, matchedSignals, "Newspaper", 2, "organization schema can support public information site");
    } else {
      addScore(scores, matchedSignals, "Small business", 3, "Organization schema");
      addScore(scores, matchedSignals, "Service", 2, "Organization schema");
    }
  }

  if (schemaTypes.isReview && !schemaTypes.isProduct) {
    addScore(scores, matchedSignals, "Directory", 4, "Review/AggregateRating schema");
  }

  return scores;
}

function scoreTitle(title, matchedSignals, url = "") {
  const scores = createScores();
  const t = String(title || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);

  if (/(breaking|live updates?|developing story|report:|exclusive:|analysis:|watch:|listen:)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 8, "breaking/live news title");
  }

  if (/(news|headlines|journal|press|times|post|daily|weekly|gazette|tribune|herald)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 5, "publication name pattern in title");
  }

  if (/(best \d|top \d+|how to |guide to |tips for |vs\.?|comparison|review:|hands.?on|i tested|my experience|week \d|month \d)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 6, "editorial/review/listicle title");
  }

  if (/(blog|author|opinion|story|insights|tutorial|checklist)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 4, "blog keyword in title");
  }

  if (
    !isEditorial &&
    /(shop|buy|sale|deals|official store|cart|checkout|best sellers|free shipping)/i.test(t) &&
    !/(review|vs\.?|comparison|guide|how to|best .* for)/i.test(t)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 7, "storefront action title");
  }

  if (/(pricing|free trial|request demo|book a demo|software|platform|api|crm|automation|workspace|dashboard)/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 7, "SaaS product title");
  }

  if (
    /(find |search |near me|top \d+ .* in |best .* near|directory|listings?|compare)/i.test(t) &&
    !/(shop|buy|sale|deals|cart|checkout)/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 6, "directory/search title");
  }

  if (/(services?|appointment|consultation|quote|repair|agency|clinic|law firm|contractor|plumber|electrician|dentist|lawyer|investigate|report crime|resources|victims)/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 7, "service/institutional title");
  }

  if (/(about us|contact us|family owned|locally owned|est\. \d{4}|since \d{4}|welcome to)/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 5, "small business identity title");
  }

  return scores;
}

function scoreMetaDescription(meta, matchedSignals, url = "", domain = "") {
  const scores = createScores();
  const t = String(meta || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isInstitutional = isInstitutionalDomain(domain);

  if (/(latest news|breaking news|news and analysis|reporting on|editorial|coverage of|our journalists|staff reporter)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 6, "editorial meta description");
  }

  if (/(blog|tips|insights|tutorials?|guides?|how-to|in-depth|my take|personal)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 5, "blog meta description");
  }

  if (
    !isEditorial &&
    !isInstitutional &&
    /(buy|shop|browse|free shipping|official store|cart|checkout|delivery|in stock|best sellers|lowest price)/i.test(t) &&
    !/(review|guide|comparison|best .* for)/i.test(t)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 6, "storefront meta description");
  }

  if (/(free trial|all-in-one platform|software for|automate your|api for|manage your|your workspace|start for free|no credit card)/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 7, "SaaS product meta description");
  }

  if (
    /(find local|browse listings|compare .* near|read reviews|business hours|top-rated .* near|\d+ (businesses|companies|providers) in)/i.test(t) &&
    !/(shop|buy|cart|checkout)/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 6, "directory meta description");
  }

  if (/(our services|book (now|online|today)|request a? quote|trusted|licensed|insured|free estimate|call (us|today)|get (a free|an? instant) quote|report crime|public safety|victim assistance|law enforcement)/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 7, "service/institutional meta description");
  }

  if (/(family owned|locally owned|serving .* since|visit our|your local|neighborhood|proudly serving)/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 6, "small business meta description");
  }

  return scores;
}

function scoreBodyText(bodyText, matchedSignals, url = "", domain = "") {
  const scores = createScores();
  const t = String(bodyText || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isCommerce = isCommerceUrl(url);
  const isInstitutional = isInstitutionalDomain(domain);

  if (/\b(reuters|associated press|\bap\b|bloomberg news|afp|the wire|press trust)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 14, "wire service attribution — definitive");
  }

  if (/\b(staff reporter|staff writer|senior correspondent|managing editor|editor in chief|our newsroom|by .{3,40} correspondent)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 10, "editorial staff title");
  }

  if (/(breaking news|developing story|this story (has been updated|is developing)|we will update|live updates?|live blog)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 9, "live/breaking news signal");
  }

  if (/(correction:|editor['’]?s note:|an earlier version of this (article|story)|this article has been updated)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 10, "editorial correction notice");
  }

  const timestampMatches = (t.match(/\d+ (seconds?|minutes?|hours?) ago/gi) || []).length;
  if (timestampMatches >= 4) {
    addScore(scores, matchedSignals, "Newspaper", 8, "high timestamp density (news feed)");
  } else if (timestampMatches >= 2) {
    addScore(scores, matchedSignals, "Newspaper", 4, "moderate timestamp density");
  }

  if (/(latest news|top stories|most read|trending stories|news feed|see all stories|more stories)/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 6, "news feed/aggregation terms");
  }

  if (/(subscribe (to (our|my) (blog|newsletter)|for updates)|join \d[\d,]* (readers?|subscribers?)|get (new )?posts? (by email|delivered))/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 10, "blog newsletter/subscriber CTA");
  }

  if (/(about the author|author bio|follow (me|us) on|i['’]?ve been|in my (opinion|experience|view)|this (post|article) (covers|explains|walks you))/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 9, "personal author signal");
  }

  if (/(leave a (reply|comment)|join the discussion|comments? \(\d|disqus|related posts?|you (might|may) also (like|enjoy)|more from this author)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 6, "blog community/engagement signals");
  }

  if (/(posted (in|on)|filed under|tagged:?|categories?:|last updated:)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 5, "blog taxonomy signals");
  }

  const hasHardCommerceTerms =
    /(add to cart|buy now|proceed to checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place (your )?order|your (shopping )?cart|return policy|add to (wishlist|bag))/i.test(t);

  const hasSoftCommerceTerms =
    /(price|prices|deal|deals|order|delivery|pickup|sku|brand|model|products|items)/i.test(t);

  if (hasHardCommerceTerms) {
    addScore(scores, matchedSignals, "E-commerce", 12, "storefront action terms");
  } else if (hasSoftCommerceTerms && isCommerce && !isEditorial && !isInstitutional) {
    addScore(scores, matchedSignals, "E-commerce", 6, "commerce terms on commerce page");
  } else if (hasSoftCommerceTerms && !isEditorial && !isInstitutional) {
    addScore(scores, matchedSignals, "E-commerce", 2, "loose commerce terms (low weight)");
  }

  if (/(start (your )?free trial|no credit card (required|needed)|cancel anytime|upgrade your plan|your workspace|team (workspace|plan|account)|all-in-one platform|connect (your )?apps?|api documentation|api (key|access|endpoint)|software (pricing|plans?)|integrations? (with|available))/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 12, "SaaS product-specific terms");
  }

  if (/(book (a )?demo|request (a )?demo|see (it )?in action|watch (a )?demo|schedule (a )?call|talk to (sales|us)|contact sales)/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 8, "SaaS sales motion terms");
  }

  if (/(monthly|annual) (plan|billing|subscription)|per (user|seat|month)|billed (monthly|annually)|upgrade (to|your)|downgrade/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 9, "SaaS pricing model terms");
  }

  const hasListingSubjectTerms =
    /(restaurants?|doctors?|dentists?|lawyers?|attorneys?|plumbers?|electricians?|contractors?|salons?|gyms?|hotels?|clinics?|pharmacies?|service providers?|local businesses?|companies nearby|businesses in|providers? in|professionals? in)/i.test(t);

  const hasListingActionTerms =
    /(write a review|read (all )?reviews|open now|closed now|get directions|claimed|unclaimed|hours of operation|find (near|nearby|local)|browse (near|by category|all))/i.test(t);

  const hasListingMetaTerms =
    /(business details|\d+ reviews?|rated \d\.\d|stars? out of|average rating|verified listing|listed on)/i.test(t);

  const directorySignalCount = [hasListingSubjectTerms, hasListingActionTerms, hasListingMetaTerms].filter(Boolean).length;

  if (directorySignalCount >= 2) {
    addScore(scores, matchedSignals, "Directory", 10, `compound directory signals (${directorySignalCount}/3 clusters)`);
  } else if (directorySignalCount === 1 && !hasHardCommerceTerms) {
    addScore(scores, matchedSignals, "Directory", 3, "weak directory signal (1/3 clusters)");
  }

  if (/(schedule (an? )?(appointment|consultation|call|meeting)|book (an? )?(appointment|service|session)|request (a )?quote|get (a )?(free )?estimate|call us (today|now|for)|we (serve|service|cover) (the|your)|report a crime|victim assistance|submit a tip|public safety|human trafficking|law enforcement|investigation)/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 10, "service/institutional engagement CTA");
  }

  if (/(licensed( and insured)?|insured( and licensed)?|fully insured|certified (technician|professional|contractor)|years of (experience|service)|satisfaction guaranteed|our (team of|experienced)|we (specialize in|are experts in)|special agent|federal bureau|office of|department of|agency mission)/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 8, "professional or institutional credentials");
  }

  if (/(residential( and commercial)?|commercial( and residential)?|emergency (service|repair|call)|same.?day service|24\/7 (service|availability|support)|serving .{3,30} (area|county|region)|crime prevention|public awareness|report suspicious activity)/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 7, "service/public safety terms");
  }

  if (/(family.?owned( and operated)?|locally owned|proudly serving|our (small )?business|visit (us|our store)|in-store (pickup|experience)|come (see|visit) us|stop (in|by)|established in \d{4})/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 8, "small business identity signals");
  }

  if (/(our location|find us at|we are located|directions to|hours of operation|monday.*friday|open (monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 5, "physical location/hours signals");
  }

  return scores;
}

function scoreLinksText(linksText, matchedSignals, domain = "") {
  const scores = createScores();
  const t = String(linksText || "").toLowerCase();
  const isInstitutional = isInstitutionalDomain(domain);

  if (/\b(world|politics|science|health|sports|entertainment|breaking news|opinion|editorial|national|international|business news)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 6, "news section nav links");
  }

  if (/\b(blog|latest posts|all posts|read more|archives?|subscribe|newsletter|tutorials?|guides?)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 5, "blog nav links");
  }

  if (
    !isInstitutional &&
    /\b(shop (all|now|by)|cart|checkout|wishlist|deals|sale|collections?|departments?|brands?|best sellers|free shipping|track (your )?order)\b/i.test(t)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 6, "e-commerce nav links");
  }

  if (/\b(pricing|features?|start free|free trial|demo|sign (in|up)|login|integrations?|api|documentation|changelog|roadmap)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Saas", 5, "SaaS nav links");
  }

  if (
    /\b(directory|listings?|browse (all|by|near)|find (a |near|local)|near me|compare|top-rated|categories?)\b/i.test(t) &&
    !/(shop|cart|checkout|sale|products?|collections?)/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 5, "directory nav links");
  }

  if (/\b(our services?|book (now|online)|schedule|appointment|get a quote|free estimate|contact us|service areas?|report a crime|most wanted|cases|investigations|resources|about us|contact us)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Service", 5, "service/institutional nav links");
  }

  if (/\b(about us|our (story|team|history)|visit us|hours|find us|gallery|testimonials)\b/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 4, "small business nav links");
  }

  return scores;
}

function scoreStructuredSignals(signals, matchedSignals, context = {}) {
  const scores = createScores();
  const url = String(context.url || "").toLowerCase();
  const body = String(context.bodyText || "").toLowerCase();
  const links = String(context.linksText || "").toLowerCase();
  const domain = String(context.domain || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const knownRetail = isKnownRetailDomain(domain);
  const isInstitutional = isInstitutionalDomain(domain);

  const hasHardCommerceInBody =
    /(add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order|your cart)/i.test(body);

  const hasProductSchema = !!signals.hasProductSchema;
  const hasHardCommerce = !!signals.hasCart || hasProductSchema || hasHardCommerceInBody || isCommerceUrl(url) || knownRetail;

  if (signals.hasCart) {
    if (isEditorial) {
      addScore(scores, matchedSignals, "E-commerce", 1, "cart on editorial page (likely affiliate)");
    } else if (hasHardCommerceInBody || isCommerceUrl(url) || knownRetail) {
      addScore(scores, matchedSignals, "E-commerce", 12, "cart confirmed as storefront");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 5, "cart detected (context ambiguous)");
    }
  }

  if (knownRetail) {
    addScore(scores, matchedSignals, "E-commerce", 10, "known retail domain");
  }

  if (signals.hasSearchAndFilter && isCommerceUrl(url) && !isEditorial && !isInstitutional) {
    addScore(scores, matchedSignals, "E-commerce", 5, "product search+filter on commerce page");
  }

  if (signals.hasPhone) {
    addScore(scores, matchedSignals, "Service", 3, "phone number detected");
    addScore(scores, matchedSignals, "Small business", 2, "phone number detected");
    if (signals.hasAddress) {
      addScore(scores, matchedSignals, "Directory", 2, "phone + address (NAP pair)");
    }
  }

  if (signals.hasAddress) {
    addScore(scores, matchedSignals, "Small business", 4, "physical address detected");
    addScore(scores, matchedSignals, "Service", 3, "physical address detected");
  }

  if (signals.hasMap) {
    addScore(scores, matchedSignals, "Service", 3, "map embed detected");
    addScore(scores, matchedSignals, "Small business", 3, "map embed detected");
    if (signals.hasAddress && signals.hasPhone) {
      addScore(scores, matchedSignals, "Directory", 4, "map + NAP = directory-like profile");
    }
  }

  if (signals.hasReviews) {
    if (!hasHardCommerceInBody && !signals.hasCart && !knownRetail) {
      addScore(scores, matchedSignals, "Directory", 5, "reviews in non-commerce context");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 2, "reviews in commerce context");
    }
  }

  if ((signals.hasCart || knownRetail || (hasHardCommerceInBody && isCommerceUrl(url))) && !isEditorial) {
    subtractScore(scores, matchedSignals, "Directory", 8, "suppressed: strong commerce context");
    subtractScore(scores, matchedSignals, "Small business", 4, "suppressed: strong commerce context");
  }

  if (isInstitutional && !hasHardCommerce) {
    subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"] || 0, "institutional domain without storefront → suppress E-commerce");
  }

  return scores;
}

function applyInteractionRules(scores, matchedSignals, context) {
  const t = String(context.bodyText || "").toLowerCase();
  const nav = String(context.linksText || "").toLowerCase();
  const url = String(context.url || "").toLowerCase();
  const signals = context.signals || {};
  const domain = String(context.domain || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isInstitutional = isInstitutionalDomain(domain);

  const blogScore = scores["Blog"] || 0;
  const newsScore = scores["Newspaper"] || 0;
  const ecomScore = scores["E-commerce"] || 0;
  const saasScore = scores["Saas"] || 0;
  const sbScore = scores["Small business"] || 0;
  const serviceScore = scores["Service"] || 0;
  const dirScore = scores["Directory"] || 0;

  if (blogScore > 0 && newsScore > 0 && Math.abs(blogScore - newsScore) < 6) {
    if (/\b(reuters|ap news|associated press|bloomberg|afp)\b/i.test(t)) {
      addScore(scores, matchedSignals, "Newspaper", 8, "tiebreak: wire service attribution → Newspaper");
    } else if (/\b(i (tested|tried|used|bought|reviewed)|my (review|experience|take|opinion)|in my (opinion|experience))\b/i.test(t)) {
      addScore(scores, matchedSignals, "Blog", 8, "tiebreak: first-person narrative → Blog");
    } else if (/\b(staff (reporter|writer)|correspondent|managing editor|newsroom)\b/i.test(t)) {
      addScore(scores, matchedSignals, "Newspaper", 6, "tiebreak: staff editorial titles → Newspaper");
    } else if (/(subscribe to (my|this) (blog|newsletter)|join \d+ readers)/i.test(t)) {
      addScore(scores, matchedSignals, "Blog", 6, "tiebreak: personal subscriber CTA → Blog");
    } else if (/\b(world|politics|science|health|entertainment|breaking)\b/i.test(nav)) {
      addScore(scores, matchedSignals, "Newspaper", 5, "tiebreak: news section nav → Newspaper");
    }
  }

  if (isEditorial && blogScore + newsScore >= 8 && ecomScore > blogScore + newsScore + 4) {
    subtractScore(scores, matchedSignals, "E-commerce", 8, "editorial URL context suppresses E-commerce");
  }

  if (saasScore > 12 && ecomScore > 0) {
    subtractScore(scores, matchedSignals, "E-commerce", Math.min(ecomScore, 6), "SaaS dominant: suppress E-commerce");
  }

  if (sbScore > 0 && serviceScore > 0) {
    if (/(licensed|insured|certified|years of experience|satisfaction guaranteed|emergency service|serving .{3,30} (area|county)|special agent|department of|federal bureau|office of)/i.test(t)) {
      addScore(scores, matchedSignals, "Service", 5, "professional/institutional credentials → Service over Small business");
    }
    if (/(family.?owned|locally owned|our little|our store|come visit|pop in)/i.test(t) && serviceScore <= sbScore) {
      addScore(scores, matchedSignals, "Small business", 4, "local identity language → Small business");
    }
  }

  if (dirScore > 0 && serviceScore > 0) {
    const isMultiListingPage =
      /(browse all|view all listings|compare .* providers|find .* near|search results|showing \d+ (results|businesses))/i.test(t);
    if (!isMultiListingPage && (signals.hasAddress || signals.hasPhone)) {
      subtractScore(scores, matchedSignals, "Directory", 5, "single-business page → demote Directory");
      addScore(scores, matchedSignals, "Service", 3, "single-business page → promote Service");
    }
  }

  if (isInstitutional) {
    const hasHardStorefront = !!signals.hasCart || !!signals.hasProductSchema || /(add to cart|buy now|checkout|shop now|in stock|free shipping|official store)/i.test(t + " " + nav);
    if (!hasHardStorefront && ecomScore > 0) {
      subtractScore(scores, matchedSignals, "E-commerce", ecomScore, "institutional domain without storefront evidence → suppress E-commerce");
    }
    if (/(report a crime|submit a tip|victim assistance|investigate|federal bureau|department of|office of|public safety|law enforcement|human trafficking)/i.test(t + " " + nav + " " + url)) {
      addScore(scores, matchedSignals, "Service", 6, "institutional/public safety signals");
    }
  }
}

function inferTypeFromSignals({
  url = "",
  title = "",
  metaDescription = "",
  bodyText = "",
  linksText = "",
  schemaText = "",
  signals = {},
  siteTypeHint = null
}) {
  const matchedSignals = [];
  const scores = createScores();

  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  })();

  const domainPrior = getDomainPrior(domain);
  const institutional = isInstitutionalDomain(domain);

  if (isBotBlocked(title, bodyText)) {
    matchedSignals.push("Warning: bot-blocked page — body/meta scoring skipped");

    mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.5);
    mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.1);
    mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain), 0.8);

    if (domainPrior && SITE_TYPES.includes(domainPrior)) {
      addScore(scores, matchedSignals, domainPrior, 12, `domain prior (bot-blocked fallback): ${domainPrior}`);
    } else if (siteTypeHint && SITE_TYPES.includes(siteTypeHint)) {
      if (!(institutional && siteTypeHint === "E-commerce")) {
        addScore(scores, matchedSignals, siteTypeHint, institutional ? 1 : 3, `site type hint (bot-blocked fallback): ${siteTypeHint}`);
      } else {
        matchedSignals.push(`Site type hint (${siteTypeHint}) ignored for institutional blocked domain`);
      }
    }

    if (institutional) {
      subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"] || 0, "institutional blocked domain without storefront → suppress E-commerce");
      addScore(scores, matchedSignals, "Service", 4, "institutional domain fallback");
    }

    const topBot = getTopScore(scores);
    return {
      siteType: topBot.siteType,
      confidence: "Low",
      matchedSignals,
      scores,
      topScore: topBot.topScore,
      secondScore: topBot.secondScore
    };
  }

  const schemaTypes = extractSchemaTypes(schemaText);

  mergeScores(
    scores,
    scoreSchema(schemaTypes, matchedSignals, {
      isEditorial: isEditorialUrl(url),
      isCommerce: isCommerceUrl(url),
      isInstitutional: institutional
    }),
    1.5
  );

  mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.4);
  mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url, domain), 1.2);
  mergeScores(scores, scoreBodyText(bodyText, matchedSignals, url, domain), 1.0);
  mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain), 1.0);
  mergeScores(scores, scoreUrlPath(url, matchedSignals), 0.9);

  mergeScores(
    scores,
    scoreStructuredSignals(signals, matchedSignals, {
      url,
      bodyText,
      linksText,
      domain
    }),
    1.1
  );

  if (domainPrior && SITE_TYPES.includes(domainPrior)) {
    addScore(scores, matchedSignals, domainPrior, 4, `domain prior (tiebreaker): ${domainPrior}`);
  } else if (siteTypeHint && SITE_TYPES.includes(siteTypeHint)) {
    if (!(institutional && siteTypeHint === "E-commerce")) {
      addScore(scores, matchedSignals, siteTypeHint, institutional ? 1 : 3, "site type hint from domain analysis");
    } else {
      matchedSignals.push(`Site type hint (${siteTypeHint}) ignored for institutional domain`);
    }
  }

  applyInteractionRules(scores, matchedSignals, {
    url,
    bodyText,
    linksText,
    signals,
    domain
  });

  let { siteType, confidence, topScore, secondScore } = getTopScore(scores);

  if (siteType === "Small business") {
    const hasStrongOther = hasStrongNonSmallBusiness(scores, 8);
    if (hasStrongOther) {
      const { type: fallbackType, score: fallbackScore } = pickBestNonSmallBusiness(scores);
      matchedSignals.push(`Post-process: Small business suppressed because ${fallbackType} has stronger evidence (${fallbackScore})`);
      siteType = fallbackType;
      topScore = fallbackScore;
      confidence = confidence === "High" ? "Medium" : confidence;
    }
  }

  if (institutional && siteType === "E-commerce") {
    const hasHardStorefront =
      !!signals.hasCart ||
      !!signals.hasProductSchema ||
      /(add to cart|buy now|checkout|shop now|official store|free shipping|in stock)/i.test(
        `${title} ${metaDescription} ${bodyText} ${linksText}`
      );

    if (!hasHardStorefront) {
      matchedSignals.push("Post-process: institutional domain cannot be E-commerce without storefront evidence");
      if ((scores["Service"] || 0) >= (scores["Newspaper"] || 0)) {
        siteType = "Service";
      } else {
        siteType = "Newspaper";
      }
      confidence = "Low";
    }
  }

  return {
    siteType,
    confidence,
    matchedSignals,
    scores,
    topScore,
    secondScore
  };
}

function classifyContentType(url, pageSignals = {}, siteTypeHint = null) {
  return inferTypeFromSignals({
    url,
    title: pageSignals.title || "",
    metaDescription: pageSignals.metaDescription || "",
    bodyText: pageSignals.bodyText || "",
    linksText: pageSignals.linksText || "",
    schemaText: pageSignals.schemaText || "",
    signals: {
      hasCart: !!pageSignals.hasCart,
      hasSearchAndFilter: !!pageSignals.hasSearchAndFilter,
      hasPhone: !!pageSignals.hasPhone,
      hasAddress: !!pageSignals.hasAddress,
      hasMap: !!pageSignals.hasMap,
      hasReviews: !!pageSignals.hasReviews,
      hasBusinessListingSchema: !!pageSignals.hasBusinessListingSchema,
      hasProductSchema: !!pageSignals.hasProductSchema,
      hasArticleSchema: !!pageSignals.hasArticleSchema
    },
    siteTypeHint
  }).siteType;
}

function scoreSignals(aggregateText, linksText, signals = {}, homepageUrl = "") {
  const result = inferTypeFromSignals({
    url: homepageUrl,
    title: "",
    metaDescription: "",
    bodyText: aggregateText,
    linksText,
    schemaText: "",
    signals
  });

  return {
    siteType: result.siteType,
    confidence: result.confidence,
    matchedSignals: result.matchedSignals,
    scores: result.scores
  };
}

module.exports = {
  SITE_TYPES,
  normalizeType,
  classifyContentType,
  scoreSignals,
  inferTypeFromSignals,
  getDomainPrior
};