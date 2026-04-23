const fs = require("fs");
const puppeteer = require("puppeteer");

let browserInstance = null;
const pagePool = [];
const MAX_POOL_SIZE = 2;

function resolveExecutablePath() {
  try {
    const autoPath = puppeteer.executablePath();
    if (autoPath && fs.existsSync(autoPath)) return autoPath;
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
    timeout: 60000,
    protocolTimeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ]
  });

  browserInstance.on("disconnected", () => {
    browserInstance = null;
    pagePool.length = 0;
  });

  return browserInstance;
}

async function preparePage(page) {
  await page.setViewport({ width: 1280, height: 720 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(45000);

  try {
    await page.setRequestInterception(true);

    page.removeAllListeners("request");
    page.on("request", (request) => {
      const resourceType = request.resourceType();

      if (["image", "media", "font"].includes(resourceType)) {
        return request.abort();
      }

      return request.continue();
    });
  } catch {}

  return page;
}

async function createPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  return preparePage(page);
}

async function getPooledPage() {
  while (pagePool.length > 0) {
    const page = pagePool.pop();
    try {
      if (page && !page.isClosed()) {
        return page;
      }
    } catch {}
  }

  return createPage();
}

async function releasePage(page) {
  try {
    if (!page || page.isClosed()) return;

    await page.goto("about:blank", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    }).catch(() => {});

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
    try {
      const page = await createPage();
      pagePool.push(page);
    } catch (error) {
      console.error("Warmup page creation failed:", error.message);
      break;
    }
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
    await browserInstance.close().catch(() => {});
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