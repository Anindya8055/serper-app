const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const FASTTEXT_BIN =
  process.env.FASTTEXT_BIN ||
  path.join(os.homedir(), "fastText", "fasttext");

const CONTENT_MODEL =
  process.env.FASTTEXT_CONTENT_MODEL ||
  path.join(__dirname, "..", "fasttext", "content-model.bin");

const SITE_MODEL =
  process.env.FASTTEXT_SITE_MODEL ||
  path.join(__dirname, "..", "fasttext", "site-model.bin");

const ENABLE_FASTTEXT = process.env.ENABLE_FASTTEXT === "true";

function exists(filePath) {
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

function buildFastTextInput(url, pageSignals = {}) {
  const parts = [];

  try {
    const u = new URL(url);
    parts.push(
      clean(
        `${u.hostname.replace(/^www\./, "")} ${u.pathname} ${u.search}`
      )
    );
  } catch {
    parts.push(clean(url));
  }

  if (pageSignals.title) parts.push(clean(pageSignals.title));
  if (pageSignals.metaDescription) parts.push(clean(pageSignals.metaDescription));
  if (pageSignals.bodyText) parts.push(clean(String(pageSignals.bodyText).slice(0, 4000)));
  if (pageSignals.linksText) parts.push(clean(String(pageSignals.linksText).slice(0, 1500)));

  return parts.filter(Boolean).join(" ").trim();
}

function parseFastTextOutput(stdout) {
  const line = String(stdout || "").trim();
  if (!line) return null;

  const parts = line.split(/\s+/);
  if (parts.length < 2) return null;

  const label = parts[0].replace(/^__label__/, "").replace(/_/g, " ");
  const probability = Number(parts[1]);

  return {
    label,
    probability: Number.isFinite(probability) ? probability : null,
    raw: line,
  };
}

function runPredictProb(modelPath, text) {
  return new Promise((resolve, reject) => {
    if (!ENABLE_FASTTEXT) {
      return resolve(null);
    }

    if (!exists(FASTTEXT_BIN)) {
      return resolve(null);
    }

    if (!exists(modelPath)) {
      return resolve(null);
    }

    const child = execFile(
      FASTTEXT_BIN,
      ["predict-prob", modelPath, "-", "1"],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(stderr?.trim() || error.message || "fastText prediction failed")
          );
        }

        return resolve(parseFastTextOutput(stdout));
      }
    );

    child.stdin.write(`${text}\n`);
    child.stdin.end();
  });
}

async function predictSiteType(url, pageSignals = {}) {
  const text = buildFastTextInput(url, pageSignals);
  if (!text) return null;

  const result = await runPredictProb(SITE_MODEL, text);
  if (!result) return null;

  return {
    siteType: result.label,
    probability: result.probability,
    input: text,
    model: SITE_MODEL,
  };
}

async function predictContentType(url, pageSignals = {}) {
  const text = buildFastTextInput(url, pageSignals);
  if (!text) return null;

  const result = await runPredictProb(CONTENT_MODEL, text);
  if (!result) return null;

  return {
    contentType: result.label,
    probability: result.probability,
    input: text,
    model: CONTENT_MODEL,
  };
}

module.exports = {
  ENABLE_FASTTEXT,
  FASTTEXT_BIN,
  CONTENT_MODEL,
  SITE_MODEL,
  buildFastTextInput,
  predictSiteType,
  predictContentType,
};