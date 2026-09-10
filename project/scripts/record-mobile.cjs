/** Record the mobile photo draft on a synthetic database. No item is accessioned.
 * This is browser viewport evidence, not a physical phone-camera qualification.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.ARCHIVE_URL || "http://127.0.0.1:8000";
  const out = path.resolve(
    process.env.ARCHIVE_EVIDENCE || "test-results/mobile",
  );
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: {
      dir: path.join(out, "raw-mobile"),
      size: { width: 390, height: 844 },
    },
  });
  try {
    const page = await context.newPage();
    await page.goto(base + "/workspace/");
    await page.getByRole("heading", { name: /Local history/ }).waitFor();
    const before = await (await page.request.get(base + "/api/status")).json();
    assert.equal(before.synthetic_demo, true);
    await page.getByLabel("Reviewer name").fill("Alex Morgan (demo)");
    await page
      .getByRole("button", { name: "Add an item manually", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Enter an archive card", exact: true })
      .waitFor();
    await page.waitForTimeout(4000);
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Take item photo", exact: true })
      .click();
    await (
      await chooser
    ).setFiles(
      path.resolve(
        __dirname,
        "../../catalogue/demo/item-photos/fictional-amber-bottle.png",
      ),
    );
    await page
      .getByAltText("Item photograph 1, awaiting accession", { exact: true })
      .waitFor();
    await page.waitForTimeout(7000);
    await page.locator("#card-title").fill("Fictional bottle: mobile draft");
    await page.waitForTimeout(2500);
    await page.reload();
    await page
      .getByAltText("Item photograph 1, awaiting accession", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator("#card-title").inputValue(),
      "Fictional bottle: mobile draft",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(6500);
    assert.equal(
      (await (await page.request.get(base + "/api/status")).json()).records,
      before.records,
    );
    const video = page.video();
    await context.close();
    fs.copyFileSync(
      await video.path(),
      path.join(out, "mobile-photo-draft.webm"),
    );
    console.log(
      "Mobile photo draft recorded; accession count unchanged. Physical camera not tested.",
    );
  } finally {
    await browser.close();
  }
})();
