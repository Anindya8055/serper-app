const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const backendRoot = path.join(__dirname, "..");

// CHANGE THIS ONLY IF YOUR FILE NAME IS DIFFERENT
const datasetPath = path.join(backendRoot, "test_dataset_corrected.csv");

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
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

function urlToTrainingText(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const pathText = u.pathname.replace(/[/_.\-]+/g, " ");
    const queryText = u.search.replace(/[?&=_.\-]+/g, " ");
    return clean(`${host} ${pathText} ${queryText}`);
  } catch {
    return clean(url);
  }
}

function labelToFasttext(label) {
  return String(label || "")
    .trim()
    .replace(/\s+/g, "_");
}

if (!fileExists(datasetPath)) {
  console.error(`Dataset not found: ${datasetPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(datasetPath, "utf8");
const rows = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

const fasttextDir = path.join(backendRoot, "fasttext");
if (!fileExists(fasttextDir)) {
  fs.mkdirSync(fasttextDir, { recursive: true });
}

const contentTrain = [];
const contentValid = [];
const siteTrain = [];
const siteValid = [];

let skippedNoUrl = 0;
let skippedNoContentLabel = 0;
let skippedNoSiteLabel = 0;
let skippedNoText = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];

  const url = String(row.url || "").trim();
  const contentLabel = String(row.expected_content_type || "").trim();
  const siteLabel = String(row.expected_site_type || "").trim();

  if (!url) {
    skippedNoUrl++;
    continue;
  }

  const trainingText = urlToTrainingText(url);
  if (!trainingText) {
    skippedNoText++;
    continue;
  }

  const isValid = i % 5 === 0;

  if (contentLabel) {
    const line = `__label__${labelToFasttext(contentLabel)} ${trainingText}`;
    if (isValid) contentValid.push(line);
    else contentTrain.push(line);
  } else {
    skippedNoContentLabel++;
  }

  if (siteLabel) {
    const line = `__label__${labelToFasttext(siteLabel)} ${trainingText}`;
    if (isValid) siteValid.push(line);
    else siteTrain.push(line);
  } else {
    skippedNoSiteLabel++;
  }
}

const files = {
  contentTrainPath: path.join(fasttextDir, "content.train.txt"),
  contentValidPath: path.join(fasttextDir, "content.valid.txt"),
  siteTrainPath: path.join(fasttextDir, "site.train.txt"),
  siteValidPath: path.join(fasttextDir, "site.valid.txt"),
};

fs.writeFileSync(files.contentTrainPath, contentTrain.join("\n") + "\n", "utf8");
fs.writeFileSync(files.contentValidPath, contentValid.join("\n") + "\n", "utf8");
fs.writeFileSync(files.siteTrainPath, siteTrain.join("\n") + "\n", "utf8");
fs.writeFileSync(files.siteValidPath, siteValid.join("\n") + "\n", "utf8");

console.log("Done.");
console.log(`Rows read: ${rows.length}`);
console.log(`Content train: ${contentTrain.length}`);
console.log(`Content valid: ${contentValid.length}`);
console.log(`Site train: ${siteTrain.length}`);
console.log(`Site valid: ${siteValid.length}`);
console.log(`Skipped (no url): ${skippedNoUrl}`);
console.log(`Skipped (no content label): ${skippedNoContentLabel}`);
console.log(`Skipped (no site label): ${skippedNoSiteLabel}`);
console.log(`Skipped (no training text): ${skippedNoText}`);
console.log(files);