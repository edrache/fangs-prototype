import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [, , url = 'http://127.0.0.1:8080/index.html', outputDir = 'output/web-game'] = process.argv;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 980 } });
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ type: 'console.error', text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push({ type: 'pageerror', text: String(error) });
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await page.evaluate(async () => {
    if (typeof window.advanceTime === 'function') {
      await window.advanceTime(1000 / 60);
      await window.advanceTime(1000 / 60);
    }
  });

  const canvas = page.locator('canvas').first();
  await canvas.screenshot({ path: path.join(outputDir, 'shot-0.png') });

  const state = await page.evaluate(() => {
    if (typeof window.render_game_to_text === 'function') {
      return window.render_game_to_text();
    }

    return null;
  });

  if (state) {
    fs.writeFileSync(path.join(outputDir, 'state-0.json'), state);
  }

  if (consoleErrors.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'errors-0.json'),
      JSON.stringify(consoleErrors, null, 2),
    );
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
