const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const outputDirectory = path.resolve(".artifacts");
fs.mkdirSync(outputDirectory, { recursive: true });

async function inspectOverflow(page) {
  return page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    overflowingButtons: [...document.querySelectorAll("button")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.textContent && element.textContent.trim()),
  }));
}

function watchErrors(page, label, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(label + " console: " + message.text());
  });
  page.on("pageerror", (error) => errors.push(label + " page: " + error.message));
}

async function resetToWarehouse(page) {
  const select = page.locator(".simple-protocol select");
  await select.selectOption("field-service-closeout-v1");
  await page.getByText("This maintenance visit is about to close. Is the work complete?", { exact: true }).waitFor();
  await select.selectOption("fulfillment-packout-v1");
  await page.getByText("This order is about to ship. Is the box correct?", { exact: true }).waitFor();
}

let browser;

(async () => {
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const results = {};

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watchErrors(desktop, "desktop", errors);
  await desktop.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await desktop.getByText("PARALLAX", { exact: true }).waitFor();
  await resetToWarehouse(desktop);

  await desktop.getByText("What should be there", { exact: true }).waitFor();
  await desktop.getByText("What is actually there", { exact: true }).waitFor();
  await desktop.getByText("What PARALLAX decides", { exact: true }).waitFor();
  await desktop.getByText("WAITING", { exact: true }).waitFor();
  await desktop.waitForTimeout(700);
  await desktop.screenshot({
    path: path.join(outputDirectory, "simple-initial.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktop.getByRole("button", { name: "Check this package", exact: true }).click();
  await desktop.getByText("No. The box is wrong, so shipping is stopped.", { exact: true }).waitFor();
  await desktop.getByText("STOP", { exact: true }).waitFor();
  await desktop.getByText("Hermes repair plan", { exact: true }).waitFor();
  await desktop.getByText("Shipment paused", { exact: true }).waitFor();
  await desktop.screenshot({
    path: path.join(outputDirectory, "simple-held.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktop.getByRole("button", { name: "Show the corrected result", exact: true }).click();
  await desktop.getByText("Yes. The box is now correct and shipping can continue.", { exact: true }).waitFor();
  await desktop.getByText("CONTINUE", { exact: true }).waitFor();
  await desktop.getByText("Workflow released", { exact: true }).waitFor();
  results.desktop = await inspectOverflow(desktop);
  await desktop.screenshot({
    path: path.join(outputDirectory, "simple-released.png"),
    fullPage: true,
    animations: "disabled",
  });

  if (await desktop.locator(".benchmark-sample").count() !== 6) {
    throw new Error("Warehouse protocol must expose six benchmark views.");
  }
  if (await desktop.locator(".history-record").count() !== 2) {
    throw new Error("Mismatch and correction must remain in visual custody history.");
  }
  await desktop.locator(".benchmark-sample").filter({ hasText: "Complete but cracked product" }).click();
  await desktop.getByText("Ceramic mug / condition", { exact: true }).first().waitFor();
  await desktop.getByText("STOP", { exact: true }).waitFor();
  await desktop.locator(".benchmark-sample").filter({ hasText: "Intact replacement proven" }).click();
  await desktop.getByText("CONTINUE", { exact: true }).waitFor();
  if (await desktop.locator(".history-record").count() !== 4) {
    throw new Error("Damage and replacement evidence must be appended to visual custody history.");
  }
  await desktop.screenshot({
    path: path.join(outputDirectory, "damage-replacement-history.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktop.locator(".simple-protocol select").selectOption("retail-planogram-v1");
  await desktop.getByText("This operation is about to complete. Does reality match the plan?", { exact: true }).waitFor();
  await desktop.locator(".benchmark-sample").filter({ hasText: "Missing water + promo tag" }).click();
  await desktop.getByText("STOP", { exact: true }).waitFor();
  await desktop.getByText("Water facing", { exact: true }).first().waitFor();
  await desktop.screenshot({
    path: path.join(outputDirectory, "benchmark-retail-oblique-block.png"),
    fullPage: true,
    animations: "disabled",
  });
  await desktop.locator(".benchmark-sample").filter({ hasText: "Different spacing, same rules" }).click();
  await desktop.getByText("CONTINUE", { exact: true }).waitFor();
  await desktop.screenshot({
    path: path.join(outputDirectory, "benchmark-retail-oblique-pass.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktop.locator(".technical-details > summary").click();
  await desktop.getByText("Evidence before execution", { exact: true }).waitFor();
  await desktop.screenshot({
    path: path.join(outputDirectory, "technical-proof-open.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktop.locator(".technical-details > summary").click();
  await desktop.locator(".simple-protocol select").selectOption("fulfillment-packout-v1");
  await desktop.locator(".benchmark-sample").filter({ hasText: "Corrected arrangement" }).click();
  await desktop.getByText("Yes. The box is now correct and shipping can continue.", { exact: true }).waitFor();

  const tablet = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  watchErrors(tablet, "tablet", errors);
  await tablet.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await tablet.getByText("Yes. The box is now correct and shipping can continue.", { exact: true }).waitFor();
  results.tablet = await inspectOverflow(tablet);
  await tablet.screenshot({
    path: path.join(outputDirectory, "simple-tablet.png"),
    fullPage: true,
    animations: "disabled",
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  watchErrors(mobile, "mobile", errors);
  await mobile.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await resetToWarehouse(mobile);
  await mobile.getByRole("button", { name: "Check this package", exact: true }).click();
  await mobile.getByText("No. The box is wrong, so shipping is stopped.", { exact: true }).waitFor();
  results.mobile = await inspectOverflow(mobile);
  await mobile.screenshot({
    path: path.join(outputDirectory, "simple-mobile-held.png"),
    fullPage: true,
    animations: "disabled",
  });

  const captureMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  watchErrors(captureMobile, "capture", errors);
  await captureMobile.goto("http://127.0.0.1:5173/capture", { waitUntil: "domcontentloaded" });
  await captureMobile.getByText("Multi-frame video proof", { exact: true }).waitFor();
  await captureMobile.getByText("Record or choose a short video", { exact: true }).waitFor();
  await captureMobile.screenshot({
    path: path.join(outputDirectory, "mobile-video-capture.png"),
    fullPage: true,
    animations: "disabled",
  });

  for (const [label, result] of Object.entries(results)) {
    if (result.page > result.viewport + 1) {
      throw new Error(label + " horizontal overflow: " + JSON.stringify(result));
    }
    if (result.overflowingButtons.length) {
      throw new Error(label + " button text overflow: " + JSON.stringify(result));
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));

  console.log(JSON.stringify({ ok: true, ...results }, null, 2));
  await browser.close();
  browser = undefined;
})().catch(async (error) => {
  if (browser) await browser.close();
  console.error(error);
  process.exitCode = 1;
});