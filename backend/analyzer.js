const { getPooledPage, releasePage } = require("./browser");
const { pickImportantLinks, getBaseDomain } = require("./utils");
const { scoreSignals } = require("./classifier");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeGoto(page, url, options = {}) {
  const retries = options.retries ?? 1;
  const timeout = options.timeout ?? 12000;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout
      });
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;

      await sleep(800 * (attempt + 1));

      try {
        await page.goto("about:blank", {
          waitUntil: "domcontentloaded",
          timeout: 4000
        });
      } catch {}
    }
  }

  throw lastError;
}

function normalizeSchemaText(html = "") {
  return String(html).replace(/\s+/g, "").toLowerCase();
}

async function extractPageData(page, url) {
  await safeGoto(page, url);

  const data = await page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText : "";
    const title = document.title || "";
    const metaDescription =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const links = [...document.querySelectorAll("a[href]")]
      .map((a) => a.href)
      .filter(Boolean)
      .slice(0, 200);
    const linksText = [...document.querySelectorAll("a")]
      .map((a) => a.textContent?.trim() || "")
      .filter(Boolean)
      .join(" ");
    const html = document.documentElement?.outerHTML || "";

    const hasRealCart =
      !!document.querySelector(
        '[class*="cart"][class*="count"], [id*="cart"][class*="count"], [class*="minicart"], [data-testid*="cart"]'
      ) ||
      /add[\s-]?to[\s-]?cart|your[\s-]?cart|view[\s-]?cart|shopping[\s-]?bag|proceed[\s-]?to[\s-]?checkout/i.test(
        bodyText + " " + linksText
      );

    const hasAffiliateLinks =
      /amazon\.com|bestbuy\.com|walmart\.com|target\.com/i.test(html) &&
      /buy|deal|price|shop/i.test(linksText);

    const hasMap = /google\.com\/maps|maps\.google|leaflet|mapbox/i.test(html);
    const hasSearchAndFilter = /filter|search results|sort by|refine/i.test(
      bodyText + " " + linksText
    );
    const hasReviews = /write a review|read reviews|rating|ratings|stars?\s*out\s*of/i.test(
      bodyText + " " + linksText + " " + html
    );
    const hasHours = /hours|open now|closed now|opening hours|hours of operation/i.test(
      bodyText + " " + linksText + " " + html
    );

    return {
      title,
      metaDescription,
      bodyText,
      links,
      linksText,
      html,
      hasCart: hasRealCart,
      hasAffiliateLinks,
      hasMap,
      hasSearchAndFilter,
      hasReviews,
      hasHours
    };
  });

  const normalizedText = `${data.title} ${data.metaDescription} ${data.bodyText}`
    .replace(/\s+/g, " ")
    .trim();

  const schemaText = normalizeSchemaText(data.html);

  const hasPhone =
    /(\+?\d{1,3}[\s\-]?)?(\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}/.test(normalizedText);

  const hasAddress =
    /\b(road|street|st\.|avenue|ave|block|sector|suite|floor|building|house|city|zip|postal|office|boulevard|blvd)\b/i.test(
      normalizedText
    );

  const hasBusinessListingSchema =
    /\"@type\":\"(localbusiness|organization|restaurant|dentist|store|attorney|medicalbusiness|homeandconstructionbusiness|automotivebusiness|hotel|lodgingbusiness)\"/i.test(
      schemaText
    );

  const hasProductSchema = /\"@type\":\"product\"/i.test(schemaText);
  const hasArticleSchema =
    /\"@type\":\"(article|newsarticle|blogposting|techarticle|reviewarticle)\"/i.test(
      schemaText
    );

  return {
    url,
    title: data.title,
    metaDescription: data.metaDescription,
    bodyText: normalizedText.slice(0, 12000),
    links: data.links,
    linksText: data.linksText.slice(0, 8000),
    hasCart: data.hasCart,
    hasAffiliateLinks: data.hasAffiliateLinks,
    hasMap: data.hasMap,
    hasSearchAndFilter: data.hasSearchAndFilter,
    hasReviews: data.hasReviews,
    hasHours: data.hasHours,
    hasPhone,
    hasAddress,
    hasBusinessListingSchema,
    hasProductSchema,
    hasArticleSchema
  };
}

async function analyzeDomain(homepageUrl) {
  const page = await getPooledPage();

  try {
    const homepage = await extractPageData(page, homepageUrl);
    const importantLinks = pickImportantLinks(homepage.links, homepageUrl).slice(0, 3);

    const extraPages = [];
    for (const link of importantLinks) {
      try {
        extraPages.push(await extractPageData(page, link));
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
  } finally {
    await releasePage(page);
  }
}

module.exports = { analyzeDomain, extractPageData };