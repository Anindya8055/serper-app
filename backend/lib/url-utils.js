function safeUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function getHostname(input) {
  const parsed = safeUrl(input);
  if (!parsed) return "";
  return parsed.hostname.replace(/^www\./, "").toLowerCase();
}

function getPathname(input) {
  const parsed = safeUrl(input);
  if (!parsed) return String(input || "").toLowerCase();
  return parsed.pathname.toLowerCase();
}

function isEditorialUrl(url) {
  return /review|reviews|article|articles|blog|blogs|news|post|posts|opinion|editorial|story|stories|features?|analysis|guide|guides|how-?to|learn|insights|research|commentary|columns?|archive|resources|recipe/i.test(
    String(url || "")
  );
}

function isEditorialPath(path) {
  const p = String(path || "").toLowerCase();

  if (p.includes("/blog") || p.startsWith("/blog")) return true;
  if (p.includes("/article") || p.includes("/stories")) return true;
  if (/learn|insights|research|commentary|columns?|archive|resources/i.test(p)) return true;

  const slug = p.split("/").filter(Boolean).pop() || "";
  const ideaWords = [
    "ideas",
    "tips",
    "guide",
    "how-to",
    "decor",
    "design",
    "forecast",
    "outlook",
    "prediction",
    "analysis",
    "review",
    "best",
    "top",
    "recipe",
  ];

  const hasIdeaWord = ideaWords.some((w) => slug.includes(w));
  if (!hasIdeaWord) return false;

  return slug.split("-").length >= 3;
}

function isCommerceUrl(url) {
  return /product|products|shop|store|cart|checkout|collections?|categories?|dpg|gp|buy|browse|\/dp\/|\/itm\/|\/ip\/|\/listing\/|\/p\/|product\.html|\/s\?|\/shop\/|\/en-us\/p\//i.test(
    String(url || "")
  );
}

function isStrongSmallBusinessPath(url) {
  const u = String(url || "").toLowerCase();
  return /\/services?\/?$|\/appointments?\/?$|\/book-appointment\/?$|\/pool-cleaning\/?$|\/individual-tax\/?$|\/business-tax\/?$|\/listings\/?$/.test(
    u
  );
}

function hasSmallBusinessNiche(text) {
  const t = String(text || "").toLowerCase();
  return /landscaping|landscape|dental|dentist|pool service|pool cleaning|barbershop|barber|realty|real estate|tax services|accounting|vet|veterinary|auto repair|clinic|salon|spa|plumbing|electrician|roofing|hvac|contractor|cleaning/i.test(
    t
  );
}

module.exports = {
  safeUrl,
  getHostname,
  getPathname,
  isEditorialUrl,
  isEditorialPath,
  isCommerceUrl,
  isStrongSmallBusinessPath,
  hasSmallBusinessNiche,
};