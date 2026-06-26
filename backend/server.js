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
  mergeRuleBasedWithFastText,
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
  "https://serper-app-txvf.vercel.app",
  "https://search.yaaply.net",
  "http://search.yaaply.net",
  "https://search.bengalvoyagers.com",
  "http://search.bengalvoyagers.com",
  "http://tryserper.ddnsfree.com",
  "https://tryserper.ddnsfree.com",
  "http://152.42.222.12",
  "http://152.42.222.12:80",
]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return (
    origin.endsWith(".vercel.app") ||
    origin.includes("anindyac708-6432s-projects") ||
    origin.includes("serper-app")
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

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || "none"}`);
  next();
});

const API_KEY = process.env.SERPER_API_KEY;
const PORT = process.env.PORT || 5000;
const TARGET_URL_COUNT = 20;
const MAX_PAGES = 10;
const SERPER_TIMEOUT_MS = 12000;
const DOMAIN_CONCURRENCY = 3;
const PAGE_CONCURRENCY = 4;
const SNAPSHOT_BATCH_SIZE = 2;
const SKIP_DOMAIN_ANALYSIS_FOR_KNOWN_PRIORS = true;
const SKIP_PAGE_FETCH_FOR_KNOWN_PRIORS = true;
const MAX_DEEP_PAGE_ANALYSIS = 20;
const activeJobs = new Map();

async function updateSearchSnapshot(keyword, country, resultsSnapshot) {
  await prisma.search.update({
    where: { keyword_country: { keyword, country } },
    data: { resultsSnapshot },
  });
}

function mergeMatchedSignals(...signalGroups) {
  const seen = new Set();
  const result = [];
  for (const item of signalGroups.flat().filter(Boolean)) {
    const key = typeof item === "string" ? item : JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function buildPendingResult(url, serperTitle = "", serperSnippet = "") {
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
    dr: null,
    serperTitle: serperTitle || null,
    serperSnippet: serperSnippet || null,
  };
}

// Classify siteType from Serper title + snippet without any crawling.
// Returns { siteType, contentType, confidence } or null if not confident enough.
function classifyFromSnippet(url, title = "", snippet = "") {
  const text = `${title} ${snippet}`.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Strong e-commerce signals in title/snippet
  const ecomSignals = [
    /\bfree shipping\b/,
    /\badd to cart\b/,
    /\bbuy (now|online|today)\b/,
    /\bshop (now|online|our)\b/,
    /\b(from|starting at|only|just)\s+\$[\d,.]+/,
    /\$[\d,.]+\s*(usd|aud|gbp|cad)?/,
    /\b(order|checkout|purchase|in stock|out of stock)\b/,
    /\bfree returns?\b/,
    /\b\d+%\s*off\b/,
  ];

  // Strong blog/editorial signals
  const blogSignals = [
    /\b(best|top|review|reviewed|guide|how to|tips|advice|ranked|rated|recommended)\b/,
    /\b(expert|tested|opinion|analysis|comparison|vs\.?|versus)\b/,
    /\b(explained|everything you need|should you|worth it)\b/,
    /\b(article|post|written by|updated|published)\b/,
  ];

  // Strong forum signals
  const forumSignals = [
    /\b(forum|thread|reply|replies|posted by|discussion|community|members?)\b/,
    /\b(asked|answered|question|topic)\b/,
  ];

  // URL signals (very reliable)
  const isCommerceUrl = /\/collections\/|\/products?\/|\/shop\/|\/store\/|\/cart\/|\/checkout\/|\/buy\//i.test(lowerUrl);
  const isContentUrl = /\/blog\/|\/blogs\/|\/news\/|\/article\/|\/guide\/|\/review\/|\/forum\/|\/topic\//i.test(lowerUrl);

  const ecomScore = ecomSignals.filter(r => r.test(text)).length + (isCommerceUrl ? 3 : 0);
  const blogScore = blogSignals.filter(r => r.test(text)).length + (isContentUrl ? 2 : 0);
  const forumScore = forumSignals.filter(r => r.test(text)).length;

  const contentType = normalizeType(classifyContentType(url, null, null));

  if (isCommerceUrl && ecomScore >= 3) {
    return { siteType: "E-commerce", contentType, confidence: "High", source: "snippet+url" };
  }
  if (ecomScore >= 4) {
    return { siteType: "E-commerce", contentType, confidence: "High", source: "snippet" };
  }
  if (ecomScore >= 2 && blogScore === 0) {
    return { siteType: "E-commerce", contentType, confidence: "Medium", source: "snippet" };
  }
  if (forumScore >= 2 || (isContentUrl && forumSignals.some(r => r.test(text)))) {
    return { siteType: "Blog", contentType: "Blog", confidence: "High", source: "snippet+url" };
  }
  if (blogScore >= 3) {
    return { siteType: "Blog", contentType: "Blog", confidence: "Medium", source: "snippet" };
  }
  if (isContentUrl && blogScore >= 1) {
    return { siteType: "Blog", contentType: "Blog", confidence: "Medium", source: "snippet+url" };
  }

  return null; // not confident — fall through to normal crawl-based analysis
}

async function fetchDomainRating(domain) {
  try {
    const response = await axios.get(
      `https://api.ahrefs.com/v3/public/domain-rating-free?target=${encodeURIComponent(domain)}&output=json`,
      { headers: { Accept: "application/json" }, timeout: 8000 }
    );
    const dr = response.data?.domain_rating?.domain_rating;
    return typeof dr === "number" ? Math.round(dr) : null;
  } catch {
    return null;
  }
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
    return /listing|listings|directory|search|results|near-me|companies|businesses|providers|locations?/i.test(url);
  }

  if (knownPrior === "E-commerce") {
    const listingPattern =
      /product|products|shop|store|collections?|categories?|dp|gp|buy|\/s\?|\/c\/kp\/|\/site\/shop\/|\/b\//i;
    if (listingPattern.test(url)) return false;
    return true;
  }

  if (knownPrior === "Saas") {
    return /pricing|features|integrations|docs|documentation|api|product|platform/i.test(url);
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
    confidence: knownPrior ? "High" : (domainAnalysis?.confidence || "Low"),
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
      secondScore: typeof record.secondScore === "number" ? record.secondScore : null,
      scoreGap: typeof record.scoreGap === "number" ? record.scoreGap : null,
      needsReview: !!record.needsReview,
      pageSignals: safeJson(record.pageSignals, {}),
      ...(record.pageResults !== undefined ? { pageResults: record.pageResults } : {}),
      scores: record.scores ?? undefined,
      matchedSignals: safeJson(record.matchedSignals, []),
      ...(record.pageClassifications !== undefined
        ? { pageClassifications: record.pageClassifications }
        : {}),
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
      secondScore: typeof record.secondScore === "number" ? record.secondScore : null,
      scoreGap: typeof record.scoreGap === "number" ? record.scoreGap : null,
      needsReview: !!record.needsReview,
      pageSignals: safeJson(record.pageSignals, {}),
      ...(record.pageResults !== undefined ? { pageResults: record.pageResults } : {}),
      scores: record.scores ?? undefined,
      matchedSignals: safeJson(record.matchedSignals, []),
      ...(record.pageClassifications !== undefined
        ? { pageClassifications: record.pageClassifications }
        : {}),
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
      throw new Error("extractPageData returned null — site likely blocked headless browser");
    }

    // Platform fingerprint (Shopify, WooCommerce, etc.) — high-confidence shortcut.
    // Guard: if the SERP URL itself is a content page, don't inherit E-commerce siteType
    // from the domain fingerprint — let the normal classifier determine siteType from page content.
    const platformMatch = pageData._platformMatch;
    delete pageData._platformMatch;
    const serpUrlIsContent = /\/blog\/|\/blogs\/|\/news\/|\/article\/|\/articles\/|\/guide\/|\/review\/|\/reviews\/|\/post\/|\/posts\/|\/video\/|\/videos\/|\/select\/|\/picks\/|\/ranked\/|\/roundup\/|\/forum\/|\/opinion\//i.test(item.url);
    if (platformMatch && !(platformMatch.siteType === "E-commerce" && serpUrlIsContent)) {
      const platformSiteType = normalizeType(platformMatch.siteType);
      const platformContentType = normalizeType(
        classifyContentType(item.url, pageData, platformSiteType)
      );
      return {
        ...item,
        siteType: platformSiteType,
        contentType: platformContentType,
        confidence: "High",
        classifierVersion: CLASSIFIER_VERSION,
        matchedSignals: [
          `Platform fingerprint: ${platformMatch.platform}`,
          ...(knownPrior ? [`Known domain prior: ${knownPrior}`] : []),
        ],
        analyzedPages: [item.url],
        analysisStatus: "done",
        pageData,
      };
    }

    const lowerUrl = String(item.url || "").toLowerCase();
    const isHomepage = /^https?:\/\/[^/]+\/?$/.test(lowerUrl);
    const serpUrlIsShop = /\/collections\/|\/products?\/|\/shop\/|\/store\/|\/cart\/|\/checkout\/|\/buy\/|\/catalog\//i.test(lowerUrl);
    const serpUrlIsContentPage = /\/blog\/|\/blogs\/|\/news\/|\/article\/|\/articles\/|\/guide\/|\/review\/|\/reviews\/|\/post\/|\/posts\/|\/video\/|\/videos\/|\/select\/|\/picks\/|\/ranked\/|\/roundup\/|\/forum\/|\/opinion\/|\/best\//i.test(lowerUrl);

    // If the domain was classified as E-commerce purely from a Magento or WooCommerce fingerprint
    // on the homepage, don't blindly inherit that for SERP URLs that are clearly content pages.
    // Magento is used by many non-ecommerce sites; WooCommerce appears on blogs that sell nothing.
    const domainSignal = domainAnalysis?.matchedSignals?.[0] || "";
    const domainFromPlatformFP =
      domainAnalysis?.siteType === "E-commerce" &&
      (domainSignal === "Platform fingerprint: Magento" ||
       domainSignal === "Platform fingerprint: WooCommerce") &&
      !serpUrlIsShop &&
      (domainSignal === "Platform fingerprint: Magento" || serpUrlIsContentPage);
    const effectiveDomainSiteType = domainFromPlatformFP ? null : domainAnalysis?.siteType;

    const rulePageResult = inferTypeFromSignals(
      item.url,
      pageData.title ?? "",
      pageData.metaDescription ?? "",
      pageData.bodyText ?? "",
      pageData.linksText ?? "",
      pageData.schemaText ?? "",
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
      knownPrior || effectiveDomainSiteType || null
    );

    const fastTextResult = await classifyWithFastText(item.url, pageData);
    const mergedPageResult = mergeRuleBasedWithFastText(rulePageResult, fastTextResult);

    let resolvedSiteType = normalizeType(
      knownPrior || effectiveDomainSiteType || mergedPageResult.siteType || "Small business"
    );
    const isLikelyEditorialUrl =
      /\/blog\/|\/post\/|\/posts\/|\/article\/|\/articles\/|\/story\/|\/stories\/|\/news\/|\/guide\/|\/best\/|\/reviews?\/|videos?\//i.test(
        lowerUrl
      );
    const isLocalSite =
      resolvedSiteType === "Small business" || resolvedSiteType === "Service";

    const ruleBasedContentType = normalizeType(
      classifyContentType(item.url, pageData, resolvedSiteType)
    );

    let resolvedContentType = ruleBasedContentType;

    const mergedScoreGap =
      typeof mergedPageResult.scoreGap === "number" ? mergedPageResult.scoreGap : 999;
    const ruleUncertain =
      mergedPageResult.confidence === "Low" || mergedScoreGap < 6;

    if (
      mergedPageResult.usedFastTextForContent &&
      mergedPageResult.fastTextContentType
    ) {
      const contentFellBackToSiteType = ruleBasedContentType === resolvedSiteType;
      const allowLocalHomepageOverride = !isLocalSite || !isHomepage || isLikelyEditorialUrl;

      if (
        (ruleUncertain && allowLocalHomepageOverride) ||
        (contentFellBackToSiteType && allowLocalHomepageOverride)
      ) {
        resolvedContentType = mergedPageResult.fastTextContentType;
      }
    }

    resolvedContentType = normalizeType(resolvedContentType || resolvedSiteType);

    const fastTextSignals = [];
    if (fastTextResult?.sitePrediction) {
      const ftSiteProb = Number(fastTextResult.sitePrediction.probability || 0);
      fastTextSignals.push(
        `fastText siteType: ${fastTextResult.sitePrediction.siteType} @ ${(ftSiteProb * 100).toFixed(1)}%`
      );
    }
    if (fastTextResult?.contentPrediction) {
      const ftContentProb = Number(fastTextResult.contentPrediction.probability || 0);
      fastTextSignals.push(
        `fastText contentType: ${fastTextResult.contentPrediction.contentType} @ ${(ftContentProb * 100).toFixed(1)}%`
      );
    }

    const mergeSignals = [];
    if (mergedPageResult.usedFastTextForSite) {
      mergeSignals.push(`fastText applied to siteType due to uncertain rule result`);
    }
    if (
      mergedPageResult.usedFastTextForContent &&
      mergedPageResult.fastTextContentType &&
      resolvedContentType === mergedPageResult.fastTextContentType
    ) {
      mergeSignals.push(`fastText applied to contentType due to uncertain rule result`);
    }

    return {
      ...item,
      siteType: resolvedSiteType,
      contentType: resolvedContentType,
      confidence: mergedPageResult.confidence || domainAnalysis?.confidence || "Low",
      classifierVersion:
        mergedPageResult.classifierVersion ||
        domainAnalysis?.classifierVersion ||
        item.classifierVersion ||
        CLASSIFIER_VERSION,
      matchedSignals: mergeMatchedSignals(
        knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
        domainAnalysis?.matchedSignals || [],
        mergedPageResult.matchedSignals || [],
        fastTextSignals,
        mergeSignals,
        [`Content analyzed from page: ${pageData.title || ""} — ${item.url}`]
      ),
      analyzedPages: [...new Set([...(domainAnalysis?.analyzedPages || []), item.url])],
      analysisStatus: "done",
      pageData,
      pageResult: mergedPageResult,
      fastTextResult,
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
      confidence: knownPrior ? "High" : (domainAnalysis?.confidence || "Low"),
      classifierVersion:
        domainAnalysis?.classifierVersion ||
        item.classifierVersion ||
        CLASSIFIER_VERSION,
      matchedSignals: mergeMatchedSignals(
        knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
        domainAnalysis?.matchedSignals || [],
        [`Fallback — unable to fetch page: ${error.message}`]
      ),
      analyzedPages: domainAnalysis?.analyzedPages || item.analyzedPages || [],
      analysisStatus: "done",
      pageError: error.message,
    };
  }
}

async function runAnalysisInBackground(keyword, country) {
  const jobKey = `${keyword}|${country}`;
  if (activeJobs.has(jobKey)) return;

  const jobPromise = (async () => {
    try {
      const existing = await prisma.search.findUnique({
        where: { keyword_country: { keyword, country } },
      });

      if (!existing?.resultsSnapshot?.length) return;

      const results = [...existing.resultsSnapshot];

      // Phase 1: classify from Serper snippet before any crawling
      let snippetHits = 0;
      for (let i = 0; i < results.length; i++) {
        if (results[i].analysisStatus === "done") continue;
        const { serperTitle, serperSnippet, url } = results[i];
        if (!serperTitle && !serperSnippet) continue;
        const hit = classifyFromSnippet(url, serperTitle || "", serperSnippet || "");
        const urlIsContent = /\/blog\/|\/blogs\/|\/news\/|\/article\/|\/articles\/|\/story\/|\/guide\/|\/review\/|\/reviews\/|\/videos?\/|\/select\/|\/picks\/|\/ranked\/|\/roundup\/|\/post\/|\/forum\//i.test(url);
        // Accept Medium confidence when the URL itself is unambiguously a content page
        const acceptableHit = hit && (hit.confidence === "High" || (hit.confidence === "Medium" && urlIsContent));
        if (acceptableHit) {
          results[i] = {
            ...results[i],
            siteType: hit.siteType,
            contentType: hit.contentType,
            confidence: hit.confidence,
            analysisStatus: "done",
            matchedSignals: [`Snippet classifier: ${hit.source}`],
          };
          snippetHits++;
        }
      }
      if (snippetHits > 0) {
        console.log(`[snippet] Pre-classified ${snippetHits} URLs from Serper snippet`);
        await updateSearchSnapshot(keyword, country, results);
      }

      const uniqueDomains = [...new Set(results.map((item) => item.domain).filter(Boolean))];

      // Fetch DR first so it appears before content/site type analysis
      await runPool(uniqueDomains, 8, async (domain) => {
        const dr = await fetchDomainRating(domain);
        for (let i = 0; i < results.length; i++) {
          if (results[i].domain === domain) results[i] = { ...results[i], dr };
        }
      });
      await updateSearchSnapshot(keyword, country, results);

      const domainMap = new Map();

      await runPool(uniqueDomains, DOMAIN_CONCURRENCY, async (domain) => {
        const homepageUrl = buildHomepageUrl(domain);
        const knownPrior = getDomainPrior(domain);

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
          console.error(`Failed to analyze domain: ${domain}`, error.message);
          domainMap.set(domain, {
            domain,
            homepageUrl,
            siteType: knownPrior || "Small business",
            confidence: knownPrior ? "High" : "Low",
            classifierVersion: CLASSIFIER_VERSION,
            matchedSignals: [
              ...(knownPrior ? [`Known domain prior: ${knownPrior}`] : []),
              `Fallback — unable to analyze domain: ${error.message}`,
            ],
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

        const domainLevelContentType = normalizeType(
          classifyContentType(buildHomepageUrl(domain), null, da?.siteType || null)
        ) || null;

        await saveSiteAnalysis({
          url: homepageUrl,
          domain,
          homepageUrl,
          classifierVersion: da?.classifierVersion || CLASSIFIER_VERSION,
          fetchMethod:
            knownPrior && SKIP_DOMAIN_ANALYSIS_FOR_KNOWN_PRIORS
              ? "known-prior"
              : "domain-analysis",
          siteType: normalizeType(da?.siteType || "Small business"),
          contentType: domainLevelContentType,
          confidence: da?.confidence || "Low",
          topScore: typeof da?.topScore === "number" ? da.topScore : null,
          secondScore: typeof da?.secondScore === "number" ? da.secondScore : null,
          scoreGap: typeof da?.scoreGap === "number" ? da.scoreGap : null,
          needsReview: da?.confidence === "Low",
          pageSignals: {},
          pageResults: { domain, homepageUrl, pageTitles: da?.pageTitles || [] },
          scores: da?.scores ?? undefined,
          matchedSignals: da?.matchedSignals || [],
          pageClassifications: da?.pageClassifications || [],
          analyzedPages: da?.analyzedPages || [],
        });

        for (let i = 0; i < results.length; i++) {
          if (results[i].domain !== domain) continue;

          const prevStatus = results[i].analysisStatus;
          // Don't overwrite Phase 1 snippet classifications with weaker domain analysis
          if (prevStatus === "done") continue;
          const nextStatus = "processing";

          const intermediateContentType =
            results[i].contentType ||
            normalizeType(
              classifyContentType(results[i].url, null, da?.siteType || null)
            ) ||
            null;

          results[i] = {
            ...results[i],
            siteType: normalizeType(da?.siteType || "Small business"),
            confidence: da?.confidence || results[i].confidence || "Low",
            classifierVersion:
              da?.classifierVersion || results[i].classifierVersion || CLASSIFIER_VERSION,
            matchedSignals: mergeMatchedSignals(
              da?.matchedSignals || [],
              results[i].matchedSignals || []
            ),
            analyzedPages: da?.analyzedPages || [],
            analysisStatus: nextStatus,
            contentType: intermediateContentType,
          };
        }

        await updateSearchSnapshot(keyword, country, results);
      });

      let completed = 0;
      let deepCounter = 0;

      await runPool(results, PAGE_CONCURRENCY, async (item, index) => {
        try {
          if (item.analysisStatus === "done") return;
          const knownPrior = getDomainPrior(item.domain);
          const myDeepIndex = knownPrior ? MAX_DEEP_PAGE_ANALYSIS : deepCounter++;
          const analyzedItem = await analyzeSingleResult(item, domainMap, myDeepIndex);

          results[index] = {
            url: analyzedItem.url,
            domain: analyzedItem.domain,
            dr: results[index].dr ?? null,
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
            fetchMethod: analyzedItem.pageData ? "page-extract" : "fallback",
            siteType: analyzedItem.siteType || null,
            contentType: analyzedItem.contentType || null,
            confidence: analyzedItem.confidence || "Low",
            topScore:
              typeof analyzedItem.pageResult?.topScore === "number"
                ? analyzedItem.pageResult.topScore
                : null,
            secondScore:
              typeof analyzedItem.pageResult?.secondScore === "number"
                ? analyzedItem.pageResult.secondScore
                : null,
            scoreGap:
              typeof analyzedItem.pageResult?.scoreGap === "number"
                ? analyzedItem.pageResult.scoreGap
                : null,
            needsReview: analyzedItem.confidence === "Low",
            pageSignals: analyzedItem.pageData
              ? {
                  hasCart: !!analyzedItem.pageData.hasCart,
                  hasSearchAndFilter: !!analyzedItem.pageData.hasSearchAndFilter,
                  hasPhone: !!analyzedItem.pageData.hasPhone,
                  hasAddress: !!analyzedItem.pageData.hasAddress,
                  hasMap: !!analyzedItem.pageData.hasMap,
                  hasReviews: !!analyzedItem.pageData.hasReviews,
                  hasBusinessListingSchema: !!analyzedItem.pageData.hasBusinessListingSchema,
                  hasProductSchema: !!analyzedItem.pageData.hasProductSchema,
                  hasArticleSchema: !!analyzedItem.pageData.hasArticleSchema,
                }
              : {},
            pageResults: analyzedItem.pageData
              ? {
                  title: analyzedItem.pageData.title || "",
                  metaDescription: analyzedItem.pageData.metaDescription || "",
                  linksCount: Array.isArray(analyzedItem.pageData.links)
                    ? analyzedItem.pageData.links.length
                    : 0,
                  pageError: analyzedItem.pageError || null,
                  fastText: analyzedItem.fastTextResult || null,
                }
              : {
                  pageError: analyzedItem.pageError || null,
                  fastText: analyzedItem.fastTextResult || null,
                },
            scores: analyzedItem.pageResult?.scores ?? undefined,
            matchedSignals: analyzedItem.matchedSignals || [],
            pageClassifications: undefined,
            analyzedPages: analyzedItem.analyzedPages || [],
          });
        } catch (err) {
          console.error(`Page analysis failed for ${item?.url}:`, err.message);

          const knownPrior = (() => {
            try {
              return getDomainPrior(item?.domain);
            } catch {
              return null;
            }
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
              [`Outer fallback — page analysis threw: ${err.message}`]
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

const DEFAULT_DISABLED_DOMAINS = [
  "amazon.com","google.com","facebook.com","fb.com","instagram.com",
  "threads.net","youtube.com","youtu.be","reddit.com","redd.it",
  "tiktok.com","twitter.com","x.com","linkedin.com","pinterest.com",
  "snapchat.com","telegram.org","whatsapp.com","medium.com","tumblr.com","discord.com",
];

app.get("/api/disabled-domains", async (req, res) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "disabledDomains" } });
    const domains = setting ? setting.value : DEFAULT_DISABLED_DOMAINS;
    return res.json({ domains });
  } catch (error) {
    return res.json({ domains: DEFAULT_DISABLED_DOMAINS });
  }
});

app.post("/api/disabled-domains", async (req, res) => {
  try {
    const { domains } = req.body || {};
    if (!Array.isArray(domains)) return res.status(400).json({ error: "domains must be an array" });
    await prisma.appSetting.upsert({
      where: { key: "disabledDomains" },
      update: { value: domains },
      create: { key: "disabledDomains", value: domains },
    });
    return res.json({ ok: true, domains });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
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
      where: { keyword_country: { keyword, country } },
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
  let { keyword, country, limit, disabledDomains } = req.body || {};

  if (!API_KEY) {
    return res.status(500).json({ error: "SERPER_API_KEY is missing in .env" });
  }

  country = (country || "bd").toLowerCase();

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: "Keyword required" });
  }

  keyword = keyword.toLowerCase().trim();

  const ALLOWED_LIMITS = [10, 20, 50, 100];
  const targetCount = ALLOWED_LIMITS.includes(Number(limit)) ? Number(limit) : TARGET_URL_COUNT;

  const blockedSet = new Set(
    Array.isArray(disabledDomains)
      ? disabledDomains.map((d) => String(d).toLowerCase().trim()).filter(Boolean)
      : []
  );

  try {
    let allUrls = [];
    let page = 1;
    const urlSnippetMap = new Map();

    while (allUrls.length < targetCount && page <= MAX_PAGES) {
      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: keyword, page, gl: country },
        {
          headers: {
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json",
          },
          timeout: SERPER_TIMEOUT_MS,
        }
      );

      const pageResults = response.data?.organic || [];

      for (const item of pageResults) {
        if (item.link) {
          try {
            const u = new URL(item.link);
            const normalizedKey = `${u.protocol}//${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;
            urlSnippetMap.set(normalizedKey, { title: item.title || "", snippet: item.snippet || "" });
          } catch {}
          allUrls.push(item.link);
        }
      }

      allUrls = cleanUrls(allUrls);
      page++;

      if (!pageResults.length) break;
    }

    const fetchedUrls = allUrls.slice(0, targetCount);
    const filteredUrls = fetchedUrls.filter((url) => !blockedSet.has(getBaseDomain(url)));
    const blockedCount = fetchedUrls.length - filteredUrls.length;

    const quickResults = filteredUrls.map((url) => {
      const meta = urlSnippetMap.get(url) || {};
      return buildPendingResult(url, meta.title || "", meta.snippet || "");
    });

    await prisma.search.upsert({
      where: { keyword_country: { keyword, country } },
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
      blockedCount,
      analyzed: false,
      results: quickResults.map((r) => {
        if (debug) return r;
        const { matchedSignals, analyzedPages, ...clean } = r;
        return clean;
      }),
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(keyword)}&country=${country}`,
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
      where: { keyword_country: { keyword, country } },
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
      statusUrl: `/api/search-status?keyword=${encodeURIComponent(keyword)}&country=${country}`,
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