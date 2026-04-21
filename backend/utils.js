const { getDomain } = require("tldts");

const BLOCKED_DOMAINS = [
  "facebook.com","fb.com","instagram.com","threads.net","youtube.com","youtu.be",
  "reddit.com","redd.it","tiktok.com","x.com","twitter.com","linkedin.com",
  "pinterest.com","snapchat.com","telegram.org","whatsapp.com","discord.com","quora.com"
];

function normalizeUrl(url) {
  try { const parsed = new URL(url); parsed.hash = ""; return parsed.toString(); }
  catch { return null; }
}

function isBlockedUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch { return true; }
}

function cleanUrls(urls = []) {
  return [...new Set(urls.map(normalizeUrl).filter(Boolean).filter((url) => !isBlockedUrl(url)))];
}

function getBaseDomain(url) {
  try { const hostname = new URL(url).hostname; return getDomain(hostname) || hostname; }
  catch { return null; }
}

function buildHomepageUrl(domain) {
  if (!domain) return null;
  return `https://${domain}`;
}

function sameBaseDomain(urlA, urlB) {
  return getBaseDomain(urlA) && getBaseDomain(urlA) === getBaseDomain(urlB);
}

function pickImportantLinks(links = [], homepageUrl, limit = 5) {
  const priorityPatterns = [
    /about/i,/contact/i,/services?/i,/pricing/i,/features?/i,
    /products?/i,/shop/i,/store/i,/reviews?/i,/blog/i,
    /news/i,/directory/i,/companies/i,/businesses/i
  ];
  const filtered = links.filter((link) => {
    if (!link || !sameBaseDomain(link, homepageUrl)) return false;
    if (link === homepageUrl || link === `${homepageUrl}/`) return false;
    return !isBlockedUrl(link);
  });
  const scored = filtered.map((link) => {
    let score = 0;
    for (const pattern of priorityPatterns) { if (pattern.test(link)) score += 1; }
    return { link, score };
  });
  return [...new Set(scored.sort((a, b) => b.score - a.score).map((item) => item.link))].slice(0, limit);
}

module.exports = {
  BLOCKED_DOMAINS, normalizeUrl, isBlockedUrl, cleanUrls,
  getBaseDomain, buildHomepageUrl, sameBaseDomain, pickImportantLinks
};