VF = Vex.Flow;

const fontStacks = {
  Bravura: [VF.Fonts.Bravura, VF.Fonts.Gonville, VF.Fonts.Custom],
  Gonville: [VF.Fonts.Gonville, VF.Fonts.Bravura, VF.Fonts.Custom],
  Petaluma: [VF.Fonts.Petaluma, VF.Fonts.Gonville, VF.Fonts.Custom],
}

var selectedScoreFontName = 'Bravura';
var spacingMode = 'engraved';
VF.DEFAULT_FONT_STACK = fontStacks[selectedScoreFontName];
const full_Width = 901;
const full_Height = 220;
const scale_Width = 500;
const scale_Height = 72;
const horiz_Padding = 50;
const dynamics_Height = 32;
const game_Width = 16;
const game_Height = 32;
const rhythm_Width = full_Width - scale_Width - horiz_Padding;
var scoreElement = document.getElementById('score');
var renderer = new VF.Renderer(scoreElement, VF.Renderer.Backends.SVG);
//GAME DATA RECEIVED FROM THE SNAKE-TETRIS
var eaten = [];
var snake = [];
var allNotes = [];
//1            5             10       13
var dynamics = [0, 1, 2, 10, 9, 8, 3, 4, 5, 7, 6, 5, 4];

const dynamicsText = [//PETALUMA
  "\u{e4e5}", //REST 0
  "\u{e52a}", //ppp 1
  "\u{e52b}", //pp 2
  "\u{e520}", //p 3
  "\u{e52c}", //mp 4
  "\u{e521}", //m 5
  "\u{e52d}", //mf 6
  "\u{e522}", //f 7
  "\u{e52f}", //ff 8
  "\u{e530}" //fff 9
];

const crescDecresc = [//PETALUMA
  "\u{e53e}",
  "\u{e53f}",
];

const crescDecresc2 = [//WORKS EXCEPT FOR IOS
  "\u{1D192}",
  "\u{1D193}",
];

const dynamicsText3 = [//WORKS EXCEPT FOR IOS
  "\u{1D13D}\u{FE0E}", //REST 0
  "\u{1D18F}\u{1D18F}\u{1D18F}\u{FE0E}", //ppp 1
  "\u{1D18F}\u{1D18F}\u{FE0E}", //pp 2
  "\u{1D18F}\u{FE0E}", //p 3
  "\u{1D190}\u{1D18F}", //mp 4
  "\u{1D190}", //m 5
  "\u{1D190}\u{1D191}", //mf 6
  "\u{1D191}", //f 7
  "\u{1D191}\u{1D191}", //ff 8
  "\u{1D191}\u{1D191}\u{1D191}" //fff 9
];

const dynamicsText2 = [//PLAIN TEXT
  "z", //REST 0
  "ppp", //ppp 1
  "pp", //pp 2
  "p", //p 3
  "mp", //mp 4
  "m", //m 5
  "mf", //mf 6
  "f", //f 7
  "ff", //ff 8
  "fff" //fff 9
];

const DYNAMICS_SOURCE_MIN = 0;
const DYNAMICS_SOURCE_MAX = 9;


const instruments = {
  piano: { name: 'piano', bass: true, violin: true, range: [40, 104], transpose: 0 },//,,E - G''''
  guitar: { name: 'gutar', bass: false, violin: true, range: [52, 84], transpose: 0 },//,E - C'''
  trumpet: { name: 'trumpet', bass: false, violin: true, range: [55, 84], transpose: 2 },//,G - C'''
  saxophone: { name: 'saxophone', bass: false, violin: true, range: [58, 89], transpose: 2 }//,Bb - F'''
};

var instrument = instruments.piano;

var notemap = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1];
var rhythm = [1, 102, 203, 304, 405, 106, 207, 308, 409];
var rhythmNotes = [];

var playbarTimeout;
var playbarAnimationFrame = 0;
// Playhead is disabled until explicitly re-enabled.
var playheadEnabled = false;
// Stored in BPM for stable shared beat logic.
var tempo = 60;
var metronomeQuarterUntilMs = 0;
var metronomeEighthUntilMs = 0;
var metronomeLastEighthIndex = null;
var lastServerMessageTimeMs = null;
var serverClockOffsetMs = 0;
var bestClockSyncRttMs = Number.POSITIVE_INFINITY;
var hasClockSync = false;
var PLAYBACK_SYNC_LEAD_MS = 180;
var METRONOME_FLASH_MS = 90;
var staveScale;
var voiceScale;
var staveBass;
var staveMain;
var voiceMain;
var staveRhythm;
var voiceRhythm;
//var staveDynamics;
//var voiceDynamics;
var context

for (let i = 0; i < 12; i++) {
  var noteName = intToNotename(i);
  var note = new VF.StaveNote({
    keys: [noteName + '/4'],
    duration: 'w'
  });
  if (noteName.length > 1) {
    note.addAccidental(0, new VF.Accidental(getAccidental(noteName)));
  }
  allNotes.push(note);
}

voiceScale = new VF.Voice({
  num_beats: 12,
  beat_value: 1
});

//console.log("allnotes before" + allNotes);
voiceScale.addTickables(allNotes);
/* voiceScale.getTickables()[0].addModifier(0, new VF.Annotation('USE THESE')
  .setJustification(VF.Annotation.Justify.LEFT)); */
formatter = new VF.Formatter().joinVoices([voiceScale]).format([voiceScale], scale_Width);

function setRange(instru) {
  instrument = instruments[instru];
  instrument.factorX = (instrument.range[1] - instrument.range[0]) / (game_Width - 1);
  instrument.factorY = (instrument.range[1] - instrument.range[0]) / (game_Height - 1);
}

function normalizeScoreFontName(fontName) {
  if (Object.prototype.hasOwnProperty.call(fontStacks, fontName)) {
    return fontName;
  }
  return 'Bravura';
}

function normalizeSpacingMode(mode) {
  return mode === 'linear' ? 'linear' : 'engraved';
}

function setDynamicsCanvasFont() {
  var canvas = document.getElementById('dynCanvas');
  if (!canvas) {
    return;
  }
  var ctx = canvas.getContext('2d');
  // Keep Petaluma fallback for dynamics glyphs if selected font is not installed as a webfont.
  ctx.font = '32px ' + selectedScoreFontName + ', Petaluma';
}

// Variant 2 uses a fixed default instrument (no startup selector).
setRange('piano');

setDynamicsCanvasFont();

function clearScore() {
  renderer.ctx.svg.remove();
  setRenderInfo('');

  renderer = new VF.Renderer(scoreElement, VF.Renderer.Backends.SVG);
  // Configure the rendering context.
  renderer.resize(full_Width, full_Height);
  context = renderer.getContext()
    .setFont("Arial", 10, "");

  if (instrument.violin) {
    staveMain = new VF.Stave(0, scale_Height, full_Width - 1);
    staveMain.addClef("treble");
    staveMain.setContext(context).draw();
  }

}


//TEMPO
function setTempo(t) {
  //var quarterPerSecond = Number(t) * 0.25 + 0.25;
  //tempo = quarterPerSecond * 60;
  tempo = t*15+50
  updateTempoDisplay();
}

function quarterRatePerSecond() {
  return Math.max(tempo, 1e-6) / 60;
}

function updateTempoDisplay() {
  var bpmEl = document.getElementById('bpmValue');
  if (!bpmEl) {
    return;
  }
  var rounded = Math.round(tempo * 15) / 10;
  bpmEl.textContent = (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)) + ' BPM';
}

function setSpacingMode(mode) {
  var normalizedMode = normalizeSpacingMode(mode);
  if (spacingMode === normalizedMode) {
    return;
  }
  spacingMode = normalizedMode;
  var spacingSelect = document.getElementById('spacingMode');
  if (spacingSelect && spacingSelect.value !== spacingMode) {
    spacingSelect.value = spacingMode;
  }
  renderMusicFromSnake();
}

function setScoreFont(fontName) {
  var normalizedFont = normalizeScoreFontName(fontName);
  if (selectedScoreFontName === normalizedFont) {
    return;
  }
  selectedScoreFontName = normalizedFont;
  VF.DEFAULT_FONT_STACK = fontStacks[selectedScoreFontName];
  var fontSelect = document.getElementById('scoreFont');
  if (fontSelect && fontSelect.value !== selectedScoreFontName) {
    fontSelect.value = selectedScoreFontName;
  }
  setDynamicsCanvasFont();
  renderMusicFromSnake();
}

function syncRenderOptionControls() {
  var spacingSelect = document.getElementById('spacingMode');
  if (spacingSelect) {
    spacingSelect.value = spacingMode;
  }
  var fontSelect = document.getElementById('scoreFont');
  if (fontSelect) {
    fontSelect.value = selectedScoreFontName;
  }
}

window.setSpacingMode = setSpacingMode;
window.setScoreFont = setScoreFont;
window.setPlayheadEnabled = function (enabled) {
  playheadEnabled = !!enabled;
};

updateTempoDisplay();
syncRenderOptionControls();

//https://stackoverflow.com/questions/1985260/
//rotate-the-elements-in-an-array-in-javascript/33451102#33451102
function arrayRotate(arr, count) {
  count -= arr.length * Math.floor(count / arr.length);
  arr.push.apply(arr, arr.splice(0, count));
  return arr;
}

//NOTEMAP
function setNotemap(message) {
  messageArray = message.split(" ");
  notemap = messageArray.map((val) => {
    return Number(val);
  });
  notemap = arrayRotate(notemap, -instrument.transpose);
}

//DYNAMICS
function setDynamics(message) {
  messageArray = message.split(" ");
  dynamics = messageArray.map((val) => {
    return Number(val);
  });
}

//RHYTHM
function setRhythm(message) {
  rhythm = message.split(" ");
}

function fakeStart() {
  clearScore();
  //setEaten("1 2 0 1 1 0.8");
  //H                   E    L        L        O
  //1    2    3    4    5    6    7   8    9   10   11   12   13
  setSnake("0 31 7 15 7 15 0 31 0 31 0 31 0 0 0 31 0 0 7 15 0 31 0 31 7 15", true);
}

//SNAKE (MAIN FUNCTION)
function setSnake(message, fakeStart) {
  //STOP PLAYBAR
  stopPlaybarMotion();

  //SET SNAKE
  messageArray = message.split(" ");
  snake = messageArray.map((val) => {
    return Number(val);
  });

  clearScore();

  notes = [];
  for (var i = 0; i < snake.length; i += 2) {
    /* keyX = snake[i] * 4 + 40; //40 = nagy G
    keyY = snake[i + 1] * 2 + 40; */
    keyX = Math.round(snake[i] * instrument.factorX) + instrument.range[0];
    keyY = Math.round(snake[i + 1] * instrument.factorY) + instrument.range[0];
    //console.log(keyX +' '+keyY);
    var keys = (keyX > keyY) ? [keyX, keyY] : [keyY, keyX];
    notes.push(new VF.StaveNote({ //BOTTOM to TOP
      keys: [intToNotename(keys[1], true), intToNotename(keys[0], true)],
      duration: 'q'
    }));
  }

  voiceMain = new VF.Voice({
    num_beats: snake.length / 2,
    beat_value: 4
  });

  voiceMain.addTickables(notes);
  voiceMain.getTickables().forEach((item) => {
    item.stem.hide = true;
  });

  //console.log(eaten);
  var scale = numberToScale(Number(eaten[4]));
  var base = (eaten[4] != '0.0') ? intToNotename(
    (Math.round(Number(eaten[3])) * 7 + instrument.transpose)
    % 12, null) : "";

  context = renderer.getContext()
    .setFont("Arial", 50, "");
  if (!fakeStart)
    context.fillText(base + ' ' + scale, 100, 140);
  else
    context.fillText('X chord', 100, 140);
  /*baseScale = new VF.Annotation(base + ' ' + scale)
    .setFont("Times", 30, '')
    .setJustification(VF.Annotation.Justify.LEFT);
  //y = math.max (y,0)
  voiceMain.getTickables()[0]
    .addModifier(0, baseScale);*/

  formatter = new VF.Formatter().joinVoices([voiceMain]).format([voiceMain], full_Width);
  voiceMain.draw(context, staveMain);

  drawLine(voiceMain, context);
  drawDynamics(voiceMain, context);

  if (!fakeStart)
    drawAndAnimatePlaybar(voiceMain.getTickables()[0].getAbsoluteX(), context);
}

function propabilityToColor(prob) {
  var d = prob * 10;
  var red = Math.min(Math.max(d - 5, 0), 4) * 60;
  var green = (Math.min(5 - Math.max(Math.abs(5 - d), 0), 4)) * 60;
  var blue = (Math.min(Math.max(5 - d, 0), 4)) * 60;
  var alpha = Math.min(prob, 0.5) * 2;
  return 'rgba(' + red + ', ' +
    green + ', ' +
    blue + ', ' +
    alpha + ')';
}


function drawAndAnimatePlaybar(startX, context) {
  var playbarTopY = Math.max(0, scale_Height - 70);
  var playbarBottomY = Math.min(full_Height - 1, scale_Height + 120);
  const group = context.openGroup();
  context.beginPath();
  context.moveTo(startX, playbarTopY);
  context.lineTo(startX, playbarBottomY);
  context.stroke();
  context.closeGroup();

  //group.classList.remove('scroll');
  const box = group.getBoundingClientRect();
  group.classList.add('scroll');

  var x = snake.length / (quarterRatePerSecond() * 2);
  //console.log(x + ' seconds');
  //group.style.transition = "transform " + x + "s linear";
  group.style.transitionDuration = x + "s";
  group.style.webkitTransitionDuration = x + "s";
  //group.classList.remove('scrolling');
  group.classList.add('scrolling');
  //console.log(x * 1000);
  playbarTimeout = setTimeout(function () {
    wsSend('snake')
  }, x * 1000);
}

function serverNowMs() {
  return Date.now() + serverClockOffsetMs;
}

function setServerMessageTime(serverMs) {
  var parsed = Number(serverMs);
  if (Number.isFinite(parsed)) {
    lastServerMessageTimeMs = parsed;
  }
}

function applyClockSyncSample(clientSentMs, serverMs, clientReceivedMs) {
  var t0 = Number(clientSentMs);
  var ts = Number(serverMs);
  var t1 = Number(clientReceivedMs);
  if (!Number.isFinite(t0) || !Number.isFinite(ts) || !Number.isFinite(t1) || t1 < t0) {
    return;
  }

  var rtt = t1 - t0;
  var midpoint = t0 + rtt / 2;
  var candidateOffset = ts - midpoint;
  if (!hasClockSync) {
    serverClockOffsetMs = candidateOffset;
    bestClockSyncRttMs = rtt;
    hasClockSync = true;
    return;
  }

  if (rtt <= bestClockSyncRttMs * 1.5) {
    serverClockOffsetMs = serverClockOffsetMs * 0.8 + candidateOffset * 0.2;
    bestClockSyncRttMs = Math.min(bestClockSyncRttMs, rtt);
  }
}

window.setServerMessageTime = setServerMessageTime;
window.applyClockSyncSample = applyClockSyncSample;

function setMetronomeLedOn(ledId, isOn) {
  var led = document.getElementById(ledId);
  if (!led) {
    return;
  }
  if (isOn) {
    led.classList.add('met-led-on');
  } else {
    led.classList.remove('met-led-on');
  }
}

function setBeatIndexDisplay(beatNumber, totalBeats) {
  var beatEl = document.getElementById('metBeatIndex');
  if (!beatEl) {
    return;
  }
  var safeTotal = Math.max(1, Math.floor(Number(totalBeats) || 1));
  var safeBeat = Math.floor(Number(beatNumber) || 1);
  safeBeat = Math.max(1, Math.min(safeTotal, safeBeat));
  beatEl.textContent = String(safeBeat);
}

function refreshMetronomeVisual(nowMs) {
  setMetronomeLedOn('metLedQuarter', nowMs < metronomeQuarterUntilMs);
  setMetronomeLedOn('metLedEighth', nowMs < metronomeEighthUntilMs);
}

function flashQuarterLed(nowMs) {
  metronomeEighthUntilMs = 0;
  metronomeQuarterUntilMs = nowMs + METRONOME_FLASH_MS;
}

function flashEighthLed(nowMs) {
  metronomeQuarterUntilMs = 0;
  metronomeEighthUntilMs = nowMs + METRONOME_FLASH_MS;
}

function resetMetronome() {
  metronomeQuarterUntilMs = 0;
  metronomeEighthUntilMs = 0;
  metronomeLastEighthIndex = null;
  refreshMetronomeVisual(serverNowMs());
  setBeatIndexDisplay(1, 1);
}

function advanceMetronome(currentQuarter, nowMs) {
  var currentEighthIndex = Math.floor(currentQuarter * 2 + 1e-6);
  if (metronomeLastEighthIndex === null) {
    metronomeLastEighthIndex = currentEighthIndex - 1;
  }
  for (var idx = metronomeLastEighthIndex + 1; idx <= currentEighthIndex; idx++) {
    if (idx % 2 === 0) {
      // Quarter pulse.
      flashQuarterLed(nowMs);
    } else {
      // Offbeat eighth pulse (so it alternates with quarter flash).
      flashEighthLed(nowMs);
    }
  }
  metronomeLastEighthIndex = currentEighthIndex;
  refreshMetronomeVisual(nowMs);
}

function stopPlaybarMotion() {
  if (playbarTimeout) {
    clearTimeout(playbarTimeout);
    playbarTimeout = 0;
  }
  if (playbarAnimationFrame) {
    cancelAnimationFrame(playbarAnimationFrame);
    playbarAnimationFrame = 0;
  }
  resetMetronome();
}

function normalizeHorizontalSpan(leftX, rightX) {
  var left = Number(leftX);
  var right = Number(rightX);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }
  if (right < left) {
    var swap = left;
    left = right;
    right = swap;
  }
  return {
    left: left,
    width: Math.max(1, right - left),
  };
}

function noteLeftEdgeX(note) {
  if (note && typeof note.getBoundingBox === 'function') {
    try {
      var bb = note.getBoundingBox();
      if (bb) {
        var bbX = Number(typeof bb.getX === 'function' ? bb.getX() : bb.x);
        if (Number.isFinite(bbX)) {
          return bbX;
        }
      }
    } catch (error) {
      // Fallback to metrics-based estimate when bounding box is unavailable.
    }
  }

  if (!note || typeof note.getAbsoluteX !== 'function') {
    return Number.NaN;
  }
  var leftX = note.getAbsoluteX();
  if (!Number.isFinite(leftX)) {
    return Number.NaN;
  }
  if (typeof note.getMetrics === 'function') {
    try {
      var metrics = note.getMetrics();
      leftX -= (metrics.modLeftPx || 0) + (metrics.leftDisplacedHeadPx || 0);
    } catch (error) {
      // Keep absolute X fallback when metrics are not available.
    }
  }
  return leftX;
}

function noteRightEdgeX(note, options) {
  options = options || {};
  var useBoundingBox = options.useBoundingBox !== false;
  if (useBoundingBox && note && typeof note.getBoundingBox === 'function') {
    try {
      var bb = note.getBoundingBox();
      if (bb) {
        var bbX = Number(typeof bb.getX === 'function' ? bb.getX() : bb.x);
        var bbW = Number(typeof bb.getW === 'function' ? bb.getW() : bb.w);
        if (Number.isFinite(bbX) && Number.isFinite(bbW) && bbW > 0) {
          return bbX + bbW;
        }
      }
    } catch (error) {
      // Fallback to metrics-based estimate when bounding box is unavailable.
    }
  }

  if (!note || typeof note.getAbsoluteX !== 'function') {
    return Number.NaN;
  }
  var leftX = noteLeftEdgeX(note);
  if (!Number.isFinite(leftX)) {
    return Number.NaN;
  }
  var width = Number.NaN;
  if (typeof note.getMetrics === 'function') {
    try {
      var metrics = note.getMetrics();
      width = metrics && Number.isFinite(metrics.width) ? metrics.width : Number.NaN;
    } catch (error) {
      width = Number.NaN;
    }
  }
  if (!Number.isFinite(width) && typeof note.getWidth === 'function') {
    width = note.getWidth();
  }
  if (!Number.isFinite(width)) {
    width = 1;
  }
  return leftX + Math.max(1, width);
}

function noteBarlineCollisionRightEdgeX(note) {
  var right = Number.NaN;

  if (note && typeof note.getNoteHeadEndX === 'function') {
    try {
      right = Number(note.getNoteHeadEndX());
    } catch (error) {
      right = Number.NaN;
    }
  }

  if (!Number.isFinite(right) && note && typeof note.getAbsoluteX === 'function' && typeof note.getGlyphWidth === 'function') {
    var absX = Number(note.getAbsoluteX());
    var glyphW = Number(note.getGlyphWidth());
    if (Number.isFinite(absX) && Number.isFinite(glyphW)) {
      right = absX + glyphW;
    }
  }

  if (Number.isFinite(right) && note && typeof note.getMetrics === 'function') {
    try {
      var metrics = note.getMetrics();
      var modRightPx = Number(metrics && metrics.modRightPx);
      if (Number.isFinite(modRightPx) && modRightPx > 0) {
        right += modRightPx;
      }
    } catch (error) {
      // Keep right edge from notehead / glyph fallback.
    }
  }

  if (Number.isFinite(right)) {
    return right;
  }

  // Final fallback for unsupported tickables.
  return noteRightEdgeX(note, { useBoundingBox: false });
}

function staffRightEdgeX() {
  if (!staveMain) {
    return Number.NaN;
  }
  var right = staveMain.getX() + staveMain.getWidth();
  return Number.isFinite(right) ? right : Number.NaN;
}

function buildEventVisualSpans(sliceEvents, notes, options) {
  options = options || {};
  var EPS = 1e-6;
  var spans = [];
  if (!sliceEvents || !notes || sliceEvents.length !== notes.length) {
    return spans;
  }
  for (var i = 0; i < sliceEvents.length; i++) {
    var event = sliceEvents[i];
    var note = notes[i];
    var left = noteLeftEdgeX(note);
    var right = options.useBarlineCollisionRightEdge ?
      noteBarlineCollisionRightEdgeX(note) :
      noteRightEdgeX(note, {
        useBoundingBox: options.useBoundingBoxRight !== false,
      });
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left + EPS) {
      continue;
    }
    spans.push({
      startQ: Number(event.startQ),
      endQ: Number(event.startQ) + Number(event.durationQ || 0),
      leftX: left,
      rightX: right,
      isRest: !!event.isRest,
      isMeasureRest: !!event.measureRest,
    });
  }
  spans.sort(function (a, b) {
    if (a.startQ !== b.startQ) {
      return a.startQ - b.startQ;
    }
    return a.leftX - b.leftX;
  });
  return spans;
}

function buildResolvedBarlineXMap(barlinesQ, xForQuarterBarline, sliceEvents, notes) {
  var resolved = new Map();
  if (!barlinesQ || barlinesQ.length === 0 || typeof xForQuarterBarline !== 'function') {
    return resolved;
  }

  var EPS = 1e-6;
  var BARLINE_PADDING_PX = 2;
  // 0.5 = visually balanced midpoint between occupied content before/after barline.
  var BARLINE_BALANCE = 0.5;
  // For bars that begin a rest-only interval, keep the barline closer to the
  // preceding content so the previous beat does not end with a large empty gap.
  var BARLINE_BALANCE_REST_RUN_START = 0.08;
  // For barline collision checks avoid full note bounding boxes, which can include
  // beam/tuplet geometry and over-constrain barline placement.
  var spans = buildEventVisualSpans(sliceEvents, notes, {
    useBarlineCollisionRightEdge: true,
  });
  var sortedBars = barlinesQ.slice().map(Number).sort(function (a, b) { return a - b; });
  var prevResolvedX = Number.NEGATIVE_INFINITY;
  var staffRight = staffRightEdgeX();
  var maxRightX = Number.isFinite(staffRight) ? (staffRight - 1) : Number.POSITIVE_INFINITY;

  sortedBars.forEach(function (barQ, barIndex) {
    var baseX = xForQuarterBarline(barQ);
    var nextBarQ = barIndex + 1 < sortedBars.length ? sortedBars[barIndex + 1] : Number.NaN;
    var startsRestOnlyInterval = Number.isFinite(nextBarQ) &&
      !intervalHasNonMeasureContent(sliceEvents, barQ, nextBarQ);
    var prevRight = Number.NEGATIVE_INFINITY;
    var nextLeft = Number.POSITIVE_INFINITY;

    spans.forEach(function (span) {
      // Whole-measure rests are recentered after draw and should not push barlines.
      if (span.isMeasureRest) {
        return;
      }
      if (span.endQ <= barQ + EPS) {
        prevRight = Math.max(prevRight, span.rightX);
      }
      if (span.startQ >= barQ - EPS) {
        var startsAtThisBar = Math.abs(span.startQ - barQ) <= EPS;
        // A rest that starts exactly on the barline should not force the
        // barline left; treat pitched content as the true right-side obstacle.
        if (startsAtThisBar && span.isRest && !span.isMeasureRest) {
          return;
        }
        nextLeft = Math.min(nextLeft, span.leftX);
      }
    });

    var minAllowedX = Number.isFinite(prevRight) ? prevRight + BARLINE_PADDING_PX : Number.NEGATIVE_INFINITY;
    var maxAllowedX = Number.isFinite(nextLeft) ? nextLeft - BARLINE_PADDING_PX : Number.POSITIVE_INFINITY;

    var x = baseX;
    var hasMin = Number.isFinite(minAllowedX);
    var hasMax = Number.isFinite(maxAllowedX);

    if (hasMin && hasMax) {
      if (minAllowedX <= maxAllowedX) {
        // Prefer centered whitespace before/after barline inside the collision-safe window.
        var balance = startsRestOnlyInterval ? BARLINE_BALANCE_REST_RUN_START : BARLINE_BALANCE;
        x = minAllowedX + balance * (maxAllowedX - minAllowedX);
      } else {
        // Overcrowded measure: keep safety by anchoring after occupied content.
        x = minAllowedX;
      }
    } else if (hasMin) {
      x = Math.max(x, minAllowedX);
    } else if (hasMax) {
      x = Math.min(x, maxAllowedX);
    }

    // Keep barlines strictly increasing.
    if (x <= prevResolvedX + 1) {
      x = prevResolvedX + 1;
    }
    if (x > maxRightX) {
      x = maxRightX;
    }

    resolved.set(quarterKey(barQ), x);
    prevResolvedX = x;
  });

  return resolved;
}

function intervalHasNonMeasureContent(sliceEvents, startQ, endQ) {
  var EPS = 1e-6;
  var start = Number(startQ);
  var end = Number(endQ);
  if (!Array.isArray(sliceEvents) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start + EPS) {
    return false;
  }

  for (var i = 0; i < sliceEvents.length; i++) {
    var event = sliceEvents[i];
    if (!event || event.measureRest) {
      continue;
    }
    var evStart = Number(event.startQ);
    var evDur = Number(event.durationQ || 0);
    var evEnd = evStart + evDur;
    if (!Number.isFinite(evStart) || !Number.isFinite(evEnd) || evEnd <= evStart + EPS) {
      continue;
    }
    if (evEnd > start + EPS && evStart < end - EPS) {
      return true;
    }
  }
  return false;
}

function redistributeRestOnlyBarlines(
  resolvedBarlineXMap,
  barlinesQ,
  sliceEvents,
  notes,
  sliceEndQ,
  rightEdgeX
) {
  if (!resolvedBarlineXMap || typeof resolvedBarlineXMap.has !== 'function') {
    return;
  }
  if (!Array.isArray(barlinesQ) || barlinesQ.length < 2) {
    return;
  }

  var EPS = 1e-6;
  var bars = barlinesQ
    .map(Number)
    .filter(function (q) { return Number.isFinite(q); })
    .sort(function (a, b) { return a - b; });
  if (!bars.length || !Number.isFinite(sliceEndQ) || !Number.isFinite(rightEdgeX)) {
    return;
  }

  var spans = buildEventVisualSpans(sliceEvents, notes, {
    useBarlineCollisionRightEdge: true,
  });
  var initialResolvedBarlineXMap = new Map(resolvedBarlineXMap);
  var MAX_PRE_CONTENT_GAP_PX = 32;

  function minContentLeftXInRange(startQ, endQ) {
    var minLeft = Number.POSITIVE_INFINITY;
    for (var s = 0; s < spans.length; s++) {
      var span = spans[s];
      if (!span || span.isMeasureRest) {
        continue;
      }
      if (span.startQ >= startQ - EPS && span.startQ < endQ - EPS) {
        minLeft = Math.min(minLeft, span.leftX);
      }
    }
    return Number.isFinite(minLeft) ? minLeft : Number.NaN;
  }

  var boundaryQs = bars.concat([sliceEndQ]);
  var intervalHasContent = new Array(bars.length);
  for (var i = 0; i < bars.length; i++) {
    intervalHasContent[i] = intervalHasNonMeasureContent(
      sliceEvents,
      boundaryQs[i],
      boundaryQs[i + 1]
    );
  }

  var idx = 0;
  while (idx < intervalHasContent.length) {
    if (intervalHasContent[idx]) {
      idx++;
      continue;
    }
    var runStart = idx;
    while (idx < intervalHasContent.length && !intervalHasContent[idx]) {
      idx++;
    }
    var runEnd = idx - 1;

    var anchorLeftBoundaryIndex = runStart;
    var firstMovableBoundaryIndex = runStart + 1;
    var lastMovableBoundaryIndex = Math.min(runEnd + 1, bars.length - 1);
    if (firstMovableBoundaryIndex > lastMovableBoundaryIndex) {
      continue;
    }

    var anchorRightBoundaryIndex = Math.min(runEnd + 2, bars.length);

    var leftQ = boundaryQs[anchorLeftBoundaryIndex];
    var leftKey = quarterKey(leftQ);
    if (!resolvedBarlineXMap.has(leftKey)) {
      continue;
    }
    var leftX = resolvedBarlineXMap.get(leftKey);

    var rightQ = boundaryQs[anchorRightBoundaryIndex];
    var rightKey = quarterKey(rightQ);
    var rightX = Number.NaN;
    if (anchorRightBoundaryIndex < bars.length && resolvedBarlineXMap.has(rightKey)) {
      rightX = resolvedBarlineXMap.get(rightKey);
    } else if (anchorRightBoundaryIndex === bars.length || Math.abs(rightQ - sliceEndQ) <= EPS) {
      rightX = rightEdgeX;
      // If there is visible content after the last movable barline, do not push
      // that barline beyond the first onset in the trailing interval.
      var trailingStartQ = boundaryQs[lastMovableBoundaryIndex];
      var firstTrailingContentX = minContentLeftXInRange(trailingStartQ, sliceEndQ);
      if (Number.isFinite(firstTrailingContentX)) {
        rightX = Math.min(rightX, firstTrailingContentX - 2);
      }
    }

    if (
      !Number.isFinite(leftX) ||
      !Number.isFinite(rightX) ||
      rightQ <= leftQ + EPS ||
      rightX <= leftX + 1
    ) {
      continue;
    }

    var prevX = leftX;
    for (var boundaryIdx = firstMovableBoundaryIndex; boundaryIdx <= lastMovableBoundaryIndex; boundaryIdx++) {
      var q = boundaryQs[boundaryIdx];
      var qKey = quarterKey(q);
      var ratio = (q - leftQ) / (rightQ - leftQ);
      var targetX = leftX + ratio * (rightX - leftX);

      var barsRemainingAfter = lastMovableBoundaryIndex - boundaryIdx;
      var maxXForThis = rightX - (barsRemainingAfter + 1);
      if (targetX <= prevX + 1) {
        targetX = prevX + 1;
      }
      if (targetX >= maxXForThis) {
        targetX = maxXForThis;
      }

      // Prevent redistributed barlines from crossing into following content.
      var nextBoundaryQ = boundaryQs[boundaryIdx + 1];
      var firstFollowingContentX = minContentLeftXInRange(q, nextBoundaryQ);
      // Do not let redistribution yank a barline far left from its original
      // collision-safe position if that would create a large visual pre-note gap.
      var originalResolvedX = initialResolvedBarlineXMap.get(qKey);
      if (Number.isFinite(originalResolvedX)) {
        targetX = Math.max(targetX, Math.min(originalResolvedX, maxXForThis));
      }
      if (Number.isFinite(firstFollowingContentX)) {
        targetX = Math.max(targetX, firstFollowingContentX - MAX_PRE_CONTENT_GAP_PX);
        targetX = Math.min(targetX, firstFollowingContentX - 2);
      }
      if (targetX >= maxXForThis) {
        targetX = maxXForThis;
      }
      if (targetX <= prevX + 1) {
        targetX = prevX + 1;
      }

      resolvedBarlineXMap.set(qKey, targetX);
      prevX = targetX;
    }
  }
}

function buildBeatSplitPoints(
  fromQuarter,
  safeNumQuarters,
  xForQuarter,
  sliceEvents,
  notes,
  barlinesQ,
  xForQuarterBarline
) {
  var totalBeats = Math.max(1, Math.ceil(safeNumQuarters - 1e-9));
  var splitPoints = new Array(totalBeats + 1);
  var EPS = 1e-6;
  var spans = buildEventVisualSpans(sliceEvents, notes);
  var onsetLeftByQ = new Map();
  var barlineXByQ = new Map();
  var refByQ = new Map();

  spans.forEach(function (span) {
    var onsetQ = Number(span.startQ);
    if (!Number.isFinite(onsetQ) || !Number.isFinite(span.leftX)) {
      return;
    }
    var onsetKey = quarterKey(onsetQ);
    if (!onsetLeftByQ.has(onsetKey) || span.leftX < onsetLeftByQ.get(onsetKey)) {
      onsetLeftByQ.set(onsetKey, span.leftX);
    }
  });

  function getBoundaryQ(beatIndex) {
    return fromQuarter + beatIndex;
  }

  function isNearBoundary(qValue, boundaryQ) {
    return Math.abs(qValue - boundaryQ) <= EPS;
  }

  function barlineXForBoundary(boundaryQ) {
    if (!barlinesQ || !barlinesQ.length || typeof xForQuarterBarline !== 'function') {
      return Number.NaN;
    }
    for (var i = 0; i < barlinesQ.length; i++) {
      var barQ = Number(barlinesQ[i]);
      if (isNearBoundary(barQ, boundaryQ)) {
        return xForQuarterBarline(barQ);
      }
    }
    return Number.NaN;
  }

  if (barlinesQ && barlinesQ.length > 0 && typeof xForQuarterBarline === 'function') {
    barlinesQ.forEach(function (barQRaw) {
      var barQ = Number(barQRaw);
      if (!Number.isFinite(barQ)) {
        return;
      }
      var barX = xForQuarterBarline(barQ);
      if (!Number.isFinite(barX)) {
        return;
      }
      barlineXByQ.set(quarterKey(barQ), barX);
    });
  }

  // Base anchors are either barline x or leftmost onset x.
  onsetLeftByQ.forEach(function (x, key) {
    refByQ.set(key, { q: Number(key), x: x });
  });
  barlineXByQ.forEach(function (x, key) {
    // Barline overrides onset when both exist at the same boundary.
    refByQ.set(key, { q: Number(key), x: x });
  });

  var startQ = getBoundaryQ(0);
  var startKey = quarterKey(startQ);
  if (!refByQ.has(startKey)) {
    refByQ.set(startKey, { q: startQ, x: xForQuarter(startQ) });
  }

  // Last split point is fixed to the right edge of the visible 5-line system.
  var lastBoundaryQ = getBoundaryQ(totalBeats);
  var staffRight = staffRightEdgeX();
  var fallbackEndX = xForQuarter(lastBoundaryQ);
  refByQ.set(
    quarterKey(lastBoundaryQ),
    {
      q: lastBoundaryQ,
      x: Number.isFinite(staffRight) ? staffRight : fallbackEndX,
    }
  );

  var refs = Array.from(refByQ.values())
    .filter(function (ref) {
      return Number.isFinite(ref.q) && Number.isFinite(ref.x);
    })
    .sort(function (a, b) {
      if (a.q !== b.q) {
        return a.q - b.q;
      }
      return a.x - b.x;
    });

  function xFromProportionalInterpolation(boundaryQ) {
    var leftRef = null;
    var rightRef = null;

    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (ref.q <= boundaryQ + EPS) {
        leftRef = ref;
      }
      if (ref.q >= boundaryQ - EPS) {
        rightRef = ref;
        break;
      }
    }

    if (leftRef && Math.abs(leftRef.q - boundaryQ) <= EPS) {
      return leftRef.x;
    }
    if (rightRef && Math.abs(rightRef.q - boundaryQ) <= EPS) {
      return rightRef.x;
    }
    if (
      leftRef &&
      rightRef &&
      rightRef.q > leftRef.q + EPS &&
      Number.isFinite(leftRef.x) &&
      Number.isFinite(rightRef.x)
    ) {
      var ratio = (boundaryQ - leftRef.q) / (rightRef.q - leftRef.q);
      return leftRef.x + ratio * (rightRef.x - leftRef.x);
    }

    return xForQuarter(boundaryQ);
  }

  for (var beatIndex = 0; beatIndex <= totalBeats; beatIndex++) {
    var boundaryQ = getBoundaryQ(beatIndex);
    var boundaryKey = quarterKey(boundaryQ);
    var barlineX = barlineXForBoundary(boundaryQ);

    // Barline always wins over leftmost-pixel onset rule.
    if (Number.isFinite(barlineX)) {
      splitPoints[beatIndex] = barlineX;
      continue;
    }

    if (onsetLeftByQ.has(boundaryKey)) {
      splitPoints[beatIndex] = onsetLeftByQ.get(boundaryKey);
      continue;
    }

    splitPoints[beatIndex] = xFromProportionalInterpolation(boundaryQ);
  }

  // Ensure strictly increasing split points so no highlight gap or overlap is missed.
  for (var m = 1; m < splitPoints.length; m++) {
    if (!Number.isFinite(splitPoints[m])) {
      splitPoints[m] = splitPoints[m - 1] + 1;
    }
    if (splitPoints[m] <= splitPoints[m - 1]) {
      splitPoints[m] = splitPoints[m - 1] + 1;
    }
  }

  return splitPoints;
}

function buildQuarterBeatWindow(fromQuarter, safeNumQuarters, progressedQuarters, xForQuarter, beatSplitPoints) {
  var totalBeats = Math.max(1, Math.ceil(safeNumQuarters - 1e-9));
  var beatIndex = Math.floor(Math.max(0, progressedQuarters + 1e-9));
  beatIndex = Math.max(0, Math.min(totalBeats - 1, beatIndex));

  var startX;
  var endX;
  if (beatSplitPoints && beatSplitPoints.length >= beatIndex + 2) {
    startX = beatSplitPoints[beatIndex];
    endX = beatSplitPoints[beatIndex + 1];
  } else {
    var beatStartQ = fromQuarter + beatIndex;
    var beatEndQ = Math.min(fromQuarter + safeNumQuarters, beatStartQ + 1);
    startX = xForQuarter(beatStartQ);
    endX = xForQuarter(beatEndQ);
  }

  return {
    beatNumber: beatIndex + 1,
    totalBeats: totalBeats,
    startX: startX,
    endX: endX,
  };
}

function createBeatHighlightOverlay(context, fromQuarter, safeNumQuarters, xForQuarter, beatSplitPoints) {
  if (!staveMain || typeof xForQuarter !== 'function') {
    return null;
  }

  var initialWindow = buildQuarterBeatWindow(
    fromQuarter,
    safeNumQuarters,
    0,
    xForQuarter,
    beatSplitPoints
  );
  var span = normalizeHorizontalSpan(initialWindow.startX, initialWindow.endX);
  if (!span) {
    return null;
  }

  var topY = staveMain.getYForLine(0) - 14;
  var bottomY = staveMain.getYForLine(4) + 14;
  var height = Math.max(1, bottomY - topY);

  var svgRoot = renderer && renderer.ctx ? renderer.ctx.svg : null;
  if (!svgRoot) {
    return null;
  }

  var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(span.left));
  rect.setAttribute('y', String(topY));
  rect.setAttribute('width', String(span.width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('fill', 'rgba(160, 210, 255, 0.35)');
  rect.setAttribute('stroke', 'none');

  if (svgRoot.firstChild) {
    svgRoot.insertBefore(rect, svgRoot.firstChild);
  } else {
    svgRoot.appendChild(rect);
  }

  return {
    rect: rect,
  };
}

function updateBeatHighlightOverlay(overlay, leftX, rightX) {
  if (!overlay || !overlay.rect) {
    return;
  }
  var span = normalizeHorizontalSpan(leftX, rightX);
  if (!span) {
    return;
  }
  overlay.rect.setAttribute('x', String(span.left));
  overlay.rect.setAttribute('width', String(span.width));
}

function drawAndAnimatePlaybarTimeMapped(
  fromQuarter,
  numQuarters,
  xForQuarter,
  context,
  sliceEvents,
  notes,
  beatSplitPoints,
  barlinesQ,
  xForQuarterBarline
) {
  if (typeof xForQuarter !== 'function') {
    return;
  }
  var safeNumQuarters = Number(numQuarters);
  if (!Number.isFinite(safeNumQuarters) || safeNumQuarters <= 0) {
    return;
  }

  var startX = xForQuarter(fromQuarter);
  if (!Number.isFinite(startX)) {
    return;
  }

  var totalQuarterBeats = Math.max(1, Math.ceil(safeNumQuarters - 1e-9));
  setBeatIndexDisplay(1, totalQuarterBeats);

  var splitPoints = beatSplitPoints && beatSplitPoints.length >= totalQuarterBeats + 1 ?
    beatSplitPoints :
    buildBeatSplitPoints(
      fromQuarter,
      safeNumQuarters,
      xForQuarter,
      sliceEvents,
      notes,
      barlinesQ,
      xForQuarterBarline
    );
  var beatOverlay = createBeatHighlightOverlay(
    context,
    fromQuarter,
    safeNumQuarters,
    xForQuarter,
    splitPoints
  );

  var playheadGroup = null;
  if (playheadEnabled) {
    var playbarTopY = Math.max(0, scale_Height - 70);
    var playbarBottomY = Math.min(full_Height - 1, scale_Height + 120);
    playheadGroup = context.openGroup();
    context.beginPath();
    context.moveTo(startX, playbarTopY);
    context.lineTo(startX, playbarBottomY);
    context.stroke();
    context.closeGroup();
    playheadGroup.classList.add('scroll');
  }

  var safeTempo = quarterRatePerSecond();
  var totalSeconds = safeNumQuarters / safeTempo;
  var nowServer = serverNowMs();
  var startServerMs =
    Number.isFinite(lastServerMessageTimeMs) ? (lastServerMessageTimeMs + PLAYBACK_SYNC_LEAD_MS) : nowServer;
  if (startServerMs < nowServer) {
    // Never start "in the past" on this client: prevents catch-up jumps and pulse drift.
    startServerMs = nowServer + 20;
  }

  function step() {
    var now = serverNowMs();
    if (now < startServerMs) {
      var preStartWindow = buildQuarterBeatWindow(
        fromQuarter,
        safeNumQuarters,
        0,
        xForQuarter,
        splitPoints
      );
      setBeatIndexDisplay(preStartWindow.beatNumber, preStartWindow.totalBeats);
      updateBeatHighlightOverlay(beatOverlay, preStartWindow.startX, preStartWindow.endX);
      refreshMetronomeVisual(now);
      playbarAnimationFrame = requestAnimationFrame(step);
      return;
    }
    var elapsedSeconds = Math.max(0, (now - startServerMs) / 1000);
    var progressedQuarters = Math.min(safeNumQuarters, elapsedSeconds * safeTempo);
    var currentQuarter = fromQuarter + progressedQuarters;

    var currentBeatWindow = buildQuarterBeatWindow(
      fromQuarter,
      safeNumQuarters,
      progressedQuarters,
      xForQuarter,
      splitPoints
    );
    setBeatIndexDisplay(currentBeatWindow.beatNumber, currentBeatWindow.totalBeats);
    updateBeatHighlightOverlay(beatOverlay, currentBeatWindow.startX, currentBeatWindow.endX);

    if (playheadGroup) {
      var currentX = xForQuarter(currentQuarter);
      if (Number.isFinite(currentX)) {
        var dx = currentX - startX;
        playheadGroup.style.transform = 'translateX(' + dx + 'px)';
        playheadGroup.style.webkitTransform = 'translateX(' + dx + 'px)';
      }
    }

    advanceMetronome(currentQuarter, now);

    if (elapsedSeconds < totalSeconds) {
      playbarAnimationFrame = requestAnimationFrame(step);
    } else {
      playbarAnimationFrame = 0;
      refreshMetronomeVisual(now);
      setBeatIndexDisplay(totalQuarterBeats, totalQuarterBeats);
    }
  }
  playbarAnimationFrame = requestAnimationFrame(step);

  var endServerMs = startServerMs + totalSeconds * 1000;
  var timeoutDelay = Math.max(0, endServerMs - serverNowMs());
  playbarTimeout = setTimeout(function () {
    wsSend('snake');
  }, timeoutDelay);
}

function clampNumber(value, min, max) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    numeric = min;
  }
  if (numeric < min) {
    return min;
  }
  if (numeric > max) {
    return max;
  }
  return numeric;
}

function remapLinear(value, inMin, inMax, outMin, outMax) {
  if (!Number.isFinite(value)) {
    return outMin;
  }
  if (Math.abs(inMax - inMin) < 1e-9) {
    return outMin;
  }
  var ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

function dynamicCanvasInteger(value) {
  var source = clampNumber(value, DYNAMICS_SOURCE_MIN, DYNAMICS_SOURCE_MAX);
  var scaled = remapLinear(
    source,
    DYNAMICS_SOURCE_MIN,
    DYNAMICS_SOURCE_MAX,
    1,
    9
  );
  return Math.max(1, Math.min(9, Math.round(scaled)));
}

function dynamicTextIndex(value) {
  return dynamicCanvasInteger(value);
}

function dynamicColorLevel(value) {
  return dynamicCanvasInteger(value);
}

function drawDynamics(voice) {
  var notes = voice.getTickables();
  var xs = [];
  notes.forEach((item) => {
    xs.push(item.getAbsoluteX());
  });
  var c = document.getElementById("dynCanvas");
  var ctx = c.getContext("2d");

  var grd = ctx.createLinearGradient(xs[0], 0, full_Width, 0);
  var width = full_Width - xs[0];
  dynamics.forEach((d, i) => {
    var col = dynamicToColor(d);
    //console.log(d);
    //console.log(col);
    grd.addColorStop((xs[i] - xs[0]) / width, col);
  });

  // Fill with gradient
  ctx.fillStyle = grd;
  ctx.clearRect(0, 0, full_Width, dynamics_Height);
  ctx.fillRect(xs[0] - 5, 0, full_Width, dynamics_Height);

  // Draw dynamics text
  ctx.fillStyle = "white";
  ctx.font = '32px ' + selectedScoreFontName + ', Petaluma';
  ctx.textBaseline = "middle";
  var noteWidth = (full_Width - xs[0]) / dynamics.length;
  var y = dynamics_Height * 0.666;
  dynamics.forEach((d, i) => {
    var dyn = dynamicTextIndex(d);
    //ctx.fillText("" + d, xs[i], 20); //debug

    var write = false;
    if (i == 0) {
      write = true;
    } else if (i > 0) {
      if (dynamics[i] > dynamics[i - 1] && dynamics[i] > 0) { //crescendo
        ctx.fillText(crescDecresc[0], (xs[i] + xs[i - 1]) / 2, y - 12);
        write = true;
      }
      if (dynamics[i] < dynamics[i - 1] && dynamics[i - 1] > 0) { //diminuendo
        ctx.fillText(crescDecresc[1], (xs[i] + xs[i - 1]) / 2, y - 12);
        write = true;
      }
    }

    if (write) {
      ctx.fillText(dynamicsText[dyn], xs[i], y);
    }
    /*if (d <= 0) { // REST
      ctx.fillText("\u{1D13D}", xs[i], y);
    }*/

  });

}

function dynamicToColor(value) {
  var d = dynamicColorLevel(value);
  var red = Math.min(Math.max(d - 5, 0), 5) * 60;
  var green = (Math.min(4 - Math.max(Math.abs(4 - d), 0), 4)) * 60;
  var blue = (Math.min(Math.max(5 - d, 0), 4)) * 60;
  return 'rgb(' + red + ', ' + green + ', ' + blue + ')';
}

function buildQuarterXInterpolator(sliceEvents, notes, stave) {
  var EPS = 1e-6;
  var anchors = sliceEvents.map(function (event, idx) {
    return { q: event.startQ, x: notes[idx].getAbsoluteX() };
  });
  anchors.sort(function (a, b) { return a.q - b.q; });

  var staveStartX = stave.getX();
  var staveEndX = stave.getX() + stave.getWidth();

  return function xForQuarter(quarterQ) {
    if (anchors.length === 0) {
      return staveStartX;
    }
    if (quarterQ <= anchors[0].q + EPS) {
      return Math.max(staveStartX, anchors[0].x - 6);
    }

    for (var i = 0; i < anchors.length - 1; i++) {
      var left = anchors[i];
      var right = anchors[i + 1];
      if (Math.abs(quarterQ - right.q) <= EPS) {
        return Math.max(staveStartX, right.x - 6);
      }
      if (quarterQ > left.q + EPS && quarterQ < right.q - EPS) {
        var ratio = (quarterQ - left.q) / Math.max(EPS, (right.q - left.q));
        return left.x + ratio * (right.x - left.x);
      }
    }

    return Math.min(staveEndX - 1, anchors[anchors.length - 1].x + 10);
  };
}

function quarterKey(quarterQ) {
  return Number(quarterQ).toFixed(6);
}

function buildLinearQuarterXInterpolator(fromQuarter, numQuarters, stave, options) {
  options = options || {};
  var leftPaddingPx = Number(options.leftPaddingPx) || 0;
  var rightPaddingPx = Number(options.rightPaddingPx) || 0;
  var leftX = typeof stave.getTieStartX === 'function' ?
    stave.getTieStartX() : (stave.getX() + 12);
  var rightX = typeof stave.getTieEndX === 'function' ?
    stave.getTieEndX() : (stave.getX() + stave.getWidth() - 12);
  leftX += leftPaddingPx;
  rightX -= rightPaddingPx;
  if (rightX <= leftX + 1) {
    rightX = leftX + 1;
  }

  var startQ = Number(fromQuarter);
  var lengthQ = Math.max(1e-6, Number(numQuarters));
  return function xForQuarterLinear(quarterQ) {
    var ratio = (Number(quarterQ) - startQ) / lengthQ;
    return leftX + ratio * (rightX - leftX);
  };
}

function getLinearCollisionMetrics(note) {
  var fallback = { left: 8, right: 8 };
  if (!note || typeof note.getMetrics !== 'function') {
    return fallback;
  }
  try {
    var metrics = note.getMetrics();
    var left = Math.max(0, (metrics.modLeftPx || 0) + (metrics.leftDisplacedHeadPx || 0));
    var width = Number.isFinite(metrics.width) ? metrics.width : note.getWidth();
    var right = Math.max(0, width - left);
    return { left: left, right: right };
  } catch (error) {
    return fallback;
  }
}

function applyLinearRhythmicSpacing(sliceEvents, notes, xForQuarterLinear) {
  var MIN_PADDING_PX = 4;
  var MAX_RIGHT_SHIFT_PX = 10;
  var prevAnchorX = null;
  var prevRightExtent = 0;

  sliceEvents.forEach(function (event, idx) {
    var note = notes[idx];
    if (!note || typeof note.setXShift !== 'function') {
      return;
    }

    var currentX = note.getAbsoluteX();
    var idealX = xForQuarterLinear(event.startQ);
    var targetX = idealX;
    var currentMetrics = getLinearCollisionMetrics(note);

    if (prevAnchorX !== null) {
      var minimumX = prevAnchorX + prevRightExtent + currentMetrics.left + MIN_PADDING_PX;
      if (targetX < minimumX) {
        targetX = Math.min(minimumX, idealX + MAX_RIGHT_SHIFT_PX);
      }
    }

    if (!Number.isFinite(currentX) || !Number.isFinite(targetX)) {
      return;
    }

    note.setXShift(targetX - currentX);
    prevAnchorX = targetX;
    prevRightExtent = currentMetrics.right;
  });
}

function buildLinearBarlineInterpolator(xForQuarterLinear, sliceEvents, notes, barlinesQ) {
  return function xForBarline(quarterQ) {
    return xForQuarterLinear(quarterQ);
  };
}

function getDynamicsForQuarterSlice(fromQuarter, numQuarters) {
  var length = Math.max(0, Math.floor(Number(numQuarters)));
  if (length <= 0) {
    return [];
  }

  var segmentCount = Math.min(
    dynamics ? dynamics.length : 0,
    snake ? Math.floor(snake.length / 2) : 0
  );

  var byQuarter = new Map();
  for (var i = 0; i < segmentCount; i++) {
    var x = Number(snake[i * 2]);
    var y = Number(snake[i * 2 + 1]);
    var dyn = Number(dynamics[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dyn)) {
      continue;
    }
    var quarter = Math.floor(y) * game_Width + Math.floor(x);
    // Tail->head input order means later writes prefer newer (closer-to-head) segments.
    byQuarter.set(quarter, dyn);
  }

  var from = Math.floor(Number(fromQuarter));
  var out = [];
  for (var qOffset = 0; qOffset < length; qOffset++) {
    var absQuarter = from + qOffset;
    if (byQuarter.has(absQuarter)) {
      out.push(byQuarter.get(absQuarter));
      continue;
    }

    // Fallback: align fromQuarter with head (latest) dynamics, then walk backward.
    var reverseIdx = segmentCount - 1 - qOffset;
    if (reverseIdx >= 0) {
      var fallbackDyn = Number(dynamics[reverseIdx]);
      out.push(Number.isFinite(fallbackDyn) ? fallbackDyn : 0);
    } else {
      out.push(0);
    }
  }

  return out;
}

function drawDynamicsForExactSlice(fromQuarter, numQuarters, xForQuarter, beatSplitPoints) {
  var c = document.getElementById('dynCanvas');
  if (!c || typeof xForQuarter !== 'function') {
    return;
  }
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, full_Width, dynamics_Height);

  var values = getDynamicsForQuarterSlice(fromQuarter, numQuarters);
  if (!values.length) {
    return;
  }

  var useSplitPoints = beatSplitPoints && beatSplitPoints.length >= values.length + 1;
  var textMarginX = 4;
  var textMarginY = 2;
  var dynamicsFontFamily = selectedScoreFontName + ', Petaluma';

  function leftEdgeForIndex(index) {
    if (useSplitPoints) {
      return beatSplitPoints[index];
    }
    return xForQuarter(fromQuarter + index);
  }

  function rightEdgeForIndex(index) {
    if (useSplitPoints) {
      return beatSplitPoints[index + 1];
    }
    return xForQuarter(fromQuarter + index + 1);
  }

  function measureMetricsForText(text, fontPx) {
    ctx.font = fontPx + 'px ' + dynamicsFontFamily;
    var metrics = ctx.measureText(text);
    var ascent = Number(metrics.actualBoundingBoxAscent);
    var descent = Number(metrics.actualBoundingBoxDescent);
    if (!(ascent > 0) || !(descent >= 0)) {
      // Fallback when browser does not report text box metrics consistently.
      ascent = fontPx * 0.76;
      descent = fontPx * 0.24;
    }
    return {
      width: Math.max(0, Number(metrics.width) || 0),
      ascent: ascent,
      descent: descent,
    };
  }

  function centeredAlphabeticBaseline(centerY, metrics) {
    return centerY + (metrics.ascent - metrics.descent) / 2;
  }

  function drawFittedDynamicsLabel(text, leftX, rightX) {
    var spanLeft = Math.min(leftX, rightX) + textMarginX;
    var spanRight = Math.max(leftX, rightX) - textMarginX;
    var spanWidth = Math.max(1, spanRight - spanLeft);
    var maxFontPx = Math.max(10, Math.floor((dynamics_Height - textMarginY * 2) * 2.0));
    var fontPx = maxFontPx;
    var measured = measureMetricsForText(text, fontPx);
    if (measured.width > spanWidth && measured.width > 0) {
      fontPx = Math.max(8, Math.floor(maxFontPx * (spanWidth / measured.width)));
      measured = measureMetricsForText(text, fontPx);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var baselineY = centeredAlphabeticBaseline(dynamics_Height / 2, measured);
    ctx.fillText(text, spanLeft, baselineY);
    return spanLeft + measured.width;
  }

  function drawStretchedTransitionGlyph(glyph, leftX, rightX) {
    var spanLeft = Math.min(leftX, rightX) + textMarginX;
    var spanRight = Math.max(leftX, rightX) - textMarginX;
    var spanWidth = Math.max(1, spanRight - spanLeft);
    if (spanWidth <= 1) {
      return;
    }
    var spanHeight = Math.max(1, dynamics_Height - textMarginY * 2);
    var fontPx = Math.max(10, Math.floor(spanHeight * 2.0));
    var metrics = measureMetricsForText(glyph, fontPx);
    var glyphWidth = Math.max(1, metrics.width);
    var scaleX = spanWidth / glyphWidth;
    var baselineY = centeredAlphabeticBaseline(textMarginY + spanHeight / 2, metrics);

    ctx.save();
    ctx.font = fontPx + 'px ' + dynamicsFontFamily;
    ctx.translate(spanLeft, 0);
    ctx.scale(scaleX, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(glyph, 0, baselineY);
    ctx.restore();
  }

  for (var i = 0; i < values.length; i++) {
    var leftX = leftEdgeForIndex(i);
    var rightX = rightEdgeForIndex(i);
    if (!Number.isFinite(leftX) || !Number.isFinite(rightX)) {
      continue;
    }
    if (rightX < leftX) {
      var swap = leftX;
      leftX = rightX;
      rightX = swap;
    }
    var width = Math.max(1, rightX - leftX);
    var currentColor = dynamicToColor(values[i]);
    var hasTransitionToNext = false;
    if (i < values.length - 1) {
      var currentLevel = dynamicCanvasInteger(values[i]);
      var nextLevel = dynamicCanvasInteger(values[i + 1]);
      hasTransitionToNext =
        (nextLevel > currentLevel && nextLevel > 0) ||
        (nextLevel < currentLevel && currentLevel > 0);
    }
    if (hasTransitionToNext && width > 0) {
      var gradient = ctx.createLinearGradient(leftX, 0, rightX, 0);
      gradient.addColorStop(0, currentColor);
      gradient.addColorStop(1, dynamicToColor(values[i + 1]));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = currentColor;
    }
    ctx.fillRect(leftX, 0, width, dynamics_Height);
  }

  ctx.fillStyle = 'white';
  for (var j = 0; j < values.length; j++) {
    var dyn = dynamicTextIndex(values[j]);
    var leftX = leftEdgeForIndex(j);
    var rightX = rightEdgeForIndex(j);
    if (!Number.isFinite(leftX) || !Number.isFinite(rightX)) {
      continue;
    }
    var spanLeft = Math.min(leftX, rightX);
    var spanRight = Math.max(leftX, rightX);
    if (spanRight <= spanLeft) {
      spanRight = spanLeft + 1;
    }
    var write = false;
    var transitionGlyph = null;

    if (j === 0) {
      write = true;
    } else {
      var prev = dynamicCanvasInteger(values[j - 1]);
      var curr = dynamicCanvasInteger(values[j]);
      if (curr !== prev) {
        write = true;
      }
    }

    if (j < values.length - 1) {
      var currToNext = dynamicCanvasInteger(values[j]);
      var next = dynamicCanvasInteger(values[j + 1]);
      if (next > currToNext && next > 0) {
        transitionGlyph = crescDecresc[0];
      }
      if (next < currToNext && currToNext > 0) {
        transitionGlyph = crescDecresc[1];
      }
    }

    if (write && transitionGlyph) {
      var textReserveRatio = 0.45;
      var textRight = spanLeft + (spanRight - spanLeft) * textReserveRatio;
      var textEndX = drawFittedDynamicsLabel(dynamicsText[dyn], spanLeft, textRight);
      var transitionLeft = Math.max(textRight, textEndX + 4);
      drawStretchedTransitionGlyph(transitionGlyph, transitionLeft, spanRight);
    } else {
      if (write) {
        drawFittedDynamicsLabel(dynamicsText[dyn], spanLeft, spanRight);
      }
      if (transitionGlyph) {
        drawStretchedTransitionGlyph(transitionGlyph, spanLeft, spanRight);
      }
    }
  }
}

function drawLine(voice, context) {
  var notes = voice.getTickables();
  var xs = [];
  var ys = [];
  notes.forEach((item) => {
    ys.push(item.getYs());
    xs.push(item.getAbsoluteX() + 5);
  });

  context.beginPath();
  context.moveTo(xs[0], ys[0][0]);
  for (var i = 1; i < xs.length; i++) {
    context.lineTo(xs[i], ys[i][0]);
  }
  var lastX = xs[xs.length - 1] * 2 - xs[xs.length - 2];
  context.lineTo(lastX, ys[ys.length - 1][0]);
  context.stroke();

  context.beginPath();
  context.moveTo(xs[0], ys[0][1]);
  for (var i = 1; i < xs.length; i++) {
    context.lineTo(xs[i], ys[i][1]);
  }
  context.lineTo(lastX, ys[ys.length - 1][1]);
  context.stroke();
}

function numberToRhythm(number) {
  var artic = Math.floor(number / 100);
  var articulation = '';
  switch (artic) {
    case 1:
      articulation = 'a.';
      break;
    case 2:
      articulation = 'a-';
      break;
    case 3:
      articulation = 'a>';
      break;
    case 4:
      articulation = 'a^';
      break;
    default:
      articulation = null;
  }

  var length = number % 100;
  var duration;
  //console.log('duration: ' + length)
  //var modifier = 0;//-1 tuplet | 1 dotted | 0 nothing
  switch (length) {
    case 1:
      duration = '16';
      break;
    case 2:
      duration = '8d';
      break;
    case 3:
      duration = '8';
      break;
    case 4:
      duration = '8';
      break;
    case 5:
      duration = '4';
      break;
    case 6:
      duration = '4';
      break;
    case 7:
      duration = '4d';
      break;
    case 8:
      duration = '2';
      break;
    default:
      duration = '1';
      break;
  }
  var note = new VF.StaveNote({
    //keys: [intToNotename(67, true)],
    keys: ["G/4"],
    duration: duration
  });
  if (articulation)
    note.addArticulation(0, new VF.Articulation(articulation));
  //console.log(note);
  return note;
}

function numberToScale(number) {
  number = Math.round(number);
  //console.log("number " + number);
  scale = 'wrongNumber';
  switch (number) {
    case 0:
      scale = 'chrom.';
      break;
    case 1:
      scale = 'phryg.';
      break;
    case 2:
      scale = 'min. penta.';
      break;
    case 3:
      scale = ' ';
      break;
  }
  return scale;
}

function getAccidental(note) {
  return note.slice(1, note.length);
}

function intToNotename(midi, getOctave) {
  pitch = midi % 12;
  var pitchName;
  switch (pitch) {
    case 0:
      pitchName = 'C';
      break;
    case 1:
      pitchName = 'C#';
      break;
    case 2:
      pitchName = 'D';
      break;
    case 3:
      pitchName = 'Eb';
      break;
    case 4:
      pitchName = 'E';
      break;
    case 5:
      pitchName = 'F';
      break;
    case 6:
      pitchName = 'F#';
      break;
    case 7:
      pitchName = 'G';
      break;
    case 8:
      pitchName = 'G#';
      break;
    case 9:
      pitchName = 'A';
      break;
    case 10:
      pitchName = 'Bb';
      break;
    case 11:
      pitchName = 'B';
      break;
    default:
      pitchName = 'X';
  }
  var octave = '';
  if (getOctave) {
    octave = '/' + (Math.floor(midi / 12) - 1);
  }
  //console.log(getOctave);
  //console.log(octave);
  return '' + pitchName + octave;
}

var tannhauserScore = null;
var selectedStaffIndex = 2; // default: 3rd staff
var pendingEatenRender = false;
var snakeSnapshotVersion = 0;
var renderWaitSnakeVersion = 0;
var eatenRenderFallbackTimer = 0;
var EATEN_RENDER_FALLBACK_MS = 250;
var debugOverrideFromQuarter = null;
var debugOverrideNumQuarters = null;
var transposeSemitones = 0;
var lockedFromQuarter = null;
var lockedNumQuarters = null;
var lastRenderDiagnostics = null;

function setDebugStatus(message) {
  var debugEl = document.getElementById('debug');
  if (debugEl) {
    debugEl.innerHTML = message;
  }
}

function setRenderInfo(message) {
  var renderInfoEl = document.getElementById('renderInfo');
  if (renderInfoEl) {
    renderInfoEl.textContent = message || '';
  }
}

function roundForReport(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.round(numeric * 1000) / 1000;
}

function readElementValue(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function readElementText(id) {
  var el = document.getElementById(id);
  if (!el) {
    return '';
  }
  return (el.textContent || el.innerText || '').trim();
}

function currentRenderControls() {
  return {
    staffIndex: selectedStaff(),
    fromQuarterInput: readElementValue('debugFromQuarter'),
    numQuartersInput: readElementValue('debugNumQuarters'),
    transposeInput: readElementValue('debugTransposeSemitones'),
    spacingMode: readElementValue('spacingMode') || spacingMode,
    scoreFont: readElementValue('scoreFont') || selectedScoreFontName,
  };
}

function buildCaseReportData() {
  var controls = currentRenderControls();
  var staffName = tannhauserScore ? tannhauserScore.getStaffName(controls.staffIndex) : '';
  return {
    timestamp: new Date().toISOString(),
    renderControls: controls,
    state: {
      selectedStaffIndex: controls.staffIndex,
      selectedStaffName: staffName,
      transposeSemitones: transposeSemitones,
      tempoBpm: roundForReport(tempo),
      spacingMode: spacingMode,
      scoreFont: selectedScoreFontName,
      lockedFromQuarter: lockedFromQuarter,
      lockedNumQuarters: lockedNumQuarters,
      debugOverrideFromQuarter: debugOverrideFromQuarter,
      debugOverrideNumQuarters: debugOverrideNumQuarters,
      pendingEatenRender: pendingEatenRender,
      snakeLength: Array.isArray(snake) ? snake.length : 0,
      eatenLength: Array.isArray(eaten) ? eaten.length : 0,
    },
    uiText: {
      renderInfo: readElementText('renderInfo'),
      debug: readElementText('debug'),
      net: readElementText('net'),
      snake: readElementText('snake'),
      eaten: readElementText('eaten'),
      dynamics: readElementText('dynamics'),
      notemap: readElementText('notemap'),
      tempo: readElementText('tempo'),
      rhythm: readElementText('rhythm'),
    },
    lastRenderDiagnostics: lastRenderDiagnostics,
  };
}

async function writeTextToClipboard(text) {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback below.
    }
  }

  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (error) {
    return false;
  }
}

async function copyCaseReportToClipboard() {
  var payload = buildCaseReportData();
  var text = 'Case Report\\n' + JSON.stringify(payload, null, 2);
  var ok = await writeTextToClipboard(text);
  setDebugStatus(ok ? 'Case report copied to clipboard.' : 'Failed to copy case report.');
  return ok;
}

window.copyCaseReportToClipboard = copyCaseReportToClipboard;

function parseOptionalNonNegativeInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor(parsed));
}

function clampTransposeSemitones(value) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  var intValue = parsed < 0 ? Math.ceil(parsed) : Math.floor(parsed);
  return Math.max(-6, Math.min(6, intValue));
}

function syncTransposeInputControl() {
  var transposeInput = document.getElementById('debugTransposeSemitones');
  if (transposeInput && Number(transposeInput.value) !== transposeSemitones) {
    transposeInput.value = String(transposeSemitones);
  }
}

function setTransposeSemitones(value) {
  transposeSemitones = clampTransposeSemitones(value);
  syncTransposeInputControl();
  renderMusicFromSnake();
}

window.setTransposeSemitones = setTransposeSemitones;

function refreshDebugSliceInputs(renderFromQuarter, renderNumQuarters) {
  var fromInput = document.getElementById('debugFromQuarter');
  if (fromInput) {
    var fromValue = debugOverrideFromQuarter;
    if (fromValue === null || fromValue === undefined) {
      if (Number.isFinite(renderFromQuarter)) {
        fromValue = Math.floor(renderFromQuarter);
      } else if (lockedFromQuarter !== null && lockedFromQuarter !== undefined) {
        fromValue = lockedFromQuarter;
      }
    }
    fromInput.value = Number.isFinite(Number(fromValue)) ? String(Math.floor(Number(fromValue))) : '';
  }

  var numInput = document.getElementById('debugNumQuarters');
  if (numInput) {
    var numValue = debugOverrideNumQuarters;
    if (numValue === null || numValue === undefined) {
      if (Number.isFinite(renderNumQuarters)) {
        numValue = Math.floor(renderNumQuarters);
      } else if (lockedNumQuarters !== null && lockedNumQuarters !== undefined) {
        numValue = lockedNumQuarters;
      }
    }
    numInput.value = Number.isFinite(Number(numValue)) ? String(Math.floor(Number(numValue))) : '';
  }
}

function setDebugSliceControls(fromQuarterValue, numQuartersValue) {
  debugOverrideFromQuarter = parseOptionalNonNegativeInt(fromQuarterValue);
  debugOverrideNumQuarters = parseOptionalNonNegativeInt(numQuartersValue);
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}

window.setDebugSliceControls = setDebugSliceControls;

class MusicXMLQuarterSource {
  constructor(staffs) {
    this.staffs = staffs;
  }

  getStaffCount() {
    return this.staffs.length;
  }

  getStaff(index) {
    if (this.staffs.length === 0) {
      return null;
    }
    var safeIndex = Math.max(0, Math.min(Number(index), this.staffs.length - 1));
    return this.staffs[safeIndex];
  }

  getStaffName(index) {
    var staff = this.getStaff(index);
    if (!staff) {
      return 'Unknown staff';
    }
    return staff.name;
  }

  // staff index is 0-based. staff=2 means "3rd staff".
  getQuarters(fromQuarter, numQuarters, staff) {
    var targetStaff = this.getStaff(staff);
    if (!targetStaff) {
      return [];
    }
    var staffQuarters = targetStaff.quarters;
    var start = Math.max(0, Math.floor(Number(fromQuarter)));
    var length = Math.max(0, Math.floor(Number(numQuarters)));
    var out = [];
    for (var i = 0; i < length; i++) {
      var quarter = staffQuarters[start + i];
      out.push(quarter ? quarter.slice() : []);
    }
    return out;
  }

  getExactSliceData(fromQuarter, numQuarters, staff) {
    var targetStaff = this.getStaff(staff);
    if (!targetStaff) {
      return { events: [], barlines: [], keyChanges: [{ q: 0, fifths: 0 }] };
    }

    var startQ = Math.max(0, Math.floor(Number(fromQuarter)));
    var lengthQ = Math.max(0, Math.floor(Number(numQuarters)));
    if (lengthQ <= 0) {
      return { events: [], barlines: [], keyChanges: [{ q: startQ, fifths: 0 }] };
    }
    var endQ = startQ + lengthQ;
    var EPS = 1e-6;
    var allKeyChanges = (targetStaff.keyChanges || [{ q: 0, fifths: 0 }])
      .slice()
      .sort(function (a, b) { return a.q - b.q; });

    function fifthsAt(q) {
      var active = 0;
      allKeyChanges.forEach(function (change) {
        if (change.q <= q + EPS) {
          active = Number(change.fifths) || 0;
        }
      });
      return Math.max(-7, Math.min(7, Math.floor(active)));
    }

    var rawEvents = targetStaff.events
      .filter(function (event) {
        var eventStart = event.startQ;
        var eventEnd = event.startQ + event.durationQ;
        return eventStart < endQ - EPS && eventEnd > startQ + EPS;
      })
      .map(function (event) {
        return {
          startQ: event.startQ,
          durationQ: event.durationQ,
          keys: event.keys.slice(),
          isRest: event.isRest,
          measureRest: !!event.measureRest,
          vexDuration: event.vexDuration,
          dotCount: event.dotCount,
          tuplet: event.tuplet ? {
            actual: event.tuplet.actual,
            normal: event.tuplet.normal,
          } : null,
          tupletStarts: event.tupletStarts.slice(),
          tupletStops: event.tupletStops.slice(),
          beams: Object.assign({}, event.beams),
          slurStarts: event.slurStarts.slice(),
          slurStops: event.slurStops.slice(),
          tieStarts: event.tieStarts.slice(),
          tieStops: event.tieStops.slice(),
        };
      });

    var events = [];
    rawEvents.forEach(function (event) {
      var eventStart = event.startQ;
      var eventEnd = event.startQ + event.durationQ;
      var overlapStart = Math.max(startQ, eventStart);
      var overlapEnd = Math.min(endQ, eventEnd);
      if (overlapEnd <= overlapStart + EPS) {
        return;
      }

      var clippedStart = overlapStart > eventStart + EPS;
      var clippedEnd = overlapEnd < eventEnd - EPS;
      var clipped = clippedStart || clippedEnd;

      var clippedEvent = {
        startQ: overlapStart,
        durationQ: overlapEnd - overlapStart,
        keys: event.keys.slice(),
        isRest: event.isRest,
        measureRest: !!event.measureRest,
        vexDuration: event.vexDuration,
        dotCount: event.dotCount,
        tuplet: event.tuplet ? {
          actual: event.tuplet.actual,
          normal: event.tuplet.normal,
        } : null,
        tupletStarts: event.tupletStarts.slice(),
        tupletStops: event.tupletStops.slice(),
        beams: Object.assign({}, event.beams),
        slurStarts: event.slurStarts.slice(),
        slurStops: event.slurStops.slice(),
        tieStarts: event.tieStarts.slice(),
        tieStops: event.tieStops.slice(),
      };

      if (clipped) {
        clippedEvent.measureRest = false;
        clippedEvent.vexDuration = inferVexDurationFromQuarter(clippedEvent.durationQ);
        clippedEvent.dotCount = 0;
        clippedEvent.tuplet = null;
        clippedEvent.tupletStarts = [];
        clippedEvent.tupletStops = [];

        var adjustedBeams = {};
        Object.keys(clippedEvent.beams || {}).forEach(function (beamNumber) {
          var state = String(clippedEvent.beams[beamNumber] || '').toLowerCase();
          if (clippedStart && state === 'begin') {
            state = 'continue';
          }
          if (clippedEnd && state === 'end') {
            state = 'continue';
          }
          adjustedBeams[beamNumber] = state;
        });
        clippedEvent.beams = adjustedBeams;

        if (clippedStart) {
          clippedEvent.slurStarts = [];
          clippedEvent.tieStarts = [];
        }
        if (clippedEnd) {
          clippedEvent.slurStops = [];
          clippedEvent.tieStops = [];
        }
      } else if (clippedEvent.isRest && clippedEvent.measureRest) {
        // Fully visible measure rests stay whole-measure rests.
        clippedEvent.vexDuration = 'w';
        clippedEvent.dotCount = 0;
      }

      events.push(clippedEvent);
    });

    var barlines = (targetStaff.measureBoundariesQ || [])
      .filter(function (barlineQ) {
        return barlineQ > startQ + EPS && barlineQ < endQ - EPS;
      });

    var keyChanges = [{ q: startQ, fifths: fifthsAt(startQ) }];
    allKeyChanges.forEach(function (change) {
      if (change.q > startQ + EPS && change.q < endQ - EPS) {
        keyChanges.push({
          q: change.q,
          fifths: Math.max(-7, Math.min(7, Math.floor(Number(change.fifths) || 0))),
        });
      }
    });

    function isMeasureBoundary(q) {
      if (Math.abs(q) <= EPS) {
        return true;
      }
      return (targetStaff.measureBoundariesQ || []).some(function (boundaryQ) {
        return Math.abs(boundaryQ - q) <= EPS;
      });
    }

    // Ensure silent full measures between barlines are represented as measure rests.
    var spanBoundaries = [startQ].concat(barlines.slice()).concat([endQ]);
    spanBoundaries.sort(function (a, b) { return a - b; });
    for (var i = 0; i < spanBoundaries.length - 1; i++) {
      var leftQ = spanBoundaries[i];
      var rightQ = spanBoundaries[i + 1];
      if (rightQ - leftQ <= EPS) {
        continue;
      }
      if (!isMeasureBoundary(leftQ) || !isMeasureBoundary(rightQ)) {
        continue;
      }
      var hasAnyEvent = events.some(function (event) {
        var eventStart = event.startQ;
        var eventEnd = event.startQ + event.durationQ;
        return eventStart < rightQ - EPS && eventEnd > leftQ + EPS;
      });
      if (hasAnyEvent) {
        continue;
      }
      events.push({
        startQ: leftQ,
        durationQ: rightQ - leftQ,
        keys: [],
        isRest: true,
        measureRest: true,
        vexDuration: 'w',
        dotCount: 0,
        tuplet: null,
        tupletStarts: [],
        tupletStops: [],
        beams: {},
        slurStarts: [],
        slurStops: [],
        tieStarts: [],
        tieStops: [],
      });
    }
    events.sort(function (a, b) {
      if (a.startQ !== b.startQ) return a.startQ - b.startQ;
      return a.durationQ - b.durationQ;
    });

    return { events: events, barlines: barlines, keyChanges: keyChanges };
  }

  // Returns source notes overlapping the [fromQuarter, fromQuarter + numQuarters) window.
  // Each note keeps original MusicXML duration/tuplet/beam/slur metadata.
  getExactSlice(fromQuarter, numQuarters, staff) {
    return this.getExactSliceData(fromQuarter, numQuarters, staff).events;
  }

  // Returns a rhythmic slice with durations preserved as closely as possible.
  // Output items: { durationQ: Number, keys: String[], isRest: Boolean }.
  getRhythmicSlice(fromQuarter, numQuarters, staff) {
    var targetStaff = this.getStaff(staff);
    if (!targetStaff) {
      return [];
    }

    var startQ = Math.max(0, Math.floor(Number(fromQuarter)));
    var lengthQ = Math.max(0, Math.floor(Number(numQuarters)));
    if (lengthQ <= 0) {
      return [];
    }
    var endQ = startQ + lengthQ;

    var EPS = 1e-6;
    var events = targetStaff.events;
    var boundaries = [startQ, endQ];

    events.forEach(function (event) {
      var eventStart = event.startQ;
      var eventEnd = event.startQ + event.durationQ;
      if (eventEnd <= startQ + EPS || eventStart >= endQ - EPS) {
        return;
      }
      boundaries.push(Math.max(startQ, eventStart));
      boundaries.push(Math.min(endQ, eventEnd));
    });

    boundaries.sort(function (a, b) { return a - b; });
    var uniqBoundaries = [];
    boundaries.forEach(function (boundary) {
      if (
        uniqBoundaries.length === 0 ||
        Math.abs(boundary - uniqBoundaries[uniqBoundaries.length - 1]) > EPS
      ) {
        uniqBoundaries.push(boundary);
      }
    });

    var segments = [];
    for (var i = 0; i < uniqBoundaries.length - 1; i++) {
      var a = uniqBoundaries[i];
      var b = uniqBoundaries[i + 1];
      var duration = b - a;
      if (duration <= EPS) {
        continue;
      }

      var keySet = new Set();
      events.forEach(function (event) {
        var eventStart = event.startQ;
        var eventEnd = event.startQ + event.durationQ;
        var isActive = eventStart < b - EPS && eventEnd > a + EPS;
        if (isActive) {
          event.keys.forEach(function (key) { keySet.add(key); });
        }
      });

      var keys = Array.from(keySet);
      keys.sort(function (left, right) { return keyToMidi(left) - keyToMidi(right); });
      segments.push({
        durationQ: duration,
        keys: keys,
        isRest: keys.length === 0,
      });
    }

    if (segments.length === 0) {
      return [{ durationQ: lengthQ, keys: [], isRest: true }];
    }

    // Merge adjacent segments with identical pitch sets.
    var merged = [];
    segments.forEach(function (segment) {
      var prev = merged.length > 0 ? merged[merged.length - 1] : null;
      var sameAsPrev =
        prev &&
        prev.isRest === segment.isRest &&
        prev.keys.length === segment.keys.length &&
        prev.keys.every(function (key, idx) { return key === segment.keys[idx]; });

      if (sameAsPrev) {
        prev.durationQ += segment.durationQ;
      } else {
        merged.push({
          durationQ: segment.durationQ,
          keys: segment.keys.slice(),
          isRest: segment.isRest,
        });
      }
    });

    return merged;
  }
}

function textOf(parent, selector) {
  var el = parent.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

function parsePitch(noteEl) {
  var pitchEl = noteEl.querySelector('pitch');
  if (!pitchEl) {
    return null;
  }

  var step = textOf(pitchEl, 'step').toLowerCase();
  var octaveText = textOf(pitchEl, 'octave');
  var alterText = textOf(pitchEl, 'alter');
  var alter = alterText ? Number(alterText) : 0;
  var octave = Number(octaveText);

  if (!step || !Number.isFinite(octave)) {
    return null;
  }

  var accidental = '';
  if (alter === 2) accidental = '##';
  else if (alter === 1) accidental = '#';
  else if (alter === -1) accidental = 'b';
  else if (alter === -2) accidental = 'bb';

  var semitoneByStep = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  var midi = (octave + 1) * 12 + semitoneByStep[step] + alter;

  return {
    key: step + accidental + '/' + octave,
    midi: midi,
  };
}

var MUSICXML_TYPE_TO_VEX = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
  '64th': '64',
  '128th': '128',
  '256th': '256',
};

function inferVexDurationFromQuarter(durationQ) {
  var candidates = [
    { q: 4, vex: 'w' },
    { q: 2, vex: 'h' },
    { q: 1, vex: 'q' },
    { q: 0.5, vex: '8' },
    { q: 0.25, vex: '16' },
    { q: 0.125, vex: '32' },
    { q: 0.0625, vex: '64' },
  ];
  var EPS = 1e-5;
  for (var i = 0; i < candidates.length; i++) {
    if (Math.abs(durationQ - candidates[i].q) < EPS) {
      return candidates[i].vex;
    }
  }
  return 'q';
}

function selectPrimaryVoice(partEl) {
  var counts = {};
  Array.from(partEl.getElementsByTagName('note')).forEach(function (noteEl) {
    if (noteEl.querySelector('grace')) {
      return;
    }
    var voice = textOf(noteEl, 'voice') || '1';
    counts[voice] = (counts[voice] || 0) + 1;
  });

  if (counts['1']) {
    return '1';
  }

  var bestVoice = '1';
  var bestCount = -1;
  Object.keys(counts).forEach(function (voice) {
    if (counts[voice] > bestCount) {
      bestCount = counts[voice];
      bestVoice = voice;
    }
  });
  return bestVoice;
}

function parseTupletInfo(noteEl) {
  var timeMod = noteEl.querySelector('time-modification');
  if (!timeMod) {
    return null;
  }

  var actual = Number(textOf(timeMod, 'actual-notes'));
  var normal = Number(textOf(timeMod, 'normal-notes'));
  if (!Number.isFinite(actual) || !Number.isFinite(normal) || actual <= 0 || normal <= 0) {
    return null;
  }
  return {
    actual: actual,
    normal: normal,
  };
}

function parseTupletMarkers(noteEl) {
  var starts = [];
  var stops = [];
  var notations = noteEl.querySelector('notations');
  if (!notations) {
    return { starts: starts, stops: stops };
  }

  Array.from(notations.getElementsByTagName('tuplet')).forEach(function (tupletEl) {
    var type = (tupletEl.getAttribute('type') || '').toLowerCase();
    var number = String(tupletEl.getAttribute('number') || '1');
    var bracketAttr = tupletEl.getAttribute('bracket');
    var bracketed = bracketAttr ? bracketAttr.toLowerCase() !== 'no' : true;
    if (type === 'start') {
      starts.push({ number: number, bracketed: bracketed });
    } else if (type === 'stop') {
      stops.push(number);
    }
  });

  return { starts: starts, stops: stops };
}

function parseSlurMarkers(noteEl) {
  var starts = [];
  var stops = [];
  var notations = noteEl.querySelector('notations');
  if (!notations) {
    return { starts: starts, stops: stops };
  }

  Array.from(notations.getElementsByTagName('slur')).forEach(function (slurEl) {
    var type = (slurEl.getAttribute('type') || '').toLowerCase();
    var number = String(slurEl.getAttribute('number') || '1');
    var placement = (slurEl.getAttribute('placement') || '').toLowerCase();
    if (type === 'start') {
      starts.push({ number: number, placement: placement });
    } else if (type === 'stop') {
      stops.push({ number: number, placement: placement });
    }
  });

  return { starts: starts, stops: stops };
}

function parseTieFlags(noteEl) {
  var start = false;
  var stop = false;

  Array.from(noteEl.children).forEach(function (child) {
    if (!child.tagName || child.tagName.toLowerCase() !== 'tie') {
      return;
    }
    var type = (child.getAttribute('type') || '').toLowerCase();
    if (type === 'start') start = true;
    if (type === 'stop') stop = true;
  });

  var notations = noteEl.querySelector('notations');
  if (notations) {
    Array.from(notations.getElementsByTagName('tied')).forEach(function (tiedEl) {
      var type = (tiedEl.getAttribute('type') || '').toLowerCase();
      if (type === 'start') start = true;
      if (type === 'stop') stop = true;
    });
  }

  return { start: start, stop: stop };
}

function parseBeamMap(noteEl) {
  var beams = {};
  Array.from(noteEl.children).forEach(function (child) {
    if (!child.tagName || child.tagName.toLowerCase() !== 'beam') {
      return;
    }
    var number = String(child.getAttribute('number') || '1');
    beams[number] = (child.textContent || '').trim().toLowerCase();
  });
  return beams;
}

function pushUnique(array, values) {
  values.forEach(function (value) {
    var exists = array.some(function (current) {
      var bothObjects =
        current !== null &&
        value !== null &&
        typeof current === 'object' &&
        typeof value === 'object';
      if (bothObjects) {
        var currentNumber = current.number !== undefined ? String(current.number) : '';
        var valueNumber = value.number !== undefined ? String(value.number) : '';
        var currentPlacement = current.placement || '';
        var valuePlacement = value.placement || '';
        return currentNumber === valueNumber && currentPlacement === valuePlacement;
      }
      return current === value;
    });
    if (!exists) {
      array.push(value);
    }
  });
}

function parsePartToTimeline(partEl) {
  var quarterMap = new Map();
  var divisions = 1;
  var cursorQ = 0;
  var keyChanges = [{ q: 0, fifths: 0 }];
  var primaryVoice = selectPrimaryVoice(partEl);
  var lastNoteStartQByVoice = new Map();
  var eventMap = new Map();
  var measureBoundariesQ = [];

  function addPitchToQuarterMap(pitch, startQ, durationQ) {
    var EPS = 1e-6;
    var fromQ = Math.floor(startQ + EPS);
    var toQ = Math.max(fromQ + 1, Math.ceil(startQ + durationQ - EPS));
    for (var q = fromQ; q < toQ; q++) {
      if (!quarterMap.has(q)) {
        quarterMap.set(q, new Map());
      }
      quarterMap.get(q).set(pitch.key, pitch.midi);
    }
  }

  function eventSortKey(startQ, durationQ, isRest) {
    return startQ.toFixed(6) + '|' + durationQ.toFixed(6) + '|' + (isRest ? 'r' : 'n');
  }

  function upsertKeyChange(atQuarter, fifthsValue) {
    var q = Number(atQuarter);
    var fifths = Number(fifthsValue);
    if (!Number.isFinite(q) || !Number.isFinite(fifths)) {
      return;
    }
    fifths = Math.max(-7, Math.min(7, Math.floor(fifths)));
    for (var i = keyChanges.length - 1; i >= 0; i--) {
      if (Math.abs(keyChanges[i].q - q) <= 1e-6) {
        keyChanges[i].fifths = fifths;
        return;
      }
      if (keyChanges[i].q < q) {
        break;
      }
    }
    keyChanges.push({ q: q, fifths: fifths });
  }

  var measures = Array.from(partEl.getElementsByTagName('measure'));
  measures.forEach(function (measureEl, measureIndex) {
    var measureStartQ = cursorQ;
    if (measureIndex > 0) {
      measureBoundariesQ.push(cursorQ);
    }
    Array.from(measureEl.children).forEach(function (child) {
      var tag = child.tagName.toLowerCase();

      if (tag === 'attributes') {
        var divText = textOf(child, 'divisions');
        if (divText) {
          var parsedDiv = Number(divText);
          if (Number.isFinite(parsedDiv) && parsedDiv > 0) {
            divisions = parsedDiv;
          }
        }
        var fifthsText = textOf(child, 'key fifths');
        if (fifthsText !== '') {
          var parsedFifths = Number(fifthsText);
          if (Number.isFinite(parsedFifths)) {
            upsertKeyChange(measureStartQ, parsedFifths);
          }
        }
        return;
      }

      if (tag === 'backup') {
        var backupDuration = Number(textOf(child, 'duration') || '0');
        cursorQ -= backupDuration / divisions;
        return;
      }

      if (tag === 'forward') {
        var forwardDuration = Number(textOf(child, 'duration') || '0');
        cursorQ += forwardDuration / divisions;
        return;
      }

      if (tag !== 'note') {
        return;
      }

      if (child.querySelector('grace')) {
        return;
      }

      var voice = textOf(child, 'voice') || primaryVoice;
      var durationDiv = Number(textOf(child, 'duration') || '0');
      var durationQ = durationDiv / divisions;
      var isChordNote = child.querySelector('chord') !== null;
      var previousStart = lastNoteStartQByVoice.has(voice) ?
        lastNoteStartQByVoice.get(voice) : cursorQ;
      var startQ = isChordNote ? previousStart : cursorQ;
      if (!isChordNote) {
        lastNoteStartQByVoice.set(voice, startQ);
        cursorQ += durationQ;
      }

      if (durationQ <= 0) {
        return;
      }
      if (voice !== primaryVoice) {
        return;
      }

      var restEl = child.querySelector('rest');
      var isRest = restEl !== null;
      var isMeasureRest =
        !!(restEl && String(restEl.getAttribute('measure') || '').toLowerCase() === 'yes');
      var tupletInfo = parseTupletInfo(child);
      var tupletMarkers = parseTupletMarkers(child);
      var slurMarkers = parseSlurMarkers(child);
      var beamMap = parseBeamMap(child);
      var tieFlags = parseTieFlags(child);
      var noteType = textOf(child, 'type').toLowerCase();
      var dotCount = child.getElementsByTagName('dot').length;
      var vexDuration = MUSICXML_TYPE_TO_VEX[noteType] || inferVexDurationFromQuarter(durationQ);
      if (isMeasureRest) {
        vexDuration = 'w';
        dotCount = 0;
      }

      var mergeKey = eventSortKey(startQ, durationQ, isRest);
      var event = eventMap.get(mergeKey);
      if (!event) {
        event = {
          startQ: startQ,
          durationQ: durationQ,
          isRest: isRest,
          measureRest: isMeasureRest,
          vexDuration: vexDuration,
          dotCount: dotCount,
          tuplet: tupletInfo,
          tupletStarts: tupletMarkers.starts.slice(),
          tupletStops: tupletMarkers.stops.slice(),
          beams: Object.assign({}, beamMap),
          slurStarts: slurMarkers.starts.slice(),
          slurStops: slurMarkers.stops.slice(),
          midiByKey: new Map(),
          tieStartSet: new Set(),
          tieStopSet: new Set(),
        };
        eventMap.set(mergeKey, event);
      } else {
        if (!event.tuplet && tupletInfo) {
          event.tuplet = tupletInfo;
        }
        if (event.dotCount === 0 && dotCount > 0) {
          event.dotCount = dotCount;
        }
        if (!event.vexDuration && vexDuration) {
          event.vexDuration = vexDuration;
        }
        if (!event.measureRest && isMeasureRest) {
          event.measureRest = true;
        }
        pushUnique(event.tupletStarts, tupletMarkers.starts);
        pushUnique(event.tupletStops, tupletMarkers.stops);
        pushUnique(event.slurStarts, slurMarkers.starts);
        pushUnique(event.slurStops, slurMarkers.stops);
        Object.keys(beamMap).forEach(function (beamNumber) {
          if (!event.beams[beamNumber]) {
            event.beams[beamNumber] = beamMap[beamNumber];
          }
        });
      }

      if (isRest) {
        return;
      }

      var pitch = parsePitch(child);
      if (!pitch) {
        return;
      }
      event.midiByKey.set(pitch.key, pitch.midi);
      if (tieFlags.start) {
        event.tieStartSet.add(pitch.key);
      }
      if (tieFlags.stop) {
        event.tieStopSet.add(pitch.key);
      }
      addPitchToQuarterMap(pitch, startQ, durationQ);
    });
  });

  var maxQ = Math.max.apply(null, Array.from(quarterMap.keys()));
  var quarters = [];
  if (Number.isFinite(maxQ)) {
    for (var q = 0; q <= maxQ; q++) {
      var keyMap = quarterMap.get(q);
      if (!keyMap) {
        quarters.push([]);
        continue;
      }
      var sorted = Array.from(keyMap.entries())
        .sort(function (a, b) { return a[1] - b[1]; })
        .map(function (entry) { return entry[0]; });
      quarters.push(sorted);
    }
  }

  var events = Array.from(eventMap.values()).map(function (event) {
    var keys = event.isRest ? [] :
      Array.from(event.midiByKey.entries())
        .sort(function (a, b) { return a[1] - b[1]; })
        .map(function (entry) { return entry[0]; });
    return {
      startQ: event.startQ,
      durationQ: event.durationQ,
      keys: keys,
      isRest: event.isRest,
      measureRest: !!event.measureRest,
      vexDuration: event.vexDuration || inferVexDurationFromQuarter(event.durationQ),
      dotCount: event.dotCount || 0,
      tuplet: event.tuplet,
      tupletStarts: event.tupletStarts,
      tupletStops: event.tupletStops,
      beams: event.beams,
      slurStarts: event.slurStarts,
      slurStops: event.slurStops,
      tieStarts: Array.from(event.tieStartSet),
      tieStops: Array.from(event.tieStopSet),
    };
  });
  events.sort(function (left, right) {
    if (left.startQ !== right.startQ) return left.startQ - right.startQ;
    return left.durationQ - right.durationQ;
  });

  var uniqueMeasureBoundariesQ = [];
  var EPS = 1e-6;
  measureBoundariesQ.forEach(function (boundaryQ) {
    if (
      uniqueMeasureBoundariesQ.length === 0 ||
      Math.abs(boundaryQ - uniqueMeasureBoundariesQ[uniqueMeasureBoundariesQ.length - 1]) > EPS
    ) {
      uniqueMeasureBoundariesQ.push(boundaryQ);
    }
  });

  return {
    quarters: quarters,
    events: events,
    measureBoundariesQ: uniqueMeasureBoundariesQ,
    keyChanges: keyChanges
      .slice()
      .sort(function (a, b) { return a.q - b.q; }),
  };
}

function parseMusicXMLDocument(scoreDoc) {
  var partNameMap = new Map();
  Array.from(scoreDoc.getElementsByTagName('score-part')).forEach(function (partInfo) {
    var id = partInfo.getAttribute('id');
    if (!id) {
      return;
    }
    var name = textOf(partInfo, 'part-name') || id;
    partNameMap.set(id, name);
  });

  var topLevelParts = Array.from(scoreDoc.documentElement.children)
    .filter(function (el) { return el.tagName === 'part'; });

  var staffs = topLevelParts.map(function (partEl, index) {
    var id = partEl.getAttribute('id') || ('staff-' + index);
    var timeline = parsePartToTimeline(partEl);
    return {
      id: id,
      name: partNameMap.get(id) || ('Staff ' + index),
      quarters: timeline.quarters,
      events: timeline.events,
      measureBoundariesQ: timeline.measureBoundariesQ,
      keyChanges: timeline.keyChanges || [{ q: 0, fifths: 0 }],
    };
  });

  return new MusicXMLQuarterSource(staffs);
}

function accidentalFromKey(key) {
  var match = key.match(/^[a-g](bb|b|##|#)?\/\d+$/i);
  return match && match[1] ? match[1] : null;
}

function keyToMidi(key) {
  var match = key.match(/^([a-g])(bb|b|##|#)?\/(\d+)$/i);
  if (!match) {
    return Number.NaN;
  }

  var step = match[1].toLowerCase();
  var accidental = match[2] || '';
  var octave = Number(match[3]);
  var semitoneByStep = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  var alterByAcc = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 };
  return (octave + 1) * 12 + semitoneByStep[step] + alterByAcc[accidental];
}

var SHARP_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
var FLAT_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];
var SHARP_PITCH_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
var FLAT_PITCH_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

function mod12(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return ((n % 12) + 12) % 12;
}

function parseKeyComponents(key) {
  var match = String(key || '').match(/^([a-g])(bb|b|##|#)?\/(\d+)$/i);
  if (!match) {
    return null;
  }
  var step = match[1].toLowerCase();
  var accidentalText = match[2] || '';
  var alterByAcc = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 };
  return {
    step: step,
    accidental: accidentalText,
    alter: alterByAcc[accidentalText] || 0,
    octave: Number(match[3]),
  };
}

function accidentalSymbolForAlter(alter) {
  var normalized = Number(alter);
  if (!Number.isFinite(normalized)) {
    return null;
  }
  if (normalized === -2) return 'bb';
  if (normalized === -1) return 'b';
  if (normalized === 0) return 'n';
  if (normalized === 1) return '#';
  if (normalized === 2) return '##';
  return null;
}

function keySignatureAlterMap(fifths) {
  var normalized = Math.max(-7, Math.min(7, Math.floor(Number(fifths) || 0)));
  var out = { c: 0, d: 0, e: 0, f: 0, g: 0, a: 0, b: 0 };
  if (normalized > 0) {
    for (var i = 0; i < normalized; i++) {
      out[SHARP_ORDER[i]] = 1;
    }
  } else if (normalized < 0) {
    for (var j = 0; j < -normalized; j++) {
      out[FLAT_ORDER[j]] = -1;
    }
  }
  return out;
}

function getFifthsAtQuarter(keyChanges, quarterQ) {
  var changes = Array.isArray(keyChanges) && keyChanges.length ? keyChanges : [{ q: 0, fifths: 0 }];
  var q = Number(quarterQ);
  var active = 0;
  var EPS = 1e-6;
  changes.forEach(function (change) {
    var atQ = Number(change.q);
    if (!Number.isFinite(atQ)) {
      return;
    }
    if (atQ <= q + EPS) {
      active = Number(change.fifths) || 0;
    }
  });
  return Math.max(-7, Math.min(7, Math.floor(active)));
}

function fifthsToTonicPitchClass(fifths) {
  return mod12(7 * Number(fifths || 0));
}

function tonicPitchClassToBestFifths(pitchClass, preferredSign) {
  var targetPc = mod12(pitchClass);
  var preferred = Number(preferredSign) || 0;
  var best = 0;
  var bestScore = Number.POSITIVE_INFINITY;
  for (var fifths = -7; fifths <= 7; fifths++) {
    if (fifthsToTonicPitchClass(fifths) !== targetPc) {
      continue;
    }
    var score = Math.abs(fifths);
    if (preferred > 0 && fifths < 0) score += 0.2;
    if (preferred < 0 && fifths > 0) score += 0.2;
    if (score < bestScore) {
      bestScore = score;
      best = fifths;
    }
  }
  return best;
}

function transposeFifths(fifths, semitoneOffset) {
  var startFifths = Math.max(-7, Math.min(7, Math.floor(Number(fifths) || 0)));
  var tonicPc = fifthsToTonicPitchClass(startFifths);
  var transposedPc = mod12(tonicPc + Number(semitoneOffset || 0));
  return tonicPitchClassToBestFifths(transposedPc, startFifths);
}

function transposeKeyChanges(keyChanges, semitoneOffset) {
  var changes = Array.isArray(keyChanges) && keyChanges.length ? keyChanges : [{ q: 0, fifths: 0 }];
  var offset = Math.floor(Number(semitoneOffset) || 0);
  return changes.map(function (change) {
    return {
      q: Number(change.q) || 0,
      fifths: offset === 0 ? (Math.max(-7, Math.min(7, Math.floor(Number(change.fifths) || 0))) ) :
        transposeFifths(change.fifths, offset),
    };
  });
}

function buildBarBoundaries(fromQuarter, numQuarters, barlinesQ) {
  var startQ = Number(fromQuarter);
  var endQ = startQ + Math.max(0, Number(numQuarters) || 0);
  var EPS = 1e-6;
  var boundaries = [startQ];
  (barlinesQ || []).forEach(function (barQ) {
    var q = Number(barQ);
    if (!Number.isFinite(q)) {
      return;
    }
    if (q > startQ + EPS && q < endQ - EPS) {
      boundaries.push(q);
    }
  });
  boundaries.push(endQ);
  boundaries.sort(function (a, b) { return a - b; });

  var unique = [];
  boundaries.forEach(function (q) {
    if (unique.length === 0 || Math.abs(q - unique[unique.length - 1]) > EPS) {
      unique.push(q);
    }
  });
  return unique;
}

function findBarIndex(boundaries, quarterQ) {
  var q = Number(quarterQ);
  var EPS = 1e-6;
  for (var i = 0; i < boundaries.length - 1; i++) {
    if (q >= boundaries[i] - EPS && q < boundaries[i + 1] - EPS) {
      return i;
    }
  }
  return Math.max(0, boundaries.length - 2);
}

function chooseNeutralAccidentalPreference(events, barStartQ, barEndQ, semitoneOffset) {
  var sharpLeanPcs = new Set([1, 6, 8]);
  var flatLeanPcs = new Set([3, 10]);
  var sharpCount = 0;
  var flatCount = 0;
  var EPS = 1e-6;

  events.forEach(function (event) {
    if (event.isRest || event.startQ < barStartQ - EPS || event.startQ >= barEndQ - EPS) {
      return;
    }
    (event.keys || []).forEach(function (key) {
      var midi = keyToMidi(key);
      if (!Number.isFinite(midi)) {
        return;
      }
      var pc = mod12(midi + semitoneOffset);
      if (sharpLeanPcs.has(pc)) {
        sharpCount += 1;
      }
      if (flatLeanPcs.has(pc)) {
        flatCount += 1;
      }
    });
  });

  return sharpCount >= flatCount ? 'sharp' : 'flat';
}

function buildBarSpellingPreferences(events, fromQuarter, numQuarters, barlinesQ, keyChanges, semitoneOffset) {
  var boundaries = buildBarBoundaries(fromQuarter, numQuarters, barlinesQ);
  var preferences = [];
  for (var i = 0; i < boundaries.length - 1; i++) {
    var startQ = boundaries[i];
    var endQ = boundaries[i + 1];
    var fifths = getFifthsAtQuarter(keyChanges, startQ);
    var preference;
    if (fifths > 0) {
      preference = 'sharp';
    } else if (fifths < 0) {
      preference = 'flat';
    } else {
      preference = chooseNeutralAccidentalPreference(events, startQ, endQ, semitoneOffset);
    }
    preferences.push(preference);
  }
  return {
    boundaries: boundaries,
    preferences: preferences,
  };
}

function midiToPreferredKey(midi, preference) {
  var value = Number(midi);
  if (!Number.isFinite(value)) {
    return null;
  }
  var intMidi = Math.round(value);
  var pitchClass = mod12(intMidi);
  var octave = Math.floor(intMidi / 12) - 1;
  var names = preference === 'flat' ? FLAT_PITCH_NAMES : SHARP_PITCH_NAMES;
  return names[pitchClass] + '/' + octave;
}

function transposeKeyBySemitone(key, semitoneOffset, accidentalPreference) {
  if (!/^[a-g](bb|b|##|#)?\/\d+$/i.test(String(key))) {
    return key;
  }
  var midi = keyToMidi(key);
  if (!Number.isFinite(midi)) {
    return key;
  }
  var transposedKey = midiToPreferredKey(midi + semitoneOffset, accidentalPreference);
  return transposedKey || key;
}

function cloneEventForRender(event) {
  return Object.assign({}, event, {
    keys: (event.keys || []).slice(),
    tupletStarts: (event.tupletStarts || []).slice(),
    tupletStops: (event.tupletStops || []).slice(),
    slurStarts: (event.slurStarts || []).slice(),
    slurStops: (event.slurStops || []).slice(),
    tieStarts: (event.tieStarts || []).slice(),
    tieStops: (event.tieStops || []).slice(),
    beams: Object.assign({}, event.beams || {}),
    renderAccidentals: Array.isArray(event.renderAccidentals) ? event.renderAccidentals.slice() : [],
  });
}

function transposeSliceEvents(events, semitoneOffset, fromQuarter, numQuarters, barlinesQ, keyChanges) {
  if (!events || !events.length) {
    return [];
  }

  var offset = Math.floor(Number(semitoneOffset) || 0);
  var spelling = buildBarSpellingPreferences(
    events,
    fromQuarter,
    numQuarters,
    barlinesQ,
    keyChanges,
    offset
  );

  return events.map(function (event) {
    var nextEvent = cloneEventForRender(event);

    if (offset === 0 || nextEvent.isRest || nextEvent.keys.length === 0) {
      return nextEvent;
    }

    var barIndex = findBarIndex(spelling.boundaries, nextEvent.startQ);
    var accidentalPreference = spelling.preferences[barIndex] || 'sharp';
    var keyMap = new Map();
    nextEvent.keys = nextEvent.keys.map(function (key) {
      var mappedKey = transposeKeyBySemitone(key, offset, accidentalPreference);
      keyMap.set(key, mappedKey);
      return mappedKey;
    });
    nextEvent.keys.sort(function (left, right) { return keyToMidi(left) - keyToMidi(right); });

    nextEvent.tieStarts = nextEvent.tieStarts.map(function (key) {
      return keyMap.get(key) || transposeKeyBySemitone(key, offset, accidentalPreference);
    });
    nextEvent.tieStops = nextEvent.tieStops.map(function (key) {
      return keyMap.get(key) || transposeKeyBySemitone(key, offset, accidentalPreference);
    });

    return nextEvent;
  });
}

function applyAccidentalStateRules(events, fromQuarter, numQuarters, barlinesQ, keyChanges) {
  var preparedEvents = (events || []).map(cloneEventForRender);
  if (!preparedEvents.length) {
    return preparedEvents;
  }

  var boundaries = buildBarBoundaries(fromQuarter, numQuarters, barlinesQ);
  var EPS = 1e-6;

  for (var barIdx = 0; barIdx < boundaries.length - 1; barIdx++) {
    var barStartQ = boundaries[barIdx];
    var barEndQ = boundaries[barIdx + 1];
    var accidentalState = new Map();

    preparedEvents.forEach(function (event) {
      if (event.isRest) {
        return;
      }
      if (event.startQ < barStartQ - EPS || event.startQ >= barEndQ - EPS) {
        return;
      }

      var tieStopSet = new Set(event.tieStops || []);
      event.renderAccidentals = new Array(event.keys.length).fill(null);

      event.keys.forEach(function (key, keyIdx) {
        var parsed = parseKeyComponents(key);
        if (!parsed) {
          event.renderAccidentals[keyIdx] = accidentalFromKey(key);
          return;
        }

        var stateKey = parsed.step + '/' + parsed.octave;
        // Key signature is used for enharmonic spelling, but hidden in rendering.
        // So each bar starts from natural accidental state for visibility.
        var previousAlter = accidentalState.has(stateKey) ?
          accidentalState.get(stateKey) : 0;
        var showAccidental = null;

        if (!tieStopSet.has(key) && parsed.alter !== previousAlter) {
          showAccidental = accidentalSymbolForAlter(parsed.alter);
        }

        event.renderAccidentals[keyIdx] = showAccidental;
        accidentalState.set(stateKey, parsed.alter);
      });
    });
  }

  return preparedEvents;
}

function stemDirectionForEvent(event) {
  if (!event || event.isRest || !event.keys || event.keys.length === 0) {
    return VF.Stem.UP;
  }

  // Treble engraving rule requested: below middle line (B4) -> stems up, otherwise down.
  var STEM_PIVOT_MIDI = 71; // B4
  var sum = 0;
  var count = 0;
  event.keys.forEach(function (key) {
    var midi = keyToMidi(key);
    if (Number.isFinite(midi)) {
      sum += midi;
      count += 1;
    }
  });
  if (count === 0) {
    return VF.Stem.UP;
  }
  var averageMidi = sum / count;
  return averageMidi < STEM_PIVOT_MIDI ? VF.Stem.UP : VF.Stem.DOWN;
}

function beamStemDirectionForEvents(events) {
  if (!events || events.length === 0) {
    return VF.Stem.UP;
  }

  // Standard engraving rule for beamed groups:
  // majority above/below middle line decides; ties resolved by farthest note,
  // and exact symmetry defaults to down stems.
  var STEM_PIVOT_MIDI = 71; // B4
  var aboveCount = 0;
  var belowCount = 0;
  var farthestDelta = 0;
  var EPS = 1e-6;

  events.forEach(function (event) {
    if (!event || event.isRest || !event.keys) {
      return;
    }
    event.keys.forEach(function (key) {
      var midi = keyToMidi(key);
      if (!Number.isFinite(midi)) {
        return;
      }
      var delta = midi - STEM_PIVOT_MIDI;
      if (delta > EPS) {
        aboveCount += 1;
      } else if (delta < -EPS) {
        belowCount += 1;
      }
      if (Math.abs(delta) > Math.abs(farthestDelta)) {
        farthestDelta = delta;
      }
    });
  });

  if (aboveCount === 0 && belowCount === 0) {
    return VF.Stem.UP;
  }
  if (belowCount > aboveCount) {
    return VF.Stem.UP;
  }
  if (aboveCount > belowCount) {
    return VF.Stem.DOWN;
  }
  if (farthestDelta < -EPS) {
    return VF.Stem.UP;
  }
  if (farthestDelta > EPS) {
    return VF.Stem.DOWN;
  }
  return VF.Stem.DOWN;
}

function makeExactStaveNote(event) {
  var keys;
  if (event.isRest || !event.keys.length) {
    // Whole-measure rests should hang from the 2nd line (D) in treble.
    keys = event.measureRest ? ['d/5'] : ['b/4'];
  } else {
    keys = event.keys;
  }
  var effectiveDuration = event.vexDuration || 'q';
  if (event.isRest && event.measureRest) {
    effectiveDuration = 'w';
  }
  var duration = effectiveDuration + (event.isRest ? 'r' : '');
  var note = new VF.StaveNote({
    clef: 'treble',
    keys: keys,
    duration: duration,
  });

  if (!event.isRest) {
    note.setStemDirection(stemDirectionForEvent(event));
    keys.forEach(function (key, idx) {
      var accidental = null;
      if (Array.isArray(event.renderAccidentals) && idx < event.renderAccidentals.length) {
        accidental = event.renderAccidentals[idx];
      } else {
        accidental = accidentalFromKey(key);
      }
      if (accidental) {
        note.addAccidental(idx, new VF.Accidental(accidental));
      }
    });
  }

  var dots = Math.max(0, event.dotCount || 0);
  for (var i = 0; i < dots; i++) {
    note.addDotToAll();
  }
  return note;
}

function slurInvertForStemAndPlacement(stemDirection, placement) {
  var normalizedPlacement = String(placement || '').toLowerCase();
  // VexFlow default (invert=false) already draws slurs opposite to stem direction.
  if (normalizedPlacement === 'below') {
    return stemDirection === VF.Stem.DOWN;
  }
  if (normalizedPlacement === 'above') {
    return stemDirection === VF.Stem.UP;
  }
  return false;
}

function centerMeasureRests(sliceEvents, notes, xForQuarter) {
  if (typeof xForQuarter !== 'function') {
    return;
  }
  var EPS = 1e-6;
  sliceEvents.forEach(function (event, idx) {
    if (!event || !event.isRest || !event.measureRest) {
      return;
    }
    var note = notes[idx];
    if (!note) {
      return;
    }

    if (typeof note.setCenterAlignment === 'function') {
      note.setCenterAlignment(true);
    }
    if (typeof note.setXShift !== 'function') {
      return;
    }

    var leftX = xForQuarter(event.startQ);
    var rightX = xForQuarter(event.startQ + event.durationQ);
    if (!Number.isFinite(leftX) || !Number.isFinite(rightX) || Math.abs(rightX - leftX) <= EPS) {
      return;
    }

    var desiredCenterX = (leftX + rightX) / 2;
    var currentX = note.getAbsoluteX();
    if (!Number.isFinite(currentX)) {
      return;
    }
    note.setXShift(desiredCenterX - currentX);
  });
}

function recenterDrawnMeasureRests(sliceEvents, notes, xForQuarter) {
  var adjustments = [];
  if (typeof xForQuarter !== 'function') {
    return adjustments;
  }

  var EPS = 1e-6;
  sliceEvents.forEach(function (event, idx) {
    if (!event || !event.isRest || !event.measureRest) {
      return;
    }
    var note = notes[idx];
    if (!note) {
      return;
    }

    var leftX = xForQuarter(event.startQ);
    var rightX = xForQuarter(event.startQ + event.durationQ);
    if (!Number.isFinite(leftX) || !Number.isFinite(rightX) || Math.abs(rightX - leftX) <= EPS) {
      return;
    }
    var desiredCenterX = (leftX + rightX) / 2;

    var visualLeft = noteLeftEdgeX(note);
    var visualRight = noteRightEdgeX(note);
    var currentCenterX = Number.NaN;
    if (Number.isFinite(visualLeft) && Number.isFinite(visualRight) && visualRight > visualLeft + EPS) {
      currentCenterX = (visualLeft + visualRight) / 2;
    } else if (typeof note.getAbsoluteX === 'function') {
      currentCenterX = note.getAbsoluteX();
    }
    if (!Number.isFinite(currentCenterX)) {
      return;
    }

    var delta = desiredCenterX - currentCenterX;
    if (!Number.isFinite(delta) || Math.abs(delta) <= 0.01) {
      return;
    }

    if (typeof note.getXShift === 'function' && typeof note.setXShift === 'function') {
      var currentShift = Number(note.getXShift());
      if (Number.isFinite(currentShift)) {
        note.setXShift(currentShift + delta);
      }
    }

    var noteEl = typeof note.getAttribute === 'function' ? note.getAttribute('el') : null;
    if (noteEl && typeof noteEl.setAttribute === 'function') {
      var existingTransform = noteEl.getAttribute('transform');
      var translate = 'translate(' + delta.toFixed(3) + ' 0)';
      noteEl.setAttribute(
        'transform',
        existingTransform ? (existingTransform + ' ' + translate) : translate
      );
    }

    adjustments.push({
      startQ: roundForReport(event.startQ),
      durationQ: roundForReport(event.durationQ),
      desiredCenterX: roundForReport(desiredCenterX),
      beforeCenterX: roundForReport(currentCenterX),
      deltaX: roundForReport(delta),
    });
  });

  return adjustments;
}

function renderMusicSlice(events, fromQuarter, numQuarters, staffIndex, barlinesQ) {
  clearScore();

  var sliceEvents = events && events.length ? events : [{
    startQ: fromQuarter,
    durationQ: 1,
    keys: [],
    isRest: true,
    measureRest: false,
    vexDuration: 'q',
    dotCount: 0,
    tuplet: null,
    tupletStarts: [],
    tupletStops: [],
    beams: {},
    slurStarts: [],
    slurStops: [],
    tieStarts: [],
    tieStops: [],
  }];

  var notes = sliceEvents.map(function (event) {
    return makeExactStaveNote(event);
  });

  var beams = [];
  var openBeams = new Map();
  sliceEvents.forEach(function (event, idx) {
    var note = notes[idx];
    function newOpenBeamGroup() {
      return { notes: [], events: [] };
    }
    function getOrCreateOpenBeamGroup(beamNumber) {
      var group = openBeams.get(beamNumber);
      if (!group) {
        group = newOpenBeamGroup();
        openBeams.set(beamNumber, group);
      }
      return group;
    }
    function pushBeamNote(group) {
      if (!group || event.isRest) {
        return;
      }
      group.notes.push(note);
      group.events.push(event);
    }
    Object.keys(event.beams || {}).forEach(function (beamNumber) {
      var state = String(event.beams[beamNumber] || '').toLowerCase();
      var open = openBeams.get(beamNumber);

      if (state === 'begin') {
        open = newOpenBeamGroup();
        openBeams.set(beamNumber, open);
        pushBeamNote(open);
      } else if (state === 'continue') {
        open = getOrCreateOpenBeamGroup(beamNumber);
        pushBeamNote(open);
      } else if (state === 'end') {
        open = getOrCreateOpenBeamGroup(beamNumber);
        pushBeamNote(open);
        if (open.notes.length >= 2) {
          var beamStemDirection = beamStemDirectionForEvents(open.events);
          open.notes.forEach(function (beamNote) {
            beamNote.setStemDirection(beamStemDirection);
          });
          beams.push(new VF.Beam(open.notes));
        }
        openBeams.delete(beamNumber);
      }
    });
  });

  // Hide flags for any note that has MusicXML beam tags, even when the tag
  // is a single-note hook and no drawable VexFlow beam object is created.
  var invisibleStyle = {
    fillStyle: 'rgba(0,0,0,0)',
    strokeStyle: 'rgba(0,0,0,0)',
  };
  sliceEvents.forEach(function (event, idx) {
    var note = notes[idx];
    var hasBeamTag = Object.keys(event.beams || {}).length > 0;
    if (!hasBeamTag) {
      return;
    }
    if (note.beam === null) {
      note.setBeam({ xmlBeamTag: true });
    }
    note.setFlagStyle(invisibleStyle);
  });

  var totalQuarters = sliceEvents.reduce(function (sum, event) {
    return sum + Math.max(0, event.durationQ || 0);
  }, 0);
  var voiceBeats = Math.max(1, Math.ceil(totalQuarters));

  var voice = new VF.Voice({
    num_beats: voiceBeats,
    beat_value: 4,
  });
  voice.setMode(VF.Voice.Mode.SOFT);
  voice.addTickables(notes);

  var drawWidth = full_Width - 20;
  new VF.Formatter().joinVoices([voice]).format([voice], drawWidth);

  var xForQuarterTime;
  var xForQuarterBarline;
  if (spacingMode === 'linear') {
    var xForQuarterLinear = buildLinearQuarterXInterpolator(
      fromQuarter,
      numQuarters,
      staveMain,
      { leftPaddingPx: 8, rightPaddingPx: 8 }
    );
    // Keep VexFlow's engraving positions intact so note modifiers
    // (accidentals, dots, etc.) remain visually attached.
    xForQuarterTime = xForQuarterLinear;
    xForQuarterBarline = buildLinearBarlineInterpolator(
      xForQuarterLinear,
      sliceEvents,
      notes,
      barlinesQ
    );
  } else {
    xForQuarterTime = buildQuarterXInterpolator(sliceEvents, notes, staveMain);
    xForQuarterBarline = xForQuarterTime;
  }

  voice.draw(context, staveMain);
  beams.forEach(function (beam) {
    beam.setContext(context).draw();
  });

  var xForQuarter = xForQuarterTime;

  var tuplets = [];
  var tupletNoteIndices = new Set();
  var openTuplets = new Map();
  sliceEvents.forEach(function (event, idx) {
    (event.tupletStarts || []).forEach(function (start) {
      var number = String(start.number || '1');
      if (!openTuplets.has(number)) {
        openTuplets.set(number, {
          notes: [],
          noteIndices: [],
          actual: event.tuplet ? event.tuplet.actual : null,
          normal: event.tuplet ? event.tuplet.normal : null,
          bracketed: start.bracketed !== false,
        });
      }
    });

    openTuplets.forEach(function (group) {
      group.notes.push(notes[idx]);
      group.noteIndices.push(idx);
      if ((!group.actual || !group.normal) && event.tuplet) {
        group.actual = event.tuplet.actual;
        group.normal = event.tuplet.normal;
      }
    });

    (event.tupletStops || []).forEach(function (stopNumber) {
      var key = String(stopNumber || '1');
      var group = openTuplets.get(key);
      if (!group || group.notes.length < 2) {
        openTuplets.delete(key);
        return;
      }
      tuplets.push(new VF.Tuplet(group.notes, {
        num_notes: group.actual || group.notes.length,
        notes_occupied: group.normal || Math.max(1, group.notes.length - 1),
        bracketed: group.bracketed,
      }));
      group.noteIndices.forEach(function (noteIdx) { tupletNoteIndices.add(noteIdx); });
      openTuplets.delete(key);
    });
  });

  // Fallback tuplet grouping for notes with time-modification but missing start/stop markers in the slice.
  for (var startIdx = 0; startIdx < sliceEvents.length; startIdx++) {
    if (tupletNoteIndices.has(startIdx)) {
      continue;
    }
    var startEvent = sliceEvents[startIdx];
    if (!startEvent.tuplet || startEvent.isRest) {
      continue;
    }

    var groupIdx = [startIdx];
    for (var j = startIdx + 1; j < sliceEvents.length && groupIdx.length < startEvent.tuplet.actual; j++) {
      if (tupletNoteIndices.has(j)) {
        break;
      }
      var candidate = sliceEvents[j];
      if (!candidate.tuplet || candidate.isRest) {
        break;
      }
      if (
        candidate.tuplet.actual !== startEvent.tuplet.actual ||
        candidate.tuplet.normal !== startEvent.tuplet.normal
      ) {
        break;
      }
      groupIdx.push(j);
    }

    if (groupIdx.length >= 2) {
      var groupNotes = groupIdx.map(function (k) { return notes[k]; });
      tuplets.push(new VF.Tuplet(groupNotes, {
        num_notes: startEvent.tuplet.actual,
        notes_occupied: startEvent.tuplet.normal,
      }));
      groupIdx.forEach(function (k) { tupletNoteIndices.add(k); });
      startIdx = groupIdx[groupIdx.length - 1];
    }
  }
  tuplets.forEach(function (tuplet) {
    tuplet.setContext(context).draw();
  });

  var ties = [];
  var openTiesByPitch = new Map();
  sliceEvents.forEach(function (event, idx) {
    if (event.isRest) {
      return;
    }
    var currentNote = notes[idx];
    var keyIndexMap = {};
    event.keys.forEach(function (key, keyIndex) {
      keyIndexMap[key] = keyIndex;
    });

    (event.tieStops || []).forEach(function (key) {
      var openTie = openTiesByPitch.get(key);
      if (!openTie || keyIndexMap[key] === undefined) {
        return;
      }
      ties.push(new VF.StaveTie({
        first_note: openTie.note,
        last_note: currentNote,
        first_indices: [openTie.index],
        last_indices: [keyIndexMap[key]],
      }));
      if ((event.tieStarts || []).indexOf(key) === -1) {
        openTiesByPitch.delete(key);
      }
    });

    (event.tieStarts || []).forEach(function (key) {
      if (keyIndexMap[key] === undefined) {
        return;
      }
      openTiesByPitch.set(key, {
        note: currentNote,
        index: keyIndexMap[key],
      });
    });
  });
  ties.forEach(function (tie) {
    tie.setContext(context).draw();
  });

  var curves = [];
  var openSlurs = new Map();
  sliceEvents.forEach(function (event, idx) {
    var currentNote = notes[idx];

    (event.slurStops || []).forEach(function (slurStop) {
      var slurNumber = typeof slurStop === 'object' ? slurStop.number : slurStop;
      var stopPlacement = typeof slurStop === 'object' ? (slurStop.placement || '') : '';
      var key = String(slurNumber);
      var startInfo = openSlurs.get(key);
      if (startInfo) {
        var stemDirection = startInfo.note.getStemDirection();
        var placement = startInfo.placement || stopPlacement;
        var invertByStem = slurInvertForStemAndPlacement(stemDirection, placement);
        curves.push(new VF.Curve(startInfo.note, currentNote, {
          invert: invertByStem,
        }));
        openSlurs.delete(key);
      } else {
        // Slur started before the visible slice: draw a partial slur into this note.
        var stopStemDirection = currentNote.getStemDirection();
        var invertFromStopStem = slurInvertForStemAndPlacement(stopStemDirection, stopPlacement);
        curves.push(new VF.Curve(null, currentNote, {
          invert: invertFromStopStem,
        }));
      }
    });

    (event.slurStarts || []).forEach(function (slurStart) {
      var slurNumber = typeof slurStart === 'string' ? slurStart : slurStart.number;
      var placement = typeof slurStart === 'string' ? '' : (slurStart.placement || '');
      openSlurs.set(String(slurNumber), {
        note: currentNote,
        placement: placement,
      });
    });
  });
  // Slurs still open here continue beyond the right edge of the visible slice.
  openSlurs.forEach(function (startInfo) {
    var stemDirection = startInfo.note.getStemDirection();
    var invertByStem = slurInvertForStemAndPlacement(stemDirection, startInfo.placement || '');
    curves.push(new VF.Curve(startInfo.note, null, {
      invert: invertByStem,
    }));
  });
  curves.forEach(function (curve) {
    curve.setContext(context).draw();
  });

  var resolvedBarlineXMap = buildResolvedBarlineXMap(
    barlinesQ,
    xForQuarterBarline,
    sliceEvents,
    notes
  );
  var safeNumQuarters = Math.max(0, Number(numQuarters) || 0);
  var sliceEndQ = fromQuarter + safeNumQuarters;
  var staffRightForSlice = staffRightEdgeX();
  redistributeRestOnlyBarlines(
    resolvedBarlineXMap,
    barlinesQ,
    sliceEvents,
    notes,
    sliceEndQ,
    Number.isFinite(staffRightForSlice) ? staffRightForSlice : xForQuarterBarline(sliceEndQ)
  );

  var resolvedBarlineEntries = [];
  resolvedBarlineXMap.forEach(function (x, key) {
    resolvedBarlineEntries.push({
      quarterQ: Number(key),
      x: roundForReport(x),
    });
  });
  resolvedBarlineEntries.sort(function (left, right) {
    return left.quarterQ - right.quarterQ;
  });

  var xForQuarterBarlineResolved = function (quarterQ) {
    var key = quarterKey(quarterQ);
    if (resolvedBarlineXMap.has(key)) {
      return resolvedBarlineXMap.get(key);
    }
    return xForQuarterBarline(quarterQ);
  };
  var xForQuarterMeasureBoundary = function (quarterQ) {
    var EPS = 1e-6;
    var q = Number(quarterQ);
    var key = quarterKey(q);
    if (resolvedBarlineXMap.has(key)) {
      return resolvedBarlineXMap.get(key);
    }

    var endX = Number.isFinite(staffRightForSlice) ? staffRightForSlice : xForQuarterBarline(sliceEndQ);

    if (resolvedBarlineEntries.length > 0) {
      var first = resolvedBarlineEntries[0];
      var last = resolvedBarlineEntries[resolvedBarlineEntries.length - 1];

      if (
        Number.isFinite(endX) &&
        Number.isFinite(last.x) &&
        sliceEndQ > last.quarterQ + EPS &&
        endX <= last.x + EPS
      ) {
        endX = last.x + 1;
      }

      if (q >= sliceEndQ - EPS) {
        return endX;
      }
      if (q <= first.quarterQ + EPS) {
        return Math.min(first.x, xForQuarterBarline(q));
      }

      for (var i = 0; i < resolvedBarlineEntries.length - 1; i++) {
        var left = resolvedBarlineEntries[i];
        var right = resolvedBarlineEntries[i + 1];
        if (q > left.quarterQ + EPS && q < right.quarterQ - EPS) {
          var ratioMid = (q - left.quarterQ) / (right.quarterQ - left.quarterQ);
          return left.x + ratioMid * (right.x - left.x);
        }
      }

      if (q > last.quarterQ + EPS && sliceEndQ > last.quarterQ + EPS) {
        var ratioTail = (q - last.quarterQ) / (sliceEndQ - last.quarterQ);
        return last.x + ratioTail * (endX - last.x);
      }
      return last.x;
    }

    if (q >= sliceEndQ - EPS) {
      return endX;
    }
    return xForQuarterBarline(q);
  };
  var measureRestRecenterAdjustments = recenterDrawnMeasureRests(
    sliceEvents,
    notes,
    xForQuarterMeasureBoundary
  );

  if (barlinesQ && barlinesQ.length > 0) {
    var staffTopY = staveMain.getYForLine(0);
    var staffBottomY = staveMain.getYForLine(4);

    barlinesQ.forEach(function (barQ) {
      var x = xForQuarterBarlineResolved(barQ);
      context.beginPath();
      context.moveTo(x, staffTopY);
      context.lineTo(x, staffBottomY);
      context.stroke();
    });
  }

  var beatSplitPoints = buildBeatSplitPoints(
    fromQuarter,
    safeNumQuarters,
    xForQuarter,
    sliceEvents,
    notes,
    barlinesQ,
    xForQuarterBarlineResolved
  );

  drawDynamicsForExactSlice(fromQuarter, numQuarters, xForQuarter, beatSplitPoints);
  if (notes.length > 0) {
    drawAndAnimatePlaybarTimeMapped(
      fromQuarter,
      numQuarters,
      xForQuarter,
      context,
      sliceEvents,
      notes,
      beatSplitPoints,
      barlinesQ,
      xForQuarterBarlineResolved
    );
  }

  var header = tannhauserScore.getStaffName(staffIndex) +
    ' | from quarter ' + fromQuarter +
    ' | length ' + Math.floor(numQuarters) +
    ' | transpose ' + (transposeSemitones >= 0 ? '+' : '') + transposeSemitones + ' st' +
    ' | exact rhythm/beam/slur' +
    ' | spacing: ' + spacingMode +
    ' | font: ' + selectedScoreFontName;
  setRenderInfo(header);

  var measureRestWindows = [];
  sliceEvents.forEach(function (event) {
    if (!event || !event.isRest || !event.measureRest) {
      return;
    }
    var leftX = xForQuarterMeasureBoundary(event.startQ);
    var rightX = xForQuarterMeasureBoundary(event.startQ + event.durationQ);
    measureRestWindows.push({
      startQ: roundForReport(event.startQ),
      durationQ: roundForReport(event.durationQ),
      leftX: roundForReport(leftX),
      rightX: roundForReport(rightX),
      centerX: roundForReport((leftX + rightX) / 2),
    });
  });

  lastRenderDiagnostics = {
    timestamp: new Date().toISOString(),
    staffIndex: staffIndex,
    staffName: tannhauserScore ? tannhauserScore.getStaffName(staffIndex) : '',
    fromQuarter: fromQuarter,
    numQuarters: numQuarters,
    transposeSemitones: transposeSemitones,
    spacingMode: spacingMode,
    scoreFont: selectedScoreFontName,
    header: header,
    barlinesQ: (barlinesQ || []).map(function (q) { return roundForReport(q); }),
    resolvedBarlines: resolvedBarlineEntries,
    beatSplitPoints: beatSplitPoints.map(function (x) { return roundForReport(x); }),
    measureRestWindows: measureRestWindows,
    measureRestRecenterAdjustments: measureRestRecenterAdjustments,
  };
  window.lastRenderDiagnostics = lastRenderDiagnostics;
}

function selectedStaff() {
  var chooser = document.getElementById('staffChooser');
  if (chooser && chooser.value !== '') {
    var parsed = Number(chooser.value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return selectedStaffIndex;
}

function setSelectedStaff(index) {
  if (!tannhauserScore) {
    return;
  }
  var count = tannhauserScore.getStaffCount();
  if (count <= 0) {
    selectedStaffIndex = 0;
    return;
  }
  var numeric = Number(index);
  if (!Number.isFinite(numeric)) {
    numeric = selectedStaffIndex;
  }
  selectedStaffIndex = Math.max(0, Math.min(Math.floor(numeric), count - 1));
  var chooser = document.getElementById('staffChooser');
  if (chooser) {
    chooser.value = String(selectedStaffIndex);
  }
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}

window.setSelectedStaff = setSelectedStaff;

function buildStaffChooser() {
  var chooser = document.getElementById('staffChooser');
  if (!chooser || !tannhauserScore) {
    return;
  }

  chooser.innerHTML = '';
  var count = tannhauserScore.getStaffCount();
  if (count === 0) {
    chooser.disabled = true;
    return;
  }
  chooser.disabled = false;

  selectedStaffIndex = Math.max(0, Math.min(selectedStaffIndex, count - 1));

  for (var i = 0; i < count; i++) {
    var option = document.createElement('option');
    option.value = String(i);
    option.textContent = i + ': ' + tannhauserScore.getStaffName(i);
    chooser.appendChild(option);
  }
  chooser.value = String(selectedStaffIndex);
  refreshDebugSliceInputs();
}

function calculateFromQuarterFromSnake() {
  if (!snake || snake.length < 2) {
    return null;
  }

  // Snake is serialized tail -> head, so head is the final coordinate pair.
  var headX = Number(snake[snake.length - 2]);
  var headY = Number(snake[snake.length - 1]);
  if (!Number.isFinite(headX) || !Number.isFinite(headY)) {
    return null;
  }

  return headY * game_Width + headX;
}

function calculateNumQuartersFromSnake() {
  if (!snake || snake.length < 2) {
    return 0;
  }
  return Math.floor(snake.length / 2);
}

function updateLockedSliceFromSnake() {
  var fromQuarter = calculateFromQuarterFromSnake();
  var numQuarters = calculateNumQuartersFromSnake();
  if (fromQuarter === null || numQuarters <= 0) {
    return false;
  }
  lockedFromQuarter = fromQuarter;
  lockedNumQuarters = numQuarters;
  refreshDebugSliceInputs();
  return true;
}

function renderMusicFromSnake() {
  if (!tannhauserScore) {
    return false;
  }

  // Keep playbar timer/animation in sync with current render.
  stopPlaybarMotion();

  // Passage content latch only updates at eaten-sync points.
  if (pendingEatenRender) {
    updateLockedSliceFromSnake();
  }

  if (lockedFromQuarter === null || lockedNumQuarters === null) {
    updateLockedSliceFromSnake();
  }

  var fromQuarter =
    debugOverrideFromQuarter !== null ? debugOverrideFromQuarter : lockedFromQuarter;
  if (fromQuarter === null) {
    fromQuarter = calculateFromQuarterFromSnake();
  }
  var numQuarters =
    debugOverrideNumQuarters !== null ? debugOverrideNumQuarters : lockedNumQuarters;
  if (!Number.isFinite(numQuarters) || numQuarters <= 0) {
    numQuarters = calculateNumQuartersFromSnake();
  }

  if (fromQuarter === null || numQuarters <= 0) {
    refreshDebugSliceInputs();
    return false;
  }

  refreshDebugSliceInputs(fromQuarter, numQuarters);

  var staffIndex = selectedStaff();
  var sliceData = tannhauserScore.getExactSliceData(fromQuarter, numQuarters, staffIndex);
  var sourceKeyChanges = sliceData.keyChanges || [{ q: fromQuarter, fifths: 0 }];
  var transposedKeyChanges = transposeKeyChanges(sourceKeyChanges, transposeSemitones);
  var transposedEvents = transposeSliceEvents(
    sliceData.events,
    transposeSemitones,
    fromQuarter,
    numQuarters,
    sliceData.barlines,
    transposedKeyChanges
  );
  var preparedEvents = applyAccidentalStateRules(
    transposedEvents,
    fromQuarter,
    numQuarters,
    sliceData.barlines,
    transposedKeyChanges
  );
  renderMusicSlice(preparedEvents, fromQuarter, numQuarters, staffIndex, sliceData.barlines);
  pendingEatenRender = false;
  renderWaitSnakeVersion = 0;
  if (eatenRenderFallbackTimer) {
    clearTimeout(eatenRenderFallbackTimer);
    eatenRenderFallbackTimer = 0;
  }
  return true;
}

function setSnakeCoordinates(message) {
  var messageArray = message.split(' ');
  snake = messageArray.map(function (val) { return Number(val); });

  snakeSnapshotVersion++;
  if (pendingEatenRender) {
    // After eaten, wait for a fresher snake snapshot before rendering.
    if (snakeSnapshotVersion >= renderWaitSnakeVersion) {
      renderMusicFromSnake();
    }
    return;
  }

  // Legacy loop behavior: every snake packet refreshes render/playbar,
  // while passage content stays latched until the next eaten-sync update.
  renderMusicFromSnake();
}

// Override: in this variant eaten triggers quarter extraction and notation display.
function setEaten(message) {
  var raw = String(message || '').trim();
  var rawTokens = raw.length > 0 ? raw.split(/\s+/) : [];
  var numericTokens = [];
  for (var i = 0; i < rawTokens.length; i++) {
    var numeric = Number(rawTokens[i]);
    if (Number.isFinite(numeric)) {
      numericTokens.push(numeric);
    }
  }

  // Keep canonical eaten payload as first 6 numeric values when available:
  // <x> <y> <amount> <hueBin> <satBin> <value>
  if (numericTokens.length >= 6) {
    eaten = numericTokens.slice(0, 6).map(function (value) {
      return String(value);
    });
  } else {
    eaten = rawTokens;
  }

  var hueBin = Number.isFinite(numericTokens[3]) ? numericTokens[3] : Number(eaten[3]);
  if (Number.isFinite(hueBin)) {
    // Requested mapping: transpose = hueBin - 6
    transposeSemitones = clampTransposeSemitones(hueBin - 6);
    syncTransposeInputControl();
  }

  pendingEatenRender = true;
  // Wait for a newer snake snapshot than the currently known one.
  renderWaitSnakeVersion = snakeSnapshotVersion + 1;

  // Proactively request a fresh snake state from the game side.
  if (typeof wsSend === 'function') {
    wsSend('snake');
  }

  // Fallback in case the fresh snapshot is delayed/lost.
  if (eatenRenderFallbackTimer) {
    clearTimeout(eatenRenderFallbackTimer);
  }
  eatenRenderFallbackTimer = setTimeout(function () {
    if (pendingEatenRender) {
      renderMusicFromSnake();
    }
  }, EATEN_RENDER_FALLBACK_MS);
}

async function loadTannhauserMxl() {
  try {
    setDebugStatus('Loading /tannhauser.mxl ...');
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip was not loaded.');
    }

    var response = await fetch('/tannhauser.mxl');
    if (!response.ok) {
      throw new Error('Failed to fetch tannhauser.mxl: ' + response.status);
    }

    var mxlArrayBuffer = await response.arrayBuffer();
    var zip = await JSZip.loadAsync(mxlArrayBuffer);

    var rootPath = 'score.xml';
    var containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      var containerXml = await containerFile.async('string');
      var containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
      var rootFile = containerDoc.querySelector('rootfile');
      if (rootFile && rootFile.getAttribute('full-path')) {
        rootPath = rootFile.getAttribute('full-path');
      }
    }

    var scoreFile = zip.file(rootPath);
    if (!scoreFile) {
      throw new Error('MusicXML root file not found in mxl: ' + rootPath);
    }

    var scoreXml = await scoreFile.async('string');
    var scoreDoc = new DOMParser().parseFromString(scoreXml, 'application/xml');
    tannhauserScore = parseMusicXMLDocument(scoreDoc);
    window.tannhauserScore = tannhauserScore;
    window.getQuarters = function (fromQuarter, numQuarters, staff) {
      if (!tannhauserScore) {
        return [];
      }
      return tannhauserScore.getQuarters(fromQuarter, numQuarters, staff);
    };
    window.getRhythmicSlice = function (fromQuarter, numQuarters, staff) {
      if (!tannhauserScore) {
        return [];
      }
      return tannhauserScore.getRhythmicSlice(fromQuarter, numQuarters, staff);
    };
    window.getExactSlice = function (fromQuarter, numQuarters, staff) {
      if (!tannhauserScore) {
        return [];
      }
      return tannhauserScore.getExactSlice(fromQuarter, numQuarters, staff);
    };
    window.getExactSliceData = function (fromQuarter, numQuarters, staff) {
      if (!tannhauserScore) {
        return { events: [], barlines: [], keyChanges: [{ q: 0, fifths: 0 }] };
      }
      return tannhauserScore.getExactSliceData(fromQuarter, numQuarters, staff);
    };

    if (tannhauserScore.getStaffCount() > 0) {
      selectedStaffIndex = Math.max(0, Math.min(selectedStaffIndex, tannhauserScore.getStaffCount() - 1));
    } else {
      selectedStaffIndex = 0;
    }

    buildStaffChooser();
    setDebugStatus('Loaded tannhauser.mxl with ' + tannhauserScore.getStaffCount() + ' staves.');

    if (pendingEatenRender) {
      renderMusicFromSnake();
    }
  } catch (error) {
    setDebugStatus('MXL load/parse error: ' + error.message);
  }
}

loadTannhauserMxl();
