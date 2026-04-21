// classifier.js — Fixed version
const SITE_TYPES = ["Blog","E-commerce","Small business","Newspaper","Saas","Directory","Service"];

const KNOWN_DOMAIN_PRIORS = {
  "cnn.com":"Newspaper","bbc.com":"Newspaper","bbc.co.uk":"Newspaper","nytimes.com":"Newspaper",
  "washingtonpost.com":"Newspaper","theguardian.com":"Newspaper","reuters.com":"Newspaper",
  "apnews.com":"Newspaper","foxnews.com":"Newspaper","foxsports.com":"Newspaper","espn.com":"Newspaper",
  "si.com":"Newspaper","bleacherreport.com":"Newspaper","sbnation.com":"Blog","nbcsports.com":"Newspaper",
  "cbssports.com":"Newspaper","nfl.com":"Newspaper","arstechnica.com":"Newspaper","theverge.com":"Newspaper",
  "wired.com":"Newspaper","techcrunch.com":"Newspaper","engadget.com":"Newspaper","9to5google.com":"Blog",
  "9to5mac.com":"Blog","androidcentral.com":"Newspaper","androidauthority.com":"Newspaper",
  "gsmarena.com":"Newspaper","tomsguide.com":"Newspaper","tomshardware.com":"Newspaper",
  "pcmag.com":"Newspaper","cnet.com":"Newspaper","zdnet.com":"Newspaper","howtogeek.com":"Blog",
  "gizmodo.com":"Newspaper","mashable.com":"Newspaper","digitaltrends.com":"Newspaper",
  "thurrott.com":"Blog","markellisreviews.com":"Blog","notebookcheck.net":"Newspaper",
  "phonearena.com":"Newspaper","consumerreports.org":"Newspaper","britannica.com":"Newspaper",
  "wikipedia.org":"Newspaper","wikimedia.org":"Newspaper","silverandblackpride.com":"Blog",
  "bleedinggreennation.com":"Blog",
  "amazon.com":"E-commerce","amazon.co.uk":"E-commerce","walmart.com":"E-commerce",
  "ebay.com":"E-commerce","target.com":"E-commerce","bestbuy.com":"E-commerce",
  "aliexpress.com":"E-commerce","etsy.com":"E-commerce","flipkart.com":"E-commerce","daraz.com":"E-commerce",
  "shopify.com":"Saas","stripe.com":"Saas","github.com":"Saas","gitlab.com":"Saas"
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
  return { Blog: 0, "E-commerce": 0, "Small business": 0, Newspaper: 0, Saas: 0, Directory: 0, Service: 0 };
}

function addScore(scores, matchedSignals, type, points, reason) {
  if (scores[type] === undefined) return;
  scores[type] += points;
  if (matchedSignals) matchedSignals.push(`${type}: ${reason} (+${points})`);
}

function mergeScores(base, extra, multiplier = 1) {
  for (const key of Object.keys(base)) base[key] += (extra[key] || 0) * multiplier;
  return base;
}

function getTopScore(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [siteType, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] || 0;
  if (topScore <= 0) return { siteType: "Small business", confidence: "Low", topScore, secondScore, sorted };
  let confidence = "Low";
  if (topScore >= 14 && topScore - secondScore >= 5) confidence = "High";
  else if (topScore >= 8 && topScore - secondScore >= 2) confidence = "Medium";
  return { siteType: normalizeType(siteType), confidence, topScore, secondScore, sorted };
}

function isEditorialUrl(url) {
  return /\/(review|reviews|article|articles|blog|blogs|news|post|posts|opinion|editorial|story|stories|features?|analysis|guide|guides|how-?to)\//i.test(String(url));
}

function isCommerceUrl(url) {
  return /\/(product|products|shop|store|cart|checkout|collections?|categories?|dp\/|gp\/product\/|buy\/)/i.test(String(url));
}

function scoreUrlPath(url, matchedSignals) {
  const scores = createScores();
  const lowerUrl = String(url || "").toLowerCase();
  if (/(\/(blog|post|posts|article|articles|author)\/)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "Blog", 5, "blog/article URL path");
  if (/(\/(news|latest|world|politics|opinion|editorial|live|breaking|features?|review|reviews|analysis|guide|how-?to)\/)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "Newspaper", 5, "news/editorial URL path");
  if (/(\/(product|products|shop|store|cart|checkout|collections?|categories?|dp\/|gp\/product\/|browse)\/|[?&](k|rh|i|node)=)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "E-commerce", 8, "commerce/taxonomy URL path");
  if (/(\/(pricing|demo|free-trial|trial|signup|sign-up|sign-in|login|app|platform|software)\/)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "Saas", 5, "saas URL path");
  if (/(\/(directory|listing|listings|companies|businesses|vendors|near-me|biz|provider|contractor)\/)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "Directory", 4, "directory/listing URL path");
  if (/(\/(services?|book|booking|appointment|consultation|quote|contact)\/)/i.test(lowerUrl))
    addScore(scores, matchedSignals, "Service", 5, "service URL path");
  return scores;
}

function scoreTitle(title, matchedSignals, url = "") {
  const scores = createScores();
  const t = String(title || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  if (/(blog|author|opinion|editorial|story|stories|insights|tips|review|analysis|guide)/i.test(t))
    addScore(scores, matchedSignals, "Blog", 4, "blog/editorial title");
  if (/(news|breaking|report|journal|headlines|live updates)/i.test(t))
    addScore(scores, matchedSignals, "Newspaper", 5, "news title");
  if (!isEditorial && /(shop|buy|sale|deals|official store|cart|checkout|best sellers)/i.test(t) &&
    !/(review|reviews|best \w+ for|guide|how to|vs\.?|comparison)/i.test(t))
    addScore(scores, matchedSignals, "E-commerce", 5, "commerce title");
  if (/(best |top \d|review|reviews|vs\.?|comparison|rated|rating|hands.?on|first look)/i.test(t)) {
    addScore(scores, matchedSignals, "Blog", 3, "review/comparison title");
    addScore(scores, matchedSignals, "Newspaper", 2, "review/editorial title");
  }
  if (/(pricing|free trial|request demo|book demo|software|platform|api|crm|automation)/i.test(t))
    addScore(scores, matchedSignals, "Saas", 5, "saas title");
  if (/(directory|find businesses|listings|companies|providers|near me)/i.test(t) &&
    !/(shop|buy|sale|deals|cart|checkout)/i.test(t))
    addScore(scores, matchedSignals, "Directory", 5, "directory title");
  if (/(services?|appointment|consultation|quote|repair|agency|clinic|law firm)/i.test(t))
    addScore(scores, matchedSignals, "Service", 5, "service title");
  if (/(about us|contact us|hours|family owned|locally owned)/i.test(t))
    addScore(scores, matchedSignals, "Small business", 4, "small business title");
  return scores;
}

function scoreMetaDescription(meta, matchedSignals, url = "") {
  const scores = createScores();
  const t = String(meta || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  if (/(latest news|news.*reviews|editorial|trends|analysis|breaking|reporting)/i.test(t))
    addScore(scores, matchedSignals, "Newspaper", 4, "editorial meta");
  if (/(blog|articles|insights|tips|guide|tutorial)/i.test(t))
    addScore(scores, matchedSignals, "Blog", 3, "blog meta");
  if (!isEditorial && /(buy|shop|browse|free shipping|official store|cart|checkout|delivery|pickup|best sellers|in stock)/i.test(t) &&
    !/(review|guide|comparison|best \w+ for)/i.test(t))
    addScore(scores, matchedSignals, "E-commerce", 5, "commerce meta");
  if (/(free trial|all-in-one platform|software|automation|api|dashboard)/i.test(t))
    addScore(scores, matchedSignals, "Saas", 4, "saas meta");
  if (/(directory|browse listings|find local|compare providers|ratings|hours|location)/i.test(t) &&
    !/(shop|buy|sale|cart|checkout)/i.test(t))
    addScore(scores, matchedSignals, "Directory", 4, "directory meta");
  if (/(our services|book now|request a quote|trusted experts)/i.test(t))
    addScore(scores, matchedSignals, "Service", 4, "service meta");
  if (/(local business|family owned|serving|visit our store)/i.test(t))
    addScore(scores, matchedSignals, "Small business", 3, "small business meta");
  return scores;
}

function scoreBodyText(bodyText, matchedSignals, url = "") {
  const scores = createScores();
  const t = String(bodyText || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isCommerce = isCommerceUrl(url);
  if (/(posted by|written by|comments|subscribe to our (blog|newsletter)|latest posts|related posts|share this article|published on)/i.test(t))
    addScore(scores, matchedSignals, "Blog", 4, "blog body text");
  if (/(breaking news|latest news|reporting|journalism|press|newsroom|editors'? choice|staff writer|correspondent)/i.test(t))
    addScore(scores, matchedSignals, "Newspaper", 5, "news/editorial body text");
  const hasStrictCommerceTerms = /(add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order|your cart|proceed to checkout)/i.test(t);
  const hasLooseCommerceTerms = /(price|prices|deals|order|delivery|pickup|sku|brand|model|products|items)/i.test(t);
  if (hasStrictCommerceTerms)
    addScore(scores, matchedSignals, "E-commerce", 9, "storefront action terms in body");
  else if (hasLooseCommerceTerms && isCommerce && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 6, "commerce terms on commerce URL");
  else if (hasLooseCommerceTerms && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 3, "commerce terms in body (low weight)");
  if (/(free trial|request demo|book demo|start for free|your workspace|team workspace|all-in-one platform|integrations|api documentation|software pricing)/i.test(t))
    addScore(scores, matchedSignals, "Saas", 7, "saas product body text");
  const hasBusinessDirectoryTerms = /(companies|businesses|providers|professionals|contractors|agencies|restaurants|doctors|dentists|lawyers|attorneys|clinics|salons|gyms|hotels|places|near me|local businesses|business listing|listed business)/i.test(t);
  const hasLocalDirectoryTerms = /(business details|hours|open now|closed now|phone number|directions|map|nearby|claimed|find local)/i.test(t);
  if (hasBusinessDirectoryTerms && hasLocalDirectoryTerms && !hasStrictCommerceTerms)
    addScore(scores, matchedSignals, "Directory", 8, "business directory body text");
  if (/(our services|schedule appointment|book appointment|request quote|call us today|consultation|get a quote)/i.test(t))
    addScore(scores, matchedSignals, "Service", 6, "service body text");
  if (/(visit us|our location|hours of operation|family owned|locally owned|call now)/i.test(t))
    addScore(scores, matchedSignals, "Small business", 5, "small business body text");
  return scores;
}

function scoreLinksText(linksText, matchedSignals) {
  const scores = createScores();
  const t = String(linksText || "").toLowerCase();
  if (/(blog|articles|latest posts|read more)/i.test(t))
    addScore(scores, matchedSignals, "Blog", 2, "blog nav/link text");
  if (/(news|world|politics|features|opinion|headlines|reviews|analysis)/i.test(t))
    addScore(scores, matchedSignals, "Newspaper", 3, "news/editorial nav");
  if (/(shop|cart|checkout|wishlist|deals|sale|collections|departments|best sellers)/i.test(t))
    addScore(scores, matchedSignals, "E-commerce", 4, "commerce nav");
  if (/(pricing|demo|login|sign in|integrations|platform|features)/i.test(t))
    addScore(scores, matchedSignals, "Saas", 3, "saas nav");
  if (/(directory|listings|companies|businesses|vendors|near me|maps|providers)/i.test(t) &&
    !/(shop|cart|checkout|sale|collections)/i.test(t))
    addScore(scores, matchedSignals, "Directory", 3, "directory nav");
  if (/(services|book now|appointment|quote|contact us)/i.test(t))
    addScore(scores, matchedSignals, "Service", 3, "service nav");
  if (/(about us|visit us|locations|hours)/i.test(t))
    addScore(scores, matchedSignals, "Small business", 2, "small business nav");
  return scores;
}

function scoreStructuredSignals(signals, matchedSignals, context = {}) {
  const scores = createScores();
  const url = String(context.url || "").toLowerCase();
  const bodyText = String(context.bodyText || "").toLowerCase();
  const domain = String(context.domain || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const isCommerce = isCommerceUrl(url);
  const retailUrlPatterns = /\/dp\/|\/gp\/|\/gp\/product\/|\/browse\/|\/shop\/|\/c\/|\/collections?\/|\/category\/|\/categories\/|\/s(\?|\/)|[?&](k|rh|i|node|low-price|high-price)=/i;
  const knownRetailDomains = /(amazon\.|walmart\.|ebay\.|target\.|bestbuy\.|aliexpress\.|etsy\.|flipkart\.|daraz\.)/i;
  const hasStrictCommerceBody = /(add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order|proceed to checkout)/i.test(bodyText);

  if (signals.hasCart) {
    if (isEditorial || (!isCommerce && signals.hasArticleSchema))
      addScore(scores, matchedSignals, "E-commerce", 2, "cart/buy-link in editorial context (affiliate)");
    else if (hasStrictCommerceBody || isCommerce)
      addScore(scores, matchedSignals, "E-commerce", 10, "cart detected (storefront)");
    else
      addScore(scores, matchedSignals, "E-commerce", 5, "cart detected (ambiguous)");
  }

  const hasStrongCommerceIntent = signals.hasCart || signals.hasProductSchema || hasStrictCommerceBody || retailUrlPatterns.test(url) || knownRetailDomains.test(domain);
  if (hasStrongCommerceIntent && !isEditorial && !signals.hasArticleSchema)
    addScore(scores, matchedSignals, "E-commerce", 12, "strong commerce intent detected");
  else if (hasStrongCommerceIntent && (isEditorial || signals.hasArticleSchema))
    addScore(scores, matchedSignals, "E-commerce", 3, "commerce signals on editorial page (low weight)");

  if (signals.hasSearchAndFilter && isCommerce && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 4, "search/filter on commerce page");
  if (signals.hasPhone) {
    addScore(scores, matchedSignals, "Small business", 2, "phone detected");
    addScore(scores, matchedSignals, "Service", 2, "phone can indicate service business");
  }
  if (signals.hasAddress) {
    addScore(scores, matchedSignals, "Small business", 3, "address detected");
    addScore(scores, matchedSignals, "Service", 2, "address can indicate local service");
  }
  if (signals.hasMap) {
    addScore(scores, matchedSignals, "Service", 2, "map detected");
    addScore(scores, matchedSignals, "Small business", 2, "location/map detected");
  }
  if (signals.hasReviews && !hasStrongCommerceIntent)
    addScore(scores, matchedSignals, "Directory", 5, "reviews detected (non-commerce)");
  if (signals.hasBusinessListingSchema && !hasStrongCommerceIntent)
    addScore(scores, matchedSignals, "Directory", 6, "business/listing schema detected");

  if (signals.hasProductSchema) {
    if (isEditorial) {
      addScore(scores, matchedSignals, "Blog", 4, "product schema on review URL = editorial markup");
      addScore(scores, matchedSignals, "Newspaper", 3, "product schema on review URL = editorial markup");
    } else if (isCommerce || knownRetailDomains.test(domain))
      addScore(scores, matchedSignals, "E-commerce", 8, "product schema on commerce page");
    else
      addScore(scores, matchedSignals, "E-commerce", 4, "product schema detected (ambiguous)");
  }

  if (signals.hasArticleSchema) {
    addScore(scores, matchedSignals, "Blog", 4, "article schema detected");
    addScore(scores, matchedSignals, "Newspaper", 4, "article/news schema detected");
  }
  if (retailUrlPatterns.test(url) && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 8, "retail taxonomy/URL pattern detected");
  if (knownRetailDomains.test(domain))
    addScore(scores, matchedSignals, "E-commerce", 10, "known retail domain prior");

  const isTrueBusinessDirectory =
    /(companies|businesses|providers|professionals|contractors|restaurants|doctors|dentists|lawyers|attorneys|near me|local businesses|business listing)/i.test(bodyText) &&
    (signals.hasAddress || signals.hasMap || signals.hasPhone) &&
    !hasStrongCommerceIntent && !signals.hasProductSchema;
  if (isTrueBusinessDirectory)
    addScore(scores, matchedSignals, "Directory", 8, "business/provider listing signals detected");

  if (hasStrongCommerceIntent && !isEditorial && !signals.hasArticleSchema) {
    scores["Directory"] = Math.max((scores["Directory"] || 0) - 8, 0);
    matchedSignals.push("Directory: suppressed due to commerce signals (-8)");
  }
  return scores;
}

function applyInteractionRules(scores, matchedSignals, context) {
  const t = String(context.bodyText || "").toLowerCase();
  const url = String(context.url || "").toLowerCase();
  const isEditorial = isEditorialUrl(url);
  const hasDirectoryText = /(write a review|read reviews|business details|open now|closed now|directions|claimed|nearby|providers|companies|businesses)/i.test(t);
  const hasBlogText = /(posted by|written by|latest posts|subscribe to our blog)/i.test(t);
  const hasNewsText = /(breaking news|latest news|journalism|newsroom)/i.test(t);
  const hasLocalBusinessText = /(visit us|family owned|hours of operation|our location)/i.test(t);
  const hasStrictCommerceText = /(add to cart|checkout|buy now|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order)/i.test(t);

  if (/(\/(biz|listing|listings|companies|businesses)\/)/i.test(url) && hasDirectoryText && !hasStrictCommerceText)
    addScore(scores, matchedSignals, "Directory", 6, "listing path + listing text");
  if (hasDirectoryText && context.signals.hasSearchAndFilter && !hasStrictCommerceText)
    addScore(scores, matchedSignals, "Directory", 4, "listing text + filters");
  if (hasDirectoryText && context.signals.hasAddress && context.signals.hasPhone && !hasStrictCommerceText)
    addScore(scores, matchedSignals, "Directory", 3, "listing text + NAP signals");
  if (hasBlogText && hasNewsText)
    addScore(scores, matchedSignals, "Newspaper", 2, "editorial/blog overlap favors news");
  if (hasLocalBusinessText && context.signals.hasAddress && context.signals.hasPhone)
    addScore(scores, matchedSignals, "Small business", 4, "local business text + NAP");
  if (hasStrictCommerceText && context.signals.hasCart && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 6, "storefront text + cart");
  if (hasStrictCommerceText && context.signals.hasProductSchema && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 5, "storefront text + product schema");
  if (/(\/(browse|dp|gp|shop|s\?))/i.test(url) && hasStrictCommerceText && !isEditorial)
    addScore(scores, matchedSignals, "E-commerce", 5, "retail URL + storefront text");
}

function inferTypeFromSignals({ url = "", title = "", metaDescription = "", bodyText = "", linksText = "", signals = {}, siteTypeHint = null }) {
  const matchedSignals = [];
  const scores = createScores();
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } })();
  const domainPrior = getDomainPrior(domain) || siteTypeHint;
  if (domainPrior && SITE_TYPES.includes(domainPrior))
    addScore(scores, matchedSignals, domainPrior, 15, `known domain prior: ${domainPrior}`);
  mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.6);
  mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url), 1.3);
  mergeScores(scores, scoreBodyText(bodyText, matchedSignals, url), 1.0);
  mergeScores(scores, scoreLinksText(linksText, matchedSignals), 1.1);
  mergeScores(scores, scoreUrlPath(url, matchedSignals), 0.9);
  mergeScores(scores, scoreStructuredSignals(signals, matchedSignals, { url, bodyText, linksText, domain, title }), 1.2);
  applyInteractionRules(scores, matchedSignals, { url, bodyText, linksText, signals });

  const isEditorial = isEditorialUrl(url);
  const editorialScore = (scores["Blog"] || 0) + (scores["Newspaper"] || 0);
  const ecomScore = scores["E-commerce"] || 0;
  if (signals.hasArticleSchema && isEditorial && editorialScore > 0) {
    const cap = editorialScore + 8;
    if (ecomScore > cap) {
      scores["E-commerce"] = cap;
      matchedSignals.push(`Editorial override: article schema + review URL caps E-commerce at ${cap}`);
    }
  }

  if (!domainPrior && siteTypeHint && SITE_TYPES.includes(siteTypeHint))
    addScore(scores, matchedSignals, siteTypeHint, 2, "site type prior");

  const top = getTopScore(scores);
  return { siteType: top.siteType, confidence: top.confidence, matchedSignals, scores, topScore: top.topScore, secondScore: top.secondScore };
}

function classifyContentType(url, pageSignals = {}, siteTypeHint = null) {
  return inferTypeFromSignals({
    url,
    title: pageSignals.title || "",
    metaDescription: pageSignals.metaDescription || "",
    bodyText: pageSignals.bodyText || "",
    linksText: pageSignals.linksText || "",
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
  const result = inferTypeFromSignals({ url: homepageUrl, title: "", metaDescription: "", bodyText: aggregateText, linksText, signals });
  return { siteType: result.siteType, confidence: result.confidence, matchedSignals: result.matchedSignals, scores: result.scores };
}

module.exports = { SITE_TYPES, normalizeType, classifyContentType, scoreSignals, inferTypeFromSignals, getDomainPrior };