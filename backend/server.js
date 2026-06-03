require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const prisma = require("./db");
const { analyzeDomain, extractPageData } = require("./analyzer");
const {
  classifyContentType,
  inferTypeFromSignals,
  normalizeType,
  getDomainPrior,
  classifyWithFastText,
} = require("./classifier");
const {
  cleanUrls,
  getBaseDomain,
  buildHomepageUrl,
  runPool,
} = require("./utils");
const { closeBrowser, warmupPagePool } = require("./browser");

const CLASSIFIER_VERSION = "classifier_v1";

const app = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://serper-app-3wyy.vercel.app",
]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return (
    origin.endsWith(".vercel.app") &&
    origin.includes("anindyac708-6432s-projects")
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn("CORS blocked origin:", origin);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

const API_KEY = process.env.SERPER_API_KEY;
const PORT = process.env.PORT || 5000;

const TARGET_URL_COUNT = 20;
const MAX_PAGES = 10;
const SERPER_TIMEOUT_MS = 12000;

const DOMAIN_CONCURRENCY = 4;
const PAGE_CONCURRENCY = 5;
const SNAPSHOT_BATCH_SIZE = 5;

const SKIP_DOMAIN_ANALYSIS_FOR_KNOWN_PRIORS = true;
const SKIP_PAGE_FETCH_FOR_KNOWN_PRIORS = false;
const MAX_DEEP_PAGE_ANALYSIS = 20;

const activeJobs = new Map();

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || "none"}`);
  next();
});

async function updateSearchSnapshot(keyword, country, resultsSnapshot) {
  await prisma.search.update({
    where: { keyword_country: { keyword, country } },
    data: { resultsSnapshot },
  });
}

function mergeMatchedSignals(...signalGroups) {
  return [...new Set(signalGroups.flat().filter(Boolean))];
}

function buildPendingResult(url) {
  return {
    url,
    domain: getBaseDomain(url),
    siteType: null,
    confidence: "Low",
    classifierVersion: CLASSIFIER_VERSION,
    contentType: null,
    analyzedPages: [],
    analysisStatus: "pending",
    matchedSignals: ["Pending analysis"],
  };
}

function buildKnownPriorDomainAnalysis(domain, knownPrior) {
  return {
    domain,
    homepageUrl: buildHomepageUrl(domain),
    siteType: knownPrior,
    confidence: "High",
    classifierVersion: CLASSIFIER_VERSION,
    matchedSignals: [
      `Known domain prior: ${knownPrior}`,
      "Domain fetch skipped because prior is trusted",
    ],
    analyzedPages: [],
    pageClassifications: [],
    scores: null,
    topScore: null,
    secondScore: null,
    scoreGap: null,
    pageTitles: [],
  };
}

function shouldDoDeepPageAnalysis(item, knownPrior) {
  if (!item?.url) return false;
  if (!knownPrior) return true;
  if (!SKIP_PAGE_FETCH_FOR_KNOWN_PRIORS) return true;

  const url = item.url.toLowerCase();

  if (knownPrior === "Directory") {
    return /listing|listings|directory|search|results|near-me|companies|businesses|providers|locations?/i.test(
      url
    );
  }

  if (knownPrior === "E-commerce") {
    const listingPattern =
      /product|products|shop|store|collections?|categories?|dp|gp|buy|\/s\?|\/c\/kp\/|\/site\/shop\/|\/b\//i;
    if (listingPattern.test(url)) {
      return false;
    }
    return true;
  }

  if (knownPrior === "Saas") {
    return /pricing|features|integrations|docs|documentation|api|product|platform/i.test(
      url
    );
  }

  return false;
}

function quickClassifyWithoutFetch(item, domainAnalysis, knownPrior) {
  const effectiveType = knownPrior || domainAnalysis?.siteType || null;
  const contentType = normalizeType(
    classifyContentType(item.url, null, effectiveType)
  );

  return {
    ...item,
    siteType: normalizeType(effectiveType || "Small business"),
    contentType,
    confidence: knownPrior ? "High" : domainAnalysis?.confidence || "Low",
    classifierVersion:
      domainAnalysis?.classifierVersion ||
      item.classifierVersion ||
      CLASSIFIER_VERSION,
    matchedSignals: mergeMatchedSignals(
      knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
      domainAnalysis?.matchedSignals || [],
      ["Quick classification without page fetch"]
    ),
    analyzedPages: domainAnalysis?.analyzedPages || [],
    analysisStatus: "done",
  };
}

function safeJson(value, fallback) {
  return value === undefined ? fallback : value;
}

async function saveSiteAnalysis(record) {
  if (!record?.url) return;

  await prisma.siteAnalysis.upsert({
    where: { url: record.url },
    create: {
      url: record.url,
      domain: record.domain,
      homepageUrl: record.homepageUrl || null,
      classifierVersion: record.classifierVersion || CLASSIFIER_VERSION,
      fetchMethod: record.fetchMethod || null,
      siteType: record.siteType || null,
      contentType: record.contentType || null,
      confidence: record.confidence || null,
      topScore: typeof record.topScore === "number" ? record.topScore : null,
      secondScore:
        typeof record.secondScore === "number" ? record.secondScore : null,
      scoreGap: typeof record.scoreGap === "number" ? record.scoreGap : null,
      needsReview: !!record.needsReview,
      pageSignals: safeJson(record.pageSignals, {}),
      pageResults: record.pageResults ?? undefined,
      scores: record.scores ?? undefined,
      matchedSignals: safeJson(record.matchedSignals, []),
      pageClassifications: record.pageClassifications ?? undefined,
      analyzedPages: safeJson(record.analyzedPages, []),
    },
    update: {
      domain: record.domain,
      homepageUrl: record.homepageUrl || null,
      classifierVersion: record.classifierVersion || CLASSIFIER_VERSION,
      fetchMethod: record.fetchMethod || null,
      siteType: record.siteType || null,
      contentType: record.contentType || null,
      confidence: record.confidence || null,
      topScore: typeof record.topScore === "number" ? record.topScore : null,
      secondScore:
        typeof record.secondScore === "number" ? record.secondScore : null,
      scoreGap: typeof record.scoreGap === "number" ? record.scoreGap : null,
      needsReview: !!record.needsReview,
      pageSignals: safeJson(record.pageSignals, {}),
      pageResults: record.pageResults ?? undefined,
      scores: record.scores ?? undefined,
      matchedSignals: safeJson(record.matchedSignals, []),
      pageClassifications: record.pageClassifications ?? undefined,
      analyzedPages: safeJson(record.analyzedPages, []),
    },
  });
}

async function analyzeSingleResult(item, domainMap, deepIndex = 0) {
  const domainAnalysis = domainMap.get(item.domain);
  const knownPrior = getDomainPrior(item.domain);

  const doDeepFetch =
    deepIndex < MAX_DEEP_PAGE_ANALYSIS &&
    shouldDoDeepPageAnalysis(item, knownPrior);

  if (!doDeepFetch) {
    return quickClassifyWithoutFetch(item, domainAnalysis, knownPrior);
  }

  try {
    const pageData = await extractPageData(null, item.url);

    if (!pageData) {
      throw new Error("extractPageData returned null (site likely blocked headless browser)");
    }

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
      knownPrior || domainAnalysis?.siteType || null
    );

    const fastTextResult = await classifyWithFastText(item.url, pageData);

    const ruleBasedSiteType = normalizeType(
      knownPrior ||
        domainAnalysis?.siteType ||
        pageResult.siteType ||
        "Small business"
    );

    const fastTextSiteType = normalizeType(
      fastTextResult?.sitePrediction?.siteType || ""
    );

    const resolvedSiteType = normalizeType(
      ruleBasedSiteType ||
      fastTextSiteType ||
      "Small business"
    );

    const ruleBasedContentType = normalizeType(
      classifyContentType(item.url, pageData, resolvedSiteType)
    );

    const fastTextContentType = normalizeType(
      fastTextResult?.contentPrediction?.contentType || ""
    );

    const resolvedContentType = normalizeType(
      ruleBasedContentType ||
      fastTextContentType ||
      resolvedSiteType
    );

    return {
      ...item,
      siteType: resolvedSiteType,
      contentType: resolvedContentType,
      confidence: pageResult.confidence || domainAnalysis?.confidence || "Low",
      classifierVersion:
        pageResult.classifierVersion ||
        domainAnalysis?.classifierVersion ||
        item.classifierVersion ||
        CLASSIFIER_VERSION,
      matchedSignals: mergeMatchedSignals(
        knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
        domainAnalysis?.matchedSignals || [],
        pageResult.matchedSignals || [],
        fastTextResult?.sitePrediction
          ? [
              `fastText siteType: ${fastTextResult.sitePrediction.siteType} (${(
                (fastTextResult.sitePrediction.probability || 0) * 100
              ).toFixed(1)}%)`,
            ]
          : [],
        fastTextResult?.contentPrediction
          ? [
              `fastText contentType: ${fastTextResult.contentPrediction.contentType} (${(
                (fastTextResult.contentPrediction.probability || 0) * 100
              ).toFixed(1)}%)`,
            ]
          : [],
        [`Content analyzed from page: ${pageData.title || item.url}`]
      ),
      analyzedPages: [
        ...new Set([...(domainAnalysis?.analyzedPages || []), item.url]),
      ],
      analysisStatus: "done",
      _pageData: pageData,
      _pageResult: pageResult,
      _fastTextResult: fastTextResult,
    };
  } catch (error) {
    const effectiveType = knownPrior || domainAnalysis?.siteType || null;
    const fallbackContentType = normalizeType(
      classifyContentType(item.url, null, effectiveType)
    );

    return {
      ...item,
      siteType: normalizeType(effectiveType || "Small business"),
      contentType: fallbackContentType,
      confidence: knownPrior ? "High" : domainAnalysis?.confidence || "Low",
      classifierVersion:
        domainAnalysis?.classifierVersion ||
        item.classifierVersion ||
        CLASSIFIER_VERSION,
      matchedSignals: mergeMatchedSignals(
        knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
        domainAnalysis?.matchedSignals || [],
        [`Fallback: unable to fetch page (${error.message})`]
      ),
      analyzedPages: domainAnalysis?.analyzedPages || item.analyzedPages || [],
      analysisStatus: "done",
      _pageError: error.message,
    };
  }
}

async function runAnalysisInBackground(keyword, country) {
  const jobKey = `${keyword}::${country}`;
  if (activeJobs.has(jobKey)) return;

  const jobPromise = (async () => {
    try {
      const existing = await prisma.search.findUnique({
        where: { keyword_country: { keyword, country } },
      });

      if (!existing?.resultsSnapshot?.length) return;

      const results = [...existing.resultsSnapshot];
      const uniqueDomains = [
        ...new Set(results.map((item) => item.domain).filter(Boolean)),
      ];
      const domainMap = new Map();

      await runPool(uniqueDomains, DOMAIN_CONCURRENCY, async (domain) => {
        const homepageUrl = buildHomepageUrl(domain);
        const knownPrior = getDomainPrior(domain);
        let domainFailed = false;

        try {
          if (knownPrior && SKIP_DOMAIN_ANALYSIS_FOR_KNOWN_PRIORS) {
            domainMap.set(domain, buildKnownPriorDomainAnalysis(domain, knownPrior));
          } else {
            const analysis = await analyzeDomain(homepageUrl);

            domainMap.set(domain, {
              ...analysis,
              siteType: knownPrior || analysis.siteType,
              confidence: knownPrior ? "High" : analysis.confidence,
              classifierVersion: analysis.classifierVersion || CLASSIFIER_VERSION,
              matchedSignals: mergeMatchedSignals(
                knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
                analysis.matchedSignals || []
              ),
            });
          }
        } catch (error) {
          console.error(`Failed to analyze domain ${domain}:`, error.message);
          domainFailed = true;

          domainMap.set(domain, {
            domain,
            homepageUrl,
            siteType: knownPrior || "Small business",
            confidence: knownPrior ? "High" : "Low",
            classifierVersion: CLASSIFIER_VERSION,
            matchedSignals: knownPrior
              ? [`Known domain prior: ${knownPrior}`]
              : [`Fallback: unable to analyze domain (${error.message})`],
            analyzedPages: [],
            pageClassifications: [],
            scores: null,
            topScore: null,
            secondScore: null,
            scoreGap: null,
            pageTitles: [],
          });
        }

        const da = domainMap.get(domain);

        await saveSiteAnalysis({
          url: homepageUrl,
          domain,
          homepageUrl,
          classifierVersion: da?.classifierVersion || CLASSIFIER_VERSION,
          fetchMethod:
            knownPrior && SKIP_DOMAIN_ANALYSIS_FOR_KNOWN_PRIORS
              ? "known_prior"
              : "domain_analysis",
          siteType: normalizeType(da?.siteType || "Small business"),
          contentType: null,
          confidence: da?.confidence || "Low",
          topScore: typeof da?.topScore === "number" ? da.topScore : null,
          secondScore: typeof da?.secondScore === "number" ? da.secondScore : null,
          scoreGap: typeof da?.scoreGap === "number" ? da.scoreGap : null,
          needsReview: (da?.confidence || "Low") === "Low",
          pageSignals: {},
          pageResults: {
            domain,
            homepageUrl,
            pageTitles: da?.pageTitles || [],
          },
          scores: da?.scores ?? undefined,
          matchedSignals: da?.matchedSignals || [],
          pageClassifications: da?.pageClassifications || [],
          analyzedPages: da?.analyzedPages || [],
        });

        for (let i = 0; i < results.length; i++) {
          if (results[i].domain !== domain) continue;

          const prevStatus = results[i].analysisStatus || "pending";
          let nextStatus;

          if (prevStatus === "done") {
            nextStatus = "done";
          } else if (domainFailed) {
            nextStatus = "processing";
          } else {
            nextStatus = "processing";
          }

          results[i] = {
            ...results[i],
            siteType: normalizeType(da?.siteType || "Small business"),
            confidence: da?.confidence || results[i].confidence || "Low",
            classifierVersion:
              da?.classifierVersion ||
              results[i].classifierVersion ||
              CLASSIFIER_VERSION,
            matchedSignals: mergeMatchedSignals(
              da?.matchedSignals || [],
              results[i].matchedSignals || []
            ),
            analyzedPages: da?.analyzedPages || [],
            analysisStatus: nextStatus,
          };
        }
      });

      await updateSearchSnapshot(keyword, country, results);

      let completed = 0;
      let deepCounter = 0;

      await runPool(results, PAGE_CONCURRENCY, async (item, index) => {
        try {
          const knownPrior = getDomainPrior(item.domain);
          const myDeepIndex = knownPrior ? MAX_DEEP_PAGE_ANALYSIS : deepCounter++;

          const analyzedItem = await analyzeSingleResult(item, domainMap, myDeepIndex);

          results[index] = {
            url: analyzedItem.url,
            domain: analyzedItem.domain,
            siteType: analyzedItem.siteType,
            confidence: analyzedItem.confidence,
            classifierVersion: analyzedItem.classifierVersion,
            contentType: analyzedItem.contentType,
            analyzedPages: analyzedItem.analyzedPages,
            analysisStatus: "done",
            matchedSignals: analyzedItem.matchedSignals,
          };

          await saveSiteAnalysis({
            url: analyzedItem.url,
            domain: analyzedItem.domain,
            homepageUrl: buildHomepageUrl(analyzedItem.domain),
            classifierVersion: analyzedItem.classifierVersion || CLASSIFIER_VERSION,
            fetchMethod: analyzedItem._pageData ? "page_extract" : "fallback",
            siteType: analyzedItem.siteType || null,
            contentType: analyzedItem.contentType || null,
            confidence: analyzedItem.confidence || "Low",
            topScore:
              typeof analyzedItem._pageResult?.topScore === "number"
                ? analyzedItem._pageResult.topScore
                : null,
            secondScore:
              typeof analyzedItem._pageResult?.secondScore === "number"
                ? analyzedItem._pageResult.secondScore
                : null,
            scoreGap:
              typeof analyzedItem._pageResult?.scoreGap === "number"
                ? analyzedItem._pageResult.scoreGap
                : null,
            needsReview: (analyzedItem.confidence || "Low") === "Low",
            pageSignals: analyzedItem._pageData
              ? {
                  hasCart: !!analyzedItem._pageData.hasCart,
                  hasSearchAndFilter: !!analyzedItem._pageData.hasSearchAndFilter,
                  hasPhone: !!analyzedItem._pageData.hasPhone,
                  hasAddress: !!analyzedItem._pageData.hasAddress,
                  hasMap: !!analyzedItem._pageData.hasMap,
                  hasReviews: !!analyzedItem._pageData.hasReviews,
                  hasBusinessListingSchema:
                    !!analyzedItem._pageData.hasBusinessListingSchema,
                  hasProductSchema: !!analyzedItem._pageData.hasProductSchema,
                  hasArticleSchema: !!analyzedItem._pageData.hasArticleSchema,
                }
              : {},
            pageResults: analyzedItem._pageData
              ? {
                  title: analyzedItem._pageData.title || "",
                  metaDescription: analyzedItem._pageData.metaDescription || "",
                  linksCount: Array.isArray(analyzedItem._pageData.links)
                    ? analyzedItem._pageData.links.length
                    : 0,
                  pageError: analyzedItem._pageError || null,
                  fastText: analyzedItem._fastTextResult || null,
                }
              : {
                  pageError: analyzedItem._pageError || null,
                  fastText: analyzedItem._fastTextResult || null,
                },
            scores: analyzedItem._pageResult?.scores ?? undefined,
            matchedSignals: analyzedItem.matchedSignals || [],
            pageClassifications: undefined,
            analyzedPages: analyzedItem.analyzedPages || [],
          });
        } catch (err) {
          console.error(`Page analysis failed for ${item?.url}:`, err.message);

          const knownPrior = (() => {
            try { return getDomainPrior(item?.domain); } catch { return null; }
          })();
          const domainAnalysis = domainMap.get(item?.domain);
          const effectiveType = knownPrior || domainAnalysis?.siteType || null;

          const fallbackSiteType = normalizeType(effectiveType || "Small business");
          const fallbackContentType = normalizeType(
            (() => {
              try {
                return classifyContentType(item?.url || "", null, effectiveType);
              } catch {
                return effectiveType || "Small business";
              }
            })()
          );

          results[index] = {
            url: item?.url || "",
            domain: item?.domain || "",
            siteType: fallbackSiteType,
            contentType: fallbackContentType,
            confidence: knownPrior ? "High" : "Low",
            classifierVersion: CLASSIFIER_VERSION,
            analyzedPages: domainAnalysis?.analyzedPages || [],
            analysisStatus: "done",
            matchedSignals: mergeMatchedSignals(
              knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
              domainAnalysis?.matchedSignals || [],
              [`Outer fallback: page analysis threw (${err.message})`]
            ),
          };
        } finally {
          completed++;
          if (completed % SNAPSHOT_BATCH_SIZE === 0 || completed === results.length) {
            await updateSearchSnapshot(keyword, country, results);
          }
        }
      });

      await updateSearchSnapshot(keyword, country, results);
    } catch (error) {
      console.error("Background analysis job failed:", error.message);
    } finally {
      activeJobs.delete(jobKey);
    }
  })();

  activeJobs.set(jobKey, jobPromise);
}

app.get("/api/debug", (req, res) => {
  res.json({
    ok: true,
    origin: req.headers.origin || null,
    allowedOrigins: Array.from(allowedOrigins),
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Health route error:", error.message);
    return res.status(500).json({ ok: false, database: "disconnected" });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const searches = await prisma.search.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        keyword: true,
        country: true,
        resultsSnapshot: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(searches);
  } catch (error) {
    console.error("History route error:", error.message);
    return res.status(500).json({
      error: "Failed to load history",
      details: error.message,
    });
  }
});

app.get("/api/search-status", async (req, res) => {
  const keyword = String(req.query.keyword || "").toLowerCase().trim();
  const country = String(req.query.country || "bd").toLowerCase();

  if (!keyword) {
    return res.status(400).json({ error: "Keyword required" });
  }

  try {
    const search = await prisma.search.findUnique({
      where: {
        keyword_country: { keyword, country },
      },
    });

    if (!search?.resultsSnapshot?.length) {
      return res.status(404).json({ error: "No search found" });
    }

    const results = search.resultsSnapshot;
    const doneCount = results.filter((r) => r.analysisStatus === "done").length;
    const errorCount = results.filter((r) => r.analysisStatus === "error").length;
    const processingCount = results.filter((r) => r.analysisStatus === "processing").length;
    const pendingCount = results.filter((r) => r.analysisStatus === "pending").length;

    const debug = req.query.debug === "true";

    return res.json({
      keyword,
      country,
      total: results.length,
      analyzed: processingCount === 0 && pendingCount === 0,
      doneCount,
      errorCount,
      processingCount,
      pendingCount,
      results: results.map((r) => {
        if (debug) return r;
        const { matchedSignals, analyzedPages, ...clean } = r;
        return clean;
      }),
    });
  } catch (error) {
    console.error("Status route error:", error.message);
    return res.status(500).json({ error: "Failed to fetch status" });
  }
});

app.post("/api/search", async (req, res) => {
  let { keyword, country } = req.body || {};

  if (!API_KEY) {
    return res.status(500).json({ error: "SERPER_API_KEY is missing in .env" });
  }

  country = (country || "bd").toLowerCase();

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: "Keyword required" });
  }

  keyword = keyword.toLowerCase().trim();

  try {
    let allUrls = [];
    let page = 1;

    while (allUrls.length < TARGET_URL_COUNT && page <= MAX_PAGES) {
      const response = await axios.post(
        "https://google.serper.dev/search",
        {
          q: keyword,
          page,
          gl: country,
        },
        {
          headers: {
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json",
          },
          timeout: SERPER_TIMEOUT_MS,
        }
      );

      const pageResults = response.data?.organic || [];
      const pageUrls = pageResults.map((item) => item.link).filter(Boolean);

      allUrls.push(...pageUrls);
      allUrls = cleanUrls(allUrls);
      page++;

      if (!pageResults.length) break;
    }

    const finalUrls = allUrls.slice(0, TARGET_URL_COUNT);
    const quickResults = finalUrls.map(buildPendingResult);

    await prisma.search.upsert({
      where: {
        keyword_country: { keyword, country },
      },
      update: { resultsSnapshot: quickResults },
      create: { keyword, country, resultsSnapshot: quickResults },
    });

    void runAnalysisInBackground(keyword, country).catch((err) =>
      console.error("Background analysis failed:", err.message)
    );

    const debug = req.body?.debug === true;

    return res.status(202).json({
      source: "api",
      keyword,
      country,
      total: quickResults.length,
      analyzed: false,
      results: quickResults.map((r) => {
        if (debug) return r;
        const { matchedSignals, analyzedPages, ...clean } = r;
        return clean;
      }),
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(
        keyword
      )}&country=${country}`,
    });
  } catch (error) {
    console.error("Search error:", error.response?.status, error.message);
    return res.status(500).json({
      error: "Something went wrong while fetching URLs",
      details: error.message,
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  let { keyword, country } = req.body || {};

  country = (country || "bd").toLowerCase();

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: "Keyword required" });
  }

  keyword = keyword.toLowerCase().trim();

  try {
    const existing = await prisma.search.findUnique({
      where: {
        keyword_country: { keyword, country },
      },
    });

    if (!existing?.resultsSnapshot?.length) {
      return res.status(404).json({
        error: "No search results found for this keyword and country",
      });
    }

    void runAnalysisInBackground(keyword, country).catch((err) =>
      console.error("Manual background analysis failed:", err.message)
    );

    return res.status(202).json({
      ok: true,
      message: "Analysis started",
      keyword,
      country,
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(
        keyword
      )}&country=${country}`,
    });
  } catch (error) {
    console.error("Analyze trigger error:", error.message);
    return res.status(500).json({
      error: "Failed to start analysis",
      details: error.message,
    });
  }
});

process.on("SIGINT", async () => {
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
});

if (process.env.ENABLE_BROWSER_WARMUP === "true") {
  warmupPagePool(1).catch((err) =>
    console.error("Page pool warmup failed:", err.message)
  );
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Allowed origins:", Array.from(allowedOrigins));
});