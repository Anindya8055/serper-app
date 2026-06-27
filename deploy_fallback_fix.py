import re, os

sjs = open('backend/server.js', encoding='utf-8').read()

# ── 1. Replace classifyFromSnippet with improved version ────────────────────
OLD_SNIPPET = '''// Classify siteType from Serper title + snippet without any crawling.
// Returns { siteType, contentType, confidence } or null if not confident enough.
function classifyFromSnippet(url, title = "", snippet = "") {
  const text = `${title} ${snippet}`.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Strong e-commerce signals in title/snippet
  const ecomSignals = [
    /\\bfree shipping\\b/,
    /\\badd to cart\\b/,
    /\\bbuy (now|online|today)\\b/,
    /\\bshop (now|online|our)\\b/,
    /\\b(from|starting at|only|just)\\s+\\$[\\d,.]+/,
    /\\$[\\d,.]+\\s*(usd|aud|gbp|cad)?/,
    /\\b(order|checkout|purchase|in stock|out of stock)\\b/,
    /\\bfree returns?\\b/,
    /\\b\\d+%\\s*off\\b/,
  ];

  // Strong blog/editorial signals
  const blogSignals = [
    /\\b(best|top|review|reviewed|guide|how to|tips|advice|ranked|rated|recommended)\\b/,
    /\\b(expert|tested|opinion|analysis|comparison|vs\\.?|versus)\\b/,
    /\\b(explained|everything you need|should you|worth it)\\b/,
    /\\b(article|post|written by|updated|published)\\b/,
  ];

  // Strong forum signals
  const forumSignals = [
    /\\b(forum|thread|reply|replies|posted by|discussion|community|members?)\\b/,
    /\\b(asked|answered|question|topic)\\b/,
  ];

  // URL signals (very reliable)
  const isCommerceUrl = /\\/collections\\/|\\/products?\\/|\\/shop\\/|\\/store\\/|\\/cart\\/|\\/checkout\\/|\\/buy\\//i.test(lowerUrl);
  const isContentUrl = /\\/blog\\/|\\/blogs\\/|\\/news\\/|\\/article\\/|\\/guide\\/|\\/review\\/|\\/forum\\/|\\/topic\\//i.test(lowerUrl);

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
}'''

NEW_SNIPPET = '''// Classify siteType from Serper title + snippet without any crawling.
// Returns { siteType, contentType, confidence } or null if not confident enough.
function classifyFromSnippet(url, title = "", snippet = "") {
  const text = `${title} ${snippet}`.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Strong e-commerce signals in title/snippet
  const ecomSignals = [
    /\\bfree shipping\\b/,
    /\\badd to cart\\b/,
    /\\bbuy (now|online|today)\\b/,
    /\\bshop (now|online|our)\\b/,
    /\\b(from|starting at|only|just)\\s+\\$[\\d,.]+/,
    /\\$[\\d,.]+\\s*(usd|aud|gbp|cad)?/,
    /\\b(order|checkout|purchase|in stock|out of stock)\\b/,
    /\\bfree returns?\\b/,
    /\\b\\d+%\\s*off\\b/,
  ];

  // Editorial/blog/review signals
  const editorialSignals = [
    /\\b(best|top|review|reviewed|guide|how to|tips|advice|ranked|rated|recommended)\\b/,
    /\\b(expert|tested|opinion|analysis|comparison|vs\\.?|versus)\\b/,
    /\\b(explained|everything you need|should you|worth it)\\b/,
    /\\b(article|post|written by|updated|published|editor.?s pick)\\b/,
    /\\b(we tested|we tried|we reviewed|our pick|staff pick)\\b/,
  ];

  // Strong forum signals
  const forumSignals = [
    /\\b(forum|thread|reply|replies|posted by|discussion|community|members?)\\b/,
    /\\b(asked|answered|question|topic)\\b/,
  ];

  // URL signals (very reliable)
  const isCommerceUrl = /\\/collections\\/|\\/products?\\/|\\/shop\\/|\\/store\\/|\\/cart\\/|\\/checkout\\/|\\/buy\\//i.test(lowerUrl);
  // News-specific URL paths
  const isNewsUrl = /\\/news\\/|\\/article\\/|\\/articles\\/|\\/story\\/|\\/stories\\/|\\/world\\/|\\/politics\\/|\\/business\\/|\\/technology\\/|\\/science\\/|\\/entertainment\\/|\\/sport\\/|\\/sports\\/|\\/health\\//i.test(lowerUrl);
  // Blog/guide URL paths
  const isBlogUrl = /\\/blog\\/|\\/blogs\\/|\\/guide\\/|\\/guides\\/|\\/review\\/|\\/reviews\\/|\\/post\\/|\\/posts\\/|\\/forum\\/|\\/topic\\/|\\/best\\/|\\/top-|\\/ranked\\/|\\/roundup\\//i.test(lowerUrl);
  const isContentUrl = isNewsUrl || isBlogUrl;

  const ecomScore = ecomSignals.filter(r => r.test(text)).length + (isCommerceUrl ? 3 : 0);
  const editorialScore = editorialSignals.filter(r => r.test(text)).length + (isContentUrl ? 2 : 0);
  const forumScore = forumSignals.filter(r => r.test(text)).length;

  const contentType = normalizeType(classifyContentType(url, null, null));

  if (isCommerceUrl && ecomScore >= 3) {
    return { siteType: "E-commerce", contentType, confidence: "High", source: "snippet+url" };
  }
  if (ecomScore >= 4) {
    return { siteType: "E-commerce", contentType, confidence: "High", source: "snippet" };
  }
  if (ecomScore >= 2 && editorialScore === 0) {
    return { siteType: "E-commerce", contentType, confidence: "Medium", source: "snippet" };
  }
  if (forumScore >= 2 || (isContentUrl && forumSignals.some(r => r.test(text)))) {
    return { siteType: "Blog", contentType: "Blog", confidence: "High", source: "snippet+url" };
  }
  // News URL with editorial signals → Newspaper
  if (isNewsUrl && editorialScore >= 1) {
    return { siteType: "Newspaper", contentType: "Newspaper", confidence: "Medium", source: "snippet+url" };
  }
  if (editorialScore >= 3) {
    return { siteType: "Blog", contentType: "Blog", confidence: "Medium", source: "snippet" };
  }
  if (isBlogUrl && editorialScore >= 1) {
    return { siteType: "Blog", contentType: "Blog", confidence: "Medium", source: "snippet+url" };
  }

  return null; // not confident — fall through to normal crawl-based analysis
}

// Infer site type from domain name patterns — last-resort fallback when crawl fails.
function inferTypeFromDomainName(domain) {
  const d = (domain || "").replace(/^www\\./, "").toLowerCase();
  // Clear newspaper/media keywords as word segments
  if (/(?:^|[-.])(news|tribune|herald|gazette|chronicle|dispatch|sentinel|enquirer|advertiser|clarion|courier|examiner|argus|beacon|democrat|republican|ledger|pilot|register|observer|bulletin|monitor|reporter|guardian|independent|times|daily|post|press|journal|globe|mirror|standard|express|wire)(?:[-.]|$)/.test(d)) {
    return "Newspaper";
  }
  if (/(?:^|[-.])(magazine|mag|media|zine)(?:[-.]|$)/.test(d)) {
    return "Newspaper";
  }
  // Clear e-commerce keyword segments (exclude if blog/review signals present)
  if (/(?:^|[-.])(shop|store|mart|outlet|wholesale|supply|supplies|emporium)(?:[-.]|$)/.test(d) &&
      !/(?:blog|review|news|guide|forum)/.test(d)) {
    return "E-commerce";
  }
  // Clear blog/forum keyword segments
  if (/(?:^|[-.])(forum|forums|community|discuss|boards?)(?:[-.]|$)/.test(d)) {
    return "Blog";
  }
  if (/(?:^|[-.])(blog|blogs)(?:[-.]|$)/.test(d)) {
    return "Blog";
  }
  return null;
}'''

if OLD_SNIPPET in sjs:
    sjs = sjs.replace(OLD_SNIPPET, NEW_SNIPPET, 1)
    print('classifyFromSnippet + inferTypeFromDomainName patched OK')
else:
    print('ERROR: classifyFromSnippet patch target not found')

# ── 2. Improve catch block to use snippet + domain name inference ────────────
OLD_CATCH = '''  } catch (error) {
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
}'''

NEW_CATCH = '''  } catch (error) {
    // When crawl fails, try snippet + domain-name inference before defaulting to "Small business".
    const snippetFallback = (item.serperTitle || item.serperSnippet)
      ? classifyFromSnippet(item.url, item.serperTitle || "", item.serperSnippet || "")
      : null;
    const domainNameType = inferTypeFromDomainName(item.domain);

    const effectiveType =
      knownPrior ||
      (snippetFallback?.confidence === "High" ? snippetFallback.siteType : null) ||
      domainAnalysis?.siteType ||
      snippetFallback?.siteType ||
      domainNameType ||
      null;

    const fallbackContentType = normalizeType(
      classifyContentType(item.url, null, effectiveType)
    );

    const fallbackSignals = [];
    if (snippetFallback) {
      fallbackSignals.push(`Snippet fallback (crawl failed): ${snippetFallback.source}`);
    } else if (domainNameType && !domainAnalysis?.siteType) {
      fallbackSignals.push(`Domain name inference: ${domainNameType}`);
    }

    return {
      ...item,
      siteType: normalizeType(effectiveType || "Small business"),
      contentType: snippetFallback?.contentType || fallbackContentType,
      confidence: knownPrior ? "High" : (snippetFallback?.confidence === "High" ? "Medium" : (domainAnalysis?.confidence || "Low")),
      classifierVersion:
        domainAnalysis?.classifierVersion ||
        item.classifierVersion ||
        CLASSIFIER_VERSION,
      matchedSignals: mergeMatchedSignals(
        knownPrior ? [`Known domain prior: ${knownPrior}`] : [],
        domainAnalysis?.matchedSignals || [],
        fallbackSignals,
        [`Fallback — unable to fetch page: ${error.message}`]
      ),
      analyzedPages: domainAnalysis?.analyzedPages || item.analyzedPages || [],
      analysisStatus: "done",
      pageError: error.message,
    };
  }
}'''

if OLD_CATCH in sjs:
    sjs = sjs.replace(OLD_CATCH, NEW_CATCH, 1)
    print('catch block patched OK')
else:
    print('ERROR: catch block patch target not found')

# ── 3. Thin content detection — prefer snippet when body < 200 chars ─────────
OLD_THIN = '''    const fastTextResult = await classifyWithFastText(item.url, pageData);
    const mergedPageResult = mergeRuleBasedWithFastText(rulePageResult, fastTextResult);

    let resolvedSiteType = normalizeType('''

NEW_THIN = '''    const fastTextResult = await classifyWithFastText(item.url, pageData);
    const mergedPageResult = mergeRuleBasedWithFastText(rulePageResult, fastTextResult);

    // Thin content: if Playwright loaded but body text is very short (bot interstitial / Cloudflare
    // challenge page), the classifier had almost no signal.  Prefer a confident snippet hit.
    const bodyLength = (pageData.bodyText || "").length;
    if (bodyLength < 200 && !knownPrior) {
      const thinSnippet = (item.serperTitle || item.serperSnippet)
        ? classifyFromSnippet(item.url, item.serperTitle || "", item.serperSnippet || "")
        : null;
      if (thinSnippet?.confidence === "High") {
        const thinContentType = normalizeType(
          classifyContentType(item.url, null, thinSnippet.siteType)
        );
        return {
          ...item,
          siteType: normalizeType(thinSnippet.siteType),
          contentType: thinSnippet.contentType || thinContentType,
          confidence: "Medium",
          classifierVersion: CLASSIFIER_VERSION,
          matchedSignals: mergeMatchedSignals(
            domainAnalysis?.matchedSignals || [],
            [`Thin page (${bodyLength} chars) — snippet override: ${thinSnippet.source}`]
          ),
          analyzedPages: [item.url],
          analysisStatus: "done",
        };
      }
    }

    let resolvedSiteType = normalizeType('''

if OLD_THIN in sjs:
    sjs = sjs.replace(OLD_THIN, NEW_THIN, 1)
    print('thin-content detection patched OK')
else:
    print('ERROR: thin-content patch target not found')

open('backend/server.js', 'w', encoding='utf-8').write(sjs)
print('server.js written.')
print('All done!')
