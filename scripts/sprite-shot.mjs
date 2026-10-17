// Лист спрайтов крупно: node scripts/sprite-shot.mjs → shots/sprites.png
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
await page.goto((process.env.ABF_URL || 'http://localhost:5310/') + '?sprites');
await page.waitForTimeout(800);
await page.locator('#stage').screenshot({ path: 'shots/sprites.png' });
await browser.close();
