import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: resolveChromePath(),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await page.goto('http://localhost:10000/index3.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.tannhauserScore && typeof window.renderMusicFromSnake === 'function');

const data = await page.evaluate(async () => {
  const control2 = document.getElementById('control2');
  if (control2) control2.style.display = 'block';
  const control = document.getElementById('control');
  if (control) control.style.display = 'none';
  window.setSelectedStaff(2);
  window.setSpacingMode('engraved');
  window.setScoreFont('Bravura');
  window.setTransposeSemitones('-4');
  window.setDebugSliceControls('106','10');
  await window.renderMusicFromSnake();
  const d = window.lastRenderDiagnostics || {};
  const osmd = window.__osmdDebug || null;
  const out = {
    diagnostics: d,
    hasOsmdGlobal: !!window.osmd,
    hasOpenSheet: !!window.opensheetmusicdisplay,
    osmdKeys: [],
    graphicSheetKeys: [],
    measureListLen: null,
    sampleEntries: []
  };

  const guess = [];
  for (const k of Object.keys(window)) {
    if (/osmd/i.test(k)) guess.push(k);
  }
  out.osmdKeys = guess.slice(0, 30);

  let instance = null;
  if (window.osmdInstance) instance = window.osmdInstance;
  if (!instance && window.__osmdInstance) instance = window.__osmdInstance;
  if (!instance) {
    for (const k of guess) {
      const v = window[k];
      if (v && typeof v === 'object' && v.GraphicSheet) { instance = v; break; }
    }
  }

  if (instance && instance.GraphicSheet) {
    const gs = instance.GraphicSheet;
    out.graphicSheetKeys = Object.keys(gs).slice(0, 60);
    out.measureListLen = Array.isArray(gs.MeasureList) ? gs.MeasureList.length : null;
    if (Array.isArray(gs.MeasureList) && gs.MeasureList.length) {
      const staff0 = gs.MeasureList[0] || [];
      for (let mi = 0; mi < Math.min(4, staff0.length); mi++) {
        const m = staff0[mi];
        const entries = [];
        const list = m && m.staffEntries ? m.staffEntries : [];
        for (let ei = 0; ei < Math.min(6, list.length); ei++) {
          const e = list[ei];
          const ts = e && e.parentSourceStaffEntry && e.parentSourceStaffEntry.Timestamp;
          let real = null;
          if (ts && typeof ts.RealValue === 'number') real = ts.RealValue;
          const absPos = e && e.PositionAndShape ? e.PositionAndShape.AbsolutePosition : null;
          entries.push({
            idx: ei,
            ts: real,
            absX: absPos ? absPos.x : null,
            absY: absPos ? absPos.y : null,
            sourceMeasure: e && e.parentSourceStaffEntry && e.parentSourceStaffEntry.VerticalContainerParent && e.parentSourceStaffEntry.VerticalContainerParent.ParentMeasure ? e.parentSourceStaffEntry.VerticalContainerParent.ParentMeasure.MeasureNumber : null
          });
        }
        out.sampleEntries.push({ measureIndex: mi, entryCount: list ? list.length : 0, entries });
      }
    }
  }

  return out;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
