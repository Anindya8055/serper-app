const fs = require('fs');
const path = require('path');

const datasetPath = process.argv[2] || path.join(process.cwd(), 'test_dataset.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.filter(r => r.some(v => String(v).trim() !== '')).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? '');
    return obj;
  });
}

function pick(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return fallback;
}

function short(text, max = 220) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function schemaSummary(result) {
  const parts = [];
  const schemaText = result.schemaText || result.schema || '';
  if (schemaText) {
    const matches = [...new Set((String(schemaText).match(/NewsArticle|Article|BlogPosting|Product|Offer|Service|LocalBusiness|SoftwareApplication|FAQPage|CollectionPage|SearchResultsPage|WebPage/gi) || []).map(x => x))];
    if (matches.length) parts.push(`schemaTypes=${matches.join('|')}`);
  }
  const flags = [
    'hasProductSchema','hasArticleSchema','hasReviewSchema','hasLocalBusinessSchema','hasFaqSchema',
    'hasCart','hasPrice','hasSearchAndFilter','hasPhone','hasAddress','hasMap','hasLogin','hasPricing'
  ];
  const found = flags.filter(k => result[k] === true || result.signals?.[k] === true);
  if (found.length) parts.push(`flags=${found.join('|')}`);
  return parts.join(' ; ');
}

async function main() {
  const candidates = [
    './analyzeDomain',
    './analyze-domain',
    './analyzer',
    './src/analyzeDomain',
    './src/analyze-domain',
    './src/analyzer',
    './lib/analyzeDomain',
    './lib/analyze-domain',
    './lib/analyzer'
  ];

  let analyzeModule = null;
  let loadedFrom = null;
  for (const c of candidates) {
    try {
      analyzeModule = require(c);
      loadedFrom = c;
      break;
    } catch (_) {}
  }

  if (!analyzeModule) {
    throw new Error('Could not load analyzer module. Update the candidates list in evaluate-full-debug.js to match your project.');
  }

  const analyzeDomain = analyzeModule.analyzeDomain || analyzeModule.default || analyzeModule;
  if (typeof analyzeDomain !== 'function') {
    throw new Error(`Loaded ${loadedFrom} but it does not export a callable analyzeDomain function.`);
  }

  const csvText = fs.readFileSync(datasetPath, 'utf8');
  const rows = parseCsv(csvText);
  const results = [];
  let total = 0;
  let siteCorrect = 0;
  let contentCorrect = 0;

  console.log(`Loaded ${rows.length} rows from ${datasetPath}`);
  console.log(`Using analyzer from ${loadedFrom}`);

  for (const row of rows) {
    const url = pick(row, ['url', 'URL']);
    const expectedSite = pick(row, ['site', 'siteType', 'expectedSite']);
    const expectedContent = pick(row, ['content', 'contentType', 'expectedContent']);
    if (!url) continue;

    total++;
    let analyzed = null;
    let error = '';

    try {
      analyzed = await analyzeDomain(url);
    } catch (err) {
      error = err?.message || String(err);
      analyzed = {};
    }

    const predictedSite = pick(analyzed, ['siteType', 'type', 'predictedSite'], 'Unknown');
    const predictedContent = pick(analyzed, ['contentType', 'pageType', 'predictedContent'], 'Unknown');

    const siteOk = predictedSite === expectedSite;
    const contentOk = predictedContent === expectedContent;
    if (siteOk) siteCorrect++;
    if (contentOk) contentCorrect++;

    const record = {
      url,
      expectedSite,
      predictedSite,
      expectedContent,
      predictedContent,
      siteOk,
      contentOk,
      title: short(pick(analyzed, ['title', 'metaTitle'])),
      metaDescription: short(pick(analyzed, ['metaDescription', 'description'])),
      schemaSummary: schemaSummary(analyzed),
      topSignals: short(JSON.stringify(analyzed.signals || analyzed.pageSignals || {}), 300),
      selectedPage: short(JSON.stringify(analyzed.pageClassifications?.[0] || analyzed.selectedPage || {}), 300),
      error: short(error, 300)
    };

    results.push(record);

    if (!siteOk || !contentOk) {
      console.log('\n--- FAILURE ---');
      console.log(url);
      console.log(`site:    ${expectedSite} -> ${predictedSite}`);
      console.log(`content: ${expectedContent} -> ${predictedContent}`);
      if (record.title) console.log(`title:   ${record.title}`);
      if (record.metaDescription) console.log(`meta:    ${record.metaDescription}`);
      if (record.schemaSummary) console.log(`schema:  ${record.schemaSummary}`);
      if (record.topSignals && record.topSignals !== '{}') console.log(`signals: ${record.topSignals}`);
      if (record.selectedPage && record.selectedPage !== '{}') console.log(`page:    ${record.selectedPage}`);
      if (record.error) console.log(`error:   ${record.error}`);
    }
  }

  const siteAccuracy = total ? ((siteCorrect / total) * 100).toFixed(1) : '0.0';
  const contentAccuracy = total ? ((contentCorrect / total) * 100).toFixed(1) : '0.0';

  console.log(`\nSite accuracy: ${siteAccuracy}% (${siteCorrect}/${total})`);
  console.log(`Content accuracy: ${contentAccuracy}% (${contentCorrect}/${total})`);

  const outCsv = [
    ['url','expectedSite','predictedSite','expectedContent','predictedContent','siteOk','contentOk','title','metaDescription','schemaSummary','topSignals','selectedPage','error'].join(','),
    ...results.map(r => [
      r.url, r.expectedSite, r.predictedSite, r.expectedContent, r.predictedContent,
      r.siteOk, r.contentOk, r.title, r.metaDescription, r.schemaSummary, r.topSignals, r.selectedPage, r.error
    ].map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
  ].join('\n');

  fs.writeFileSync(path.join(process.cwd(), 'eval-full-debug-results.csv'), outCsv, 'utf8');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});