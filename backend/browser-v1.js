const { chromium } = require("playwright");

let browserInstance = null;
const pagePool = [];
const waitQueue = [];

const MAX_POOL_SIZE = 2;
const MAX_ACTIVE_PAGES = 4;

let totalLivePages = 0;

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
    waitQueue.length = 0;
    totalLivePages = 0;
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
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const page = await context.newPage();

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    const url = route.request().url().toLowerCase();

    // Abort only heavy assets.
    // Keep stylesheets because some sites need CSS to reveal text/content properly.
    if (["image", "media", "font"].includes(type)) {
      return route.abort();
    }

    if (
      url.includes("google-analytics") ||
      url.includes("googletagmanager") ||
      url.includes("doubleclick") ||
      url.includes("facebook.net") ||
      url.includes("hotjar") ||
      url.includes("clarity.ms") ||
      url.includes("segment.io") ||
      url.includes("analytics") ||
      url.includes("mixpanel")
    ) {
      return route.abort();
    }

    return route.continue();
  });

  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(20000);

  totalLivePages += 1;
  return page;
}

function resolveNextWaiter() {
  if (waitQueue.length === 0) return;
  const next = waitQueue.shift();
  if (next) next();
}

async function getPooledPage() {
  while (pagePool.length > 0) {
    const page = pagePool.pop();
    try {
      if (page && !page.isClosed()) return page;
    } catch {}
  }

  if (totalLivePages < MAX_ACTIVE_PAGES) {
    return createPage();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waitQueue.indexOf(wake);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error("Timed out waiting for an available Playwright page"));
    }, 15000);

    const wake = async () => {
      clearTimeout(timer);

      while (pagePool.length > 0) {
        const page = pagePool.pop();
        try {
          if (page && !page.isClosed()) {
            resolve(page);
            return;
          }
        } catch {}
      }

      if (totalLivePages < MAX_ACTIVE_PAGES) {
        try {
          const page = await createPage();
          resolve(page);
        } catch (err) {
          reject(err);
        }
        return;
      }

      waitQueue.push(wake);
    };

    waitQueue.push(wake);
  });
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
      resolveNextWaiter();
    } else {
      await page.context().close().catch(() => {});
      totalLivePages = Math.max(0, totalLivePages - 1);
      resolveNextWaiter();
    }
  } catch {
    try {
      if (page && !page.isClosed()) {
        await page.context().close().catch(() => {});
      }
    } catch {}
    totalLivePages = Math.max(0, totalLivePages - 1);
    resolveNextWaiter();
  }
}

async function warmupPagePool(size = 1) {
  const target = Math.min(size, MAX_POOL_SIZE);
  for (let i = pagePool.length; i < target; i++) {
    if (totalLivePages >= MAX_ACTIVE_PAGES) break;

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

  waitQueue.length = 0;
  totalLivePages = 0;

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