/** Real browser journey. Run ONLY against a newly created 100-item demo DB.
 * All writes use visible UI controls. API reads capture evidence/assert state.
 * RECORD_DEMO=1 also records an uncut 2560x1440 browser video and timed captions.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const base = process.env.ARCHIVE_URL || "http://127.0.0.1:8000";
const out = path.resolve(
  process.env.ARCHIVE_EVIDENCE ||
    path.join(__dirname, "../test-results/workspace"),
);
const record = process.env.RECORD_DEMO === "1";
const cards = path.resolve(__dirname, "../../catalogue/demo/cards");
const gold = JSON.parse(
  fs.readFileSync(path.resolve(cards, "../benchmark.json"), "utf8"),
).fixtures;
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 2560, height: 1440 },
    ...(record
      ? {
          recordVideo: {
            dir: path.join(out, "raw-video"),
            size: { width: 2560, height: 1440 },
          },
        }
      : {}),
  });
  const page = await context.newPage();
  const clock = Date.now();
  const errors = [],
    chapters = [],
    evidence = {
      versions: { playwright: require("playwright/package.json").version },
      scans: [],
      checks: [],
    };
  page.on("pageerror", (e) => errors.push(e.message));
  const pause = (ms) => page.waitForTimeout(record ? ms : 80);
  const caption = async (title, message, hold = 4800) => {
    chapters.push({ start: (Date.now() - clock) / 1000, title, message });
    console.log(title);
    await pause(hold);
  };
  const shot = (name) =>
    page.screenshot({ path: path.join(out, name + ".png") });
  const state = async () =>
    (await page.request.get(base + "/api/status")).json();
  const job = async () =>
    (
      await page.request.get(
        base + "/api/scans/" + page.url().split("/scan/")[1],
      )
    ).json();
  const nav = async (name) => {
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name, exact: false })
      .click();
    await pause(800);
  };
  const field = async (key, value) => {
    await page.locator("#card-" + key).fill(value);
    if (record) await page.waitForTimeout(180);
  };
  try {
    await page.goto(base + "/workspace/");
    await page.getByRole("heading", { name: /Local history/ }).waitFor();
    const initial = await state();
    assert.equal(
      initial.synthetic_demo,
      true,
      "A separate synthetic demo DB is required",
    );
    assert.equal(
      initial.records,
      100,
      "Use a fresh demo DB, not an existing collection",
    );
    assert.equal(initial.learned_spellings, 0);
    await page.getByLabel("Reviewer name").fill("Alex Morgan (demo)");
    await page.getByRole("heading", { name: /Local history/ }).click();
    await shot("01-collection");
    await caption(
      "100 fictional items, ten kinds of local history",
      "Photographs, clothing, books, helmets, medicine bottles, deeds, maps, brochures, household objects and tools.",
    );
    for (const category of [
      "Helmets & uniform",
      "Maps & plans",
      "Bottles & medicine",
    ]) {
      await page.getByRole("button", { name: category, exact: true }).click();
      assert.equal(await page.locator(".collection-item").count(), 10);
      await pause(2500);
    }
    await page.getByRole("button", { name: /All items/ }).click();
    await page.getByLabel("Search the collection").fill("Cottage conveyance");
    assert.equal(await page.locator(".collection-item").count(), 1);
    await page.locator(".collection-item").click();
    await page
      .getByRole("heading", {
        name: "Cottage conveyance on parchment",
        exact: true,
      })
      .waitFor();
    await caption(
      "The familiar card, front and back",
      "The digital card follows the society’s paper fields, with the item’s location, source and change history alongside.",
    );
    await page
      .getByRole("button", { name: "Back of card", exact: true })
      .click();
    await pause(2400);
    await nav("The collection");
    await page
      .getByRole("button", { name: "Scan an archive card", exact: true })
      .click();
    await page
      .getByLabel("Upload card file")
      .setInputFiles(path.join(cards, "01-first-accession.pdf"));
    await shot("02-ready-to-scan");
    await caption(
      "Accession by scanning a card",
      "This two-page fictional deed card is uploaded to the local OCR engine. The original file will stay with the record.",
    );
    await page
      .getByRole("button", { name: "Start scanning", exact: true })
      .click();
    await page.getByRole("heading", { name: "Reading your card…" }).waitFor();
    await shot("03-real-scanning");
    await page
      .getByRole("heading", { name: "A second pair of eyes." })
      .waitFor({ timeout: 90000 });
    const first = await job();
    evidence.scans.push({ phase: "first_raw", scan: first });
    assert.equal(first.status, "review");
    assert.notEqual(
      first.raw_fields.donated_by,
      gold[0].expected_fields.donated_by,
    );
    assert(first.benchmark.raw.word_accuracy < 100);
    assert.equal(first.suggestions.length, 0);
    await shot("04-uncertain-name");
    await caption(
      "A real OCR error: a name needs help",
      `The scanner read “${first.raw_fields.donated_by}”. The known fictional card says “Helena Quillmere”. Raw word accuracy: ${first.benchmark.raw.word_accuracy}%.`,
      6500,
    );
    const checkPending = async (fixture, teach) => {
      let current = await job();
      while (current.pending.length) {
        const active = [
          "donated_by",
          "associated_people",
          ...current.pending,
        ].find((f) => current.pending.includes(f));
        const expected = fixture.expected_fields[active];
        await page
          .getByLabel("Checked reading", { exact: true })
          .fill(expected);
        if (teach && active === "donated_by") {
          await page
            .getByLabel("Remember this spelling for later scans", {
              exact: true,
            })
            .check();
          await pause(2200);
        }
        const response = page.waitForResponse(
          (r) => r.url().endsWith("/review") && r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Save checked reading", exact: true })
          .click();
        assert.equal((await response).status(), 200);
        current = await job();
        await pause(1000);
      }
      return current;
    };
    const reviewed = await checkPending(gold[0], true);
    evidence.scans.push({ phase: "first_reviewed", scan: reviewed });
    assert.equal(reviewed.benchmark.draft.word_accuracy, 100);
    await shot("05-first-card-corrected");
    await caption(
      "The checked reading is remembered",
      "The original OCR is preserved. The confirmed spelling is saved for later suggestions, and this card now scores 100% against its known text.",
    );
    await page
      .getByRole("button", { name: "Back of card", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Page 2 · back", exact: true })
      .click();
    await pause(2400);
    await page
      .getByLabel("Item category", { exact: true })
      .selectOption("Deeds & documents");
    await page.getByLabel("Item date or era").fill("1924 (fictional)");
    await page.getByLabel("Material", { exact: true }).fill("Paper and ink");
    await page
      .getByLabel("I have checked the complete card", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Accession this item", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Willow Lane garden deed", exact: true })
      .waitFor();
    assert.equal((await state()).records, 101);
    await shot("06-scan-accessioned");
    await caption(
      "Item 101 joins the catalogue",
      "The scan, both card faces and the reviewer’s decisions stay together. Accession happens only after the complete card is checked.",
    );
    await page
      .getByRole("heading", { name: "Accession & change history" })
      .scrollIntoViewIfNeeded();
    await pause(2700);
    await nav("Remembered words");
    await page
      .getByRole("heading", { name: "Remembered words", exact: true })
      .waitFor();
    assert.equal(await page.locator(".dictionary-row").count(), 1);
    await shot("07-remembered-spelling");
    await pause(3200);

    await nav("The collection");
    await page
      .getByRole("button", { name: "Add an item manually", exact: true })
      .click();
    await caption(
      "Manual accession works from the same card",
      "An object without an existing archive card can be entered directly. This new item is a fictional, empty amber medicine bottle.",
    );
    assert.equal(
      await page
        .getByLabel("Take a photo of the item", { exact: true })
        .getAttribute("capture"),
      "environment",
    );
    await page
      .getByLabel("Choose item photos", { exact: true })
      .setInputFiles(
        path.resolve(cards, "../item-photos/fictional-amber-bottle.png"),
      );
    await page
      .getByAltText("Item photograph 1, awaiting accession", { exact: true })
      .waitFor();
    await shot("08-item-photo-before-accession");
    assert.equal(
      (await state()).records,
      101,
      "A photo must not create an accession by itself",
    );
    await caption(
      "Photograph the item before accession",
      "On mobile, “Take item photo” requests the camera. Check the preview or replace it before saving. This demonstration photograph is AI-generated and clearly fictional.",
    );
    const manual = {
      object_name: "Medicine bottle",
      archive_reference_canonical: "DEMO/2026/102",
      title: "Amber medicine bottle from an imagined chemist",
      date_received: "2026-09-10",
      brief_description:
        "Fictional amber bottle with an illustrated paper label. Created to demonstrate the accession of a physical object.",
      donated_by: "Ada Brindlewick (fictional)",
      donation_date: "2026-09-10",
      copyright: "Synthetic training material",
      associated_people: "Ada Brindlewick",
      associated_places: "Collingham; Imagined Willow Lane",
      home_location: "Store B / Box 04",
      home_location_date: "2026-09-10",
      current_location: "Store B / Box 04",
      current_location_date: "2026-09-10",
      physical_description:
        "Amber glass bottle with a narrow neck and an invented paper chemist label. Empty. No historical object is represented.",
      size: "145 mm high; 55 mm diameter",
      condition: "Good; light surface marks",
      notes:
        "FICTIONAL TRAINING ITEM. Donor, provenance and object history are invented.",
      cross_references: "Synthetic collection / medicine containers",
    };
    for (const key of Object.keys(manual).slice(0, 14))
      await field(key, manual[key]);
    await shot("08-manual-front");
    await pause(2200);
    await page
      .getByRole("button", { name: "Back of card", exact: true })
      .click();
    for (const key of Object.keys(manual).slice(14))
      await field(key, manual[key]);
    await page
      .getByLabel("Item category", { exact: true })
      .selectOption("Bottles & medicine");
    await page.getByLabel("Item date or era").fill("circa 1910 (fictional)");
    await page
      .getByLabel("Material", { exact: true })
      .fill("Amber glass and paper");
    await shot("09-manual-back");
    await caption(
      "Describe the physical object",
      "The reverse holds its material description, size, condition and notes. Category and storage location make it findable later.",
    );
    await page
      .getByLabel("I have checked this manual card", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Accession this item", exact: true })
      .click();
    await page
      .getByRole("heading", { name: manual.title, exact: true })
      .waitFor();
    assert.equal((await state()).records, 102);
    const manualId = page.url().split("/item/")[1];
    const manualDetail = await (
      await page.request.get(base + "/api/records/" + manualId)
    ).json();
    assert.equal(manualDetail.photos.length, 1);
    assert.equal(manualDetail.record.photo_count, 1);
    await page
      .getByAltText("Item photograph: " + manual.title, { exact: true })
      .waitFor();
    evidence.item_photograph = manualDetail.photos[0];
    await pause(1800);
    await page
      .getByRole("button", { name: "Arrange a loan", exact: true })
      .click();
    await page
      .getByLabel("Borrower", { exact: true })
      .fill("Fictional exhibition team");
    await page
      .getByLabel("Loan destination", { exact: true })
      .fill("Demo display cabinet");
    await page.getByLabel("Return by", { exact: true }).fill("2026-10-01");
    await page
      .getByLabel("Loan notes", { exact: true })
      .fill("Synthetic demonstration loan.");
    await page
      .getByRole("button", { name: "Record loan", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Demo display cabinet", exact: true })
      .waitFor();
    await caption(
      "Follow the item’s location",
      "Recording a loan updates the current location and the audit history. Returning it restores its previous home.",
    );
    await nav("Loans & locations");
    await page
      .getByRole("button", { name: "Record return", exact: true })
      .click();
    await page.getByText("Returned", { exact: true }).waitFor();
    assert.equal((await state()).open_loans, 0);
    await shot("10-loan-returned");
    await pause(2000);

    await nav("Scan & accession");
    await page
      .getByLabel("Upload card file")
      .setInputFiles(path.join(cards, "02-later-accession.pdf"));
    await caption(
      "A later card, the same difficult name",
      "This is a different accession: a fictional walking brochure. It is scanned afresh by the same optical engine.",
    );
    await page
      .getByRole("button", { name: "Start scanning", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "A second pair of eyes." })
      .waitFor({ timeout: 90000 });
    const later = await job();
    evidence.scans.push({ phase: "later_before_review", scan: later });
    assert.equal(later.suggestions.length, 2);
    assert.equal(later.draft_fields.donated_by, "Helena Quillmere");
    assert.equal(later.benchmark.draft.word_accuracy, 100);
    assert(later.benchmark.raw.word_accuracy < 100);
    assert(later.pending.length > 0);
    await shot("11-later-scan-improved");
    await caption(
      "The saved correction improves the next draft",
      `Raw OCR: ${later.benchmark.raw.word_accuracy}%. With the remembered spelling: ${later.benchmark.draft.word_accuracy.toFixed(2)}% on this known fictional card. Both suggestions still need human approval.`,
      8500,
    );
    await checkPending(gold[1], false);
    await page
      .getByRole("button", { name: "Back of card", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Page 2 · back", exact: true })
      .click();
    await page
      .getByLabel("Item category", { exact: true })
      .selectOption("Brochures & ephemera");
    await page.getByLabel("Item date or era").fill("1930 (fictional)");
    await page.getByLabel("Material", { exact: true }).fill("Printed paper");
    await page
      .getByLabel("I have checked the complete card", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Accession this item", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Orchard walking brochure", exact: true })
      .waitFor();
    await nav("The collection");
    await page.getByLabel("Search the collection").fill("Helena Quillmere");
    assert.equal(await page.locator(".collection-item").count(), 2);
    await shot("12-name-search");
    await caption(
      "The two corrected records are now findable",
      "A search for the confirmed name brings together the deed and the brochure, while retaining their separate accession references.",
    );
    await page.getByLabel("Clear search").click();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Export catalogue", exact: true })
      .click();
    await (await downloaded).saveAs(path.join(out, "post-demo-export.json"));
    const exported = JSON.parse(
      fs.readFileSync(path.join(out, "post-demo-export.json"), "utf8"),
    );
    assert.equal(exported.records.length, 103);
    assert(exported.records.every((r) => r.is_sample));
    const final = await state();
    evidence.final_status = final;
    assert.equal(final.records, 103);
    assert.equal(final.learned_spellings, 1);
    assert.equal(final.pending_scans, 0);
    assert.equal(final.open_loans, 0);
    evidence.checks.push(
      "100-item synthetic seed",
      "category filtering and search",
      "front and back card viewing",
      "real optical PDF scanning",
      "human review and retained source",
      "dictionary reuse on a separate scan",
      "manual accession",
      "loan and return",
      "103-record JSON export",
    );
    await shot("13-complete-collection");
    await caption(
      "103 accessioned items. Every change accounted for.",
      "Two scanned cards and one manually entered object. This demonstration measures two synthetic fixtures; it does not promise 100% accuracy on real archives.",
      7500,
    );
    evidence.page_errors = errors;
    assert.deepEqual(errors, []);
    evidence.duration_seconds = (Date.now() - clock) / 1000;
    chapters.forEach(
      (c, i) => (c.end = chapters[i + 1]?.start || evidence.duration_seconds),
    );
    fs.writeFileSync(
      path.join(out, "chapters.json"),
      JSON.stringify(chapters, null, 2),
    );
    const video = page.video();
    await context.close();
    if (video) {
      const videoPath = await video.path();
      fs.copyFileSync(
        videoPath,
        path.join(out, "archive-walkthrough-1440p.webm"),
      );
    }

    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobile = await phone.newPage();
    await mobile.goto(base + "/workspace/");
    await mobile.getByRole("heading", { name: /Local history/ }).waitFor();
    await mobile.waitForTimeout(300);
    assert.equal(
      await mobile.evaluate(() => document.body.scrollWidth <= innerWidth),
      true,
    );
    await mobile.screenshot({
      path: path.join(out, "14-mobile-collection.png"),
      fullPage: true,
    });
    await mobile
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await mobile
      .locator(".sidebar nav")
      .getByRole("button", { name: "Scan & accession", exact: true })
      .click();
    await mobile
      .getByRole("heading", { name: "Let’s read the card." })
      .waitFor();
    assert.equal(
      await mobile.evaluate(() => document.body.scrollWidth <= innerWidth),
      true,
    );
    await mobile.screenshot({
      path: path.join(out, "15-mobile-scanner.png"),
      fullPage: true,
    });
    await mobile.getByRole("button", { name: /Enter a card manually/ }).click();
    const cameraControl = mobile.getByLabel("Take a photo of the item", {
      exact: true,
    });
    assert.equal(await cameraControl.getAttribute("capture"), "environment");
    await cameraControl.setInputFiles(
      path.resolve(cards, "../item-photos/fictional-amber-bottle.png"),
    );
    await mobile
      .getByAltText("Item photograph 1, awaiting accession", { exact: true })
      .waitFor();
    await mobile
      .locator("#card-title")
      .fill("Unaccessioned mobile photo draft");
    await mobile.reload();
    await mobile
      .getByAltText("Item photograph 1, awaiting accession", { exact: true })
      .waitFor();
    assert.equal(
      await mobile.locator("#card-title").inputValue(),
      "Unaccessioned mobile photo draft",
    );
    await mobile.screenshot({
      path: path.join(out, "16-mobile-item-photo.png"),
      fullPage: true,
    });
    await mobile
      .getByRole("button", { name: "Remove item photo 1", exact: true })
      .click();
    assert.equal(
      await mobile
        .getByAltText("Item photograph 1, awaiting accession", { exact: true })
        .count(),
      0,
    );
    evidence.checks.push(
      "item photo staging, preview, attachment and original retention",
      "mobile camera input and draft recovery",
    );
    evidence.physical_phone_camera_tested = false;
    evidence.checks.push("390px mobile navigation without horizontal overflow");
    await phone.close();

    const legacyContext = await browser.newContext();
    const legacy = await legacyContext.newPage();
    await legacy.goto(base + "/workspace/#/legacy");
    await legacy.waitForFunction(
      () => localStorage.getItem("archiveDb")?.length > 100,
      { timeout: 30000 },
    );
    const stored = await legacy.evaluate(() =>
      localStorage.getItem("archiveDb"),
    );
    await legacy
      .getByRole("button", { name: /Return to the new archive workspace/ })
      .click();
    assert.equal(
      await legacy.evaluate(() => localStorage.getItem("archiveDb")),
      stored,
    );
    evidence.checks.push("earlier browser database loads and is preserved");
    await legacyContext.close();
    fs.writeFileSync(
      path.join(out, "verification.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          checks: evidence.checks,
          final_status: final,
          duration_seconds: evidence.duration_seconds,
          output: out,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await page
      .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
      .catch(() => {});
    fs.writeFileSync(
      path.join(out, "failure.json"),
      JSON.stringify({ error: error.stack, errors, chapters }, null, 2),
    );
    throw error;
  } finally {
    await browser.close();
  }
})();
