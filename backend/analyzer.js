const axios = require("axios");
const cheerio = require("cheerio");
const { getPooledPage, releasePage } = require("./browser");
const { pickImportantLinks, getBaseDomain, runPool } = require("./utils");
const { scoreSignals, getTopScore } = require("./classifier");

const FETCH_TIMEOUT = 6000;
const PLAYWRIGHT_TIMEOUT = 9000;

const MAX_BODY_TEXT = 8000;
const MAX_LINKS = 80;
const MAX_LINKS_TEXT = 3500;
const MAX_AGGREGATE_TEXT = 18000;
const MAX_AGGREGATE_LINKS_TEXT = 8000;

const DOMAIN_INTERNAL_PAGES = 2;
const INTERNAL_PAGE_CONCURRENCY = 2;

const EVAL_FAST_MODE = process.env.EVAL_FAST_MODE === "1";
const ENABLE_BROWSER_UPGRADE = process.env.ENABLE_BROWSER_UPGRADE !== "0";
const INTERNAL_PAGES_LIMIT = EVAL_FAST_MODE ? 0 : DOMAIN_INTERNAL_PAGES;

const EARLY_EXIT_CONFIDENCE = "High";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function compactText(text = "", limit = MAX_BODY_TEXT) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, limit);
}

// Returns true if the URL looks like a content/editorial page rather than a shop page.
// Used to prevent Shopify CDN false positives on media sites with embedded buy buttons.
function isContentUrl(url = "") {
  return /\/blog\/|\/blogs\/|\/news\/|\/article\/|\/articles\/|\/story\/|\/stories\/|\/guide\/|\/guides\/|\/review\/|\/reviews\/|\/best\/|\/topic\/|\/topics\/|\/forum\/|\/forums\/|\/post\/|\/posts\/|\/opinion\/|\/advice\/|\/videos?\/|\/select\/|\/picks\/|\/ranked\/|\/roundup\//i.test(url);
}

// Returns true if the URL looks like a shop/product page.
function isShopUrl(url = "") {
  return /\/collections\/|\/products?\/|\/shop\/|\/store\/|\/cart\/|\/checkout\/|\/buy\/|\/order\/|\/catalogue\/|\/catalog\//i.test(url);
}

// Detect e-commerce/platform type from raw HTML fingerprints.
// Returns { platform, siteType } or null if nothing matched.
function detectPlatformFromHtml(html = "", responseHeaders = {}, url = "") {
  const h = html.slice(0, 60000);
  const contentPage = isContentUrl(url);
  const shopPage = isShopUrl(url);
  const isHomepage = /^https?:\/\/[^/]+\/?$/.test(url);

  // For Shopify: only fire on shop/collection/product URLs or homepages.
  // Many media/blog sites embed Shopify buy buttons — don't classify them as E-commerce.
  const shopifyDetected =
    /cdn\.shopify\.com|shopify\.com\/s\/files|Shopify\.theme|window\.Shopify\s*=/i.test(h) ||
    /x-shopid|x-shopify/i.test(Object.keys(responseHeaders).join(" "));

  if (shopifyDetected) {
    if (shopPage || isHomepage) return { platform: "Shopify", siteType: "E-commerce" };
    if (contentPage) return null; // blog/news page on a Shopify site — let normal classifier handle it
    // Unknown URL pattern but Shopify detected — trust it
    return { platform: "Shopify", siteType: "E-commerce" };
  }

  // WooCommerce — same guard: content URLs on WP sites shouldn't override to E-commerce
  if (/wp-content\/plugins\/woocommerce|woocommerce\.min\.js|\/wc-api\/|wc_add_to_cart/i.test(h)) {
    if (contentPage) return null;
    return { platform: "WooCommerce", siteType: "E-commerce" };
  }

  // BigCommerce — content URLs on BigCommerce sites should not override to E-commerce
  if (/cdn\d*\.bigcommerce\.com|bigcommerce\.com\/s-|BigCommerce\.com/i.test(h)) {
    if (contentPage) return null;
    return { platform: "BigCommerce", siteType: "E-commerce" };
  }

  // Magento — extremely high false-positive rate on non-ecommerce sites (blogs, directories,
  // academies, news sites all embed Magento scripts). Only trust on explicit shop URLs or
  // the homepage. Return null for ALL other URL patterns.
  if (/mage\/|Magento_|mage\.cookies|require\.config.*Magento/i.test(h)) {
    if (shopPage || isHomepage) return { platform: "Magento", siteType: "E-commerce" };
    return null;
  }

  // Squarespace Commerce
  if (/squarespace\.com\/commerce|static\.squarespace\.com.*commerce/i.test(h))
    return { platform: "Squarespace", siteType: "E-commerce" };

  // PrestaShop
  if (/prestashop|\/themes\/.*\/assets\/css\/theme\.css/i.test(h) && /add.to.cart|panier/i.test(h))
    return { platform: "PrestaShop", siteType: "E-commerce" };

  // Wix eCommerce
  if (/static\.wixstatic\.com|wixsite\.com/i.test(h) && /\/store\/|wix-stores/i.test(h))
    return { platform: "Wix Store", siteType: "E-commerce" };

  // Ecwid
  if (/app\.ecwid\.com|ecwid\.com\/script\.js/i.test(h))
    return { platform: "Ecwid", siteType: "E-commerce" };

  // Generic WordPress (not WooCommerce) → Blog
  if (/wp-content\/themes|wp-includes\/js|xmlrpc\.php/i.test(h))
    return { platform: "WordPress", siteType: "Blog" };

  // Webflow
  if (/assets\.website-files\.com|webflow\.com\/css/i.test(h))
    return { platform: "Webflow", siteType: "Small business" };

  return null;
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

function shouldFallbackToPlaywright({
  html = "",
  title = "",
  bodyText = "",
  linksText = "",
  schemaText = "",
}) {
  const h = String(html || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  const b = String(bodyText || "").toLowerCase();
  const l = String(linksText || "").toLowerCase();
  const s = String(schemaText || "").toLowerCase();

  const visible = compactText(bodyText, 400);
  const tooThin = visible.length < 80;
  const weakTitle = t.trim().length < 8;
  const weakLinks = l.trim().length < 40;
  const weakSchema = s.trim().length < 40;

  const botBlocked =
    /just a moment|access denied|attention required|enable javascript|checking your browser|verify you are human|request blocked|cf challenge|cloudflare|akamai|perimeterx|incapsula/i.test(
      `${t} ${b}`.slice(0, 2000)
    );

  const jsShell =
    /id="__next"|id="root"|id="app"|__nuxt|webpack|hydration|window\.__|application\/json/i.test(
      h
    ) && visible.length < 160;

  return (
    botBlocked ||
    jsShell ||
    tooThin ||
    (weakTitle && weakLinks) ||
    (weakSchema && visible.length < 120)
  );
}

function extractSchemaTextFromCheerio($) {
  const schemaRaw = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    schemaRaw.push($(el).html() || "");
  });
  return schemaRaw.join(" ").slice(0, 20000);
}

function extractUsefulBodyTextFromCheerio($) {
  const clone = $.root().clone();

  clone
    .find(
      [
        "script",
        "style",
        "noscript",
        "template",
        "svg",
        "canvas",
        "iframe",
        "header nav",
        "footer",
        "form",
        '[aria-hidden="true"]',
        ".visually-hidden",
        ".sr-only",
        ".screen-reader-text",
        ".cookie",
        ".cookies",
        ".cookie-banner",
        ".cookie-consent",
        ".consent",
        ".newsletter",
        ".popup",
        ".modal",
        ".drawer",
        ".offcanvas",
      ].join(",")
    )
    .remove();

  const candidates = [
    "main",
    "article",
    '[role="main"]',
    ".main",
    ".content",
    ".page-content",
    ".entry-content",
    ".post-content",
    ".article-content",
    ".site-content",
    "body",
  ];

  let text = "";
  for (const sel of candidates) {
    const node = clone.find(sel).first();
    if (node.length) {
      text = compactText(node.text(), MAX_BODY_TEXT);
      if (text.length >= 120) break;
    }
  }

  return compactText(text, MAX_BODY_TEXT);
}

function buildPageData(
  url,
  title,
  metaDescription,
  bodyText,
  html,
  links,
  linksText,
  schemaText
) {
  const normalizedBody = compactText(bodyText, MAX_BODY_TEXT);
  const t = `${String(title || "")} ${String(metaDescription || "")} ${normalizedBody}`.toLowerCase();
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
      `${title || ""} ${metaDescription || ""} ${normalizedBody}`
    );

  const hasAddress =
    /\b(road|street|st\.|avenue|ave|block|sector|suite|floor|building|house|city|zip|postal|office|boulevard|blvd)\b/i.test(
      `${title || ""} ${metaDescription || ""} ${normalizedBody}`
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
    bodyText: normalizedBody,
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
    hasArticleSchema,
  };
}

function buildClassifierSignals(page) {
  return {
    hasCart: !!page.hasCart,
    hasPhone: !!page.hasPhone,
    hasAddress: !!page.hasAddress,
    hasMap: !!page.hasMap,
    hasSearchAndFilter: !!page.hasSearchAndFilter,
    hasReviews: !!page.hasReviews,
    hasBusinessListingSchema: !!page.hasBusinessListingSchema,
    hasProductSchema: !!page.hasProductSchema,
    hasArticleSchema: !!page.hasArticleSchema,
  };
}

function classifySinglePage(page) {
  const aggregateText = `${page.title} ${page.metaDescription} ${page.bodyText} ${page.schemaText}`.slice(
    0,
    MAX_AGGREGATE_TEXT
  );

  return scoreSignals(
    aggregateText,
    page.linksText.slice(0, MAX_AGGREGATE_LINKS_TEXT),
    buildClassifierSignals(page),
    page.url
  );
}

function createEmptyScores() {
  return {
    Blog: 0,
    "E-commerce": 0,
    "Small business": 0,
    Newspaper: 0,
    Saas: 0,
    Directory: 0,
    Service: 0,
  };
}

function aggregateWeightedScores(weightedResults) {
  const totals = createEmptyScores();

  for (const item of weightedResults) {
    const scores = item?.scores || {};
    const weight = Number(item?.weight || 0);

    for (const key of Object.keys(totals)) {
      totals[key] += (scores[key] || 0) * weight;
    }
  }

  return totals;
}

function summarizeWeightedClassification(weightedResults) {
  const scores = aggregateWeightedScores(weightedResults);
  const top = getTopScore(scores);
  const classifierVersion =
    weightedResults.find((r) => r?.classifierVersion)?.classifierVersion || null;

  return {
    siteType: top.siteType,
    confidence: top.confidence,
    classifierVersion,
    scores,
    topScore: top.topScore,
    secondScore: top.secondScore,
    scoreGap: (top.topScore || 0) - (top.secondScore || 0),
  };
}

async function fetchWithCheerio(url) {
  const response = await axios.get(url, {
    headers: FETCH_HEADERS,
    timeout: FETCH_TIMEOUT,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 500,
  });

  const html = typeof response.data === "string" ? response.data : "";
  const platformMatch = detectPlatformFromHtml(html, response.headers || {}, url);
  const $ = cheerio.load(html);

  const title = $("title").text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const bodyText = extractUsefulBodyTextFromCheerio($);

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
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) linksTextArr.push(text);
  });

  const linksText = linksTextArr.join(" ");
  const schemaText = extractSchemaTextFromCheerio($);

  const pageData = buildPageData(
    url,
    title,
    metaDescription,
    bodyText,
    html,
    links,
    linksText,
    schemaText
  );

  return {
    ...pageData,
    _source: "cheerio",
    _platformMatch: platformMatch || null,
    _needsBrowser: platformMatch
      ? false  // platform fingerprint is definitive — no need for browser
      : shouldFallbackToPlaywright({ html, title, bodyText, linksText, schemaText }),
  };
}

async function fetchWithPlaywright(url) {
  let page = null;

  try {
    page = await getPooledPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PLAYWRIGHT_TIMEOUT,
    });

    try {
      await page.waitForTimeout(800);
    } catch {}

    const data = await page.evaluate(
      ({ maxLinks, maxBodyText }) => {
        const title = document.title || "";
        const metaDescription =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ||
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") ||
          "";

        const bodyRoot =
          document.querySelector("main, article, [role='main'], .main, .content, .page-content, .entry-content, .post-content") ||
          document.body;

        const bodyText = (bodyRoot?.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, maxBodyText);

        const links = [...document.querySelectorAll("a[href]")]
          .map((a) => a.href)
          .filter(Boolean)
          .slice(0, maxLinks);

        const linksText = [...document.querySelectorAll("a")]
          .map((a) => (a.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, maxLinks)
          .join(" ");

        const schemaText = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((s) => s.textContent || "")
          .join(" ")
          .slice(0, 20000);

        const html = document.documentElement?.outerHTML || "";

        return {
          title,
          metaDescription,
          bodyText,
          links,
          linksText,
          schemaText,
          html,
        };
      },
      { maxLinks: MAX_LINKS, maxBodyText: MAX_BODY_TEXT }
    );

    return {
      ...buildPageData(
        url,
        data.title,
        data.metaDescription,
        data.bodyText,
        data.html,
        data.links,
        data.linksText,
        data.schemaText || data.html
      ),
      _source: "playwright",
      _needsBrowser: false,
    };
  } finally {
    if (page) await releasePage(page).catch(() => {});
  }
}

async function extractPageData(_ctx, url) {
  try {
    const cheerioResult = await fetchWithCheerio(url);
    const platformMatch = cheerioResult._platformMatch;
    delete cheerioResult._platformMatch;

    if (EVAL_FAST_MODE || !ENABLE_BROWSER_UPGRADE || !cheerioResult._needsBrowser) {
      delete cheerioResult._needsBrowser;
      delete cheerioResult._source;
      if (platformMatch) cheerioResult._platformMatch = platformMatch;
      return cheerioResult;
    }

    try {
      const browserResult = await fetchWithPlaywright(url);
      delete browserResult._needsBrowser;
      delete browserResult._source;
      // Carry platform match through even after browser upgrade
      if (platformMatch) browserResult._platformMatch = platformMatch;
      return browserResult;
    } catch (_playwrightError) {
      delete cheerioResult._needsBrowser;
      delete cheerioResult._source;
      if (platformMatch) cheerioResult._platformMatch = platformMatch;
      return cheerioResult;
    }
  } catch (cheerioError) {
    if (EVAL_FAST_MODE || !ENABLE_BROWSER_UPGRADE) {
      throw cheerioError;
    }

    try {
      const browserResult = await fetchWithPlaywright(url);
      delete browserResult._needsBrowser;
      delete browserResult._source;
      return browserResult;
    } catch (_playwrightError) {
      return buildPageData(url, "", "", "", "", [], "", "");
    }
  }
}

async function maybeUpgradePageWithBrowser(page) {
  if (!ENABLE_BROWSER_UPGRADE || EVAL_FAST_MODE) {
    return {
      page,
      classification: classifySinglePage(page),
      upgraded: false,
    };
  }

  const initialClassification = classifySinglePage(page);

  const shouldRetry =
    initialClassification.confidence === "Low" &&
    shouldFallbackToPlaywright({
      html: "",
      title: page.title,
      bodyText: page.bodyText,
      linksText: page.linksText,
      schemaText: page.schemaText,
    });

  if (!shouldRetry) {
    return {
      page,
      classification: initialClassification,
      upgraded: false,
    };
  }

  try {
    const browserPage = await fetchWithPlaywright(page.url);
    const browserClassification = classifySinglePage(browserPage);

    const oldGap =
      (initialClassification.topScore || 0) -
      (initialClassification.secondScore || 0);
    const newGap =
      (browserClassification.topScore || 0) -
      (browserClassification.secondScore || 0);

    if (
      browserClassification.confidence === "High" ||
      newGap > oldGap ||
      browserClassification.siteType !== initialClassification.siteType
    ) {
      return {
        page: browserPage,
        classification: browserClassification,
        upgraded: true,
      };
    }

    return {
      page,
      classification: initialClassification,
      upgraded: false,
    };
  } catch {
    return {
      page,
      classification: initialClassification,
      upgraded: false,
    };
  }
}

async function analyzeDomain(homepageUrl) {
  const homepageRaw = await extractPageData(null, homepageUrl);

  // Platform fingerprint shortcut — skip full domain analysis (homepages always qualify)
  const platformMatch = homepageRaw._platformMatch;
  if (platformMatch) {
    delete homepageRaw._platformMatch;
    return {
      domain: getBaseDomain(homepageUrl),
      homepageUrl,
      classifierVersion: null,
      siteType: platformMatch.siteType,
      confidence: "High",
      topScore: 1,
      secondScore: 0,
      scoreGap: 1,
      scores: null,
      analyzedPages: [homepageUrl],
      pageTitles: [homepageRaw.title].filter(Boolean),
      pageClassifications: [],
      matchedSignals: [`Platform fingerprint: ${platformMatch.platform}`],
    };
  }

  const homepageResolved = await maybeUpgradePageWithBrowser(homepageRaw);
  const homepage = homepageResolved.page;
  const homepageClassification = homepageResolved.classification;

  if (homepageClassification.confidence === EARLY_EXIT_CONFIDENCE) {
    return {
      domain: getBaseDomain(homepageUrl),
      homepageUrl,
      classifierVersion: homepageClassification.classifierVersion || null,
      analyzedPages: [homepage.url],
      pageTitles: [homepage.title].filter(Boolean),
      pageClassifications: [
        {
          url: homepage.url,
          role: "homepage",
          weight: 1,
          siteType: homepageClassification.siteType,
          confidence: homepageClassification.confidence,
          classifierVersion: homepageClassification.classifierVersion || null,
          scores: homepageClassification.scores,
          upgradedToBrowser: !!homepageResolved.upgraded,
        },
      ],
      matchedSignals: homepageClassification.matchedSignals || [],
      ...homepageClassification,
      scoreGap:
        (homepageClassification.topScore || 0) -
        (homepageClassification.secondScore || 0),
    };
  }

  const importantLinks = pickImportantLinks(homepage.links, homepageUrl).slice(
    0,
    INTERNAL_PAGES_LIMIT
  );

  const extraPages = [];

  await runPool(importantLinks, INTERNAL_PAGE_CONCURRENCY, async (link) => {
    try {
      const rawPage = await extractPageData(null, link);
      const resolved = await maybeUpgradePageWithBrowser(rawPage);

      extraPages.push({
        ...resolved.page,
        _classification: resolved.classification,
        _upgraded: resolved.upgraded,
      });
    } catch (error) {
      console.error(`Failed analyzing internal page ${link}:`, error.message);
    }
  });

  const allPages = [homepage, ...extraPages];

  const weightedResults = allPages.map((page, index) => {
    const classification =
      index === 0
        ? homepageClassification
        : page._classification || classifySinglePage(page);

    let weight = 0.25;
    if (index === 0) weight = 0.5;
    else if (index === 1) weight = 0.25;
    else if (index === 2) weight = 0.25;

    return {
      url: page.url,
      title: page.title,
      role: index === 0 ? "homepage" : "internal",
      weight,
      siteType: classification.siteType,
      confidence: classification.confidence,
      classifierVersion: classification.classifierVersion || null,
      scores: classification.scores,
      matchedSignals: classification.matchedSignals || [],
      upgradedToBrowser: !!page._upgraded,
    };
  });

  const finalClassification = summarizeWeightedClassification(weightedResults);

  const matchedSignals = weightedResults.flatMap((p) =>
    (p.matchedSignals || []).map((signal) => ({
      ...signal,
      url: p.url,
      weight: p.weight,
    }))
  );

  return {
    domain: getBaseDomain(homepageUrl),
    homepageUrl,
    classifierVersion: finalClassification.classifierVersion || null,
    analyzedPages: allPages.map((p) => p.url),
    pageTitles: allPages.map((p) => p.title).filter(Boolean),
    pageClassifications: weightedResults.map((p) => ({
      url: p.url,
      title: p.title,
      role: p.role,
      weight: p.weight,
      siteType: p.siteType,
      confidence: p.confidence,
      classifierVersion: p.classifierVersion || null,
      upgradedToBrowser: !!p.upgradedToBrowser,
    })),
    matchedSignals,
    ...finalClassification,
  };
}

module.exports = { analyzeDomain, extractPageData };