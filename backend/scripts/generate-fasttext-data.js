// C:\Users\Lenovo\OneDrive\Desktop\serper-app\backend\scripts\generate-fasttext-data.js
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const backendRoot = path.join(__dirname, "..");

// Main labeled dataset
const datasetPath = path.join(backendRoot, "test_dataset.csv");

// Optional analyzed result files in backend root
const analyzedFiles = [
  path.join(backendRoot, "analyzed-results-2.csv"),
  path.join(backendRoot, "analyzed-results-3.csv"),
];

// Optional extra analyzed data folder if you later store files there
const analyzedDir = path.join(backendRoot, "data");

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function clean(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s/_\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function urlPathTokens(url) {
  try {
    const u = new URL(url);
    return `${u.hostname} ${u.pathname}`.replace(/[/_.\-]+/g, " ").toLowerCase();
  } catch {
    return clean(url);
  }
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

function firstNonEmpty(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
      return String(obj[key]).trim();
    }
  }
  return "";
}

if (!fileExists(datasetPath)) {
  console.error(`Missing test dataset: ${datasetPath}`);
  process.exit(1);
}

const datasetRows = readCsv(datasetPath);

// Build a URL -> extracted text map from analyzed CSVs if present
const extractedMap = new Map();

for (const filePath of analyzedFiles) {
  if (!fileExists(filePath)) continue;

  const rows = readCsv(filePath);
  for (const row of rows) {
    const url = firstNonEmpty(row, ["URL", "url"]);
    if (!url) continue;

    const title = firstNonEmpty(row, ["Title", "title"]);
    const metaDescription = firstNonEmpty(row, ["Meta Description", "metaDescription", "meta_description"]);
    const bodyText = firstNonEmpty(row, ["Body Text", "bodyText", "body_text"]);

    extractedMap.set(url, {
      title,
      metaDescription,
      bodyText,
    });
  }
}

// If backend/data exists, auto-read extra csv/json exports later if you add them
if (fileExists(analyzedDir)) {
  const files = fs.readdirSync(analyzedDir);
  for (const name of files) {
    const full = path.join(analyzedDir, name);
    if (!fileExists(full)) continue;

    if (name.endsWith(".csv")) {
      try {
        const rows = readCsv(full);
        for (const row of rows) {
          const url = firstNonEmpty(row, ["URL", "url"]);
          if (!url) continue;

          const title = firstNonEmpty(row, ["Title", "title"]);
          const metaDescription = firstNonEmpty(row, ["Meta Description", "metaDescription", "meta_description"]);
          const bodyText = firstNonEmpty(row, ["Body Text", "bodyText", "body_text"]);

          extractedMap.set(url, {
            title,
            metaDescription,
            bodyText,
          });
        }
      } catch (_) {}
    }

    if (name.endsWith(".json")) {
      try {
        const data = JSON.parse(fs.readFileSync(full, "utf8"));
        if (Array.isArray(data)) {
          for (const row of data) {
            const url = firstNonEmpty(row, ["URL", "url"]);
            if (!url) continue;

            const title = firstNonEmpty(row, ["Title", "title"]);
            const metaDescription = firstNonEmpty(row, ["Meta Description", "metaDescription", "meta_description"]);
            const bodyText = firstNonEmpty(row, ["Body Text", "bodyText", "body_text"]);

            extractedMap.set(url, {
              title,
              metaDescription,
              bodyText,
            });
          }
        }
      } catch (_) {}
    }
  }
}

const outDir = path.join(backendRoot, "fasttext");
if (!fileExists(outDir)) fs.mkdirSync(outDir, { recursive: true });

const trainLines = [];
const validLines = [];
let skippedNoUrl = 0;
let skippedNoLabel = 0;
let skippedNoText = 0;

for (let i = 0; i < datasetRows.length; i++) {
  const row = datasetRows[i];

  const url = firstNonEmpty(row, ["URL", "url"]);
  if (!url) {
    skippedNoUrl++;
    continue;
  }

  // Prefer explicit content-type label
  const label = firstNonEmpty(row, [
    "Content Type",
    "contentType",
    "content_type",
    "label",
    "type",
  ]);

  if (!label) {
    skippedNoLabel++;
    continue;
  }

  const extracted = extractedMap.get(url) || {};

  const title = extracted.title || firstNonEmpty(row, ["Title", "title"]);
  const metaDescription = extracted.metaDescription || firstNonEmpty(row, ["Meta Description", "metaDescription"]);
  const bodyText = extracted.bodyText || firstNonEmpty(row, ["Body Text", "bodyText"]);

  const parts = [
    urlPathTokens(url),
    clean(title),
    clean(metaDescription),
    clean(bodyText).slice(0, 4000),
  ].filter(Boolean);

  const text = parts.join(" ").trim();
  if (!text) {
    skippedNoText++;
    continue;
  }

  const normalizedLabel = label.replace(/\s+/g, "_");
  const line = `__label__${normalizedLabel} ${text}`;

  if (i % 5 === 0) {
    validLines.push(line);
  } else {
    trainLines.push(line);
  }
}

const trainPath = path.join(outDir, "content.train.txt");
const validPath = path.join(outDir, "content.valid.txt");

fs.writeFileSync(trainPath, trainLines.join("\n") + "\n", "utf8");
fs.writeFileSync(validPath, validLines.join("\n") + "\n", "utf8");

console.log("Done.");
console.log(`Dataset rows: ${datasetRows.length}`);
console.log(`Train lines: ${trainLines.length}`);
console.log(`Valid lines: ${validLines.length}`);
console.log(`Skipped (no URL): ${skippedNoUrl}`);
console.log(`Skipped (no label): ${skippedNoLabel}`);
console.log(`Skipped (no text): ${skippedNoText}`);
console.log(`Train file: ${trainPath}`);
console.log(`Valid file: ${validPath}`);
console.log(`Extracted text records loaded: ${extractedMap.size}`);