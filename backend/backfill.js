require("dotenv").config();

const prisma = require("./db");
const { extractPageData } = require("./analyzer");
const {
  classifyContentType,
  inferTypeFromSignals,
  normalizeType,
  getDomainPrior,
} = require("./classifier");
const { buildHomepageUrl, getBaseDomain, runPool } = require("./utils");

const CLASSIFIER_VERSION = "classifier_v1";
const CONCURRENCY = 3;
const DRY_RUN = process.env.DRY_RUN === "1";

function safeJson(value, fallback) {
  return value === undefined ? fallback : value;
}

async function upsertSiteAnalysis(record) {
  if (!record?.url) return;

  if (DRY_RUN) {
    console.log("DRY RUN: Would upsert", record.url);
    return;
  }

  await prisma.siteAnalysis.upsert({
    where: { url: record.url },
    create: record,
    update: record,
  });
}

async function backfillItem(item) {
  const existing = await prisma.siteAnalysis.findUnique({
    where: { url: item.url },
  });

  if (existing?.classifierVersion === CLASSIFIER_VERSION) {
    console.log("SKIP Already current version", item.url);
    return;
  }

  const knownPrior = getDomainPrior(item.domain);

  try {
    const pageData = await extractPageData(null, item.url);

    const pageResult = inferTypeFromSignals(
      item.url,
      pageData.title || "",
      pageData.metaDescription || "",
      pageData.bodyText || "",
      pageData.linksText || "",
      pageData.schemaText || "",
      {
        hasCart: !!pageData.hasCart,
        hasSearchAndFilter: !!pageData.hasSearchAndFilter,
        hasPhone: !!pageData.hasPhone,
        hasAddress: !!pageData.hasAddress,
        hasMap: !!pageData.hasMap,
        hasReviews: !!pageData.hasReviews,
        hasBusinessListingSchema: !!pageData.hasBusinessListingSchema,
        hasProductSchema: !!pageData.hasProductSchema,
        hasArticleSchema: !!pageData.hasArticleSchema,
      },
      knownPrior || null
    );

    const resolvedSiteType = normalizeType(
      knownPrior || pageResult.siteType || "Small business"
    );
    const resolvedContentType = normalizeType(
      classifyContentType(item.url, pageData, resolvedSiteType)
    );

    await upsertSiteAnalysis({
      url: item.url,
      domain: item.domain,
      homepageUrl: buildHomepageUrl(item.domain),
      classifierVersion: pageResult.classifierVersion || CLASSIFIER_VERSION,
      fetchMethod: "backfillpageextract",
      siteType: resolvedSiteType,
      contentType: resolvedContentType,
      confidence: pageResult.confidence || "Low",
      topScore: typeof pageResult.topScore === "number" ? pageResult.topScore : null,
      secondScore:
        typeof pageResult.secondScore === "number" ? pageResult.secondScore : null,
      scoreGap: typeof pageResult.scoreGap === "number" ? pageResult.scoreGap : null,
      needsReview: (pageResult.confidence || "Low") === "Low",
      pageSignals: {
        hasCart: !!pageData.hasCart,
        hasSearchAndFilter: !!pageData.hasSearchAndFilter,
        hasPhone: !!pageData.hasPhone,
        hasAddress: !!pageData.hasAddress,
        hasMap: !!pageData.hasMap,
        hasReviews: !!pageData.hasReviews,
        hasBusinessListingSchema: !!pageData.hasBusinessListingSchema,
        hasProductSchema: !!pageData.hasProductSchema,
        hasArticleSchema: !!pageData.hasArticleSchema,
      },
      pageResults: {
        title: pageData.title,
        metaDescription: pageData.metaDescription,
        linksCount: Array.isArray(pageData.links) ? pageData.links.length : 0,
      },
      scores: safeJson(pageResult.scores, undefined),
      matchedSignals: pageResult.matchedSignals || [],
      pageClassifications: undefined,
      analyzedPages: [item.url],
    });

    console.log("OK Backfilled", item.url, resolvedSiteType);
  } catch (err) {
    console.error("ERR Failed", item.url, err.message);

    const effectiveType = normalizeType(knownPrior || "Small business");

    // ── FIX (Bug #6): contentType should not be copied from siteType in the
    //    fallback path. Derive it the same way as the server fallback does,
    //    using classifyContentType(url, null, effectiveType).
    const fallbackContentType = normalizeType(
      classifyContentType(item.url, null, effectiveType)
    );

    await upsertSiteAnalysis({
      url: item.url,
      domain: item.domain,
      homepageUrl: buildHomepageUrl(item.domain),
      classifierVersion: CLASSIFIER_VERSION,
      fetchMethod: "backfillfallback",
      siteType: effectiveType,
      contentType: fallbackContentType,
      confidence: knownPrior ? "High" : "Low",
      topScore: null,
      secondScore: null,
      scoreGap: null,
      needsReview: !knownPrior,
      pageSignals: {},
      pageResults: { pageError: err.message },
      scores: undefined,
      matchedSignals: [`Backfill fallback: ${err.message}`],
      pageClassifications: undefined,
      analyzedPages: [],
    });
  }
}

async function main() {
  console.log("Starting backfill... DRY_RUN=", DRY_RUN);

  const searches = await prisma.search.findMany({
    select: {
      id: true,
      keyword: true,
      country: true,
      resultsSnapshot: true,
    },
  });

  const urlMap = new Map();

  for (const search of searches) {
    const items = Array.isArray(search.resultsSnapshot) ? search.resultsSnapshot : [];

    for (const item of items) {
      if (item?.url && !urlMap.has(item.url)) {
        urlMap.set(item.url, {
          url: item.url,
          domain: item.domain || getBaseDomain(item.url),
        });
      }
    }
  }

  const allItems = [...urlMap.values()];

  console.log(
    "Found",
    allItems.length,
    "unique URLs across",
    searches.length,
    "cached searches"
  );

  await runPool(allItems, CONCURRENCY, async (item) => {
    await backfillItem(item);
  });

  console.log("Backfill complete.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Backfill failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});