// backend/classifier/helpers.js
const {
  createDomainIntelligence,
  DEFAULT_SITE_TYPES,
} = require("../lib/domain-intelligence");

const fs = require("fs");
const path = require("path");

function loadJson(relativePath) {
  const filePath = path.join(__dirname, "..", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const EXACT = loadJson("./config/domain-priors/exact.json");
const SUFFIX = loadJson("./config/domain-priors/suffix.json");

const domainIntel = createDomainIntelligence({
  exact: EXACT,
  suffix: SUFFIX,
  siteTypes: DEFAULT_SITE_TYPES,
});

const SITETYPES = [...DEFAULT_SITE_TYPES];

function normalizeType(type) {
  return domainIntel.normalizeType(type);
}

function getDomainPrior(domain) {
  return domainIntel.getDomainPrior(domain);
}

function createScores() {
  return {
    Blog: 0,
    "E-commerce": 0,
    "Small business": 0,
    Newspaper: 0,
    Saas: 0,
    Directory: 0,
    Service: 0,
  };
}

function addScore(scores, matchedSignals, type, points, reason) {
  if (scores[type] === undefined) return;
  scores[type] += points;
  if (matchedSignals) matchedSignals.push({ type, reason, points });
}

function subtractScore(scores, matchedSignals, type, points, reason) {
  if (scores[type] === undefined) return;
  scores[type] = Math.max(0, scores[type] - points);
  if (matchedSignals) matchedSignals.push({ type, reason, points: -points });
}

function mergeScores(base, extra, multiplier = 1) {
  for (const key of Object.keys(base)) {
    base[key] += (extra[key] || 0) * multiplier;
  }
  return base;
}

function getTopScore(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [siteType, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] || 0;
  const scoreGap = topScore - secondScore;

  if (topScore === 0) {
    return {
      siteType: "Small business",
      confidence: "Low",
      topScore,
      secondScore,
      scoreGap,
      sorted,
      needsReview: true,
    };
  }

  let confidence = "Low";
  if (topScore >= 16 && scoreGap >= 6) confidence = "High";
  else if (topScore >= 9 && scoreGap >= 3) confidence = "Medium";

  const needsReview = confidence === "Low" || scoreGap < 3;

  return {
    siteType: normalizeType(siteType),
    confidence,
    topScore,
    secondScore,
    scoreGap,
    sorted,
    needsReview,
  };
}

function hasStrongNonSmallBusiness(scores, threshold = 4) {
  return Object.entries(scores).some(([type, score]) => {
    if (type === "Small business") return false;
    return score >= threshold;
  });
}

function pickBestNonSmallBusiness(scores) {
  const candidates = Object.entries(scores)
    .filter(([type]) => type !== "Small business")
    .sort((a, b) => b[1] - a[1]);

  const [type, score] = candidates[0] || ["Small business", 0];
  return { type, score };
}

module.exports = {
  domainIntel,
  SITETYPES,
  normalizeType,
  getDomainPrior,
  createScores,
  addScore,
  subtractScore,
  mergeScores,
  getTopScore,
  hasStrongNonSmallBusiness,
  pickBestNonSmallBusiness,
};