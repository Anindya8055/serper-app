// const fs = require("fs");
// const path = require("path");
// const { CLASSIFIER_VERSION } = require("./config/constants");
// // module.exports = require("./classifier");
// // module.exports = require("./classifier/index");

module.exports = require("./classifier/index");
// const {
//   createDomainIntelligence,
//   DEFAULT_SITE_TYPES,
// } = require("./lib/domain-intelligence");

// const {
//   getHostname,
//   getPathname,
//   isEditorialUrl,
//   isEditorialPath,
//   isCommerceUrl,
//   isStrongSmallBusinessPath,
//   hasSmallBusinessNiche,
// } = require("./lib/url-utils");

// function loadJson(relativePath) {
//   const filePath = path.join(__dirname, relativePath);
//   return JSON.parse(fs.readFileSync(filePath, "utf8"));
// }

// const EXACT = loadJson("./config/domain-priors/exact.json");
// const SUFFIX = loadJson("./config/domain-priors/suffix.json");
// const PATH_OVERRIDES = loadJson("./config/domain-priors/path-overrides.json");

// const domainIntel = createDomainIntelligence({
//   exact: EXACT,
//   suffix: SUFFIX,
//   siteTypes: DEFAULT_SITE_TYPES,
// });

// function getDomainPrior(domain) {
//   return domainIntel.getDomainPrior(domain);
// }

// const SITETYPES = [...DEFAULT_SITE_TYPES];

// function normalizeType(type) {
//   return domainIntel.normalizeType(type);
// }

// function createScores() {
//   return {
//     Blog: 0,
//     "E-commerce": 0,
//     "Small business": 0,
//     Newspaper: 0,
//     Saas: 0,
//     Directory: 0,
//     Service: 0,
//   };
// }

// function addScore(scores, matchedSignals, type, points, reason) {
//   if (scores[type] === undefined) return;
//   scores[type] += points;
//   if (matchedSignals) matchedSignals.push({ type, reason, points });
// }

// function subtractScore(scores, matchedSignals, type, points, reason) {
//   if (scores[type] === undefined) return;
//   scores[type] = Math.max(0, scores[type] - points);
//   if (matchedSignals) matchedSignals.push({ type, reason, points: -points });
// }

// function mergeScores(base, extra, multiplier = 1) {
//   for (const key of Object.keys(base)) {
//     base[key] += (extra[key] || 0) * multiplier;
//   }
//   return base;
// }

// function getTopScore(scores) {
//   const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
//   const [siteType, topScore] = sorted[0];
//   const secondScore = sorted[1]?.[1] || 0;

//   if (topScore === 0) {
//     return {
//       siteType: "Small business",
//       confidence: "Low",
//       topScore,
//       secondScore,
//       sorted,
//     };
//   }

//   let confidence = "Low";
//   if (topScore >= 16 && topScore - secondScore >= 6) confidence = "High";
//   else if (topScore >= 9 && topScore - secondScore >= 3) confidence = "Medium";

//   return {
//     siteType: normalizeType(siteType),
//     confidence,
//     topScore,
//     secondScore,
//     sorted,
//   };
// }

// function hasStrongNonSmallBusiness(scores, threshold = 4) {
//   return Object.entries(scores).some(([type, score]) => {
//     if (type === "Small business") return false;
//     return score >= threshold;
//   });
// }

// function pickBestNonSmallBusiness(scores) {
//   const candidates = Object.entries(scores)
//     .filter(([type]) => type !== "Small business")
//     .sort((a, b) => b[1] - a[1]);
//   const [type, score] = candidates[0] || ["Small business", 0];
//   return { type, score };
// }

// function isBotBlocked(title, bodyText) {
//   const t = String(title || "").toLowerCase();
//   const b = String(bodyText || "").toLowerCase().slice(0, 1200);

//   const blockPhrases = [
//     "just a moment",
//     "robot or human",
//     "access denied",
//     "attention required",
//     "are you human",
//     "enable javascript",
//     "please verify",
//     "ddos protection",
//     "checking your browser",
//     "403 forbidden",
//     "temporarily unavailable",
//     "this site has determined a security issue with your request",
//     "security issue with your request",
//     "you do not have permission to access this page",
//     "request blocked",
//     "the request could not be satisfied",
//     "sorry, you have been blocked",
//     "verify you are human",
//     "press and hold",
//     "cf challenge",
//     "cloudflare",
//     "akamai",
//     "perimeterx",
//     "incapsula",
//     "access to this page has been denied",
//   ];

//   return blockPhrases.some((p) => t.includes(p) || b.includes(p));
// }

// function extractSchemaTypes(schemaText) {
//   const s = String(schemaText || "").toLowerCase();

//   return {
//     isNewsArticle: /"@type"\s*:\s*"(newsarticle|reportagenewsarticle|liveblogposting)"/i.test(s),
//     isBlogPosting: /"@type"\s*:\s*"(blogposting)"/i.test(s),
//     isArticle: /"@type"\s*:\s*"(article|techarticle|scholarlyarticle|recipe)"/i.test(s),
//     isProduct: /"@type"\s*:\s*"(product)"/i.test(s),
//     isLocalBusiness:
//       /"@type"\s*:\s*"(localbusiness|restaurant|dentist|attorney|medicalbusiness|store|hotel|lodgingbusiness|automotivebusiness|homeandconstructionbusiness|professionalservice|physician|veterinarycare)"/i.test(
//         s
//       ),
//     isOrganization:
//       /"@type"\s*:\s*"(organization|corporation|nonprofit|governmentorganization|educationalorganization)"/i.test(
//         s
//       ),
//     isSoftwareApp:
//       /"@type"\s*:\s*"(softwareapplication|webapplication|mobileapplication)"/i.test(s),
//     isReview: /"@type"\s*:\s*"(review|aggregaterating)"/i.test(s),
//   };
// }

// function hasStrongEditorialPageSignals(url, title, metaDescription, bodyText, schemaTypes) {
//   const combined = `${title || ""} ${metaDescription || ""} ${bodyText || ""}`.toLowerCase();

//   const editorialTitle =
//     /what to expect|outlook|forecast|predictions?|analysis|opinion|editorial|market outlook|investment outlook|learn|insights|best|top|review|guide|how to|recipe/i.test(
//       combined
//     );

//   return (
//     !!isEditorialUrl(url) ||
//     !!isEditorialPath(getPathname(url)) ||
//     schemaTypes.isNewsArticle ||
//     schemaTypes.isBlogPosting ||
//     schemaTypes.isArticle ||
//     editorialTitle
//   );
// }

// function hasStrongLocalBusinessIdentity(title, metaDescription, bodyText, linksText, signals = {}) {
//   const t = `${title || ""} ${metaDescription || ""} ${bodyText || ""} ${linksText || ""}`.toLowerCase();
//   let hits = 0;

//   if (
//     /family.?owned|locally owned|proudly serving|serving .* since|our office|our clinic|our team|call us|contact us|visit us|book appointment|request appointment|schedule appointment|same-day|walk-ins|licensed|insured|certified|free estimate|our location|hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(
//       t
//     )
//   ) hits += 1;
//   if (hasSmallBusinessNiche(t)) hits += 1;
//   if (signals.hasPhone) hits += 1;
//   if (signals.hasAddress) hits += 1;
//   if (signals.hasMap) hits += 1;
//   if (/appointments?|services?|contact|about|locations?|reviews|testimonials/i.test(t)) hits += 1;

//   return hits >= 4;
// }

// function isStrongRetailProductPath(url, domain) {
//   const u = String(url || "").toLowerCase();
//   const d = String(domain || "").toLowerCase();

//   if (!domainIntel.isKnownRetailDomain(d)) return false;

//   return (
//     /\/dp\/|\/gp\/|\/product\/|\/products\/|\/p\/|\/pd\/|\/shop\/product\/|\.product\.\d+\.html|\/s\/[^/]+\/\d+|\/color\/\d+|\/en\/.*\/product\/|\/itm\/|\/ip\/|\/dpg\//i.test(
//       u
//     ) ||
//     /chewy\.com\/.*\/dp\/\d+/i.test(u) ||
//     /sephora\.com\/product\/.+/i.test(u) ||
//     /nordstrom\.com\/s\/.+\/\d+/i.test(u) ||
//     /macys\.com\/shop\/product\/.+/i.test(u) ||
//     /homedepot\.com\/p\/.+\/\d+/i.test(u) ||
//     /lowes\.com\/pd\/.+\/\d+/i.test(u) ||
//     /costco\.com\/.+\.product\.\d+\.html/i.test(u) ||
//     /overstock\.com\/.+\/product\.html/i.test(u) ||
//     /zappos\.com\/product\/\d+/i.test(u) ||
//     /petco\.com\/shop\/.+\/product\/.+/i.test(u) ||
//     /ulta\.com\/p\/.+/i.test(u)
//   );
// }

// const comparisonDomains = new Set([
//   "91mobiles.com",
//   "smartprix.com",
//   "kimovil.com",
//   "gadgets360.com",
//   "gsmarena.com",
//   "phonearena.com",
//   "versus.com",
//   "mobile57.com",
// ]);

// function isStrongBrandedLocalBusiness(url, domain, title, metaDescription, bodyText, linksText, signals = {}) {
//   const d = String(domain || "").toLowerCase();
//   if (!domainIntel.isLikelyLocalBusinessDomain(d)) return false;
//   if (domainIntel.getDomainPrior(d)) return false;
//   if (comparisonDomains.has(d)) return false;

//   const brandish = /^[a-z0-9-]+\.(com|net|org|co|biz|us|ca|io)$/i.test(d);
//   const pathish = isStrongSmallBusinessPath(url);
//   const identity = hasStrongLocalBusinessIdentity(title, metaDescription, bodyText, linksText, signals);
//   const niche = hasSmallBusinessNiche(`${d} ${title} ${metaDescription} ${bodyText} ${linksText}`);

//   return brandish && (pathish || identity || niche);
// }

// function applyPathOverrides(url, currentType, matchedSignals) {
//   const pathname = getPathname(url);

//   for (const [pattern, forcedType] of Object.entries(PATH_OVERRIDES || {})) {
//     try {
//       const re = new RegExp(pattern, "i");
//       if (re.test(pathname)) {
//         matchedSignals.push({
//           type: "Post-process",
//           reason: `path override matched: ${pattern} -> ${forcedType}`,
//           points: 0,
//         });
//         return normalizeType(forcedType);
//       }
//     } catch {
//       continue;
//     }
//   }

//   return currentType;
// }

// function scoreUrlPath(url, matchedSignals) {
//   const scores = createScores();
//   const u = String(url || "").toLowerCase();

//   if (
//     /world|politics|science|health|sports|entertainment|business|technology|opinion|editorial|breaking|live|local|national|international|news\//i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "Newspaper", 10, "news section URL path");
//   }

//   if (/blog|post|posts|author|authors|category|tag|archive|resources/i.test(u)) {
//     addScore(scores, matchedSignals, "Blog", 8, "blog content URL path");
//   }

//   if (
//     /article|articles|story|stories|guide|guides|review|reviews|analysis|how-?to|features?|learn|insights|research|commentary|columns?|recipe/i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "Blog", 5, "article URL path");
//     addScore(scores, matchedSignals, "Newspaper", 4, "article URL path");
//   }

//   if (
//     /product|products|shop|store|cart|checkout|collections?|categories?|browse|c\/|dpg|gp\/|\/dp\/|\/itm\/|\/ip\/|\/listing\/|\/p\//i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "E-commerce", 10, "commerce URL path");
//   }

//   if (
//     /pricing|demo|free-trial|trial|signup|sign-up|login|sign-in|app|platform|software|dashboard|workspace|integrations|features|docs|product/i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "Saas", 8, "SaaS URL path");
//   }

//   if (
//     /directory|listing|listings|companies|businesses|vendors|near-me|providers?|places|jobs\/search|hotel-search|find-a-|for_sale|realestateandhomes-search|\/search\?/i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "Directory", 8, "directory listing URL path");
//   }

//   if (
//     /services?|book|booking|appointment|appointments|consultation|quote|our-work|portfolio|case-study|investigate|programs|resources|support|bank|insurance|retirement|mortgage|credit-cards|wealth|invest/i.test(
//       u
//     )
//   ) {
//     addScore(scores, matchedSignals, "Service", 7, "service/institutional URL path");
//   }

//   if (isStrongSmallBusinessPath(u)) {
//     addScore(scores, matchedSignals, "Small business", 4, "local-business path boost");
//   }

//   return scores;
// }

// function scoreSchema(schemaTypes, matchedSignals, context) {
//   const scores = createScores();
//   const { isEditorial, isCommerce, isInstitutional, domain } = context;

//   if (schemaTypes.isNewsArticle) {
//     addScore(scores, matchedSignals, "Newspaper", 16, "NewsArticle schema definitive");
//     subtractScore(scores, matchedSignals, "Blog", 4, "NewsArticle schema overrides Blog");
//   }

//   if (schemaTypes.isBlogPosting) {
//     addScore(scores, matchedSignals, "Blog", 14, "BlogPosting schema definitive");
//     subtractScore(scores, matchedSignals, "Newspaper", 4, "BlogPosting schema overrides Newspaper");
//   }

//   if (schemaTypes.isArticle && !schemaTypes.isNewsArticle && !schemaTypes.isBlogPosting) {
//     addScore(scores, matchedSignals, "Newspaper", 5, "Article schema ambiguous");
//     addScore(scores, matchedSignals, "Blog", 5, "Article schema ambiguous");
//   }

//   if (schemaTypes.isProduct) {
//     if (isEditorial) {
//       addScore(scores, matchedSignals, "Blog", 5, "Product schema on editorial page");
//       addScore(scores, matchedSignals, "Newspaper", 4, "Product schema on editorial page");
//     } else if (isCommerce) {
//       addScore(scores, matchedSignals, "E-commerce", 14, "Product schema on commerce page");
//     } else if (!isInstitutional) {
//       addScore(scores, matchedSignals, "E-commerce", 7, "Product schema detected");
//     } else {
//       addScore(scores, matchedSignals, "E-commerce", 5, "Product schema on institutional page");
//     }
//   }

//   if (schemaTypes.isLocalBusiness) {
//     addScore(scores, matchedSignals, "Directory", 3, "LocalBusiness schema detected");
//     addScore(scores, matchedSignals, "Small business", 8, "LocalBusiness schema");
//     addScore(scores, matchedSignals, "Service", 2, "LocalBusiness schema can be service-oriented");
//   }

//   if (schemaTypes.isSoftwareApp) {
//     addScore(scores, matchedSignals, "Saas", 16, "SoftwareApplication schema definitive");
//   }

//   if (!schemaTypes.isLocalBusiness && !schemaTypes.isSoftwareApp && schemaTypes.isOrganization) {
//     if (isInstitutional || domainIntel.isLargeFinancialInstitutionDomain(domain)) {
//       addScore(scores, matchedSignals, "Service", 6, "institutional organization schema");
//       addScore(scores, matchedSignals, "Newspaper", 2, "organization schema supports public info");
//     } else {
//       addScore(scores, matchedSignals, "Small business", 2, "Organization schema");
//       addScore(scores, matchedSignals, "Service", 1, "Organization schema weak");
//     }
//   }

//   if (schemaTypes.isReview && !schemaTypes.isProduct) {
//     addScore(scores, matchedSignals, "Directory", 4, "Review/AggregateRating schema");
//   }

//   return scores;
// }

// function scoreTitle(title, matchedSignals, url) {
//   const scores = createScores();
//   const t = String(title || "").toLowerCase();
//   const isEditorial = isEditorialUrl(url);

//   if (/breaking|live updates?|developing story|report|exclusive|analysis|watch live|listen/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 10, "breaking/live news title");
//   }

//   if (/news|headlines|journal|press|times|post|daily|weekly|gazette|tribune|herald/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 6, "publication name pattern in title");
//   }

//   if (/best|top|how to|guide to|tips for|vs\.?|comparison|review|hands.?on|i tested|my experience|outlook|forecast|prediction|analysis|recipe/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 7, "editorial/review/listicle title");
//   }

//   if (/blog|author|opinion|story|insights|tutorial|checklist|outlook|forecast|prediction|recipe/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 4, "blog keyword in title");
//   }

//   if (
//     !isEditorial &&
//     /shop|buy|sale|deals|official store|cart|checkout|best sellers|free shipping/i.test(t) &&
//     !/review|vs\.?|comparison|guide|how to|best .* for/i.test(t)
//   ) {
//     addScore(scores, matchedSignals, "E-commerce", 7, "storefront action title");
//   }

//   if (/pricing|free trial|request demo|book a demo|software|platform|api|crm|automation|workspace|dashboard|features|product/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 8, "SaaS product title");
//   }

//   if (/find|search|near me|top .* in|best .* near|directory|listings?|compare/i.test(t) && !/shop|buy|sale|deals|cart|checkout/i.test(t)) {
//     addScore(scores, matchedSignals, "Directory", 6, "directory/search title");
//   }

//   if (/services?|appointment|appointments|consultation|quote|repair|agency|clinic|law firm|contractor|plumber|electrician|dentist|lawyer|investigate|report crime|victims|resources|insurance|mortgage|retirement|banking|wealth management/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 7, "service/institutional title");
//   }

//   if (/about us|contact us|family owned|locally owned|est\.?|since \d{4}|welcome to/i.test(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business identity title");
//   }

//   if (hasSmallBusinessNiche(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business niche in title");
//   }

//   return scores;
// }

// function scoreMetaDescription(meta, matchedSignals, url, domain) {
//   const scores = createScores();
//   const t = String(meta || "").toLowerCase();
//   const isEditorial = isEditorialUrl(url);
//   const isInstitutional = domainIntel.isInstitutionalDomain(domain);

//   if (/latest news|breaking news|news and analysis|reporting on|coverage of|our journalists|staff reporter/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 7, "editorial meta description");
//   }

//   if (/blog|tips|insights|tutorials?|guides?|how-to|in-depth|my take|personal|outlook|forecast|prediction|analysis|recipe/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 6, "blog meta description");
//   }

//   if (
//     !isEditorial &&
//     !isInstitutional &&
//     /buy|shop|browse|free shipping|official store|cart|checkout|delivery|in stock|best sellers|lowest price/i.test(t) &&
//     !/review|guide|comparison|best .* for/i.test(t)
//   ) {
//     addScore(scores, matchedSignals, "E-commerce", 7, "storefront meta description");
//   }

//   if (/free trial|all-in-one platform|software for|automate your|api for|manage your|your workspace|start for free|no credit card|features|productivity platform/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 8, "SaaS product meta description");
//   }

//   if (/find local|browse listings|compare .* near|read reviews|business hours|top-rated .* near|businesses|companies|providers in/i.test(t) && !/shop|buy|cart|checkout/i.test(t)) {
//     addScore(scores, matchedSignals, "Directory", 6, "directory meta description");
//   }

//   if (/our services|book now online|today|request a ?quote|free estimate|get a free|an? instant quote|report crime|public safety|victim assistance|law enforcement|banking|insurance|retirement|mortgage|wealth/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 7, "service/institutional meta description");
//   }

//   if (/family owned|locally owned|serving .* since|visit our|your local|neighborhood|proudly serving/i.test(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business meta description");
//   }

//   if (hasSmallBusinessNiche(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business niche in meta");
//   }

//   return scores;
// }

// function scoreBodyText(bodyText, matchedSignals, url, domain) {
//   const scores = createScores();
//   const t = String(bodyText || "").toLowerCase();
//   const isEditorial = isEditorialUrl(url);
//   const isCommerce = isCommerceUrl(url);
//   const isInstitutional = domainIntel.isInstitutionalDomain(domain);

//   if (/reuters|associated press|bloomberg news|afp|press trust/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 16, "wire service attribution definitive");
//   }

//   if (/staff reporter|staff writer|senior correspondent|managing editor|editor in chief|our newsroom|by [^.]{3,40} correspondent/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 12, "editorial staff title");
//   }

//   if (/breaking news|developing story|this story has been updated|is developing|we will update|live updates?|live blog/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 10, "live/breaking news signal");
//   }

//   if (/correction|editor'?s note|an earlier version of this article|this article has been updated/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 12, "editorial correction notice");
//   }

//   if (/latest news|top stories|most read|trending stories|news feed|see all stories|more stories/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 8, "news feed terms");
//   }

//   if (/subscribe to (our|my) (blog|newsletter)|join .* (readers|subscribers)|get new (posts?|articles?) by email/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 10, "blog newsletter CTA");
//   }

//   if (/about the author|author bio|follow me on|in my opinion|view this post|article covers|explains|walks you|ingredients|instructions|prep time|cook time/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 9, "author/recipe signal");
//   }

//   if (/leave a reply|comment|join the discussion|comments?|disqus|related posts?|you might|may also like|more from this author/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 7, "blog engagement signal");
//   }

//   if (/posted in|filed under|tagged?|categories?|last updated/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 5, "blog taxonomy signals");
//   }

//   const hasHardCommerceTerms =
//     /add to cart|buy now|proceed to checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place your ?order|your shopping ?cart|return policy|add to wishlist|bag/i.test(
//       t
//     );
//   const hasSoftCommerceTerms =
//     /price|prices|deal|deals|order|delivery|pickup|sku|brand|model|products|items/i.test(t);

//   if (hasHardCommerceTerms) {
//     addScore(scores, matchedSignals, "E-commerce", 14, "storefront action terms");
//   } else if (hasSoftCommerceTerms && isCommerce && !isEditorial && !isInstitutional) {
//     addScore(scores, matchedSignals, "E-commerce", 7, "commerce terms on commerce page");
//   } else if (hasSoftCommerceTerms && !isEditorial && !isInstitutional) {
//     addScore(scores, matchedSignals, "E-commerce", 3, "loose commerce terms");
//   }

//   if (/start your ?free trial|no credit card (required|needed)|cancel anytime|upgrade your plan|your workspace|team workspace|all-in-one platform|connect your ?apps?|api documentation|api key|software pricing|plans?|integrations? with|available|docs|deployment|automation|communications|customer messaging|observability|payments infrastructure|communications api|customer messaging platform/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 14, "SaaS product-specific terms");
//   }

//   if (/book a ?demo|request a ?demo|see it ?in action|watch a ?demo|schedule a ?call|talk to (sales|us)|contact sales/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 10, "SaaS sales motion");
//   }

//   if (/monthly|annual plan|billing|subscription|per user|seat|billed monthly|annually|upgrade|downgrade/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 10, "SaaS pricing model");
//   }

//   const hasListingSubjectTerms =
//     /restaurants?|doctors?|dentists?|lawyers?|attorneys?|plumbers?|electricians?|contractors?|salons?|gyms?|hotels?|clinics?|pharmacies?|service providers?|local businesses?|companies nearby|businesses in|providers? in|professionals? in|jobs|flights|hotel|homes for sale/i.test(
//       t
//     );
//   const hasListingActionTerms =
//     /write a review|read all ?reviews|open now|closed now|get directions|claimed|unclaimed|hours of operation|find near|nearby|browse nearby|search results/i.test(
//       t
//     );
//   const hasListingMetaTerms =
//     /business details|reviews?|rated .*stars? out of|average rating|verified listing|listed on/i.test(t);

//   const directorySignalCount = [
//     hasListingSubjectTerms,
//     hasListingActionTerms,
//     hasListingMetaTerms,
//   ].filter(Boolean).length;

//   if (directorySignalCount >= 2) {
//     addScore(scores, matchedSignals, "Directory", 10, "compound directory signals");
//   } else if (directorySignalCount === 1 && !hasHardCommerceTerms) {
//     addScore(scores, matchedSignals, "Directory", 3, "weak directory signal");
//   }

//   if (/schedule an? ?(appointment|consultation|call|meeting)|book an? ?(appointment|service|session)|request a ?quote|get a ?free ?estimate|report a crime|victim assistance|submit a tip|public safety|law enforcement|investigation|banking|insurance|mortgage|retirement|wealth management/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 10, "service engagement CTA");
//   }

//   if (/licensed and insured|fully insured|certified technician|professional contractor|years of experience|satisfaction guaranteed|we specialize in/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 4, "professional credentials");
//     addScore(scores, matchedSignals, "Small business", 2, "professional local business");
//   }

//   if (/special agent|federal bureau|office of|department of|agency mission/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 9, "institutional service");
//   }

//   if (/residential and commercial|emergency service|repair call|same.?day service|24\/7 service|support|crime prevention|public awareness/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 7, "service/public safety terms");
//   }

//   if (/family.?owned and operated|locally owned|proudly serving|our small ?business|visit us|our store|in-store pickup|come see|stop in|established in \d{4}/i.test(t)) {
//     addScore(scores, matchedSignals, "Small business", 4, "small business identity");
//   }

//   if (/our location|find us at|we are located|directions to|hours of operation|open monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "physical location/hours");
//   }

//   if (hasSmallBusinessNiche(t)) {
//     addScore(scores, matchedSignals, "Small business", 5, "small business niche in body");
//   }

//   if (/ingredients|recipe|prep time|cook time|servings|instructions|step 1|step 2/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 8, "recipe content");
//   }

//   return scores;
// }

// function scoreLinksText(linksText, matchedSignals, domain) {
//   const scores = createScores();
//   const t = String(linksText || "").toLowerCase();
//   const isInstitutional = domainIntel.isInstitutionalDomain(domain);

//   if (/world|politics|science|health|sports|entertainment|breaking news|opinion|editorial|national|international|business news/i.test(t)) {
//     addScore(scores, matchedSignals, "Newspaper", 6, "news nav links");
//   }

//   if (/blog|latest posts|all posts|read more|archives?|subscribe|newsletter|tutorials?|guides?|resources/i.test(t)) {
//     addScore(scores, matchedSignals, "Blog", 5, "blog nav links");
//   }

//   if (
//     !isInstitutional &&
//     /shop all|shop now|buy now|cart|checkout|wishlist|deals|sale|collections?|departments?|brands?|best sellers|free shipping|track your ?order/i.test(t)
//   ) {
//     addScore(scores, matchedSignals, "E-commerce", 6, "e-commerce nav links");
//   }

//   if (/pricing|features?|start free|free trial|demo|sign in|login|integrations?|api|documentation|changelog|roadmap|product|developers?/i.test(t)) {
//     addScore(scores, matchedSignals, "Saas", 5, "SaaS nav links");
//   }

//   if (/directory|listings?|browse all|near me|compare|top-rated|categories?|jobs|hotels|flights|homes|find a/i.test(t) && !/shop|cart|checkout|sale|products?|collections?/i.test(t)) {
//     addScore(scores, matchedSignals, "Directory", 5, "directory nav links");
//   }

//   if (/our services?|book now|online|schedule|appointment|get a quote|free estimate|service areas?|report a crime|most wanted|cases|investigations|victim assistance|file a report|banking|insurance|retirement|mortgage|wealth/i.test(t)) {
//     addScore(scores, matchedSignals, "Service", 5, "service nav links");
//   }

//   if (/about us|our story|team|history|visit us|hours|find us|gallery|testimonials|contact us|locations?/i.test(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business nav links");
//   }

//   if (hasSmallBusinessNiche(t)) {
//     addScore(scores, matchedSignals, "Small business", 3, "small business niche in nav");
//   }

//   return scores;
// }

// function scoreStructuredSignals(signals, matchedSignals, context) {
//   const scores = createScores();

//   const url = String(context.url || "").toLowerCase();
//   const body = String(context.bodyText || "").toLowerCase();
//   const domain = String(context.domain || "").toLowerCase();

//   const isEditorial = isEditorialUrl(url) || isEditorialPath(getPathname(url));
//   const knownRetail = domainIntel.isKnownRetailDomain(domain);
//   const isInstitutional = domainIntel.isInstitutionalDomain(domain);
//   const isLargeFI = domainIntel.isLargeFinancialInstitutionDomain(domain);

//   const hasHardCommerceInBody =
//     /add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|best sellers|place order|your cart/i.test(body);

//   const hasProductSchema = !!signals.hasProductSchema;
//   const strongRetailPath = isStrongRetailProductPath(url, domain);
//   const hasHardCommerce =
//     !!signals.hasCart || hasProductSchema || hasHardCommerceInBody || isCommerceUrl(url) || knownRetail || strongRetailPath;

//   if (signals.hasCart) {
//     if (isEditorial) {
//       addScore(scores, matchedSignals, "E-commerce", 1, "cart on editorial page");
//     } else if (hasHardCommerceInBody || knownRetail || isCommerceUrl(url) || strongRetailPath) {
//       addScore(scores, matchedSignals, "E-commerce", 16, "cart confirmed as storefront");
//     } else {
//       addScore(scores, matchedSignals, "E-commerce", 6, "cart detected");
//     }
//   }

//   if (knownRetail) {
//     addScore(scores, matchedSignals, "E-commerce", 12, "known retail domain");
//     subtractScore(scores, matchedSignals, "Small business", 6, "known retail domain suppresses small business");
//   }

//   if (signals.hasSearchAndFilter && (isCommerceUrl(url) || knownRetail) && !isEditorial && !isInstitutional) {
//     addScore(scores, matchedSignals, "E-commerce", 6, "product search/filter");
//   }

//   if (signals.hasPhone) {
//     if (!knownRetail && !isInstitutional && !hasHardCommerce) {
//       addScore(scores, matchedSignals, "Small business", 2, "phone number detected");
//     }
//   }

//   if (signals.hasAddress) {
//     addScore(scores, matchedSignals, "Directory", 1, "address detected");
//     if (!knownRetail && !isInstitutional && !hasHardCommerce) {
//       addScore(scores, matchedSignals, "Small business", 2, "physical address detected");
//     }
//   }

//   if (signals.hasMap) {
//     addScore(scores, matchedSignals, "Directory", 1, "map embed detected");
//     if (!knownRetail && !isInstitutional && !hasHardCommerce) {
//       addScore(scores, matchedSignals, "Small business", 1, "map embed detected");
//     }
//   }

//   if (signals.hasAddress && signals.hasPhone) {
//     addScore(scores, matchedSignals, "Directory", 1, "NAP pair");
//     if (!knownRetail && !isInstitutional && !hasHardCommerce) {
//       addScore(scores, matchedSignals, "Small business", 2, "NAP pair supports local business");
//     }
//   }

//   if (signals.hasReviews) {
//     if (!hasHardCommerceInBody && !signals.hasCart && !knownRetail && !isLargeFI && !signals.hasPhone && !signals.hasAddress) {
//       addScore(scores, matchedSignals, "Directory", 4, "reviews in non-commerce context");
//     } else if (!knownRetail && !hasHardCommerce && signals.hasPhone && signals.hasAddress) {
//       addScore(scores, matchedSignals, "Small business", 1, "reviews on single business page");
//     } else {
//       addScore(scores, matchedSignals, "E-commerce", 3, "reviews in commerce context");
//     }
//   }

//   if (signals.hasCart || hasProductSchema || strongRetailPath || knownRetail) {
//     subtractScore(scores, matchedSignals, "Directory", 8, "suppress directory on strong commerce");
//     subtractScore(scores, matchedSignals, "Small business", 10, "suppress small business on strong commerce");
//     addScore(scores, matchedSignals, "E-commerce", 10, "strong retail product override");
//   }

//   if (isInstitutional && !hasHardCommerce) {
//     subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"] || 0, "institutional without storefront");
//     subtractScore(scores, matchedSignals, "Small business", Math.min(8, scores["Small business"] || 0), "institutional page is not small business");
//     addScore(scores, matchedSignals, "Service", 5, "institutional service bias");
//   }

//   if (isLargeFI && !hasHardCommerce) {
//     subtractScore(scores, matchedSignals, "Directory", Math.min(8, scores["Directory"] || 0), "large financial institution is not directory");
//     addScore(scores, matchedSignals, "Service", 6, "large financial institution");
//   }

//   return scores;
// }

// function applyInteractionRules(scores, matchedSignals, context) {
//   const t = String(context.bodyText || "").toLowerCase();
//   const nav = String(context.linksText || "").toLowerCase();
//   const url = String(context.url || "").toLowerCase();
//   const title = String(context.title || "").toLowerCase();
//   const metaDescription = String(context.metaDescription || "").toLowerCase();
//   const signals = context.signals || {};
//   const domain = String(context.domain || "").toLowerCase();

//   const isEditorial = isEditorialUrl(url) || isEditorialPath(getPathname(url));
//   const isInstitutional = domainIntel.isInstitutionalDomain(domain);
//   const isLargeFI = domainIntel.isLargeFinancialInstitutionDomain(domain);
//   const knownRetail = domainIntel.isKnownRetailDomain(domain);
//   const strongRetailPath = isStrongRetailProductPath(url, domain);

//   const blogScore = scores["Blog"] || 0;
//   const newsScore = scores["Newspaper"] || 0;
//   const ecomScore = scores["E-commerce"] || 0;
//   const saasScore = scores["Saas"] || 0;
//   const sbScore = scores["Small business"] || 0;
//   const serviceScore = scores["Service"] || 0;
//   const dirScore = scores["Directory"] || 0;

//   if (blogScore > 0 && newsScore > 0 && Math.abs(blogScore - newsScore) <= 6) {
//     if (/reuters|ap news|associated press|bloomberg|afp/i.test(t)) {
//       addScore(scores, matchedSignals, "Newspaper", 8, "wire service attribution");
//     } else if (/i tested|tried|used|bought|reviewed|my review|experience|take|opinion|in my opinion/i.test(t)) {
//       addScore(scores, matchedSignals, "Blog", 8, "first-person narrative");
//     } else if (/staff reporter|writer|correspondent|managing editor|newsroom/i.test(t)) {
//       addScore(scores, matchedSignals, "Newspaper", 6, "staff editorial titles");
//     } else if (/subscribe to my|this blog|newsletter|join .* readers/i.test(t)) {
//       addScore(scores, matchedSignals, "Blog", 6, "personal subscriber CTA");
//     } else if (/world|politics|science|health|entertainment|breaking/i.test(nav)) {
//       addScore(scores, matchedSignals, "Newspaper", 5, "news section nav");
//     }
//   }

//   if (isEditorial && blogScore + newsScore >= 8 && ecomScore > 0) {
//     subtractScore(scores, matchedSignals, "E-commerce", Math.min(ecomScore, 8), "editorial suppresses E-commerce");
//   }

//   if (saasScore >= 10 && ecomScore > 0) {
//     subtractScore(scores, matchedSignals, "E-commerce", Math.min(ecomScore, 8), "SaaS suppresses E-commerce");
//   }

//   if (sbScore > 0 || serviceScore > 0) {
//     const hasServiceWorkflow =
//       /schedule an? appointment|consultation|call service|book an? appointment|service session|request a quote|get a free estimate|emergency service|repair call|report a crime|submit a tip|victim assistance|public safety|investigation|banking|insurance|mortgage|retirement/i.test(t);

//     const hasLocalRetailIdentity =
//       /family.?owned|locally owned|our little|our store|come visit|visit us|stop in|neighborhood|our office|our clinic|call us/i.test(
//         `${title} ${metaDescription} ${t} ${nav}`
//       ) || hasSmallBusinessNiche(`${title} ${metaDescription} ${t} ${nav}`);

//     if (hasServiceWorkflow && !hasLocalRetailIdentity && !knownRetail) {
//       addScore(scores, matchedSignals, "Service", 5, "service workflow language");
//       subtractScore(scores, matchedSignals, "Small business", Math.min(sbScore, 4), "service workflow dampens small business");
//     } else if (hasLocalRetailIdentity && !isInstitutional && !knownRetail && !strongRetailPath) {
//       addScore(scores, matchedSignals, "Small business", 5, "local identity language");
//       subtractScore(scores, matchedSignals, "Service", Math.min(serviceScore, 3), "local business dampens service");
//     }
//   }

//   if (dirScore > 0 && serviceScore > 0) {
//     const isMultiListingPage =
//       /browse all|view all listings|compare .* providers|find .* near|search results|showing results|businesses|jobs|flights|hotels/i.test(t);

//     if (!isMultiListingPage && signals.hasAddress && signals.hasPhone) {
//       subtractScore(scores, matchedSignals, "Directory", Math.min(dirScore, 5), "single-business page");
//       addScore(scores, matchedSignals, "Service", 3, "single-business page");
//     }
//   }

//   if (scores["Directory"] > 0 && scores["E-commerce"] > 0) {
//     const isMultiListingPage =
//       /browse all|view all listings|compare .* providers|find .* near|search results|showing results|businesses|top .* near|jobs|flights|hotels/i.test(t);
//     const hasCartOrProduct = !!signals.hasCart || !!signals.hasProductSchema || isCommerceUrl(url);

//     if (isMultiListingPage && !hasCartOrProduct) {
//       addScore(scores, matchedSignals, "Directory", 4, "multi-listing page");
//     } else if (hasCartOrProduct) {
//       addScore(scores, matchedSignals, "E-commerce", 4, "storefront/cart evidence");
//     }
//   }

//   if (scores["Blog"] > 0 && scores["Service"] > 0) {
//     const isPureHowToOrGuide =
//       /guide|how to|tutorial|explained|in-depth|step by step|recipe/i.test(t) &&
//       !/book now|online schedule|appointment|request a quote|get a free estimate/i.test(t);

//     if (isPureHowToOrGuide) {
//       addScore(scores, matchedSignals, "Blog", 4, "pure guide/how-to");
//     }
//   }

//   if (isInstitutional) {
//     const hasHardStorefront =
//       !!signals.hasCart || !!signals.hasProductSchema || /add to cart|buy now|checkout|shop now|official store|free shipping/i.test(nav);

//     if (!hasHardStorefront && (scores["E-commerce"] || 0) > 0) {
//       subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"], "institutional without storefront evidence");
//     }

//     if (/report a crime|submit a tip|victim assistance|investigate|federal bureau|department of|office of|public safety|law enforcement|human trafficking/i.test(`${t} ${nav} ${url}`)) {
//       addScore(scores, matchedSignals, "Service", 6, "institutional/public safety");
//     }

//     if ((scores["Small business"] || 0) > 0) {
//       subtractScore(scores, matchedSignals, "Small business", Math.min(8, scores["Small business"]), "institutional page is not small business");
//     }
//   }

//   if (isLargeFI) {
//     if (isEditorial) {
//       addScore(scores, matchedSignals, "Service", 6, "financial editorial section");
//       addScore(scores, matchedSignals, "Blog", 4, "institutional editorial");
//       addScore(scores, matchedSignals, "Newspaper", 3, "finance article style");
//     }

//     subtractScore(scores, matchedSignals, "Directory", Math.min(8, scores["Directory"] || 0), "financial institution is not a directory");

//     if (!signals.hasCart && !signals.hasProductSchema && !isCommerceUrl(url)) {
//       subtractScore(scores, matchedSignals, "E-commerce", Math.min(8, scores["E-commerce"] || 0), "finance page without storefront");
//     }
//   }

//   if (domain === "polymarket.com" || domain.endsWith(".polymarket.com")) {
//     addScore(scores, matchedSignals, "Saas", 8, "prediction market platform");
//     subtractScore(scores, matchedSignals, "Newspaper", Math.min(8, scores["Newspaper"] || 0), "platform event page is not newspaper");
//   }

//   if (
//     isStrongBrandedLocalBusiness(
//       url,
//       domain,
//       context.title,
//       context.metaDescription,
//       context.bodyText,
//       context.linksText,
//       signals
//     ) &&
//     !comparisonDomains.has(domain) &&
//     !knownRetail &&
//     !strongRetailPath
//   ) {
//     if (!hasStrongNonSmallBusiness(scores, 10)) {
//       addScore(scores, matchedSignals, "Small business", 6, "branded local business preference");
//       subtractScore(scores, matchedSignals, "Directory", 4, "local business dampens Directory");
//       subtractScore(scores, matchedSignals, "Saas", 4, "local business dampens SaaS");
//     }
//   }
// }
// function applyFinalDomainOverrides(siteType, confidence, url, domain, matchedSignals, scores, context = {}) {
//   let finalType = siteType;
//   let finalConfidence = confidence;
//   const pathname = getPathname(url);
//   const prior = domainIntel.getDomainPrior(domain);

//   finalType = applyPathOverrides(url, finalType, matchedSignals);

//   const mediaDomains = new Set([
//     "theguardian.com",
//     "reuters.com",
//     "apnews.com",
//     "techcrunch.com",
//     "theverge.com",
//     "wired.com",
//     "cnbc.com",
//     "marketwatch.com",
//     "businessinsider.com",
//     "ft.com",
//     "economist.com",
//     "techradar.com",
//     "cnet.com",
//     "engadget.com",
//     "arstechnica.com",
//     "zdnet.com",
//     "thetimes.com",
//     "timeout.com",
//     "travelandleisure.com",
//     "morningstar.com",
//     "consumerreports.org",
//     "time.com",
//     "pcmag.com",
//     "tomsguide.com",
//     "digitaltrends.com",
//     "androidauthority.com",
//     "fortune.com",
//     "inc.com",
//     "theatlantic.com",
//     "usatoday.com",
//     "politico.com",
//     "thehill.com",
//     "entrepreneur.com",
//     "investopedia.com",
//   ]);

//   if (mediaDomains.has(domain)) {
//     if (
//       finalType === "Small business" ||
//       finalType === "Saas" ||
//       finalType === "E-commerce" ||
//       finalType === "Directory" ||
//       finalType === "Blog"
//     ) {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "pure media domain resolves to Newspaper",
//         points: 0,
//       });
//       finalType = "Newspaper";
//       finalConfidence = "High";
//     }
//   }

//   const saasCoreDomains = new Set([
//     "hubspot.com",
//     "zendesk.com",
//     "stripe.com",
//     "twilio.com",
//     "datadog.com",
//     "asana.com",
//     "airtable.com",
//     "intercom.com",
//     "mailchimp.com",
//     "cloudflare.com",
//     "supabase.com",
//     "n8n.io",
//     "shopify.com",
//     "wix.com",
//     "squarespace.com",
//     "dropbox.com",
//   ]);

//   const isSaasProductPath =
//     /\/product|\/products|\/pricing|\/plans|\/platform|\/features|\/database|\/automation|\/email-marketing|\/workers|\/upgrade|\/payments|\/communications|\/customer-service|\/customer-messaging/i.test(
//       pathname
//     );

//   if (saasCoreDomains.has(domain) && isSaasProductPath) {
//     if (finalType !== "Saas") {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "core SaaS domain on product/pricing path → SaaS",
//         points: 0,
//       });
//       finalType = "Saas";
//       finalConfidence = "High";
//     }
//   }

//   if (domainIntel.isKnownRetailDomain(domain) && isStrongRetailProductPath(url, domain)) {
//     if (finalType !== "E-commerce") {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "known retail + strong product path → E-commerce",
//         points: 0,
//       });
//       finalType = "E-commerce";
//       finalConfidence = "High";
//     }
//   }

//   if (
//     domainIntel.isInstitutionalDomain(domain) ||
//     /mayoclinic\.org|khanacademy\.org|coursera\.org|edx\.org|nyse\.com|investopedia\.com|irs\.gov|uscis\.gov|cdc\.gov/.test(domain)
//   ) {
//     if (finalType === "Small business" || (domain === "coursera.org" && finalType === "Blog")) {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "institutional/edu/authority domain cannot be Small business/Blog here",
//         points: 0,
//       });
//       finalType = "Service";
//       finalConfidence = "High";
//     }
//   }

//   if (domain === "nyse.com") {
//     finalType = "Service";
//     finalConfidence = "High";
//   }

//   if (domain === "irs.gov" && /\/filing\//i.test(pathname)) {
//     finalType = "Service";
//     finalConfidence = "High";
//   }

//   const directoryCoreDomains = new Set([
//     "healthgrades.com",
//     "zocdoc.com",
//     "glassdoor.com",
//     "indeed.com",
//     "homeadvisor.com",
//     "vitals.com",
//     "findlaw.com",
//   ]);

//   if (directoryCoreDomains.has(domain)) {
//     if (finalType !== "Directory") {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "core directory domain → Directory",
//         points: 0,
//       });
//       finalType = "Directory";
//       finalConfidence = "High";
//     }
//   }

//   const pureBlogDomains = new Set([
//     "neilpatel.com",
//     "backlinko.com",
//     "copyblogger.com",
//     "medium.com",
//     "dev.to",
//     "smashingmagazine.com",
//     "markmanson.net",
//     "waitbutwhy.com",
//     "paulgraham.com",
//     "simonwillison.net",
//     "jvns.ca",
//     "overreacted.io",
//     "rachelandrew.co.uk",
//     "healthyblog.com",
//     "mybookreviews.net",
//     "substack.com",
//   ]);

//   if (pureBlogDomains.has(domain)) {
//     if (finalType === "Small business" || finalType === "Service" || finalType === "E-commerce" || finalType === "Newspaper") {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "pure blog/essay domain → Blog",
//         points: 0,
//       });
//       finalType = "Blog";
//       finalConfidence = "High";
//     }
//   }

//   if (
//     comparisonDomains.has(domain) &&
//     (finalType === "Small business" || finalType === "Service")
//   ) {
//     const dirScore = scores["Directory"] || 0;
//     const sbScore = scores["Small business"] || 0;
//     const svcScore = scores["Service"] || 0;
//     if (dirScore >= sbScore && dirScore >= svcScore) {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "comparison domain resolves to Directory",
//         points: 0,
//       });
//       finalType = "Directory";
//       finalConfidence = "High";
//     }
//   }

//   if (
//     isStrongBrandedLocalBusiness(
//       url,
//       domain,
//       context.title,
//       context.metaDescription,
//       context.bodyText,
//       context.linksText,
//       context.signals || {}
//     ) &&
//     !comparisonDomains.has(domain)
//   ) {
//     if (!hasStrongNonSmallBusiness(scores, 8)) {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: "branded local-business domain/path → Small business (no strong alternative)",
//         points: 0,
//       });
//       finalType = "Small business";
//       finalConfidence = "High";
//     }
//   }

//   if (prior && SITETYPES.includes(prior)) {
//     const currentScore = scores[finalType] || 0;
//     const priorScore = scores[prior] || 0;
//     const strongDisagreement = finalType !== prior && currentScore >= priorScore + 10 && currentScore >= 22;

//     if (!strongDisagreement) {
//       matchedSignals.push({
//         type: "Post-process",
//         reason: `domain prior wins → ${prior}`,
//         points: 0,
//       });
//       finalType = prior;
//       finalConfidence = "High";
//     }
//   }

//   return { siteType: finalType, confidence: finalConfidence };
// }

// function adjustContentTypeAfterScoring(contentType, siteType, url, schemaTypes, bodyText) {
//   const pathName = getPathname(url);
//   const editorialPath = isEditorialPath(pathName);
//   const hasBlogPosting = !!schemaTypes.isBlogPosting;
//   const hasNewsArticle = !!schemaTypes.isNewsArticle;
//   const isListicle = /best|top|ideas|tips|guide|how to|wall decor|decorating ideas|recipe/i.test(
//     String(bodyText || "").toLowerCase()
//   );

//   if (editorialPath && hasBlogPosting && isListicle) return "Blog";
//   if (editorialPath && hasNewsArticle) return "Newspaper";
//   if (hasNewsArticle && siteType === "Newspaper") return "Newspaper";

//   return contentType;
// }

// function inferTypeFromSignals(
//   url,
//   title,
//   metaDescription,
//   bodyText,
//   linksText,
//   schemaText,
//   signals,
//   siteTypeHint = null
// ) {
//   const matchedSignals = [];
//   const scores = createScores();

//   const domain = getHostname(url);

//   if (isBotBlocked(title, bodyText)) {
//     matchedSignals.push({
//       type: "Warning",
//       reason: "bot-blocked page, body/meta scoring skipped",
//       points: 0,
//     });

//     mergeScores(scores, scoreUrlPath(url, matchedSignals), 1.4);
//     mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.1);
//     mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain), 0.8);

//     const prior = domainIntel.getDomainPrior(domain);
//     if (prior && SITETYPES.includes(prior)) {
//       addScore(scores, matchedSignals, prior, 16, "domain prior bot-blocked fallback");
//     } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
//       addScore(scores, matchedSignals, siteTypeHint, 3, "site type hint bot-blocked fallback");
//     }

//     if (domainIntel.isInstitutionalDomain(domain)) {
//       subtractScore(scores, matchedSignals, "E-commerce", scores["E-commerce"] || 0, "institutional blocked domain without storefront");
//       addScore(scores, matchedSignals, "Service", 4, "institutional domain fallback");
//     }

//     const topBot = getTopScore(scores);
//     const finalBot = applyFinalDomainOverrides(
//       topBot.siteType,
//       domainIntel.getDomainPrior(domain) ? "Medium" : "Low",
//       url,
//       domain,
//       matchedSignals,
//       scores,
//       { title, metaDescription, bodyText, linksText, signals }
//     );

//     return {
//   siteType: finalBot.siteType,
//   confidence: finalBot.confidence,
//   classifierVersion: CLASSIFIER_VERSION,
//   matchedSignals,
//   scores,
//   topScore: topBot.topScore,
//   secondScore: topBot.secondScore,
//   schemaTypes: extractSchemaTypes(schemaText),
// };
//   }

//   const schemaTypes = extractSchemaTypes(schemaText);
//   const editorialUrl = isEditorialUrl(url);
//   const commerceUrl = isCommerceUrl(url);
//   const institutional = domainIntel.isInstitutionalDomain(domain);

//   mergeScores(
//     scores,
//     scoreSchema(schemaTypes, matchedSignals, {
//       isEditorial: editorialUrl,
//       isCommerce: commerceUrl,
//       isInstitutional: institutional,
//       domain,
//     }),
//     1.5
//   );

//   mergeScores(scores, scoreTitle(title, matchedSignals, url), 1.4);
//   mergeScores(scores, scoreMetaDescription(metaDescription, matchedSignals, url, domain), 1.2);
//   mergeScores(scores, scoreBodyText(bodyText, matchedSignals, url, domain), 1.0);
//   mergeScores(scores, scoreLinksText(linksText, matchedSignals, domain), 1.0);
//   mergeScores(scores, scoreUrlPath(url, matchedSignals), 0.9);
//   mergeScores(
//     scores,
//     scoreStructuredSignals(signals || {}, matchedSignals, {
//       url,
//       bodyText,
//       linksText,
//       domain,
//     }),
//     1.1
//   );

//   const prior = domainIntel.getDomainPrior(domain);
//   if (prior && SITETYPES.includes(prior)) {
//     addScore(scores, matchedSignals, prior, 12, "domain prior tiebreaker");
//   } else if (siteTypeHint && SITETYPES.includes(siteTypeHint)) {
//     addScore(scores, matchedSignals, siteTypeHint, institutional ? 1 : 3, "site type hint from domain analysis");
//   }

//   applyInteractionRules(scores, matchedSignals, {
//     url,
//     title,
//     metaDescription,
//     bodyText,
//     linksText,
//     signals: signals || {},
//     domain,
//   });

//   const strongEditorialPage = hasStrongEditorialPageSignals(
//     url,
//     title,
//     metaDescription,
//     bodyText,
//     schemaTypes
//   );

//   if (strongEditorialPage) {
//     if (scores["E-commerce"] >= 8 && !signals.hasCart && !signals.hasProductSchema && !commerceUrl) {
//       subtractScore(scores, matchedSignals, "E-commerce", Math.min(10, scores["E-commerce"]), "editorial page without storefront");
//     }

//     if (
//       scores["Directory"] >= 8 &&
//       !/directory|listing|listings|companies|businesses|vendors|near-me|providers?|places|jobs|flights|hotels|homes/.test(url)
//     ) {
//       subtractScore(scores, matchedSignals, "Directory", Math.min(10, scores["Directory"]), "editorial page without listing structure");
//     }

//     if (domainIntel.isLargeFinancialInstitutionDomain(domain)) {
//       addScore(scores, matchedSignals, "Service", 6, "large financial institution domain");
//       addScore(scores, matchedSignals, "Blog", 4, "institutional editorial content");
//       addScore(scores, matchedSignals, "Newspaper", 3, "research/article content on finance site");
//       subtractScore(scores, matchedSignals, "Directory", Math.min(8, scores["Directory"]), "financial institution is not a directory");
//     }
//   }

//   let top = getTopScore(scores);

//   const finalOverride = applyFinalDomainOverrides(
//     top.siteType,
//     top.confidence,
//     url,
//     domain,
//     matchedSignals,
//     scores,
//     { title, metaDescription, bodyText, linksText, signals }
//   );

//   return {
//     siteType: finalOverride.siteType,
//     confidence: finalOverride.confidence,
//     matchedSignals,
//     scores,
//     topScore: top.topScore,
//     secondScore: top.secondScore,
//     schemaTypes,
//   };
// }

// function classifyContentType(url, pageSignals = {}, siteTypeHint = null) {
//   const pageResult = inferTypeFromSignals(
//     url,
//     pageSignals.title || "",
//     pageSignals.metaDescription || "",
//     pageSignals.bodyText || "",
//     pageSignals.linksText || "",
//     pageSignals.schemaText || "",
//     {
//       hasCart: !!pageSignals.hasCart,
//       hasSearchAndFilter: !!pageSignals.hasSearchAndFilter,
//       hasPhone: !!pageSignals.hasPhone,
//       hasAddress: !!pageSignals.hasAddress,
//       hasMap: !!pageSignals.hasMap,
//       hasReviews: !!pageSignals.hasReviews,
//       hasBusinessListingSchema: !!pageSignals.hasBusinessListingSchema,
//       hasProductSchema: !!pageSignals.hasProductSchema,
//       hasArticleSchema: !!pageSignals.hasArticleSchema,
//     },
//     siteTypeHint
//   );

//   const rawContentType = pageResult.siteType;
//   return adjustContentTypeAfterScoring(
//     rawContentType,
//     siteTypeHint || pageResult.siteType,
//     url,
//     pageResult.schemaTypes || {},
//     pageSignals.bodyText || ""
//   );
// }

// function scoreSignals(aggregateText, linksText, signals, homepageUrl) {
//   const result = inferTypeFromSignals(
//     homepageUrl,
//     "",
//     "",
//     aggregateText,
//     linksText,
//     "",
//     signals
//   );

//   return {
//     siteType: result.siteType,
//     confidence: result.confidence,
//     matchedSignals: result.matchedSignals,
//     scores: result.scores,
//   };
// }

// module.exports = {
//   SITETYPES,
//   normalizeType,
//   classifyContentType,
//   scoreSignals,
//   inferTypeFromSignals,
//   getDomainPrior,
// };