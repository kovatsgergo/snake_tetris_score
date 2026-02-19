#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = {
    url: 'http://localhost:10000/conductor.html',
    outDir: 'artifacts/index3-capture',
    width: 1440,
    height: 980,
    timeoutMs: 25000,
    settleMs: 800,
    caseFile: null,
    fromQuarter: null,
    numQuarters: null,
    staffIndex: null,
    transpose: null,
    spacing: 'engraved',
    font: 'Bravura',
    tempoBpm: null,
    addOverlay: true,
    assertMode: 'none',
    assertTolerancePx: 1.5,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    if (key === '--url') out.url = value;
    if (key === '--out-dir') out.outDir = value;
    if (key === '--width') out.width = Number(value) || out.width;
    if (key === '--height') out.height = Number(value) || out.height;
    if (key === '--timeout-ms') out.timeoutMs = Number(value) || out.timeoutMs;
    if (key === '--settle-ms') out.settleMs = Number(value) || out.settleMs;
    if (key === '--case-file') out.caseFile = value;
    if (key === '--from-quarter') out.fromQuarter = Number(value);
    if (key === '--num-quarters') out.numQuarters = Number(value);
    if (key === '--staff-index') out.staffIndex = Number(value);
    if (key === '--transpose') out.transpose = Number(value);
    if (key === '--spacing') out.spacing = value;
    if (key === '--font') out.font = value;
    if (key === '--tempo-bpm') out.tempoBpm = Number(value);
    if (key === '--add-overlay') out.addOverlay = value !== 'false';
    if (key === '--assert-mode') out.assertMode = String(value || 'none');
    if (key === '--assert-tolerance-px') out.assertTolerancePx = Number(value) || out.assertTolerancePx;
  }
  return out;
}

function resolveChromePath() {
  const envPath = process.env.CHROME_PATH;
  if (envPath) return envPath;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate)) || null;
}

function nowTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'case';
}

function buildSingleCaseFromArgs(args) {
  const name = [
    `fq${Number.isFinite(args.fromQuarter) ? Math.floor(args.fromQuarter) : 'na'}`,
    `nq${Number.isFinite(args.numQuarters) ? Math.floor(args.numQuarters) : 'na'}`,
    `st${Number.isFinite(args.staffIndex) ? Math.floor(args.staffIndex) : 'na'}`,
    `tr${Number.isFinite(args.transpose) ? Math.floor(args.transpose) : 0}`,
    args.spacing || 'engraved',
  ].join('_');
  return [{
    name,
    fromQuarter: Number.isFinite(args.fromQuarter) ? Math.floor(args.fromQuarter) : 0,
    numQuarters: Number.isFinite(args.numQuarters) ? Math.max(1, Math.floor(args.numQuarters)) : 8,
    staffIndex: Number.isFinite(args.staffIndex) ? Math.max(0, Math.floor(args.staffIndex)) : 2,
    transpose: Number.isFinite(args.transpose) ? Math.max(-6, Math.min(6, Math.floor(args.transpose))) : 0,
    spacing: args.spacing || 'engraved',
    font: args.font || 'Bravura',
    tempoBpm: Number.isFinite(args.tempoBpm) ? Number(args.tempoBpm) : null,
    messages: {},
  }];
}

async function loadCases(args) {
  if (!args.caseFile) {
    return buildSingleCaseFromArgs(args);
  }
  const raw = await fs.readFile(path.resolve(args.caseFile), 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Case file must contain a non-empty JSON array.');
  }
  return parsed;
}

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function assertStrictQuarterGrid(report, oneCase, tolerancePx) {
  const failures = [];
  const diagnostics = report && report.diagnostics ? report.diagnostics : null;
  if (!diagnostics) {
    failures.push('missing diagnostics');
    return failures;
  }
  const expectedBeats = Math.max(1, Math.floor(Number(oneCase.numQuarters) || 0));
  const points = Array.isArray(diagnostics.beatSplitPoints) ? diagnostics.beatSplitPoints.map(Number) : [];
  if (points.length !== expectedBeats + 1) {
    failures.push(`beatSplitPoints length ${points.length} != expected ${expectedBeats + 1}`);
    return failures;
  }
  const widths = [];
  for (let i = 1; i < points.length; i += 1) {
    widths.push(points[i] - points[i - 1]);
  }
  if (widths.some((w) => !Number.isFinite(w) || w <= 0)) {
    failures.push('non-finite or non-positive beat width found');
    return failures;
  }
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  if ((maxW - minW) > tolerancePx) {
    failures.push(`beat width spread too large: max-min=${(maxW - minW).toFixed(3)}px > ${tolerancePx}px`);
  }

  const resolvedBars = Array.isArray(diagnostics.resolvedBarlines) ? diagnostics.resolvedBarlines : [];
  const fromQuarter = Number(oneCase.fromQuarter);
  resolvedBars.forEach((bar) => {
    const q = Number(bar && bar.quarterQ);
    const x = Number(bar && bar.x);
    if (!Number.isFinite(q) || !Number.isFinite(x)) return;
    const idx = Math.round(q - fromQuarter);
    if (idx < 0 || idx >= points.length) return;
    const expectedX = points[idx];
    if (Math.abs(expectedX - x) > tolerancePx) {
      failures.push(
        `barline q=${q} x=${x.toFixed(3)} does not match split[${idx}]=${expectedX.toFixed(3)} within ${tolerancePx}px`
      );
    }
  });
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.outDir);
  await fs.mkdir(outDir, { recursive: true });

  let puppeteer;
  try {
    puppeteer = await import('puppeteer-core');
  } catch (error) {
    console.error('Missing dependency: puppeteer-core');
    console.error('Run: npm install -D puppeteer-core');
    process.exit(2);
  }

  const executablePath = resolveChromePath();
  if (!executablePath) {
    console.error('Cannot find a Chromium/Chrome executable.');
    console.error('Set CHROME_PATH to your browser binary.');
    process.exit(2);
  }

  const cases = await loadCases(args);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const batchTag = nowTag();
  const summary = {
    generatedAt: new Date().toISOString(),
    url: args.url,
    count: cases.length,
    results: [],
  };
  const allFailures = [];

  try {
    for (let i = 0; i < cases.length; i += 1) {
      const oneCase = cases[i] || {};
      const page = await browser.newPage();
      await page.setViewport({
        width: args.width,
        height: args.height,
        deviceScaleFactor: 1,
      });
      await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });

      await page.waitForFunction(
        () => typeof window.renderMusicFromSnake === 'function' && window.tannhauserScore,
        { timeout: args.timeoutMs }
      );

      const caseName = sanitizePart(oneCase.name || `case-${i + 1}`);
      const fromQuarter = Math.max(0, Math.floor(toFiniteNumber(oneCase.fromQuarter, 0)));
      const numQuarters = Math.max(1, Math.floor(toFiniteNumber(oneCase.numQuarters, 8)));
      const staffIndex = Math.max(0, Math.floor(toFiniteNumber(oneCase.staffIndex, 2)));
      const transpose = Math.max(-6, Math.min(6, Math.floor(toFiniteNumber(oneCase.transpose, 0))));
      const spacing = String(oneCase.spacing || args.spacing || 'engraved').trim() || 'engraved';
      const font = String(oneCase.font || args.font || 'Bravura').trim() || 'Bravura';
      const tempoBpm = toFiniteNumber(oneCase.tempoBpm, null);
      const messages = oneCase.messages && typeof oneCase.messages === 'object' ? oneCase.messages : {};

      await page.evaluate(async (cfg) => {
        const control2 = document.getElementById('control2');
        if (control2) control2.style.display = 'block';
        const control = document.getElementById('control');
        if (control) control.style.display = 'none';

        if (typeof window.setSelectedStaff === 'function') {
          window.setSelectedStaff(cfg.staffIndex);
        }
        if (typeof window.setScoreFont === 'function') {
          window.setScoreFont(cfg.font);
        }
        if (typeof window.setSpacingMode === 'function') {
          window.setSpacingMode(cfg.spacing);
        }
        if (typeof window.setTransposeSemitones === 'function') {
          window.setTransposeSemitones(String(cfg.transpose));
        }
        if (typeof window.setDebugSliceControls === 'function') {
          window.setDebugSliceControls(String(cfg.fromQuarter), String(cfg.numQuarters));
        }
        if (Number.isFinite(cfg.tempoBpm) && typeof window.setTempo === 'function') {
          window.setTempo(String(cfg.tempoBpm));
        }

        if (typeof window.setSnakeCoordinates === 'function' && cfg.messages.snake) {
          window.setSnakeCoordinates(String(cfg.messages.snake).replace(/^snake\s+/i, ''));
        }
        if (typeof window.setEaten === 'function' && cfg.messages.eaten) {
          window.setEaten(String(cfg.messages.eaten).replace(/^eaten\s+/i, ''));
        }
        if (typeof window.setDynamics === 'function' && cfg.messages.dynamics) {
          window.setDynamics(String(cfg.messages.dynamics).replace(/^dynam\s+/i, ''));
        }
        if (typeof window.setRhythm === 'function' && cfg.messages.rhythm) {
          window.setRhythm(String(cfg.messages.rhythm).replace(/^rhyth\s+/i, ''));
        }
        if (typeof window.setNotemap === 'function' && cfg.messages.notemap) {
          window.setNotemap(String(cfg.messages.notemap).replace(/^notem\s+/i, ''));
        }

        if (typeof window.renderMusicFromSnake === 'function') {
          await window.renderMusicFromSnake();
        }
      }, {
        fromQuarter,
        numQuarters,
        staffIndex,
        transpose,
        spacing,
        font,
        tempoBpm,
        messages,
      });

      await page.waitForFunction(
        (expectedFrom, expectedNum) => {
          const d = window.lastRenderDiagnostics;
          if (!d) return false;
          return (
            Number(d.fromQuarter) === Number(expectedFrom) &&
            Number(d.numQuarters) === Number(expectedNum)
          );
        },
        { timeout: args.timeoutMs },
        fromQuarter,
        numQuarters
      );

      if (args.addOverlay) {
        await page.evaluate(() => {
          const old = document.getElementById('__caseOverlayLines');
          if (old) old.remove();
          const host = document.createElement('div');
          host.id = '__caseOverlayLines';
          host.style.position = 'absolute';
          host.style.inset = '0';
          host.style.pointerEvents = 'none';
          host.style.zIndex = '99999';

          const diag = window.lastRenderDiagnostics || {};
          const points = Array.isArray(diag.beatSplitPoints) ? diag.beatSplitPoints : [];
          const bars = Array.isArray(diag.resolvedBarlines) ? diag.resolvedBarlines : [];
          const score = document.getElementById('score');
          const svg = score ? score.querySelector('svg') : null;
          if (!score || typeof score.getBoundingClientRect !== 'function') return;
          const rect = score.getBoundingClientRect();
          const canMap =
            svg &&
            typeof svg.createSVGPoint === 'function' &&
            typeof svg.getScreenCTM === 'function' &&
            svg.getScreenCTM();
          const svgPoint = canMap ? svg.createSVGPoint() : null;
          const ctm = canMap ? svg.getScreenCTM() : null;

          function toScreenX(rawX) {
            const x = Number(rawX);
            if (!Number.isFinite(x)) return Number.NaN;
            if (svgPoint && ctm) {
              svgPoint.x = x;
              svgPoint.y = 0;
              const screen = svgPoint.matrixTransform(ctm);
              return Number(screen.x);
            }
            return x;
          }

          function addLine(x, color, width = 1) {
            const line = document.createElement('div');
            line.style.position = 'fixed';
            line.style.left = `${toScreenX(x)}px`;
            line.style.top = `${rect.top}px`;
            line.style.width = `${width}px`;
            line.style.height = `${Math.max(1, rect.height)}px`;
            line.style.background = color;
            line.style.opacity = '0.8';
            host.appendChild(line);
          }

          points.forEach((x, idx) => {
            if (!Number.isFinite(Number(x))) return;
            const color = idx === 0 ? '#ff9900' : idx === points.length - 1 ? '#1f72ff' : '#00aa44';
            addLine(Number(x), color, 1);
          });
          bars.forEach((entry) => {
            const x = Number(entry && entry.x);
            if (!Number.isFinite(x)) return;
            addLine(x, '#ff0000', 1);
          });

          document.body.appendChild(host);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, Math.max(50, args.settleMs)));

      const timestamp = nowTag();
      const baseName = `${batchTag}-${String(i + 1).padStart(2, '0')}-${caseName}`;
      const screenshotPath = path.join(outDir, `${baseName}.png`);
      const reportPath = path.join(outDir, `${baseName}.json`);

      await page.screenshot({ path: screenshotPath, fullPage: true });
      const report = await page.evaluate(() => {
        function quarterKey(q) {
          return Number(q).toFixed(6);
        }

        function dedupSortedXs(values, minDelta) {
          const out = [];
          const delta = Number.isFinite(minDelta) ? Math.max(0.01, minDelta) : 1;
          (values || [])
            .map(Number)
            .filter((x) => Number.isFinite(x))
            .sort((a, b) => a - b)
            .forEach((x) => {
              if (!out.length || Math.abs(x - out[out.length - 1]) > delta) {
                out.push(x);
              } else {
                out[out.length - 1] = (out[out.length - 1] + x) / 2;
              }
            });
          return out;
        }

        function buildDerivedOnsetAnchors(diag) {
          if (!diag || !Number.isFinite(diag.fromQuarter) || !Number.isFinite(diag.numQuarters)) {
            return { onsetCount: 0, glyphCount: 0, zipped: [] };
          }
          if (typeof window.getExactSliceData !== 'function') {
            return { onsetCount: 0, glyphCount: 0, zipped: [] };
          }
          const staffIndex = Number(diag.staffIndex) || 0;
          const slice = window.getExactSliceData(
            Number(diag.fromQuarter),
            Number(diag.numQuarters),
            staffIndex
          ) || { events: [] };
          const fromQ = Number(diag.fromQuarter);
          const toQ = fromQ + Number(diag.numQuarters);
          const onsets = [];
          const seen = new Set();
          (slice.events || []).forEach((event) => {
            const q = Number(event && event.startQ);
            if (!Number.isFinite(q) || q < fromQ || q >= toQ) return;
            const key = quarterKey(q);
            if (seen.has(key)) return;
            seen.add(key);
            onsets.push(q);
          });
          onsets.sort((a, b) => a - b);

          const svg = document.querySelector('#score svg');
          const rawXs = [];
          if (svg) {
            svg.querySelectorAll('g.vf-stavenote').forEach((g) => {
              try {
                const box = g.getBBox();
                if (box && Number.isFinite(box.x)) rawXs.push(box.x);
              } catch (_err) {
                // ignore
              }
            });
          }
          const glyphXs = dedupSortedXs(rawXs, 0.5);
          const count = Math.min(onsets.length, glyphXs.length);
          const zipped = [];
          for (let i = 0; i < count; i += 1) {
            zipped.push({ q: onsets[i], x: glyphXs[i] });
          }
          return {
            onsetCount: onsets.length,
            glyphCount: glyphXs.length,
            zipped,
          };
        }

        const diagnostics = window.lastRenderDiagnostics || null;
        return {
          capturedAt: new Date().toISOString(),
          ui: {
            renderInfo: (document.getElementById('renderInfo') || {}).textContent || '',
            debug: (document.getElementById('debug') || {}).textContent || '',
          },
          diagnostics,
          derivedOnsetAnchors: buildDerivedOnsetAnchors(diagnostics),
        };
      });

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      summary.results.push({
        index: i + 1,
        name: caseName,
        fromQuarter,
        numQuarters,
        staffIndex,
        transpose,
        spacing,
        font,
        tempoBpm,
        screenshot: screenshotPath,
        report: reportPath,
        diagnostics: report.diagnostics,
      });

      if (args.assertMode === 'strict-quarter') {
        const failures = assertStrictQuarterGrid(report, { fromQuarter, numQuarters }, args.assertTolerancePx);
        if (failures.length) {
          const row = {
            name: caseName,
            report: reportPath,
            failures,
          };
          allFailures.push(row);
          summary.results[summary.results.length - 1].assertFailures = failures;
        } else {
          summary.results[summary.results.length - 1].assertFailures = [];
        }
      }

      console.log(`[${i + 1}/${cases.length}] saved`, screenshotPath);
      console.log(`[${i + 1}/${cases.length}] saved`, reportPath);

      await page.close();
      void timestamp;
    }

    const summaryPath = path.join(outDir, `${batchTag}-summary.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log('Saved summary:', summaryPath);
    if (allFailures.length > 0) {
      console.error('\nAssertion failures:');
      allFailures.forEach((row) => {
        console.error(`- ${row.name}`);
        row.failures.forEach((message) => {
          console.error(`  * ${message}`);
        });
        console.error(`  report: ${row.report}`);
      });
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
