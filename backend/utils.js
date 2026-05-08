// utils.js

// If you still have tldts installed and want its behavior, you can reintroduce it.
// Right now getBaseDomain does its own parsing, so tldts is optional.
// const { getDomain } = require("tldts");

// 1) Blocked domains list (restored)
const BLOCKED_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "threads.net",
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "redd.it",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
  "telegram.org",
  "whatsapp.com",
  "discord.com",
  "quora.com",
];

// 2) Helper: check if URL should be blocked
function isBlockedUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return BLOCKED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    // If URL is invalid, safest is to treat as blocked for SERP purposes
    return true;
  }
}

// 3) Normalize and dedupe URLs, while filtering blocked domains
function cleanUrls(urls = []) {
  const seen = new Set();
  const cleaned = [];

  for (const raw of urls) {
    if (!raw) continue;

    try {
      const url = new URL(raw);

      // Basic normalization like your “new” version
      const hostname = url.hostname.replace(/^www\./, "");
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      const normalized = `${url.protocol}//${hostname}${pathname}${url.search}`;

      // Apply blocked-domain filtering here
      if (isBlockedUrl(normalized)) continue;

      if (!seen.has(normalized)) {
        seen.add(normalized);
        cleaned.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return cleaned;
}

// 4) Base domain helper (keeps your updated logic)
function getBaseDomain(input) {
  try {
    const url = input.startsWith("http")
      ? new URL(input)
      : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return String(input || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

// 5) Homepage URL builder
function buildHomepageUrl(domain) {
  const base = getBaseDomain(domain);
  return `https://${base}`;
}

// 6) Important link picker (keeps your newer scoring, adds blocking)
function pickImportantLinks(links = [], homepageUrl = "") {
  const homepageDomain = getBaseDomain(homepageUrl);

  const priorityPatterns = [
    /about/i,
    /services?/i,
    /products?/i,
    /pricing/i,
    /features/i,
    /solutions?/i,
    /shop/i,
    /store/i,
    /category/i,
    /collections?/i,
    /blog/i,
    /news/i,
    /article/i,
    /post/i,
    /directory/i,
    /listing/i,
    /companies/i,
    /business/i,
    /locations?/i,
    /contact/i,
  ];

  const scored = [];

  for (const link of links) {
    if (!link) continue;
    if (isBlockedUrl(link)) continue; // do not follow internal links to blocked domains

    try {
      const url = new URL(link);
      const domain = getBaseDomain(url.href);
      if (domain !== homepageDomain) continue;

      const href = url.href;
      const path = `${url.pathname}${url.search}`.toLowerCase();

      let score = 0;

      for (const pattern of priorityPatterns) {
        if (pattern.test(path)) score += 1;
      }

      if (path === "/" || path === "") score -= 5;
      if (/privacy|terms|login|signin|signup|account|cart|checkout/i.test(path)) {
        score -= 3;
      }

      scored.push({ href, score });
    } catch {
      continue;
    }
  }

  return [...new Set(scored.sort((a, b) => b.score - a.score).map((x) => x.href))];
}

// 7) Concurrency helper
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

module.exports = {
  BLOCKED_DOMAINS,
  isBlockedUrl,
  cleanUrls,
  getBaseDomain,
  buildHomepageUrl,
  pickImportantLinks,
  runPool,
};