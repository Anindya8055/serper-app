const {
  addScore,
  subtractScore,
  createScores,
} = require("./helpers");

const {
  getPathname,
  isEditorialUrl,
  isEditorialPath,
  isCommerceUrl,
  isStrongSmallBusinessPath,
  hasSmallBusinessNiche,
} = require("../lib/url-utils");

function isPublisherEditorialDomain(domain = "") {
  const d = String(domain || "").toLowerCase();
  const domains = [
    "nytimes.com",
    "wsj.com",
    "bloomberg.com",
    "reuters.com",
    "apnews.com",
    "cnn.com",
    "foxnews.com",
    "nbcnews.com",
    "bbc.com",
    "theguardian.com",
    "thetimes.com",
    "time.com",
    "newsweek.com",
    "politico.com",
    "thehill.com",
    "usatoday.com",
    "forbes.com",
    "fortune.com",
    "businessinsider.com",
    "cnbc.com",
    "marketwatch.com",
    "ft.com",
    "economist.com",
    "techcrunch.com",
    "theverge.com",
    "wired.com",
    "arstechnica.com",
    "zdnet.com",
    "cnet.com",
    "engadget.com",
    "techradar.com",
    "tomsguide.com",
    "digitaltrends.com",
    "androidauthority.com",
    "pcmag.com",
    "investopedia.com",
    "morningstar.com",
    "consumerreports.org",
    "timeout.com",
    "travelandleisure.com",
    "hgtv.com",
    "thespruce.com",
    "architecturaldigest.com",
    "entrepreneur.com",
    "inc.com",
    "theatlantic.com",
    "wikipedia.org",
  ];

  return domains.some((base) => d === base || d.endsWith(`.${base}`));
}

function isCommunityBlogPlatform(domain = "") {
  const d = String(domain || "").toLowerCase();
  const domains = [
    "dev.to",
    "medium.com",
    "substack.com",
    "hashnode.dev",
    "hashnode.com",
  ];

  return domains.some((base) => d === base || d.endsWith(`.${base}`));
}

const STRONG_DIRECTORY_PATH_RE =
  /\/(lawyers|attorneys|all-lawyers|find-a-lawyer|find-a-dentist|find-a-doctor|directory|search\/?|search\?|results|professionals?|providers?|near-me|listing|listings)(\/|$|\?)/i;

const LOCATION_OR_CLINIC_PATH_RE =
  /\/(locations?|location\/|dental-clinic|dental-care|dental-center|dentistry|clinic|clinics?|offices?|our-locations?)(\/|$)/i;

function scoreUrlPath(url, matchedSignals) {
  const scores = createScores();
  const u = String(url || "").toLowerCase();

  if (
    /world|politics|science|health|sports|entertainment|business|technology|opinion|editorial|breaking|live|local|national|international|news\//i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 10, "news section URL path");
  }

  if (/blog|post|posts|author|authors|category|tag|archive|resources/i.test(u)) {
    addScore(scores, matchedSignals, "Blog", 8, "blog content URL path");
  }

  if (
    /article|articles|story|stories|guide|guides|review|reviews|analysis|how-?to|features?|learn|insights|research|commentary|columns?|recipe|hands-?on|preview/i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 6, "article/review URL path");
    addScore(scores, matchedSignals, "Newspaper", 4, "article/review URL path");
  }

  if (
    /product|products|shop|store|cart|checkout|collections?|categories?|browse|c\/|dpg|gp\/|\/dp\/|\/itm\/|\/ip\/|\/listing\/|\/p\//i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "E-commerce", 10, "commerce URL path");
  }

  if (
    /pricing|demo|free-trial|trial|signup|sign-up|login|sign-in|\bapp\b|software|dashboard|workspace|integrations|platform\/app|api\/|developers\//i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 8, "SaaS URL path");
  }

  if (
    /directory|listing|listings|companies|businesses|vendors|near-me|providers?|places|jobs\/search|hotel-search|find-a-|for_sale|realestateandhomes-search|\/search\?|\/compare\/|\/specs?\//i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "Directory", 8, "directory listing URL path");
  }

  if (STRONG_DIRECTORY_PATH_RE.test(u)) {
    addScore(scores, matchedSignals, "Directory", 6, "strong directory/finder URL path");
  }

  if (
    /services?|book|booking|appointment|appointments|consultation|quote|our-work|portfolio|case-study|investigate|programs|resources|support|bank|insurance|retirement|mortgage|credit-cards|wealth|invest/i.test(
      u
    )
  ) {
    addScore(scores, matchedSignals, "Service", 7, "service/institutional URL path");
  }

  if (isStrongSmallBusinessPath(u)) {
    addScore(scores, matchedSignals, "Small business", 4, "local-business path boost");
  }

  return scores;
}

function scoreSchema(schemaTypes, matchedSignals, context = {}) {
  const scores = createScores();
  const {
    isEditorial = false,
    isCommerce = false,
    isInstitutional = false,
    domain = "",
    domainIntel,
  } = context;

  if (schemaTypes.isNewsArticle) {
    addScore(scores, matchedSignals, "Newspaper", 16, "NewsArticle schema definitive");
    subtractScore(scores, matchedSignals, "Blog", 4, "NewsArticle schema overrides Blog");
  }

  if (schemaTypes.isBlogPosting) {
    addScore(scores, matchedSignals, "Blog", 14, "BlogPosting schema definitive");
    subtractScore(scores, matchedSignals, "Newspaper", 4, "BlogPosting schema overrides Newspaper");
  }

  if (schemaTypes.isArticle && !schemaTypes.isNewsArticle && !schemaTypes.isBlogPosting) {
    addScore(scores, matchedSignals, "Newspaper", 5, "Article schema ambiguous");
    addScore(scores, matchedSignals, "Blog", 5, "Article schema ambiguous");
  }

  if (schemaTypes.isProduct) {
    if (isEditorial) {
      addScore(scores, matchedSignals, "Blog", 5, "Product schema on editorial page");
      addScore(scores, matchedSignals, "Newspaper", 4, "Product schema on editorial page");
    } else if (isCommerce) {
      addScore(scores, matchedSignals, "E-commerce", 14, "Product schema on commerce page");
    } else if (!isInstitutional) {
      addScore(scores, matchedSignals, "E-commerce", 7, "Product schema detected");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 5, "Product schema on institutional page");
    }
  }

  if (schemaTypes.isStrongLocalBusinessSchema) {
    addScore(scores, matchedSignals, "Small business", 18, "specific LocalBusiness schema subtype");
    subtractScore(scores, matchedSignals, "E-commerce", 10, "local business schema overrides E-commerce");
    subtractScore(scores, matchedSignals, "Saas", 8, "local business schema overrides SaaS");
    subtractScore(scores, matchedSignals, "Directory", 6, "local business schema overrides Directory");
  } else if (schemaTypes.isLocalBusiness) {
    addScore(scores, matchedSignals, "Small business", 10, "generic LocalBusiness schema");
    addScore(scores, matchedSignals, "Directory", 3, "LocalBusiness schema could be a listing page");
    addScore(scores, matchedSignals, "Service", 2, "LocalBusiness schema can be service-oriented");
  }

  if (schemaTypes.isSoftwareApp) {
    addScore(scores, matchedSignals, "Saas", 16, "SoftwareApplication schema definitive");
  }

  if (!schemaTypes.isLocalBusiness && !schemaTypes.isSoftwareApp && schemaTypes.isOrganization) {
    if (
      isInstitutional ||
      (domainIntel && domainIntel.isLargeFinancialInstitutionDomain(domain))
    ) {
      addScore(scores, matchedSignals, "Service", 6, "institutional organization schema");
      addScore(scores, matchedSignals, "Newspaper", 2, "organization schema supports public info");
    } else {
      addScore(scores, matchedSignals, "Small business", 2, "Organization schema");
      addScore(scores, matchedSignals, "Service", 1, "Organization schema weak");
    }
  }

  if (schemaTypes.isReview && !schemaTypes.isProduct) {
    addScore(scores, matchedSignals, "Directory", 4, "Review/AggregateRating schema");
    addScore(scores, matchedSignals, "Blog", 2, "review schema supports editorial content");
  }

  return scores;
}

function scoreTitle(title, matchedSignals, url, domain = "") {
  const scores = createScores();
  const t = String(title || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isPublisher = isPublisherEditorialDomain(domain);
  const isCommunity = isCommunityBlogPlatform(domain);

  if (
    /breaking|live updates?|developing story|report|exclusive|analysis|watch live|listen/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 10, "breaking/live news title");
  }

  if (
    /news|headlines|journal|press|times|post|daily|weekly|gazette|tribune|herald/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Newspaper", 6, "publication name pattern in title");
  }

  if (
    /best|top|how to|guide to|tips for|vs\.?|comparison|review|hands.?on|i tested|my experience|outlook|forecast|prediction|analysis|recipe|preview/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 7, "editorial/review/listicle title");
    if (isPublisher) {
      addScore(scores, matchedSignals, "Newspaper", 5, "publisher review/listicle title");
    }
  }

  if (
    /blog|author|opinion|story|insights|tutorial|checklist|outlook|forecast|prediction|recipe/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 4, "blog keyword in title");
  }

  if (isCommunity) {
    addScore(scores, matchedSignals, "Blog", 8, "community publishing platform title");
    subtractScore(scores, matchedSignals, "Small business", 4, "community platform is not a local business");
  }

  if (
    !isEditorial &&
    /shop|buy|sale|deals|official store|cart|checkout|best sellers|free shipping/i.test(
      t
    ) &&
    !/review|vs\.?|comparison|guide|how to|best .* for/i.test(t)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 7, "storefront action title");
  }

  if (
    /pricing|free trial|request demo|book a demo|software|api|crm|automation|workspace|dashboard|sign in|log in/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 8, "SaaS product title");
  }

  if (
    /find|search|near me|top .* in|best .* near|directory|listings?|compare|specs?/i.test(t) &&
    !/shop|buy|sale|deals|cart|checkout/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 6, "directory/search title");
  }

  if (
    /services?|appointment|appointments|consultation|quote|repair|agency|clinic|law firm|contractor|plumber|electrician|dentist|lawyer|investigate|report crime|victims|resources|insurance|mortgage|retirement|banking|wealth management/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 7, "service/institutional title");
  }

  if (/about us|contact us|family owned|locally owned|est\.?|since \d{4}|welcome to/i.test(t)) {
    addScore(scores, matchedSignals, "Small business", 3, "small business identity title");
  }

  if (hasSmallBusinessNiche(t) && !isCommunity) {
    addScore(scores, matchedSignals, "Small business", 3, "small business niche in title");
  }

  return scores;
}

function scoreMetaDescription(meta, matchedSignals, url, domain, domainIntel) {
  const scores = createScores();
  const t = String(meta || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isInstitutional = domainIntel ? domainIntel.isInstitutionalDomain(domain) : false;
  const isPublisher = isPublisherEditorialDomain(domain);
  const isCommunity = isCommunityBlogPlatform(domain);

  if (
    /latest news|breaking news|news and analysis|reporting on|coverage of|our journalists|staff reporter/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 7, "editorial meta description");
  }

  if (
    /blog|tips|insights|tutorials?|guides?|how-to|in-depth|my take|personal|outlook|forecast|prediction|analysis|recipe|hands-on|review/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 6, "blog meta description");
    if (isPublisher) {
      addScore(scores, matchedSignals, "Newspaper", 3, "publisher editorial meta");
    }
  }

  if (isCommunity) {
    addScore(scores, matchedSignals, "Blog", 8, "community publishing platform meta");
    subtractScore(scores, matchedSignals, "Small business", 4, "community platform is not a local business");
  }

  if (
    !isEditorial &&
    !isInstitutional &&
    /buy|shop|browse|free shipping|official store|cart|checkout|delivery|in stock|best sellers|lowest price/i.test(
      t
    ) &&
    !/review|guide|comparison|best .* for/i.test(t)
  ) {
    addScore(scores, matchedSignals, "E-commerce", 7, "storefront meta description");
  }

  if (
    /free trial|all-in-one software|software for|automate your|api for|manage your|your workspace|start for free|no credit card|sign in|log in|integrations?/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 8, "SaaS product meta description");
  }

  if (
    /find local|browse listings|compare .* near|read reviews|business hours|top-rated .* near|businesses|companies|providers in|specifications|compare/i.test(
      t
    ) &&
    !/shop|buy|cart|checkout/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 6, "directory meta description");
  }

  if (
    /our services|book now online|today|request a ?quote|free estimate|get a free|an? instant quote|report crime|public safety|victim assistance|law enforcement|banking|insurance|retirement|mortgage|wealth/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 7, "service/institutional meta description");
  }

  if (
    /family owned|locally owned|serving .* since|visit our|your local|neighborhood|proudly serving/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Small business", 3, "small business meta description");
  }

  if (hasSmallBusinessNiche(t) && !isCommunity) {
    addScore(scores, matchedSignals, "Small business", 3, "small business niche in meta");
  }

  return scores;
}

function scoreBodyText(bodyText, matchedSignals, url, domain, domainIntel) {
  const scores = createScores();
  const t = String(bodyText || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isCommerce = isCommerceUrl(url);
  const isInstitutional = domainIntel ? domainIntel.isInstitutionalDomain(domain) : false;
  const knownRetail = domainIntel ? domainIntel.isKnownRetailDomain(domain) : false;
  const isPublisher = isPublisherEditorialDomain(domain);
  const isCommunity = isCommunityBlogPlatform(domain);

  if (/reuters|associated press|bloomberg news|afp|press trust/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 16, "wire service attribution definitive");
  }

  if (
    /staff reporter|staff writer|senior correspondent|managing editor|editor in chief|our newsroom|by [^.]{3,40} correspondent/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 12, "editorial staff title");
  }

  if (
    /breaking news|developing story|this story has been updated|is developing|we will update|live updates?|live blog/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 10, "live/breaking news signal");
  }

  if (
    /correction|editor'?s note|an earlier version of this article|this article has been updated/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 12, "editorial correction notice");
  }

  if (
    /latest news|top stories|most read|trending stories|news feed|see all stories|more stories/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 8, "news feed terms");
  }

  if (
    /subscribe to (our|my) (blog|newsletter)|join .* (readers|subscribers)|get new (posts?|articles?) by email/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 10, "blog newsletter CTA");
  }

  if (
    /about the author|author bio|follow me on|in my opinion|view this post|article covers|explains|walks you|ingredients|instructions|prep time|cook time/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 9, "author/recipe signal");
  }

  if (
    /leave a reply|comment|join the discussion|comments?|disqus|related posts?|you might|may also like|more from this author/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 7, "blog engagement signal");
  }

  if (/posted in|filed under|tagged?|categories?|last updated/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 5, "blog taxonomy signals");
  }

  if (isCommunity) {
    addScore(scores, matchedSignals, "Blog", 10, "community publishing platform body");
    subtractScore(scores, matchedSignals, "Small business", 6, "community platform is not a local business");
  }

  if (isPublisher && /review|reviews|best|guide|hands.?on|tested|analysis|preview/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 5, "publisher editorial review body");
    addScore(scores, matchedSignals, "Blog", 2, "review-style editorial body");
  }

  const hasHardCommerceTerms =
    /add to cart|buy now|proceed to checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place your ?order|your shopping ?cart|return policy|add to wishlist|bag/i.test(
      t
    );

  const hasSoftCommerceTerms = /price|prices|deal|deals|sku|brand|model/i.test(t);

  const hasStorefrontContext =
    isCommerce ||
    knownRetail ||
    /\/product\/|\/products\/|\/shop\/|\/store\/|\/cart|\/checkout|\/dp\/|\/p\/|\/itm\/|\/ip\//i.test(
      url
    );

  if (hasHardCommerceTerms) {
    addScore(scores, matchedSignals, "E-commerce", 14, "storefront action terms");
  } else if (
    hasSoftCommerceTerms &&
    hasStorefrontContext &&
    !isEditorial &&
    !isInstitutional
  ) {
    addScore(scores, matchedSignals, "E-commerce", 7, "commerce terms in storefront context");
  }

  if (
    /start your ?free trial|no credit card (required|needed)|cancel anytime|upgrade your plan|your workspace|team workspace|all-in-one software|connect your ?apps?|api documentation|api key|software pricing|plans?|integrations? with|developers?|automation|communications api|customer messaging platform/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 14, "SaaS product-specific terms");
  }

  if (
    /book a ?demo|request a ?demo|see it ?in action|watch a ?demo|schedule a ?call|talk to (sales|us)|contact sales/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 10, "SaaS sales motion");
  }

  if (
    /monthly|annual plan|billing|subscription|per user|seat|billed monthly|annually|upgrade|downgrade/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 10, "SaaS pricing model");
  }

  const hasListingSubjectTerms =
    /restaurants?|doctors?|dentists?|lawyers?|attorneys?|plumbers?|electricians?|contractors?|salons?|gyms?|hotels?|clinics?|pharmacies?|service providers?|local businesses?|companies nearby|businesses in|providers? in|professionals? in|jobs|flights|hotel|homes for sale|phones|smartphones/i.test(
      t
    );

  const hasListingActionTerms =
    /write a review|read all ?reviews|open now|closed now|get directions|claimed|unclaimed|hours of operation|find near|nearby|browse nearby|search results|compare|full specs|specifications/i.test(
      t
    );

  const hasListingMetaTerms =
    /business details|reviews?|rated .*stars? out of|average rating|verified listing|listed on|spec score|user rating/i.test(
      t
    );

  const directorySignalCount = [
    hasListingSubjectTerms,
    hasListingActionTerms,
    hasListingMetaTerms,
  ].filter(Boolean).length;

  if (directorySignalCount >= 2) {
    addScore(scores, matchedSignals, "Directory", 10, "compound directory signals");
  } else if (directorySignalCount === 1 && !hasHardCommerceTerms) {
    addScore(scores, matchedSignals, "Directory", 3, "weak directory signal");
  }

  if (
    /schedule an? ?(appointment|consultation|call|meeting)|book an? ?(appointment|service|session)|request a ?quote|get a ?free ?estimate|report a crime|victim assistance|submit a tip|public safety|law enforcement|investigation|banking|insurance|mortgage|retirement|wealth management/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 10, "service engagement CTA");
  }

  if (
    /licensed and insured|fully insured|certified technician|professional contractor|years of experience|satisfaction guaranteed|we specialize in/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 4, "professional credentials");
    addScore(scores, matchedSignals, "Small business", 2, "professional local business");
  }

  if (
    /special agent|federal bureau|office of|department of|agency mission/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Service", 9, "institutional service");
  }

  if (
    /residential and commercial|emergency service|repair call|same.?day service|24\/7 service|support|crime prevention|public awareness/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 7, "service/public safety terms");
  }

  if (
    /family.?owned and operated|locally owned|our small ?business|visit us|our store|in-store pickup|come see|stop in|established in \d{4}/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Small business", 4, "small business identity");
  }

  if (
    /our location|find us at|we are located|directions to|hours of operation|open monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Small business", 3, "physical location/hours");
  }

  if (hasSmallBusinessNiche(t) && !isCommunity) {
    addScore(scores, matchedSignals, "Small business", 5, "small business niche in body");
  }

  if (
    /ingredients|recipe|prep time|cook time|servings|instructions|step 1|step 2/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Blog", 8, "recipe content");
  }

  return scores;
}

function scoreLinksText(linksText, matchedSignals, domain, domainIntel) {
  const scores = createScores();
  const t = String(linksText || "").toLowerCase();
  const isInstitutional = domainIntel ? domainIntel.isInstitutionalDomain(domain) : false;
  const isPublisher = isPublisherEditorialDomain(domain);
  const isCommunity = isCommunityBlogPlatform(domain);

  if (
    /world|politics|science|health|sports|entertainment|breaking news|opinion|editorial|national|international|business news/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Newspaper", 6, "news nav links");
  }

  if (
    /blog|latest posts|all posts|read more|archives?|subscribe|newsletter|tutorials?|guides?|resources/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Blog", 5, "blog nav links");
  }

  if (isPublisher && /news|reviews|features|opinion|guides|analysis|specs/i.test(t)) {
    addScore(scores, matchedSignals, "Newspaper", 5, "publisher editorial nav");
  }

  if (isCommunity) {
    addScore(scores, matchedSignals, "Blog", 7, "community publishing platform nav");
    subtractScore(scores, matchedSignals, "Small business", 4, "community platform is not a local business");
  }

  if (
    !isInstitutional &&
    /shop all|shop now|buy now|cart|checkout|wishlist|deals|sale|collections?|departments?|brands?|best sellers|free shipping|track your ?order/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "E-commerce", 6, "e-commerce nav links");
  }

  if (
    /pricing|features?|start free|free trial|demo|sign in|login|integrations?|api|documentation|changelog|roadmap|developers?/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Saas", 5, "SaaS nav links");
  }

  if (
    /directory|listings?|browse all|near me|compare|top-rated|categories?|jobs|hotels|flights|homes|find a|specs?/i.test(
      t
    ) &&
    !/shop|cart|checkout|sale|products?|collections?/i.test(t)
  ) {
    addScore(scores, matchedSignals, "Directory", 5, "directory nav links");
  }

  if (
    /our services?|book now|online|schedule|appointment|get a quote|free estimate|service areas?|report a crime|most wanted|cases|investigations|victim assistance|file a report|banking|insurance|retirement|mortgage|wealth/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Service", 5, "service nav links");
  }

  if (
    /about us|our story|team|history|visit us|hours|find us|gallery|testimonials|contact us|locations?/i.test(
      t
    )
  ) {
    addScore(scores, matchedSignals, "Small business", 3, "small business nav links");
  }

  if (hasSmallBusinessNiche(t) && !isCommunity) {
    addScore(scores, matchedSignals, "Small business", 3, "small business niche in nav");
  }

  return scores;
}

function scoreStructuredSignals(signals, matchedSignals, context = {}) {
  const scores = createScores();

  const url = String(context.url || "").toLowerCase();
  const body = String(context.bodyText || "").toLowerCase();
  const domain = String(context.domain || "").toLowerCase();
  const domainIntel = context.domainIntel;
  const isStrongRetailProductPath = context.isStrongRetailProductPath;
  const schemaTypes = context.schemaTypes || {};

  const isEditorial = isEditorialUrl(url) || isEditorialPath(getPathname(url));
  const knownRetail = domainIntel ? domainIntel.isKnownRetailDomain(domain) : false;
  const isInstitutional = domainIntel ? domainIntel.isInstitutionalDomain(domain) : false;
  const isLargeFI = domainIntel ? domainIntel.isLargeFinancialInstitutionDomain(domain) : false;
  const isPublisher = isPublisherEditorialDomain(domain);
  const isCommunity = isCommunityBlogPlatform(domain);

  const hasHardCommerceInBody =
    /add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order|your cart/i.test(
      body
    );

  const hasProductSchema = !!signals.hasProductSchema;
  const strongRetailPath =
    typeof isStrongRetailProductPath === "function"
      ? isStrongRetailProductPath(url, domain)
      : false;

  const hasLocalBizSupport =
    !!signals.hasPhone ||
    !!signals.hasAddress ||
    !!signals.hasMap ||
    !!schemaTypes.isLocalBusiness ||
    !!schemaTypes.isStrongLocalBusinessSchema ||
    hasSmallBusinessNiche(body) ||
    isStrongSmallBusinessPath(url);

  const hasConfirmedStorefront =
    hasProductSchema ||
    hasHardCommerceInBody ||
    isCommerceUrl(url) ||
    knownRetail ||
    strongRetailPath;

  const hasHardCommerce =
    hasConfirmedStorefront || (signals.hasCart && !hasLocalBizSupport);

  if (signals.hasCart) {
    if (isEditorial || isPublisher || isCommunity) {
      addScore(scores, matchedSignals, "E-commerce", 1, "cart on editorial/community page");
    } else if (hasConfirmedStorefront) {
      addScore(scores, matchedSignals, "E-commerce", 16, "cart confirmed as storefront");
    } else if (hasLocalBizSupport && !knownRetail && !isInstitutional) {
      addScore(scores, matchedSignals, "E-commerce", 2, "cart present on local business page");
      addScore(scores, matchedSignals, "Small business", 4, "local business with plugin cart");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 6, "cart detected");
    }
  }

  if (knownRetail) {
    addScore(scores, matchedSignals, "E-commerce", 12, "known retail domain");
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      6,
      "known retail domain suppresses small business"
    );
  }

  if (isPublisher) {
    addScore(scores, matchedSignals, "Newspaper", 5, "publisher editorial domain");
  }

  if (isCommunity) {
    addScore(scores, matchedSignals, "Blog", 9, "community publishing platform");
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      6,
      "community platform is not a local business"
    );
  }

  if (
    signals.hasSearchAndFilter &&
    (isCommerceUrl(url) || knownRetail || strongRetailPath) &&
    !isEditorial &&
    !isInstitutional &&
    !isPublisher &&
    !isCommunity
  ) {
    addScore(scores, matchedSignals, "E-commerce", 6, "product search/filter");
  }

  if (signals.hasPhone && !knownRetail && !isInstitutional && !hasHardCommerce) {
    addScore(scores, matchedSignals, "Small business", 3, "phone number detected");
  }

  if (signals.hasAddress) {
    addScore(scores, matchedSignals, "Directory", 1, "address detected");
    if (!knownRetail && !isInstitutional && !hasHardCommerce) {
      addScore(scores, matchedSignals, "Small business", 3, "physical address detected");
    }
  }

  if (signals.hasMap) {
    addScore(scores, matchedSignals, "Directory", 1, "map embed detected");
    if (!knownRetail && !isInstitutional && !hasHardCommerce) {
      addScore(scores, matchedSignals, "Small business", 2, "map embed detected");
    }
  }

  if (signals.hasAddress && signals.hasPhone) {
    addScore(scores, matchedSignals, "Directory", 1, "NAP pair");
    if (!knownRetail && !isInstitutional && !hasHardCommerce) {
      addScore(scores, matchedSignals, "Small business", 4, "NAP pair supports local business");
    }
  }

  if (signals.hasReviews) {
    if (
      !hasHardCommerceInBody &&
      !hasConfirmedStorefront &&
      !knownRetail &&
      !isLargeFI &&
      !signals.hasPhone &&
      !signals.hasAddress
    ) {
      addScore(scores, matchedSignals, "Directory", 4, "reviews in non-commerce context");
    } else if (
      !knownRetail &&
      !hasConfirmedStorefront &&
      signals.hasPhone &&
      signals.hasAddress &&
      !isCommunity
    ) {
      addScore(scores, matchedSignals, "Small business", 1, "reviews on single business page");
    } else {
      addScore(scores, matchedSignals, "E-commerce", 3, "reviews in commerce context");
    }
  }

  if (hasConfirmedStorefront || knownRetail) {
    subtractScore(
      scores,
      matchedSignals,
      "Directory",
      8,
      "suppress directory on strong commerce"
    );
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      10,
      "suppress small business on strong commerce"
    );
    addScore(scores, matchedSignals, "E-commerce", 10, "strong retail product override");
  } else if (signals.hasCart && hasLocalBizSupport && !knownRetail && !isInstitutional) {
    subtractScore(
      scores,
      matchedSignals,
      "Directory",
      1,
      "single-business page is not a directory"
    );
  }

  if (isPublisher) {
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      Math.min(6, scores["Small business"] || 0),
      "publisher domain suppresses small business"
    );
  }

  if (isCommunity) {
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      Math.min(8, scores["Small business"] || 0),
      "community domain suppresses small business"
    );
  }

  const isLocationOrClinicPath = LOCATION_OR_CLINIC_PATH_RE.test(url);
  if (isLocationOrClinicPath && !hasHardCommerce && isInstitutional) {
    subtractScore(
      scores,
      matchedSignals,
      "Saas",
      Math.min(8, scores["Saas"] || 0),
      "clinic/location path on institutional domain suppresses SaaS"
    );
    addScore(
      scores,
      matchedSignals,
      "Service",
      4,
      "clinic/location path on institutional domain boosts Service"
    );
  }

  if (isInstitutional && !hasHardCommerce) {
    subtractScore(
      scores,
      matchedSignals,
      "E-commerce",
      scores["E-commerce"] || 0,
      "institutional without storefront"
    );
    subtractScore(
      scores,
      matchedSignals,
      "Small business",
      Math.min(8, scores["Small business"] || 0),
      "institutional page is not small business"
    );
    addScore(scores, matchedSignals, "Service", 5, "institutional service bias");
  }

  if (isLargeFI && !hasHardCommerce) {
    subtractScore(
      scores,
      matchedSignals,
      "Directory",
      Math.min(8, scores["Directory"] || 0),
      "large financial institution is not directory"
    );
    addScore(scores, matchedSignals, "Service", 6, "large financial institution");
  }

  return scores;
}

module.exports = {
  scoreUrlPath,
  scoreSchema,
  scoreTitle,
  scoreMetaDescription,
  scoreBodyText,
  scoreLinksText,
  scoreStructuredSignals,
};