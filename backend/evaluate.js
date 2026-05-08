// const { inferTypeFromSignals } = require("./classifier.js");
const { inferTypeFromSignals } = require("./classifier");
const fs = require("fs");

// Load CSV (expects: url,expectedType with header row)
const rawLines = fs
  .readFileSync("test_dataset.csv", "utf8")
  .trim()
  .split("\n")
  .slice(1); // skip header

let correct = 0;
let total = 0;
const confusionMap = {};
const failures = [];

for (const line of rawLines) {
  // Find last comma: everything before = URL, after = expected type
  const lastComma = line.lastIndexOf(",");
  if (lastComma === -1) continue;

  const url = line.slice(0, lastComma).trim().replace(/^"|"$/g, "");
  const expected = line.slice(lastComma + 1).trim().replace(/^"|"$/g, "");

  if (!url || !expected) continue;

  // Call classifier with URL only; all other page signals empty
  const result = inferTypeFromSignals(
    url,   // url
    "",    // title
    "",    // metaDescription
    "",    // bodyText
    "",    // linksText
    "",    // schemaText
    {},    // signals
    null   // siteTypeHint
  );

  const predicted = result.siteType;

  // Build confusion matrix
  if (!confusionMap[expected]) confusionMap[expected] = {};
  confusionMap[expected][predicted] =
    (confusionMap[expected][predicted] || 0) + 1;

  if (predicted === expected) {
    correct += 1;
  } else {
    failures.push({ url, expected, predicted });
  }

  total += 1;
}

// Summary
const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0";
console.log(
  `\nAccuracy: ${accuracy}% (${correct}/${total})\n`
);

// Confusion matrix
console.log("Confusion matrix:");
console.table(confusionMap);

// Failures
if (failures.length) {
  console.log("\nFailed predictions:");
  failures.forEach((f) => {
    console.log(
      `${f.expected.padEnd(16)} → ${f.predicted.padEnd(16)}  ${f.url}`
    );
  });
} else {
  console.log("\nNo failed predictions 🎉");
}