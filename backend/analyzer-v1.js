const axios = require("axios");
const cheerio = require("cheerio");
const { getPooledPage, releasePage } = require("./browser-v1");
const { pickImportantLinks, getBaseDomain } = require("./utils");
const { scoreSignals } = require("./classifier");

// Timeouts tuned for speed
const FETCH_TIMEOUT = 6000;
const PLAYWRIGHT_TIMEOUT = 9000;

// Text/links limits
const MAX_BODY_TEXT = 8000;
const MAX_LINKS = 80;
const MAX_LINKS_TEXT = 3500;
const MAX_AGGREGATE_TEXT = 18000;
const MAX_AGGREGATE_LINKS_TEXT = 8000;

// Domain analysis limits
const DOMAIN_INTERNAL_PAGES = 2;
const INTERNAL_PAGE_CONCURRENCY = 2;

// When classification is already strong on homepage, skip extra pages
const EARLY_EXIT_CONFIDENCE = "High";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

async function runPool(items, concurrency, worker) {
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const currentIndex = index++;
      await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner())
  );
}

function compactText(text = "", limit = MAX_BODY_TEXT) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, limit);
}

function absolutizeLinks(baseUrl, hrefs = []) {
  const out = [];
  for (const href of hrefs) {
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (/^(javascript:|mailto:|tel:)/i.test(href)) continue;

    try {
      out.push(new URL(href, baseUrl).toString());
    } catch {}
  }
  return [...new Set(out)];
}

/**
 * Decide if we *really* need Playwright.
 * We keep it for:
 *  - obvious bot blocks
 *  - JS shells with almost no visible body
 *  - extremely thin content on domains where classification matters
 */
function shouldFallbackToPlaywright({ html = "", title = "", bodyText = "" }) {
  const h = String(html || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  const b = String(bodyText || "").toLowerCase();

  const visible = compactText(bodyText, 400);
  const tooThin = visible.length < 80; // slightly more aggressive

  const botBlocked =
    /just a moment|access denied|attention required|enable javascript|checking your browser|verify you are human|request blocked|cf challenge|cloudflare|akamai|perimeterx|incapsula/i.test(
      `${t} ${b}`.slice(0, 2000)
    );

  const jsShell =
    /id="__next"|id="root"|id="app"|__nuxt|webpack|hydration|window\.__|application\/json/i.test(
      h
    ) && visible.length < 160;

  return botBlocked || jsShell || tooThin;
}

function extractSchemaTextFromCheerio($) {
  const schemaRaw = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    schemaRaw.push($(el).html() || "");
  });
  return schemaRaw.join(" ").slice(0, 20000);
}

function buildPageData(
  url,
  title,
  metaDescription,
  normalizedText,
  html,
  links,
  linksText,
  schemaText
) {
  const t = String(normalizedText || "").toLowerCase();
  const l = String(linksText || "").toLowerCase();
  const lowerHtml = String(html || "").toLowerCase();
  const schemaLower = String(schemaText || "").replace(/\s+/g, "").toLowerCase();

  const hasCart =
    /class="[^"]*cart[^"]*"|data-testid="[^"]*cart[^"]*"|minicart|shopping-bag|basket-count/i.test(
      html || ""
    ) ||
    /add[\s-]?to[\s-]?cart|your[\s-]?cart|view[\s-]?cart|shopping[\s-]?bag|proceed[\s-]?to[\s-]?checkout|buy now/i.test(
      `${t} ${l}`
    );

  const hasAffiliateLinks =
    /amazon\.com|bestbuy\.com|walmart\.com|target\.com|ebay\.com/i.test(lowerHtml) &&
    /buy|deal|price|shop/i.test(l);

  const hasMap =
    /google\.com\/maps|maps\.google|leaflet|mapbox|geo:|place-id/i.test(lowerHtml);

  const hasSearchAndFilter =
    /filter|search results|sort by|refine|facets?|apply filters?/i.test(`${t} ${l}`);

  const hasReviews =
    /write a review|read reviews|rating|ratings|stars?\s*out\s*of|customer reviews|review score/i.test(
      `${t} ${l} ${lowerHtml}`
    );

  const hasHours =
    /hours|open now|closed now|opening hours|hours of operation/i.test(
      `${t} ${l} ${lowerHtml}`
    );

  const hasPhone =
    /(\+?\d{1,3}[\s\-]?)?(\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}/.test(
      normalizedText || ""
    );

  const hasAddress =
    /\b(road|street|st\.|avenue|ave|block|sector|suite|floor|building|house|city|zip|postal|office|boulevard|blvd)\b/i.test(
      normalizedText || ""
    );

  const hasBusinessListingSchema =
    /"@type":"(localbusiness|organization|restaurant|dentist|store|attorney|medicalbusiness|homeandconstructionbusiness|automotivebusiness|hotel|lodgingbusiness)"/i.test(
      schemaLower
    );

  const hasProductSchema = /"@type":"product"/i.test(schemaLower);

  const hasArticleSchema =
    /"@type":"(article|newsarticle|blogposting|techarticle|reviewarticle)"/i.test(
      schemaLower
    );

  return {
    url,
    title: String(title || "").trim().slice(0, 300),
    metaDescription: String(metaDescription || "").trim().slice(0, 500),
    bodyText: compactText(normalizedText, MAX_BODY_TEXT),
    schemaText: String(schemaText || "").slice(0, 20000),
    links: (links || []).slice(0, MAX_LINKS),
    linksText: compactText(linksText, MAX_LINKS_TEXT),
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

// ─── Cheerio scraper ──────────────────────────────────────────────────────────

async function fetchWithCheerio(url) {
  const response = await axios.get(url, {
    headers: FETCH_HEADERS,
    timeout: FETCH_TIMEOUT,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 500
  });

  const html = typeof response.data === "string" ? response.data : "";
  const $ = cheerio.load(html);

  const title = $("title").text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const bodyText = compactText($("body").text(), MAX_BODY_TEXT);

  const hrefs = [];
  $("a[href]").each((_, el) => {
    if (hrefs.length >= MAX_LINKS) return false;
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });

  const links = absolutizeLinks(url, hrefs);

  const linksTextArr = [];
  $("a").each((_, el) => {
    if (linksTextArr.length >= MAX_LINKS) return false;
    const text = $(el).text().trim();
    if (text) linksTextArr.push(text);
  });

  const linksText = linksTextArr.join(" ");
  const normalizedText = compactText(`${title} ${metaDescription} ${bodyText}`, MAX_BODY_TEXT);
  const schemaText = extractSchemaTextFromCheerio($);

  const pageData = buildPageData(
    url,
    title,
    metaDescription,
    normalizedText,
    html,
    links,
    linksText,
    schemaText
  );

  return {
    ...pageData,
    _source: "cheerio",
    _needsBrowser: shouldFallbackToPlaywright({
      html,
      title,
      bodyText
    })
  };
}

// ─── Playwright scraper ───────────────────────────────────────────────────────

async function fetchWithPlaywright(url) {
  let page = null;

  try {
    page = await getPooledPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PLAYWRIGHT_TIMEOUT
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: 2500 });
    } catch {}

    const data = await page.evaluate(
      ({ maxLinks, maxBodyText }) => {
        const title = document.title || "";
        const metaDescription =
          document.querySelector('meta[name="description"]')?.getAttribute("content") ||
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
          "";

        const bodyText = (document.body?.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, maxBodyText);

        const links = [...document.querySelectorAll("a[href]")]
          .map((a) => a.href)
          .filter(Boolean)
          .slice(0, maxLinks);

        const linksText = [...document.querySelectorAll("a")]
          .map((a) => (a.textContent || "").trim())
          .filter(Boolean)
          .slice(0, maxLinks)
          .join(" ");

        const schemaText = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((s) => s.textContent || "")
          .join(" ")
          .slice(0, 20000);

        const html = document.documentElement?.outerHTML || "";

        return { title, metaDescription, bodyText, links, linksText, schemaText, html };
      },
      { maxLinks: MAX_LINKS, maxBodyText: MAX_BODY_TEXT }
    );

    return {
      ...buildPageData(
        url,
        data.title,
        data.metaDescription,
        `${data.title} ${data.metaDescription} ${data.bodyText}`,
        data.html,
        data.links,
        data.linksText,
        data.schemaText || data.html
      ),
      _source: "playwright",
      _needsBrowser: false
    };
  } finally {
    if (page) await releasePage(page).catch(() => {});
  }
}

// ─── Main extractor ───────────────────────────────────────────────────────────

async function extractPageData(_ctx, url) {
  // Try Cheerio first (fast path)
  try {
    const cheerioResult = await fetchWithCheerio(url);

    if (!cheerioResult._needsBrowser) {
      delete cheerioResult._needsBrowser;
      delete cheerioResult._source;
      return cheerioResult;
    }

    // Only use Playwright when clearly needed
    try {
      const browserResult = await fetchWithPlaywright(url);
      delete browserResult._needsBrowser;
      delete browserResult._source;
      return browserResult;
    } catch (_playwrightError) {
      delete cheerioResult._needsBrowser;
      delete cheerioResult._source;
      return cheerioResult;
    }
  } catch (_cheerioError) {
    // Cheerio failed hard, try Playwright once
    try {
      const browserResult = await fetchWithPlaywright(url);
      delete browserResult._needsBrowser;
      delete browserResult._source;
      return browserResult;
    } catch (playwrightError) {
      throw new Error(
        `Both Cheerio and Playwright failed for ${url}: ${playwrightError.message}`
      );
    }
  }
}

// ─── Domain analysis ──────────────────────────────────────────────────────────

async function analyzeDomain(homepageUrl) {
  const homepage = await extractPageData(null, homepageUrl);

  const initialAggregateText = `${homepage.title} ${homepage.metaDescription} ${homepage.bodyText}`.slice(
    0,
    MAX_AGGREGATE_TEXT
  );
  const initialLinksText = homepage.linksText.slice(0, MAX_AGGREGATE_LINKS_TEXT);

  const initialSignals = {
    hasCart: !!homepage.hasCart,
    hasPhone: !!homepage.hasPhone,
    hasAddress: !!homepage.hasAddress,
    hasMap: !!homepage.hasMap,
    hasSearchAndFilter: !!homepage.hasSearchAndFilter,
    hasReviews: !!homepage.hasReviews,
    hasBusinessListingSchema: !!homepage.hasBusinessListingSchema,
    hasProductSchema: !!homepage.hasProductSchema,
    hasArticleSchema: !!homepage.hasArticleSchema
  };

  const initialClassification = scoreSignals(
    initialAggregateText,
    initialLinksText,
    initialSignals,
    homepageUrl
  );

  if (initialClassification.confidence === EARLY_EXIT_CONFIDENCE) {
    return {
      domain: getBaseDomain(homepageUrl),
      homepageUrl,
      analyzedPages: [homepage.url],
      pageTitles: [homepage.title].filter(Boolean),
      ...initialClassification
    };
  }

  const importantLinks = pickImportantLinks(homepage.links, homepageUrl).slice(
    0,
    DOMAIN_INTERNAL_PAGES
  );

  const extraPages = [];

  await runPool(importantLinks, INTERNAL_PAGE_CONCURRENCY, async (link) => {
    try {
      const page = await extractPageData(null, link);
      extraPages.push(page);
    } catch (error) {
      console.error(`Failed analyzing internal page ${link}:`, error.message);
    }
  });

  const allPages = [homepage, ...extraPages];

  const aggregateText = allPages
    .map((p) => `${p.title} ${p.metaDescription} ${p.bodyText}`)
    .join(" ")
    .slice(0, MAX_AGGREGATE_TEXT);

  const linksText = allPages
    .map((p) => p.linksText)
    .join(" ")
    .slice(0, MAX_AGGREGATE_LINKS_TEXT);

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
    aggregateText,
    linksText,
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