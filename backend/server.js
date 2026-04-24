require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const prisma = require("./db");
const { analyzeDomain, extractPageData } = require("./analyzer");
const {
  classifyContentType,
  inferTypeFromSignals,
  normalizeType
} = require("./classifier");
const {
  cleanUrls,
  getBaseDomain,
  buildHomepageUrl
} = require("./utils");
const {
  closeBrowser,
  warmupPagePool,
  getPooledPage,
  releasePage
} = require("./browser");

const app = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://serper-app-3wyy.vercel.app"
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
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    console.warn("CORS blocked origin:", origin);
    console.warn("Allowed origins set:", Array.from(allowedOrigins));
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

const API_KEY = process.env.SERPER_API_KEY;
const PORT = process.env.PORT || 5000;
const TARGET_URL_COUNT = 50;
const MAX_PAGES = 15;
const DOMAIN_CONCURRENCY = 2;
const PAGE_CONCURRENCY = 2;
const SNAPSHOT_BATCH_SIZE = 3;

const activeJobs = new Map();

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || "none"}`);
  next();
});

async function runPool(items, concurrency, worker) {
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const currentIndex = index++;
      await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runner()
  );

  await Promise.all(workers);
}

async function updateSearchSnapshot(keyword, country, resultsSnapshot) {
  await prisma.search.update({
    where: {
      keyword_country: {
        keyword,
        country
      }
    },
    data: {
      resultsSnapshot
    }
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
    contentType: null,
    analyzedPages: [],
    analysisStatus: "pending",
    matchedSignals: ["Pending analysis"]
  };
}

async function analyzeSingleResult(item, domainMap) {
  const domainAnalysis = domainMap.get(item.domain);
  let fallbackReason = null;
  let page = null;

  try {
    page = await getPooledPage();

    const pageData = await extractPageData(page, item.url);

    const pageResult = inferTypeFromSignals({
      url: item.url,
      title: pageData.title || "",
      metaDescription: pageData.metaDescription || "",
      bodyText: pageData.bodyText || "",
      linksText: pageData.linksText || "",
      signals: {
        hasCart: !!pageData.hasCart,
        hasSearchAndFilter: !!pageData.hasSearchAndFilter,
        hasPhone: !!pageData.hasPhone,
        hasAddress: !!pageData.hasAddress,
        hasMap: !!pageData.hasMap,
        hasReviews: !!pageData.hasReviews,
        hasBusinessListingSchema: !!pageData.hasBusinessListingSchema,
        hasProductSchema: !!pageData.hasProductSchema,
        hasArticleSchema: !!pageData.hasArticleSchema
      },
      siteTypeHint: domainAnalysis?.siteType || null
    });

    return {
      ...item,
      siteType: normalizeType(
        domainAnalysis?.siteType || item.siteType || "Small business"
      ),
      contentType: normalizeType(pageResult.siteType),
      confidence:
        pageResult.confidence ||
        domainAnalysis?.confidence ||
        item.confidence ||
        "Low",
      matchedSignals: mergeMatchedSignals(
        domainAnalysis?.matchedSignals || [],
        pageResult.matchedSignals || [],
        [`Content analyzed from page: ${pageData.title || item.url}`]
      ),
      analyzedPages: [
        ...new Set([...(domainAnalysis?.analyzedPages || []), item.url])
      ],
      analysisStatus: "done"
    };
  } catch (error) {
    fallbackReason = error.message;
  } finally {
    if (page) {
      await releasePage(page).catch(() => {});
    }
  }

  const fallbackContentType = normalizeType(
    classifyContentType(item.url, {}, domainAnalysis?.siteType || null)
  );

  return {
    ...item,
    siteType: normalizeType(
      domainAnalysis?.siteType || item.siteType || "Small business"
    ),
    contentType: fallbackContentType,
    confidence: domainAnalysis?.confidence || item.confidence || "Low",
    matchedSignals: mergeMatchedSignals(
      domainAnalysis?.matchedSignals || [],
      [
        `Fallback: content type inferred from URL/site prior (${fallbackReason || "unknown error"})`
      ]
    ),
    analyzedPages: domainAnalysis?.analyzedPages || item.analyzedPages || [],
    analysisStatus: "done"
  };
}

async function runAnalysisInBackground(keyword, country) {
  const jobKey = `${keyword}::${country}`;
  if (activeJobs.has(jobKey)) return;

  const jobPromise = (async () => {
    try {
      const existing = await prisma.search.findUnique({
        where: {
          keyword_country: { keyword, country }
        }
      });

      if (!existing?.resultsSnapshot?.length) return;

      const results = [...existing.resultsSnapshot];
      const uniqueDomains = [
        ...new Set(results.map((item) => item.domain).filter(Boolean))
      ];
      const domainMap = new Map();

      await runPool(uniqueDomains, DOMAIN_CONCURRENCY, async (domain) => {
        const homepageUrl = buildHomepageUrl(domain);

        try {
          const analysis = await analyzeDomain(homepageUrl);
          domainMap.set(domain, analysis);
        } catch (error) {
          console.error(`Failed to analyze domain ${domain}:`, error.message);

          domainMap.set(domain, {
            domain,
            homepageUrl,
            siteType: "Small business",
            confidence: "Low",
            matchedSignals: [
              `Fallback: unable to analyze domain (${error.message})`
            ],
            analyzedPages: homepageUrl ? [homepageUrl] : []
          });
        }

        for (let i = 0; i < results.length; i++) {
          if (results[i].domain === domain) {
            results[i] = {
              ...results[i],
              siteType: normalizeType(
                domainMap.get(domain)?.siteType || "Small business"
              ),
              confidence:
                domainMap.get(domain)?.confidence ||
                results[i].confidence ||
                "Low",
              matchedSignals: mergeMatchedSignals(
                domainMap.get(domain)?.matchedSignals || [],
                results[i].matchedSignals || []
              ),
              analyzedPages: domainMap.get(domain)?.analyzedPages || [],
              analysisStatus: results[i].contentType ? "done" : "processing"
            };
          }
        }

        await updateSearchSnapshot(keyword, country, results);
      });

      let completed = 0;

      await runPool(results, PAGE_CONCURRENCY, async (item, index) => {
        const analyzedItem = await analyzeSingleResult(item, domainMap);
        results[index] = analyzedItem;
        completed++;

        if (
          completed % SNAPSHOT_BATCH_SIZE === 0 ||
          completed === results.length
        ) {
          await updateSearchSnapshot(keyword, country, results);
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
    allowedOrigins: Array.from(allowedOrigins)
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
        updatedAt: true
      }
    });

    return res.json(searches);
  } catch (error) {
    console.error("History route error:", error.message);
    return res.status(500).json({
      error: "Failed to load history",
      details: error.message
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
        keyword_country: { keyword, country }
      }
    });

    if (!search?.resultsSnapshot?.length) {
      return res.status(404).json({ error: "No search found" });
    }

    const results = search.resultsSnapshot;
    const doneCount = results.filter(
      (item) => item.analysisStatus === "done"
    ).length;
    const processingCount = results.filter(
      (item) => item.analysisStatus === "processing"
    ).length;
    const pendingCount = results.filter(
      (item) => item.analysisStatus === "pending"
    ).length;

    return res.json({
      keyword,
      country,
      total: results.length,
      analyzed: doneCount === results.length,
      doneCount,
      processingCount,
      pendingCount,
      results
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
    const existing = await prisma.search.findUnique({
      where: {
        keyword_country: { keyword, country }
      }
    });

    if (existing?.resultsSnapshot?.length) {
      const analyzed = existing.resultsSnapshot.every(
        (item) => item.analysisStatus === "done"
      );

      if (!analyzed) {
        void runAnalysisInBackground(keyword, country).catch((err) => {
          console.error("Background analysis restart failed:", err.message);
        });
      }

      return res.json({
        source: "cache",
        keyword,
        country,
        total: existing.resultsSnapshot.length,
        analyzed,
        results: existing.resultsSnapshot,
        statusUrl: `/api/search-status?keyword=${encodeURIComponent(
          keyword
        )}&country=${country}`
      });
    }

    let allUrls = [];
    let page = 1;

    while (allUrls.length < TARGET_URL_COUNT && page <= MAX_PAGES) {
      const response = await axios.post(
        "https://google.serper.dev/search",
        {
          q: keyword,
          page,
          gl: country
        },
        {
          headers: {
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );

      const results = response.data?.organic || [];
      const pageUrls = results.map((item) => item.link).filter(Boolean);

      allUrls.push(...pageUrls);
      allUrls = cleanUrls(allUrls);
      page++;
    }

    const finalUrls = allUrls.slice(0, TARGET_URL_COUNT);
    const quickResults = finalUrls.map(buildPendingResult);

    await prisma.search.upsert({
      where: {
        keyword_country: { keyword, country }
      },
      update: {
        resultsSnapshot: quickResults
      },
      create: {
        keyword,
        country,
        resultsSnapshot: quickResults
      }
    });

    void runAnalysisInBackground(keyword, country).catch((err) => {
      console.error("Background analysis failed:", err.message);
    });

    return res.status(202).json({
      source: "api",
      keyword,
      country,
      total: quickResults.length,
      analyzed: false,
      results: quickResults,
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(
        keyword
      )}&country=${country}`
    });
  } catch (error) {
    console.error("Search error status:", error.response?.status);
    console.error("Search error data:", error.response?.data);
    console.error("Search error message:", error.message);

    return res.status(500).json({
      error: "Something went wrong while fetching URLs",
      details: error.message
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
        keyword_country: { keyword, country }
      }
    });

    if (!existing?.resultsSnapshot?.length) {
      return res.status(404).json({
        error: "No search results found for this keyword and country"
      });
    }

    void runAnalysisInBackground(keyword, country).catch((err) => {
      console.error("Manual background analysis failed:", err.message);
    });

    return res.status(202).json({
      ok: true,
      message: "Analysis started",
      keyword,
      country,
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(
        keyword
      )}&country=${country}`
    });
  } catch (error) {
    console.error("Analyze trigger error:", error.message);

    return res.status(500).json({
      error: "Failed to start analysis",
      details: error.message
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
  warmupPagePool().catch((err) => {
    console.error("Page pool warmup failed:", err.message);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Allowed origins:", Array.from(allowedOrigins));
});