import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GLIDE_URL = 'https://gdps-ksa.glide.page/dl/d0a5f4';
const OUTPUT_PATH = join(__dirname, 'raw_data.json');

async function inspectGlideApp() {
  const capturedResponses = [];
  let dataSnapshotUrl = null;

  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Intercept ALL responses
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Capture JSON responses and anything from Glide/Firebase APIs
    if (
      contentType.includes('application/json') ||
      contentType.includes('application/x-protobuf') ||
      url.includes('glideapp') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('googleapis.com')
    ) {
      try {
        const body = await response.text();
        const entry = {
          url,
          status: response.status(),
          contentType,
          timestamp: new Date().toISOString(),
          body: null,
          rawBody: null,
        };

        // Try to parse as JSON
        try {
          entry.body = JSON.parse(body);

          // Extract the dataSnapshot URL from getAppSnapshot response
          if (url.includes('getAppSnapshot') && entry.body.dataSnapshot) {
            dataSnapshotUrl = entry.body.dataSnapshot;
            console.log(`\n🔑 Found dataSnapshot URL: ${dataSnapshotUrl.substring(0, 100)}...`);
          }
        } catch {
          entry.rawBody = body;
        }

        capturedResponses.push(entry);

        const preview = body.substring(0, 200);
        console.log(`\n📦 [${response.status()}] ${url.substring(0, 120)}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Preview: ${preview.substring(0, 150)}...`);
      } catch {
        // Some responses can't be read — skip
      }
    }
  });

  console.log(`\n🌐 Navigating to: ${GLIDE_URL}`);
  await page.goto(GLIDE_URL, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  console.log('\n⏳ Waiting for app to fully load...');
  await sleep(5000);

  // Now fetch the dataSnapshot URL directly — this has the actual row data
  if (dataSnapshotUrl) {
    console.log('\n📊 Fetching data snapshot (actual row data)...');
    try {
      const snapshotResponse = await page.evaluate(async (url) => {
        const res = await fetch(url);
        const text = await res.text();
        return { status: res.status, text };
      }, dataSnapshotUrl);

      let snapshotBody = null;
      try {
        snapshotBody = JSON.parse(snapshotResponse.text);
      } catch {
        snapshotBody = null;
      }

      // The snapshot is base64-encoded — decode it
      let decodedBody = null;
      if (!snapshotBody && snapshotResponse.text) {
        try {
          const decoded = Buffer.from(snapshotResponse.text, 'base64').toString('utf8');
          decodedBody = JSON.parse(decoded);
          console.log('   ✅ Successfully decoded base64 data snapshot');
        } catch (e) {
          console.log('   ⚠️ Failed to decode as base64:', e.message);
        }
      }

      const finalBody = snapshotBody || decodedBody;

      capturedResponses.push({
        url: dataSnapshotUrl,
        status: snapshotResponse.status,
        contentType: 'application/json',
        timestamp: new Date().toISOString(),
        label: 'DATA_SNAPSHOT — Contains actual row data for all tables',
        body: finalBody,
        rawBody: null,
      });

      if (snapshotBody) {
        // Log summary of what we got
        const keys = Object.keys(snapshotBody);
        console.log(`   Snapshot top-level keys: ${keys.join(', ')}`);
        for (const key of keys) {
          const val = snapshotBody[key];
          if (Array.isArray(val)) {
            console.log(`   📋 ${key}: ${val.length} items`);
            if (val.length > 0) {
              console.log(`      First item keys: ${Object.keys(val[0]).join(', ')}`);
              console.log(`      Sample: ${JSON.stringify(val[0]).substring(0, 300)}`);
            }
          } else if (typeof val === 'object' && val !== null) {
            const subKeys = Object.keys(val);
            console.log(`   📋 ${key}: object with ${subKeys.length} keys`);
            // Check if sub-keys contain arrays (table data)
            for (const sk of subKeys.slice(0, 5)) {
              const sv = val[sk];
              if (Array.isArray(sv)) {
                console.log(`      ${sk}: ${sv.length} rows`);
                if (sv.length > 0) {
                  console.log(`         First row: ${JSON.stringify(sv[0]).substring(0, 300)}`);
                }
              }
            }
          }
        }
      } else {
        console.log(`   Raw preview: ${snapshotResponse.text.substring(0, 500)}`);
      }
    } catch (err) {
      console.error('   ❌ Failed to fetch data snapshot:', err.message);
    }
  } else {
    console.log('\n⚠️ No dataSnapshot URL found — trying to extract from page...');

    // Fallback: try to find data via page evaluation
    try {
      const pageData = await page.evaluate(() => {
        // Glide stores data in window.__NEXT_DATA__ or similar globals
        const candidates = ['__NEXT_DATA__', '__GLIDE_DATA__', '__APP_DATA__'];
        for (const key of candidates) {
          if (window[key]) return { key, data: window[key] };
        }
        // Try to find any large data objects on window
        const found = {};
        for (const key of Object.keys(window)) {
          try {
            const val = window[key];
            if (val && typeof val === 'object' && JSON.stringify(val).length > 1000) {
              found[key] = typeof val;
            }
          } catch {}
        }
        return { windowKeys: found };
      });
      console.log('   Page data:', JSON.stringify(pageData).substring(0, 500));
    } catch {}
  }

  // Also click tabs to trigger additional loads
  console.log('\n🔍 Clicking tabs to trigger additional data loads...');
  const navButtons = await page.$$('nav button, [role="tab"]');
  for (const btn of navButtons) {
    try {
      const text = await btn.evaluate((e) => e.textContent?.trim() || '');
      if (text && text.length < 50) {
        console.log(`   🖱️  Clicking: "${text}"`);
        await btn.click();
        await sleep(2000);
      }
    } catch {}
  }

  await sleep(3000);

  // Save all captured responses
  console.log(`\n💾 Saving ${capturedResponses.length} captured responses to ${OUTPUT_PATH}`);
  await writeFile(OUTPUT_PATH, JSON.stringify(capturedResponses, null, 2), 'utf-8');

  console.log('\n✅ Done! Inspect raw_data.json for the captured data.');
  await browser.close();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

inspectGlideApp().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
