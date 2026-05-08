const DEFAULT_SITE_TYPES = [
  "Blog",
  "E-commerce",
  "Small business",
  "Newspaper",
  "Saas",
  "Directory",
  "Service",
];

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function createDomainIntelligence({
  exact = {},
  suffix = {},
  siteTypes = DEFAULT_SITE_TYPES,
} = {}) {
  const validTypes = new Set(siteTypes);

  function normalizeType(type) {
    return validTypes.has(type) ? type : "Small business";
  }

  function lookupExact(hostname) {
    const h = normalizeHostname(hostname);
    return exact[h] ? normalizeType(exact[h]) : null;
  }

  function lookupSuffix(hostname) {
    const h = normalizeHostname(hostname);
    if (!h) return null;

    for (const [suffixKey, type] of Object.entries(suffix)) {
      const key = normalizeHostname(suffixKey);
      if (!key) continue;
      if (h === key || h.endsWith(`.${key}`)) {
        return normalizeType(type);
      }
    }

    return null;
  }

  function getDomainPrior(hostname) {
    return lookupExact(hostname) || lookupSuffix(hostname) || null;
  }

  function isKnownRetailDomain(hostname) {
    const t = getDomainPrior(hostname);
    return t === "E-commerce";
  }

  function isInstitutionalDomain(hostname) {
    const d = normalizeHostname(hostname);

    if (!d) return false;
    if (d.endsWith(".gov") || d.endsWith(".mil") || d.endsWith(".edu")) return true;

    return /(^|\.)(fbi|cia|nsa|dhs|uscis|justice|treasury|irs|cdc|nih|nasa|noaa)(\.|$)/i.test(d) ||
      /\b(police|sheriff|county|city|state|court|courts|university|college|school)\b/i.test(d);
  }

  function isLargeFinancialInstitutionDomain(hostname) {
    const d = normalizeHostname(hostname);

    return /(^|\.)(schwab|goldmansachs|jpmorgan|morganstanley|blackrock|fidelity|vanguard|edwardjones|northwesternmutual|statefarm|truist|americancentury|wipfli|ml|bankofamerica|wellsfargo|chase|citibank|citibankonline|capitalone|ally|geico|allstate|progressive|aetna|cigna|prudential|metlife|nationwide)\.com$/i.test(
      d
    );
  }

  function isLikelyLocalBusinessDomain(hostname) {
    const d = normalizeHostname(hostname);
    if (!d) return false;
    if (isInstitutionalDomain(d)) return false;
    if (getDomainPrior(d)) return false;
    return /^[a-z0-9-]+\.(com|net|org|co|biz|us|ca|io)$/i.test(d);
  }

  return {
    DEFAULT_SITE_TYPES,
    normalizeHostname,
    normalizeType,
    getDomainPrior,
    isKnownRetailDomain,
    isInstitutionalDomain,
    isLargeFinancialInstitutionDomain,
    isLikelyLocalBusinessDomain,
  };
}

module.exports = {
  DEFAULT_SITE_TYPES,
  normalizeHostname,
  createDomainIntelligence,
};