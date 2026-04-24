const { chromium } = require("playwright");

let browserInstance = null;
const pagePool = [];
const MAX_POOL_SIZE = 2;

async function getBrowser() {
  if (browserInstance) return browserInstance;

  console.log("Launching Playwright browser...");

  browserInstance = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-background-networking",
      "--disable-extensions"
    ]
  });

  browserInstance.on("disconnected", () => {
    browserInstance = null;
    pagePool.length = 0;
    console.log("Playwright browser disconnected");
  });

  return browserInstance;
}

async function createPage() {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" }
  });

  const page = await context.newPage();

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    const url = route.request().url().toLowerCase();

    if (["image", "media", "font", "stylesheet"].includes(type)) {
      return route.abort();
    }

    if (
      url.includes("google-analytics") ||
      url.includes("googletagmanager") ||
      url.includes("doubleclick") ||
      url.includes("facebook.net") ||
      url.includes("hotjar") ||
      url.includes("clarity.ms")
    ) {
      return route.abort();
    }

    return route.continue();
  });

  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(20000);

  return page;
}

async function getPooledPage() {
  while (pagePool.length > 0) {
    const page = pagePool.pop();
    try {
      if (page && !page.isClosed()) return page;
    } catch {}
  }
  return createPage();
}

async function releasePage(page) {
  try {
    if (!page || page.isClosed()) return;

    await page.goto("about:blank", {
      waitUntil: "domcontentloaded",
      timeout: 5000
    }).catch(() => {});

    if (pagePool.length < MAX_POOL_SIZE) {
      pagePool.push(page);
    } else {
      await page.context().close().catch(() => {});
    }
  } catch {
    try {
      await page.context().close();
    } catch {}
  }
}

async function warmupPagePool(size = 1) {
  for (let i = pagePool.length; i < size; i++) {
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
      await page.context().close();
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