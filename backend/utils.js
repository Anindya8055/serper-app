// utils.js

// If you still have tldts installed and want its behavior, you can reintroduce it.
// Right now getBaseDomain does its own parsing, so tldts is optional.
// const { getDomain } = require("tldts");

// 1) Blocked domains list
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
function isBlockedUrl(url, blockedDomains = BLOCKED_DOMAINS) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return blockedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return true;
  }
}

// 3) Normalize and dedupe URLs, while filtering blocked domains
function cleanUrls(urls = [], blockedDomains = BLOCKED_DOMAINS) {
  const seen = new Set();
  const cleaned = [];

  for (const raw of urls) {
    if (!raw) continue;

    try {
      const url = new URL(raw);

      const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      const normalized = `${url.protocol}//${hostname}${pathname}${url.search}`;

      if (isBlockedUrl(normalized, blockedDomains)) continue;

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

// 4) Base domain helper
function getBaseDomain(input) {
  try {
    const raw = String(input || "").trim();
    if (!raw) return "";

    const url = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(`https://${raw}`);

    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

// 5) Homepage URL builder
function buildHomepageUrl(domain) {
  const base = getBaseDomain(domain);
  return base ? `https://${base}` : "";
}

// 6) Important link picker
function pickImportantLinks(
  links = [],
  homepageUrl = "",
  blockedDomains = BLOCKED_DOMAINS
) {
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
    if (isBlockedUrl(link, blockedDomains)) continue;

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