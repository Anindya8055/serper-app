const { getPathname, isEditorialPath } = require("../lib/url-utils");

function adjustContentTypeAfterScoring(contentType, siteType, url, schemaTypes, bodyText) {
  const pathName = getPathname(url);
  const editorialPath = isEditorialPath(pathName);
  const hasBlogPosting = !!schemaTypes.isBlogPosting;
  const hasNewsArticle = !!schemaTypes.isNewsArticle;
  const isListicle = /best|top|ideas|tips|guide|how to|wall decor|decorating ideas|recipe/i.test(
    String(bodyText || "").toLowerCase()
  );

  if (editorialPath && hasBlogPosting && isListicle) return "Blog";
  if (editorialPath && hasNewsArticle) return "Newspaper";
  if (hasNewsArticle && siteType === "Newspaper") return "Newspaper";

  return contentType;
}

module.exports = {
  adjustContentTypeAfterScoring,
};