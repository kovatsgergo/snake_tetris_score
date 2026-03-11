#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const out = {
    port: 13027,
    runMs: 60000,
    warmupMs: 5000,
    outDir: 'artifacts/conductor7-keysig-tests',
    keepLogs: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    if (key === '--port') out.port = Number(value) || out.port;
    if (key === '--run-ms') out.runMs = Number(value) || out.runMs;
    if (key === '--warmup-ms') out.warmupMs = Number(value) || out.warmupMs;
    if (key === '--out-dir') out.outDir = value;
    if (key === '--keep-logs') out.keepLogs = value === 'true';
  }
  return out;
}

function nowTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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

function spawnProcess(label, cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = {
    label,
    child,
    stdout: [],
    stderr: [],
  };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    const lines = String(chunk).split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => state.stdout.push(line));
  });
  child.stderr.on('data', (chunk) => {
    const lines = String(chunk).split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => state.stderr.push(line));
  });
  return state;
}

async function waitForLine(procState, pattern, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const all = procState.stdout.concat(procState.stderr);
    if (all.some((line) => pattern.test(line))) {
      return true;
    }
    if (procState.child.exitCode !== null) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function stopProcess(procState) {
  if (!procState || !procState.child || procState.child.exitCode !== null) {
    return;
  }
  procState.child.kill('SIGTERM');
}

function summarizeProcess(procState) {
  return {
    label: procState.label,
    exitCode: procState.child.exitCode,
    stdoutTail: procState.stdout.slice(-40),
    stderrTail: procState.stderr.slice(-40),
  };
}

function buildFailures(report) {
  const failures = [];
  const totalChanges = Array.isArray(report.keyProfileChanges)
    ? report.keyProfileChanges.length
    : 0;
  const sameDescriptor = Array.isArray(report.sameDescriptorKeyProfileChanges)
    ? report.sameDescriptorKeyProfileChanges.length
    : 0;
  const midBeat = Array.isArray(report.midBeatKeyProfileChanges)
    ? report.midBeatKeyProfileChanges.length
    : 0;
  const endBeat = Array.isArray(report.endBeatKeyProfileChanges)
    ? report.endBeatKeyProfileChanges.length
    : 0;
  const firstBeatExtra = Array.isArray(report.firstBeatExtraKeyProfileChanges)
    ? report.firstBeatExtraKeyProfileChanges.length
    : 0;
  const snapshotMissing = Number(report.snapshotMissingSamples) || 0;

  if (!Number.isFinite(report.clockSamples) || report.clockSamples < 10) {
    failures.push(`insufficient room-clock samples: ${report.clockSamples}`);
  }
  if (snapshotMissing > 0) {
    failures.push(`currentPhraseSnapshot missing during sampling: ${snapshotMissing}`);
  }
  if (sameDescriptor > 0) {
    failures.push(`key signature changed while phrase descriptor stayed the same: ${sameDescriptor}`);
  }
  if (midBeat > 0) {
    failures.push(`key signature changed in the middle of a phrase (beat 2..N-1): ${midBeat}`);
  }
  if (firstBeatExtra > 0) {
    failures.push(`multiple key-signature changes inside same first-beat window: ${firstBeatExtra}`);
  }
  if (totalChanges === 0) {
    failures.push('no key-signature changes were observed; run may be too short');
  }
  void endBeat;
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

  const server = spawnProcess(
    'server7',
    process.execPath,
    ['server7.js'],
    { env: { PORT: String(args.port) } }
  );
  const serverReady = await waitForLine(server, /Listening on/i, 12000);
  if (!serverReady) {
    console.error('server7 did not start in time.');
    console.error(JSON.stringify(summarizeProcess(server), null, 2));
    stopProcess(server);
    process.exit(1);
  }

  const snake = spawnProcess(
    'snake7-chaos',
    process.execPath,
    ['tmp/snake7-sim-chaos.js'],
    { env: { PORT: String(args.port) } }
  );
  const snakeReady = await waitForLine(snake, /\broom=\d+/i, 12000);
  if (!snakeReady) {
    console.error('snake simulator did not connect in time.');
    console.error(JSON.stringify(summarizeProcess(snake), null, 2));
    stopProcess(snake);
    stopProcess(server);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  const url = `http://127.0.0.1:${args.port}/conductor7.html?room=1&autostart=1&traceTranspose=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(
    () => typeof window.setRoomClock === 'function' && typeof window.renderMusicFromSnake === 'function',
    { timeout: 45000 }
  );

  await page.evaluate((probeConfig) => {
    if (window.__CONDUCTOR7_KEYSIG_PROBE__) {
      return;
    }
    window.__CONDUCTOR7_KEYSIG_PROBE__ = true;

    const startedAt = Date.now();
    const state = {
      warmupMs: Number(probeConfig && probeConfig.warmupMs) || 0,
      clockSamples: 0,
      snapshotMissingSamples: 0,
      keyProfileChanges: [],
      sameDescriptorKeyProfileChanges: [],
      midBeatKeyProfileChanges: [],
      endBeatKeyProfileChanges: [],
      firstBeatKeyProfileChanges: [],
      firstBeatExtraKeyProfileChanges: [],
      currentBeat1Quarter: null,
      beat1KeyChangeCount: 0,
      lastDescriptor: null,
      lastKeyProfile: null,
      descriptorSwitches: [],
    };

    function isPastWarmup() {
      return (Date.now() - startedAt) >= state.warmupMs;
    }

    function keyChangesFingerprint(keyChanges) {
      const list = Array.isArray(keyChanges) ? keyChanges : [];
      return list.map((change) => {
        const q = Number(change && change.q);
        const f = Number(change && change.fifths);
        const qKey = Number.isFinite(q) ? q.toFixed(3) : 'NaN';
        const fKey = Number.isFinite(f) ? Math.floor(f) : 'NaN';
        return `${qKey}:${fKey}`;
      }).join('|');
    }

    function descriptorOf(snapshot) {
      if (!snapshot) return '-';
      return [
        Math.floor(Number(snapshot.fromQuarter) || 0),
        Math.floor(Number(snapshot.numQuarters) || 0),
        Math.floor(Number(snapshot.transposeSemitones) || 0),
      ].join('/');
    }

    function keyProfileOf(snapshot) {
      if (!snapshot) {
        return '-';
      }
      if (snapshot.mode === 'conductor' && Array.isArray(snapshot.staffSlices)) {
        return snapshot.staffSlices.map((slice) => {
          const idx = Number(slice && slice.staffIndex);
          const keys = keyChangesFingerprint(slice && slice.keyChanges);
          return `${Number.isFinite(idx) ? Math.floor(idx) : 'x'}:${keys}`;
        }).join('||');
      }
      return keyChangesFingerprint(snapshot.keyChanges);
    }

    function trackDescriptorSwitch(before, after, beatInPhrase, quarterCounter) {
      if (before === after) {
        return;
      }
      state.descriptorSwitches.push({
        from: before,
        to: after,
        beatInPhrase,
        quarterCounter,
        relMs: Date.now() - startedAt,
      });
    }

    function trackKeyProfileChange(beforeProfile, afterProfile, beforeDescriptor, afterDescriptor, beatInPhrase, quarterCounter) {
      if (beforeProfile === afterProfile) {
        return;
      }
      const change = {
        beforeProfile,
        afterProfile,
        beforeDescriptor,
        afterDescriptor,
        beatInPhrase,
        quarterCounter,
        relMs: Date.now() - startedAt,
      };
      state.keyProfileChanges.push(change);

      const descriptorChanged = beforeDescriptor !== afterDescriptor;
      if (!descriptorChanged) {
        state.sameDescriptorKeyProfileChanges.push(change);
      }
      const beforeDescriptorParts = String(beforeDescriptor || '').split('/');
      const beforePhraseBeats = Math.floor(Number(beforeDescriptorParts[1]));
      const isLastBeatOfPreviousPhrase = (
        Number.isFinite(beforePhraseBeats) &&
        beforePhraseBeats > 1 &&
        beatInPhrase === beforePhraseBeats
      );

      if (beatInPhrase === 1 && Number.isFinite(quarterCounter)) {
        if (state.currentBeat1Quarter !== quarterCounter) {
          state.currentBeat1Quarter = quarterCounter;
          state.beat1KeyChangeCount = 0;
        }
        state.beat1KeyChangeCount += 1;
        state.firstBeatKeyProfileChanges.push({
          ...change,
          switchCountInBeat1: state.beat1KeyChangeCount,
        });
        if (state.beat1KeyChangeCount > 1) {
          state.firstBeatExtraKeyProfileChanges.push({
            ...change,
            switchCountInBeat1: state.beat1KeyChangeCount,
          });
        }
      } else if (isLastBeatOfPreviousPhrase) {
        state.endBeatKeyProfileChanges.push(change);
      } else {
        state.midBeatKeyProfileChanges.push(change);
      }
    }

    const originalSetRoomClock = window.setRoomClock;
    window.setRoomClock = function patchedSetRoomClock() {
      const beforeSnapshot = window.currentPhraseSnapshot || null;
      const beforeDescriptor = descriptorOf(beforeSnapshot);
      const beforeKeyProfile = keyProfileOf(beforeSnapshot);

      const result = originalSetRoomClock.apply(this, arguments);
      if (!isPastWarmup()) {
        return result;
      }

      state.clockSamples += 1;
      const beatInPhrase = Math.floor(Number(window.roomClockBeatInPhrase) || 0);
      const quarterCounter = Math.floor(Number(window.roomClockQuarterCounter));

      const afterSnapshot = window.currentPhraseSnapshot || null;
      if (!afterSnapshot) {
        state.snapshotMissingSamples += 1;
        return result;
      }
      const afterDescriptor = descriptorOf(afterSnapshot);
      const afterKeyProfile = keyProfileOf(afterSnapshot);

      trackDescriptorSwitch(beforeDescriptor, afterDescriptor, beatInPhrase, quarterCounter);
      trackKeyProfileChange(
        beforeKeyProfile,
        afterKeyProfile,
        beforeDescriptor,
        afterDescriptor,
        beatInPhrase,
        quarterCounter
      );

      state.lastDescriptor = afterDescriptor;
      state.lastKeyProfile = afterKeyProfile;
      if (beatInPhrase !== 1) {
        state.currentBeat1Quarter = null;
        state.beat1KeyChangeCount = 0;
      }
      return result;
    };

    const originalCommit = window.commitPhraseSwapTargetSnapshot;
    if (typeof originalCommit === 'function') {
      window.commitPhraseSwapTargetSnapshot = async function patchedCommit() {
        const beforeSnapshot = window.currentPhraseSnapshot || null;
        const beforeDescriptor = descriptorOf(beforeSnapshot);
        const beforeKeyProfile = keyProfileOf(beforeSnapshot);
        const result = await originalCommit.apply(this, arguments);
        if (!isPastWarmup()) {
          return result;
        }
        const afterSnapshot = window.currentPhraseSnapshot || null;
        const beatInPhrase = Math.floor(Number(window.roomClockBeatInPhrase) || 0);
        const quarterCounter = Math.floor(Number(window.roomClockQuarterCounter));
        const afterDescriptor = descriptorOf(afterSnapshot);
        const afterKeyProfile = keyProfileOf(afterSnapshot);
        trackDescriptorSwitch(beforeDescriptor, afterDescriptor, beatInPhrase, quarterCounter);
        trackKeyProfileChange(
          beforeKeyProfile,
          afterKeyProfile,
          beforeDescriptor,
          afterDescriptor,
          beatInPhrase,
          quarterCounter
        );
        return result;
      };
    }

    window.__CONDUCTOR7_KEYSIG_REPORT__ = function conductor7KeysigReport() {
      const traceTail = (typeof window.getTransposeTrace === 'function')
        ? window.getTransposeTrace(200)
        : [];
      return {
        startedAtIso: new Date(startedAt).toISOString(),
        elapsedMs: Date.now() - startedAt,
        clockSamples: state.clockSamples,
        snapshotMissingSamples: state.snapshotMissingSamples,
        keyProfileChanges: state.keyProfileChanges.slice(),
        sameDescriptorKeyProfileChanges: state.sameDescriptorKeyProfileChanges.slice(),
        midBeatKeyProfileChanges: state.midBeatKeyProfileChanges.slice(),
        endBeatKeyProfileChanges: state.endBeatKeyProfileChanges.slice(),
        firstBeatKeyProfileChanges: state.firstBeatKeyProfileChanges.slice(),
        firstBeatExtraKeyProfileChanges: state.firstBeatExtraKeyProfileChanges.slice(),
        descriptorSwitches: state.descriptorSwitches.slice(),
        traceTail,
      };
    };
  }, {
    warmupMs: args.warmupMs,
  });

  await new Promise((resolve) => setTimeout(resolve, Math.max(5000, args.runMs)));

  const report = await page.evaluate(() => {
    if (typeof window.__CONDUCTOR7_KEYSIG_REPORT__ === 'function') {
      return window.__CONDUCTOR7_KEYSIG_REPORT__();
    }
    return null;
  });

  const output = {
    generatedAt: new Date().toISOString(),
    config: {
      port: args.port,
      runMs: args.runMs,
      warmupMs: args.warmupMs,
      url,
    },
    report,
    failures: report ? buildFailures(report) : ['missing key signature regression report'],
    processes: {
      server: summarizeProcess(server),
      snake: summarizeProcess(snake),
    },
  };

  const outputPath = path.join(outDir, `conductor7-keysig-regression-${nowTag()}.json`);
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

  await page.close();
  await browser.close();
  stopProcess(snake);
  stopProcess(server);

  if (output.failures.length > 0) {
    console.error('Key-signature regression FAILED.');
    output.failures.forEach((line) => console.error(`- ${line}`));
    console.error(`Report: ${outputPath}`);
    process.exit(1);
  }

  console.log('Key-signature regression PASSED.');
  console.log(`Report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
