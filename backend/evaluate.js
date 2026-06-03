const fs = require("fs");
const path = require("path");
const {
  inferTypeFromSignals,
  classifyContentType,
  normalizeType,
  classifyWithFastText,
} = require("./classifier");

const DATASET_PATH = path.join(__dirname, "test_dataset_corrected.csv");

function parseCsvLine(line) {
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  parts.push(current);
  return parts.map((x) => x.trim());
}

const rawLines = fs
  .readFileSync(DATASET_PATH, "utf8")
  .trim()
  .split("\n")
  .slice(1);

let contentCorrect = 0;
let siteCorrect = 0;
let total = 0;
const failures = [];

(async () => {
  for (const line of rawLines) {
    const [url, expectedContentType, expectedSiteType] = parseCsvLine(line);
    if (!url || !expectedContentType || !expectedSiteType) continue;

    const ruleSite = inferTypeFromSignals(url, "", "", "", "", "", {}, null);
    const predictedSite = normalizeType(ruleSite.siteType);

    const predictedContent = normalizeType(
      classifyContentType(url, null, predictedSite)
    );

    const fastText = await classifyWithFastText(url, {});
    const fastTextSite = normalizeType(fastText?.sitePrediction?.siteType || "");
    const fastTextContent = normalizeType(fastText?.contentPrediction?.contentType || "");

    const finalSite = predictedSite || fastTextSite;
    const finalContent = predictedContent || fastTextContent || finalSite;

    if (finalSite === expectedSiteType) siteCorrect++;
    if (finalContent === expectedContentType) contentCorrect++;

    if (finalSite !== expectedSiteType || finalContent !== expectedContentType) {
      failures.push({
        url,
        expectedSiteType,
        finalSite,
        expectedContentType,
        finalContent,
        fastTextSite,
        fastTextContent,
      });
    }

    total++;
  }

  const siteAccuracy = total ? ((siteCorrect / total) * 100).toFixed(1) : "0.0";
  const contentAccuracy = total ? ((contentCorrect / total) * 100).toFixed(1) : "0.0";

  console.log(`\nSite accuracy: ${siteAccuracy}% (${siteCorrect}/${total})`);
  console.log(`Content accuracy: ${contentAccuracy}% (${contentCorrect}/${total})`);

  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures) {
      console.log(
        `[site ${f.expectedSiteType} -> ${f.finalSite}] [content ${f.expectedContentType} -> ${f.finalContent}] ${f.url}`
      );
    }
  } else {
    console.log("\nNo failed predictions 🎉");
  }
})().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});