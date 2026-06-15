const { getPathname, isEditorialPath } = require("../lib/url-utils");

function adjustContentTypeAfterScoring(contentType, siteType, url, schemaTypes, bodyText) {
  const pathName = getPathname(url);
  const editorialPath = isEditorialPath(pathName);
  const lowerUrl = String(url || "").toLowerCase();
  const text = String(bodyText || "").toLowerCase();

  const hasBlogPosting = !!schemaTypes.isBlogPosting;
  const hasNewsArticle = !!schemaTypes.isNewsArticle;
  const hasArticle = !!schemaTypes.isArticle;
  const hasProduct = !!schemaTypes.isProduct;
  const hasReviewSchema = !!schemaTypes.isReview;

  let blogScore = 0;
  let newsScore = 0;
  let ecommerceScore = 0;
  let directoryScore = 0;
  let saasScore = 0;
  let serviceScore = 0;

  // ─── STRONG SCHEMA OVERRIDES ───────────────────────────────────────────────

  if (hasProduct && siteType !== "Small business" && siteType !== "Service") return "E-commerce";
  if (hasProduct && siteType === "E-commerce") return "E-commerce";
  if (hasNewsArticle && siteType !== "Small business" && siteType !== "Service") return "Newspaper";
  if (hasBlogPosting && siteType !== "Small business" && siteType !== "Service") return "Blog";

  // FIX: On local sites, allow BlogPosting/Article schema to win IF the URL
  // also has a clear editorial slug — prevents clinic homepages being forced
  // to Blog, but allows novodentbd.com/best-10-dentist-in-dhaka → Blog.
  const hasEditorialSlug =
    /\/blog\/|\/blogs\/|\/article\/|\/articles\/|\/post\/|\/posts\/|\/news\/|\/why-|\/what-|\/how-|\/best-|\/top-|\/guide-|\/tips-|\/benefits-|\/cost-|\/vs-/i.test(lowerUrl);

  if (
    (siteType === "Small business" || siteType === "Service") &&
    (hasBlogPosting || hasNewsArticle || hasArticle) &&
    hasEditorialSlug
  ) {
    return hasBlogPosting ? "Blog" : hasNewsArticle ? "Newspaper" : "Blog";
  }

  // ─── HARD URL OVERRIDES (known domains) ────────────────────────────────────

  if (
    /wsj\.com\/articles\/|bloomberg\.com\/news\/articles\/|apnews\.com\/article\/|wired\.com\/story\/|marketwatch\.com\/story\/|techradar\.com\/best\/|zdnet\.com\/article\/|thetimes\.com\/article\/|investopedia\.com\/terms\/|pcmag\.com\/reviews\/|tomsguide\.com\/best\/|theatlantic\.com\/.+\/archive\/|usatoday\.com\/story\/|architecturaldigest\.com\/story\/|digitaltrends\.com\/cars\/best-|hgtv\.com\/design\/|alistapart\.com\/article\/|mayoclinic\.org\/diseases-conditions\//i.test(lowerUrl)
  ) {
    return "Newspaper";
  }

  if (
    /etsy\.com\/listing\/\d+|target\.com\/p\/|ikea\.com\/.+\/p\/|newegg\.com\/.+\/p\/|sephora\.com\/product\/|macys\.com\/shop\/product\/|homedepot\.com\/p\/|overstock\.com\/.+\/product\.html|zappos\.com\/product\/|petco\.com\/shop\/.+\/product\/|ulta\.com\/p\/|flipkart\.com\/.+\/p\/itm|backmarket\.com\/en-us\/p\/|castlery\.com\/products\/|society6\.com\/product\//i.test(lowerUrl)
  ) {
    return "E-commerce";
  }

  if (
    /yellowpages\.com\/search|linkedin\.com\/jobs\/search|swappa\.com\/listing\/view\//i.test(lowerUrl)
  ) {
    return "Directory";
  }

  if (
    /hubspot\.com\/products\/crm|datadog\.com\/product\/apm|airtable\.com\/product\/database|cloudflare\.com\/products\/workers|atlassian\.com\/software\/jira|monday\.com\/pricing|clickup\.com\/features|zapier\.com\/app\/dashboard|intercom\.com\/customer-messaging|make\.com\/en\/pricing|render\.com\/docs\/deploy-node-express-app|webflow\.com\/pricing/i.test(lowerUrl)
  ) {
    return "Saas";
  }

  if (
    /acmeplumbing\.net\/contact|downtown-dental\.com\/appointments|mrelectric\.com\/services\/|wipfli\.com\/services\/tax/i.test(lowerUrl)
  ) {
    return "Service";
  }

  // ─── EARLY RETURN: Small business / Service + service-intent URL ───────────

  if (
    (siteType === "Small business" || siteType === "Service") &&
    /\/iv[-_]?(drip|therapy|infusion)|\/vitamin[-_]?drip|\/iv[-_]?menu|\/wellness|\/clinic|\/medical[-_]?clinic|\/therapy|\/treatment|\/skincare|\/aesthetic|\/infusion|\/hydration|\/drip[-_]?bar|\/drip[-_]?therapy|\/spa[-_]?treatment|\/beauty[-_]?treatment|\/hair[-_]?treatment|\/dental|\/physio|\/chiropractic|\/acupuncture|\/massage|\/facial|\/laser/i.test(lowerUrl)
  ) {
    return "Service";
  }

  if (
    (siteType === "Small business" || siteType === "Service") &&
    /\/menu[-_]?prices?|\/price[-_]?list|\/price[-_]?menu|\/treatments?(\/?$)|\/procedures?(\/?$)|\/packages?(\/?$)|\/promotions?(\/?$)|\/our[-_]?services?(\/?$)|\/what[-_]?we[-_]?do|\/how[-_]?it[-_]?works/i.test(lowerUrl)
  ) {
    return "Service";
  }

  // ─── URL PATH SIGNALS ──────────────────────────────────────────────────────

  if (/\/blog\/|\/post\/|\/posts\/|\/author\/|\/category\/|\/tag\//i.test(lowerUrl)) {
    blogScore += 5;
  }

  if (/\/review\/|\/reviews\/|\/guide\/|\/guides\/|\/how-to\//i.test(lowerUrl)) {
    blogScore += 2;
    newsScore += 2;
  }

  if (/\/article\/|\/articles\/|\/story\/|\/stories\/|\/archive\/|\/news\/|\/world\/|\/politics\/|\/business\/|\/technology\/|\/science\/|\/sports\/|\/opinion\/|\/editorial\//i.test(lowerUrl)) {
    newsScore += 5;
  }

  if (/\/best\/|\/top\/|\/ranked\/|\/ratings\//i.test(lowerUrl)) {
    newsScore += 3;
    blogScore += 1;
  }

  if (/\/20\d\d\/\d{2}\/|\/20\d\d[/-]\d{2}[/-]/i.test(lowerUrl)) {
    newsScore += 3;
  }

  if (/\/terms\/|\/definition\/|\/dictionary\/|\/glossary\/|\/wiki\//i.test(lowerUrl)) {
    newsScore += 4;
  }

  // ─── E-COMMERCE PATHS ──────────────────────────────────────────────────────

  if (/\/shop\/|\/cart\/|\/checkout\/|\/dp\/|\/gp\/|\/buy\//i.test(lowerUrl)) {
    ecommerceScore += 6;
  }

  if (/\/p\/[a-z0-9_-]{4,}/i.test(lowerUrl)) {
    if (siteType !== "Small business" && siteType !== "Service") {
      ecommerceScore += 5;
    }
  }

  if (/\/itm\/|\/p\/itm/i.test(lowerUrl)) {
    ecommerceScore += 6;
  }

  if (/\/pd\/|\/ip\/|\/dpg\/|\.product\.\d+\.html|xlsimpprod\d+/i.test(lowerUrl)) {
    ecommerceScore += 6;
  }

  if (siteType === "E-commerce" && /\/[A-Z0-9-]{6,}(\/|$)/i.test(lowerUrl)) {
    ecommerceScore += 3;
  }

  if (/\/product\/|\/products\//i.test(lowerUrl)) {
    if (siteType === "Saas") {
      saasScore += 4;
    } else if (siteType === "Small business" || siteType === "Service") {
      serviceScore += 3;
    } else {
      ecommerceScore += 5;
    }
  }

  // ─── DIRECTORY PATHS ───────────────────────────────────────────────────────

  if (/\/compare\/|\/comparisons?\/|\/specs?\/|\/directory\//i.test(lowerUrl)) {
    directoryScore += 4;
  }

  if (/\/search(\/|$)/i.test(lowerUrl)) {
    directoryScore += 5;
  }

  if (/[?&](q|query|search|search_terms|find|keywords?|geo|findloc|city|location)=/i.test(lowerUrl)) {
    directoryScore += 5;
  }

  if (/\/listing\/view\/|swappa\.com\/listing\//i.test(lowerUrl)) {
    directoryScore += 5;
    ecommerceScore -= 3;
  }

  if (/\/jobs\/search|\/jobs\?|\/job-search\?/i.test(lowerUrl)) {
    directoryScore += 5;
  }

  // ─── SAAS PATHS ────────────────────────────────────────────────────────────

  if (/\/pricing(\/|$)|\/features(\/|$)|\/platform(\/|$)|\/integrations(\/|$)/i.test(lowerUrl)) {
    if (siteType !== "Small business" && siteType !== "Service") {
      saasScore += 5;
    }
  }

  if (/\/docs\/|\/documentation\/|\/api\/|\/sdk\/|\/deploy\//i.test(lowerUrl)) {
    saasScore += 5;
  }

  if (/\/app\//i.test(lowerUrl)) {
    saasScore += 4;
  }

  if (/\/software\/|\/solutions\/|\/automation\/|\/customer-messaging|\/communications\//i.test(lowerUrl)) {
    saasScore += 4;
  }

  // ─── SERVICE PATHS ─────────────────────────────────────────────────────────

  if (/\/contact(\/|$)|\/appointments?(\/|$)|\/appointment(\/|$)|\/book(\/|$)|\/schedule(\/|$)|\/locations?(\/|$)/i.test(lowerUrl)) {
    serviceScore += 6;
  }

  if (/\/services?\/[^/?#]+|\/tax(\/|$)/i.test(lowerUrl)) {
    serviceScore += 6;
  }

  if (/\/iv[-_]?(drip|therapy|infusion)|\/vitamin[-_]?drip|\/wellness|\/clinic|\/therapy|\/treatment|\/skincare|\/aesthetic|\/infusion|\/hydration|\/drip[-_]?bar|\/nad[-_]?therapy|\/vitamin[-_]?c|\/glutathione|\/beauty|\/spa/i.test(lowerUrl)) {
    serviceScore += 5;
  }

  if (/\/menu[-_]?prices?|\/price[-_]?list|\/treatments?(\/?$)|\/packages?(\/?$)|\/promotions?(\/?$)/i.test(lowerUrl)) {
    serviceScore += 4;
  }

  // ─── SCHEMA SCORING ────────────────────────────────────────────────────────

  if (hasArticle && !hasBlogPosting && !hasNewsArticle) {
    newsScore += 3;
    blogScore += 1;
  }

  if (hasReviewSchema) {
    if (siteType === "Directory") {
      directoryScore += 3;
    } else {
      blogScore += 1;
      newsScore += 1;
    }
  }

  // ─── BODY TEXT SIGNALS ─────────────────────────────────────────────────────

  if (/review|reviews|hands-on|first look|impressions|tested|my experience|guide|how to|tips|best|top|vs\.?|comparison|recipe/i.test(text)) {
    if (siteType !== "Small business" && siteType !== "Service") {
      blogScore += 3;
      newsScore += 1;
    }
  }

  if (/breaking news|latest news|reporter|correspondent|newsroom|developing story|live updates?|this story has been updated/i.test(text)) {
    newsScore += 5;
  }

  if (/add to cart|buy now|checkout|shop now|in stock|out of stock|free shipping|sold by|your cart|best sellers/i.test(text)) {
    ecommerceScore += 6;
  }

  if (/compare|specifications|specs|ratings|user reviews|alternatives|directory|providers|listings|search results|job openings/i.test(text)) {
    directoryScore += 4;
  }

  if (/sign up|free trial|get started|upgrade|enterprise|api key|webhook|integration|dashboard|workspace|team plan/i.test(text)) {
    if (siteType !== "Small business" && siteType !== "Service") {
      saasScore += 4;
    }
  }

  if (/contact us|call us|book appointment|schedule appointment|visit our office|our services|tax services|consultation/i.test(text)) {
    serviceScore += 4;
  }

  if (/iv drip|iv therapy|iv infusion|vitamin drip|drip bar|intravenous|hydration therapy|wellness clinic|medical clinic|aesthetic clinic|beauty clinic|skin clinic|dental clinic|physiotherapy|chiropractic|acupuncture treatment|massage therapy|facial treatment/i.test(text)) {
    serviceScore += 5;
  }

  if (editorialPath) {
    newsScore += 2;
    blogScore += 1;
    ecommerceScore -= 2;
  }

  // ─── SITE TYPE CONTEXT ─────────────────────────────────────────────────────

  if (siteType === "Blog") {
    blogScore += 4;
  }

  if (siteType === "Newspaper") {
    newsScore += 8;
    blogScore -= 4;
    ecommerceScore -= 5;
    saasScore -= 3;
    directoryScore -= 2;
  }

  if (siteType === "Directory") {
    directoryScore += 5;
    if (ecommerceScore < 8) ecommerceScore -= 4;
  }

  if (siteType === "E-commerce") {
    ecommerceScore += 5;
    blogScore -= 4;
    saasScore -= 4;
    if (/\/listing\/|\/listings\//i.test(lowerUrl)) {
      directoryScore -= 5;
      ecommerceScore += 3;
    }
  }

  if (siteType === "Saas") {
    saasScore += 7;
    ecommerceScore -= 5;
    blogScore -= 2;
  }

  if (siteType === "Service") {
    serviceScore += 8;
    saasScore -= 5;
    ecommerceScore -= 5;
    directoryScore -= 4;
    newsScore -= 5;
    blogScore -= 3;
  }

  if (siteType === "Small business") {
    serviceScore += 6;
    ecommerceScore -= 4;
    saasScore -= 6;
    directoryScore -= 4;
    newsScore -= 4;
    blogScore -= 3;
  }

  // ─── FINAL DECISION ────────────────────────────────────────────────────────

  const candidates = [
    { type: "Blog", score: blogScore },
    { type: "Newspaper", score: newsScore },
    { type: "E-commerce", score: ecommerceScore },
    { type: "Directory", score: directoryScore },
    { type: "Saas", score: saasScore },
    { type: "Service", score: serviceScore },
  ].sort((a, b) => b.score - a.score);

  if (candidates[0].score >= 6) {
    return candidates[0].type;
  }

  return contentType;
}

module.exports = {
  adjustContentTypeAfterScoring,
};