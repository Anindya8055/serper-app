const puppeteer = require("puppeteer");

let browserInstance = null;
const pagePool = [];
const MAX_POOL_SIZE = 4;

function resolveExecutablePath() {
  try {
    const autoPath = puppeteer.executablePath();
    if (autoPath) return autoPath;
  } catch {}

  return undefined;
}

async function getBrowser() {
  if (browserInstance) return browserInstance;

  const executablePath = resolveExecutablePath();
  console.log("Puppeteer executablePath:", executablePath || "auto");

  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  browserInstance.on("disconnected", () => {
    browserInstance = null;
    pagePool.length = 0;
  });

  return browserInstance;
}

async function preparePage(page) {
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);
  return page;
}

async function createPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  return preparePage(page);
}

async function getPooledPage() {
  if (pagePool.length > 0) {
    return pagePool.pop();
  }
  return createPage();
}

async function releasePage(page) {
  try {
    if (!page || page.isClosed()) return;
    await page.goto("about:blank").catch(() => {});
    if (pagePool.length < MAX_POOL_SIZE) {
      pagePool.push(page);
    } else {
      await page.close().catch(() => {});
    }
  } catch {
    try {
      await page.close();
    } catch {}
  }
}

async function warmupPagePool(size = MAX_POOL_SIZE) {
  const needed = Math.max(0, size - pagePool.length);
  for (let i = 0; i < needed; i++) {
    const page = await createPage();
    pagePool.push(page);
  }
}

async function closeBrowser() {
  while (pagePool.length) {
    const page = pagePool.pop();
    try {
      await page.close();
    } catch {}
  }

  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = {
  getBrowser,
  createPage,
  getPooledPage,
  releasePage,
  warmupPagePool,
  closeBrowser
};
