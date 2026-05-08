const fs = require("fs");
const path = require("path");
const { analyzeDomain } = require("./analyzer");
const { closeBrowser } = require("./browser");

// Defaults Playwright OFF for evaluation runs for speed.
// Override if needed:
// PowerShell: $env:ENABLE_BROWSER_UPGRADE=1; node evaluate-full.js
process.env.ENABLE_BROWSER_UPGRADE =
  process.env.ENABLE_BROWSER_UPGRADE ?? "0";

const DATASET_PATH = path.join(__dirname, "test_dataset.csv");
const REGRESSION_DIR = path.join(__dirname, "regression");
const HISTORY_DIR = path.join(REGRESSION_DIR, "history");
const BASELINE_PATH = path.join(REGRESSION_DIR, "baseline.json");
const LATEST_PATH = path.join(REGRESSION_DIR, "latest.json");

function ensureDirs() {
  if (!fs.existsSync(REGRESSION_DIR)) {
    fs.mkdirSync(REGRESSION_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveReport(report) {
  ensureDirs();

  const latestJson = JSON.stringify(report, null, 2);
  fs.writeFileSync(LATEST_PATH, latestJson, "utf8");

  const historyPath = path.join(HISTORY_DIR, `report-${report.runId}.json`);
  fs.writeFileSync(historyPath, latestJson, "utf8");

  const latestStat = fs.statSync(LATEST_PATH);
  const historyStat = fs.statSync(historyPath);

  console.log(`\nSaved latest  -> ${LATEST_PATH} (${latestStat.size} bytes)`);
  console.log(`Saved history -> ${historyPath} (${historyStat.size} bytes)`);
}

function promoteToBaseline() {
  if (!fs.existsSync(LATEST_PATH)) return;
  fs.copyFileSync(LATEST_PATH, BASELINE_PATH);
  console.log(`Promoted latest -> baseline`);
}

function compareWithBaseline(current, baseline) {
  if (!baseline) return null;

  const delta = current.accuracy - baseline.accuracy;
  const regressions = [];
  const improvements = [];

  const baselineMap = new Map(
    (baseline.results || []).map((r) => [r.url, r])
  );

  for (const r of current.results || []) {
    const b = baselineMap.get(r.url);
    if (!b) continue;

    if (b.predicted === r.expected && r.predicted !== r.expected) {
      regressions.push({
        url: r.url,
        expected: r.expected,
        was: b.predicted,
        now: r.predicted,
      });
    } else if (b.predicted !== r.expected && r.predicted === r.expected) {
      improvements.push({
        url: r.url,
        expected: r.expected,
        was: b.predicted,
        now: r.predicted,
      });
    }
  }

  return { delta, regressions, improvements };
}

async function main() {
  const rawLines = fs
    .readFileSync(DATASET_PATH, "utf8")
    .trim()
    .split("\n")
    .slice(1); // skip header

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const startTime = Date.now();

  let correct = 0;
  let total = 0;
  const confusionMap = {};
  const failures = [];
  const results = [];

  for (const line of rawLines) {
    const lastComma = line.lastIndexOf(",");
    if (lastComma === -1) continue;

    const url = line.slice(0, lastComma).trim().replace(/^"|"$/g, "");
    const expected = line.slice(lastComma + 1).trim().replace(/^"|"$/g, "");
    if (!url || !expected) continue;

    try {
      const result = await analyzeDomain(url);
      const predicted = result.siteType;

      const topScore = result.topScore ?? 0;
      const secondScore = result.secondScore ?? 0;
      const scoreGap = result.scoreGap ?? topScore - secondScore;

      const pageClassifications = (result.pageClassifications || []).map((pc) => {
        if (pc.topScore !== undefined && pc.secondScore !== undefined) {
          return pc;
        }

        const pcScores = pc.scores || {};
        const sorted = Object.entries(pcScores).sort(([, a], [, b]) => b - a);
        const pcTopScore = sorted[0]?.[1] ?? 0;
        const pcSecondScore = sorted[1]?.[1] ?? 0;

        return {
          ...pc,
          topScore: pcTopScore,
          secondScore: pcSecondScore,
          scoreGap: pcTopScore - pcSecondScore,
        };
      });

      if (!confusionMap[expected]) confusionMap[expected] = {};
      confusionMap[expected][predicted] =
        (confusionMap[expected][predicted] || 0) + 1;

      if (predicted === expected) {
        correct++;
      } else {
        failures.push({
          url,
          expected,
          predicted,
          confidence: result.confidence,
          topScore,
          secondScore,
          scoreGap,
          analyzedPages: result.analyzedPages,
        });
      }

      results.push({
        url,
        expected,
        predicted,
        correct: predicted === expected,
        confidence: result.confidence,
        topScore,
        secondScore,
        scoreGap,
        analyzedPages: result.analyzedPages,
        pageClassifications,
      });

      total++;
    } catch (err) {
      failures.push({
        url,
        expected,
        predicted: "ERROR",
        confidence: "NA",
        error: err.message,
      });

      results.push({
        url,
        expected,
        predicted: "ERROR",
        correct: false,
        confidence: "NA",
        topScore: 0,
        secondScore: 0,
        scoreGap: 0,
        analyzedPages: [],
        pageClassifications: [],
        error: err.message,
      });

      total++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0";

  console.log(`\nAccuracy: ${accuracy}% (${correct}/${total}) in ${elapsed}s`);
  console.log("Confusion matrix:");
  console.table(confusionMap);

  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    console.dir(failures, { depth: null });
  }

  const report = {
    runId,
    timestamp: new Date().toISOString(),
    elapsedSeconds: parseFloat(elapsed),
    accuracy: parseFloat(accuracy),
    correct,
    total,
    confusionMap,
    failures,
    results,
    summary: {
      byCategory: Object.fromEntries(
        Object.entries(confusionMap).map(([cat, preds]) => {
          const catTotal = Object.values(preds).reduce((s, v) => s + v, 0);
          const catCorrect = preds[cat] || 0;

          return [
            cat,
            {
              total: catTotal,
              correct: catCorrect,
              accuracy:
                catTotal > 0
                  ? parseFloat(((catCorrect / catTotal) * 100).toFixed(1))
                  : 0,
            },
          ];
        })
      ),
    },
  };

  saveReport(report);

  const baseline = loadBaseline();
  const comparison = compareWithBaseline(report, baseline);

  if (comparison) {
    const sign = comparison.delta >= 0 ? "+" : "";
    console.log(
      `\nBaseline delta: ${sign}${comparison.delta.toFixed(1)}% accuracy`
    );

    if (comparison.regressions.length > 0) {
      console.log(`Regressions (${comparison.regressions.length}):`);
      console.dir(comparison.regressions, { depth: null });
    }

    if (comparison.improvements.length > 0) {
      console.log(`Improvements (${comparison.improvements.length}):`);
      console.dir(comparison.improvements, { depth: null });
    }
  } else {
    console.log("\nNo baseline found. Run with --promote to set one.");
  }

  if (process.argv.includes("--promote")) {
    promoteToBaseline();
  }
}

// ── FIX (Bug #7): always close pooled browser resources after the evaluation
//    run finishes. Without this, ENABLE_BROWSER_UPGRADE=1 can leave Playwright
//    open and the process may hang instead of exiting cleanly.
(async () => {
  try {
    await main();
  } catch (err) {
    console.error("evaluate-full failed:", err);
    process.exitCode = 1;
  } finally {
    await closeBrowser().catch((closeErr) => {
      console.error("Failed to close browser:", closeErr.message);
      if (!process.exitCode) process.exitCode = 1;
    });
  }
})();