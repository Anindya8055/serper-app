const axios = require("axios");
const cheerio = require("cheerio");
const { getPooledPage, releasePage } = require("./browser");
const { pickImportantLinks, getBaseDomain } = require("./utils");
const { scoreSignals } = require("./classifier");

const FETCH_TIMEOUT = 10000;
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xhtml,application/xml;q=0.9,*/*;q=0.8"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Cheerio-based scraper (primary, no browser) ────────────────────────────

async function fetchWithCheerio(url) {
  const response = await axios.get(url, {
    headers: FETCH_HEADERS,
    timeout: FETCH_TIMEOUT,
    maxRedirects: 5,
    validateStatus: (s) => s < 500
  });

  const html = response.data || "";
  const $ = cheerio.load(html);

  const title = $("title").text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 15000);

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
      links.push(href);
    }
  });

  const linksText = [];
  $("a").each((_, el) => {
    const text = $(el).text().trim();
    if (text) linksText.push(text);
  });

  const normalizedText = `${title} ${metaDescription} ${bodyText}`.replace(/\s+/g, " ").trim();

  const schemaRaw = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    schemaRaw.push($(el).html() || "");
  });
  const schemaText = schemaRaw.join(" ").replace(/\s+/g, "").toLowerCase();

  const linksJoined = linksText.join(" ");

  return buildPageData(url, title, metaDescription, normalizedText, html, links, linksJoined, schemaText);
}

// ─── Playwright-based scraper (fallback for JS-heavy pages) ──────────────────

async function fetchWithPlaywright(url) {
  let page = null;
  try {
    page = await getPooledPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    const { title, metaDescription, bodyText, links, linksText, html } =
      await page.evaluate(() => {
        const title = document.title || "";
        const metaDescription =
          document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
        const bodyText = document.body?.innerText || "";
        const links = [...document.querySelectorAll("a[href]")]
          .map((a) => a.href)
          .filter(Boolean)
          .slice(0, 200);
        const linksText = [...document.querySelectorAll("a")]
          .map((a) => a.textContent?.trim() || "")
          .filter(Boolean)
          .join(" ");
        const html = document.documentElement?.outerHTML || "";
        return { title, metaDescription, bodyText, links, linksText, html };
      });

    const normalizedText = `${title} ${metaDescription} ${bodyText}`
      .replace(/\s+/g, " ")
      .trim();

    const schemaText = html.replace(/\s+/g, "").toLowerCase();

    return buildPageData(url, title, metaDescription, normalizedText, html, links, linksText, schemaText);
  } finally {
    if (page) await releasePage(page).catch(() => {});
  }
}

// ─── Shared signal extraction ─────────────────────────────────────────────────

function buildPageData(url, title, metaDescription, normalizedText, html, links, linksText, schemaText) {
  const t = normalizedText;
  const l = linksText;
  const lowerHtml = html.toLowerCase();

  const hasCart =
    !!html.match(/class="[^"]*cart[^"]*count[^"]*"|class="[^"]*minicart[^"]*"|data-testid="[^"]*cart[^"]*"/i) ||
    /add[\s-]?to[\s-]?cart|your[\s-]?cart|view[\s-]?cart|shopping[\s-]?bag|proceed[\s-]?to[\s-]?checkout/i.test(t + " " + l);

  const hasAffiliateLinks =
    /amazon\.com|bestbuy\.com|walmart\.com|target\.com/i.test(lowerHtml) &&
    /buy|deal|price|shop/i.test(l);

  const hasMap = /google\.com\/maps|maps\.google|leaflet|mapbox/i.test(lowerHtml);
  const hasSearchAndFilter = /filter|search results|sort by|refine/i.test(t + " " + l);
  const hasReviews = /write a review|read reviews|rating|ratings|stars?\s*out\s*of/i.test(t + " " + l + " " + lowerHtml);
  const hasHours = /hours|open now|closed now|opening hours|hours of operation/i.test(t + " " + l + " " + lowerHtml);
  const hasPhone = /(\+?\d{1,3}[\s\-]?)?(\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}/.test(t);
  const hasAddress =
    /\b(road|street|st\.|avenue|ave|block|sector|suite|floor|building|house|city|zip|postal|office|boulevard|blvd)\b/i.test(t);

  const hasBusinessListingSchema =
    /\"@type\":\"(localbusiness|organization|restaurant|dentist|store|attorney|medicalbusiness|homeandconstructionbusiness|automotivebusiness|hotel|lodgingbusiness)\"/i.test(schemaText);
  const hasProductSchema = /\"@type\":\"product\"/i.test(schemaText);
  const hasArticleSchema =
    /\"@type\":\"(article|newsarticle|blogposting|techarticle|reviewarticle)\"/i.test(schemaText);

  return {
    url,
    title,
    metaDescription,
    bodyText: normalizedText.slice(0, 12000),
    links: links.slice(0, 200),
    linksText: l.slice(0, 8000),
    hasCart,
    hasAffiliateLinks,
    hasMap,
    hasSearchAndFilter,
    hasReviews,
    hasHours,
    hasPhone,
    hasAddress,
    hasBusinessListingSchema,
    hasProductSchema,
    hasArticleSchema
  };
}

// ─── Main fetch with Cheerio first, Playwright fallback ──────────────────────

async function extractPageData(_, url) {
  // Try Cheerio first (fast, no browser)
  try {
    return await fetchWithCheerio(url);
  } catch (cheerioError) {
    console.warn(`Cheerio failed for ${url}: ${cheerioError.message} — trying Playwright`);
  }

  // Playwright fallback
  try {
    return await fetchWithPlaywright(url);
  } catch (playwrightError) {
    throw new Error(`Both Cheerio and Playwright failed for ${url}: ${playwrightError.message}`);
  }
}

// ─── Domain analysis (homepage + up to 3 internal pages) ─────────────────────

async function analyzeDomain(homepageUrl) {
  const homepage = await extractPageData(null, homepageUrl);
  const importantLinks = pickImportantLinks(homepage.links, homepageUrl).slice(0, 3);

  const extraPages = [];
  for (const link of importantLinks) {
    try {
      extraPages.push(await extractPageData(null, link));
    } catch (error) {
      console.error(`Failed analyzing internal page ${link}:`, error.message);
    }
  }

  const allPages = [homepage, ...extraPages];
  const aggregateText = allPages
    .map((p) => `${p.title} ${p.metaDescription} ${p.bodyText}`)
    .join(" ");
  const linksText = allPages.map((p) => p.linksText).join(" ");

  const combinedSignals = {
    hasCart: allPages.some((p) => p.hasCart),
    hasPhone: allPages.some((p) => p.hasPhone),
    hasAddress: allPages.some((p) => p.hasAddress),
    hasMap: allPages.some((p) => p.hasMap),
    hasSearchAndFilter: allPages.some((p) => p.hasSearchAndFilter),
    hasReviews: allPages.some((p) => p.hasReviews),
    hasBusinessListingSchema: allPages.some((p) => p.hasBusinessListingSchema),
    hasProductSchema: allPages.some((p) => p.hasProductSchema),
    hasArticleSchema: allPages.some((p) => p.hasArticleSchema)
  };

  const classification = scoreSignals(
    aggregateText.slice(0, 30000),
    linksText.slice(0, 12000),
    combinedSignals,
    homepageUrl
  );

  return {
    domain: getBaseDomain(homepageUrl),
    homepageUrl,
    analyzedPages: allPages.map((p) => p.url),
    pageTitles: allPages.map((p) => p.title).filter(Boolean),
    ...classification
  };
}

module.exports = { analyzeDomain, extractPageData };