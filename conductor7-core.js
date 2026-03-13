VF = Vex.Flow;

const fontStacks = {
  Bravura: [VF.Fonts.Bravura, VF.Fonts.Gonville, VF.Fonts.Custom],
  Gonville: [VF.Fonts.Gonville, VF.Fonts.Bravura, VF.Fonts.Custom],
  Petaluma: [VF.Fonts.Petaluma, VF.Fonts.Gonville, VF.Fonts.Custom],
}

var selectedScoreFontName = 'Bravura';
var spacingMode = 'engraved';
VF.DEFAULT_FONT_STACK = fontStacks[selectedScoreFontName];
const scoreViewConfig = (window && window.SCORE_VIEW_CONFIG) ? window.SCORE_VIEW_CONFIG : {};
const DEFAULT_SCORE_WIDTH = 901;
const DEFAULT_SCORE_HEIGHT = 340;
var full_Width = DEFAULT_SCORE_WIDTH;
var full_Height = DEFAULT_SCORE_HEIGHT;
const phrasePreviewOffsetY = (
  window &&
  window.SCORE_VIEW_CONFIG &&
  Number.isFinite(Number(window.SCORE_VIEW_CONFIG.phrasePreviewOffsetY))
) ? Number(window.SCORE_VIEW_CONFIG.phrasePreviewOffsetY) : 122;
const DEFAULT_OSMD_MUSIC_ZOOM = Number.isFinite(Number(scoreViewConfig.osmdMusicZoom))
  ? Number(scoreViewConfig.osmdMusicZoom)
  : 0.58;
const OSMD_WIDEST_CASE_VB_WIDTH = 1218.7262496;
const OSMD_WIDEST_CASE_VB_HEIGHT = 381.0;
const CONDUCTOR_FIT_PADDING_X = Number.isFinite(Number(scoreViewConfig.conductorFitPaddingX))
  ? Math.max(0, Number(scoreViewConfig.conductorFitPaddingX))
  : Math.max(0, Number(scoreViewConfig.conductorFitPaddingPx) || 10);
const CONDUCTOR_FIT_PADDING_Y = Number.isFinite(Number(scoreViewConfig.conductorFitPaddingY))
  ? Math.max(0, Number(scoreViewConfig.conductorFitPaddingY))
  : Math.max(0, Number(scoreViewConfig.conductorFitPaddingPx) || 10);
const CONDUCTOR_FIT_MIN_ZOOM = Number.isFinite(Number(scoreViewConfig.conductorFitMinZoom))
  ? Math.max(0.01, Number(scoreViewConfig.conductorFitMinZoom))
  : 0.1;
const CONDUCTOR_FIT_MAX_ZOOM = Number.isFinite(Number(scoreViewConfig.conductorFitMaxZoom))
  ? Math.max(CONDUCTOR_FIT_MIN_ZOOM, Number(scoreViewConfig.conductorFitMaxZoom))
  : 1.5;
const CONDUCTOR_FIT_SAFETY = 0.995;
const CONDUCTOR_FIT_WIDTH_FROM_QUARTER = Number.isFinite(Number(scoreViewConfig.conductorFitWidthFromQuarter))
  ? Math.max(0, Math.floor(Number(scoreViewConfig.conductorFitWidthFromQuarter)))
  : 29;
const CONDUCTOR_FIT_WIDTH_NUM_QUARTERS = Number.isFinite(Number(scoreViewConfig.conductorFitWidthNumQuarters))
  ? Math.max(1, Math.floor(Number(scoreViewConfig.conductorFitWidthNumQuarters)))
  : 10;
const CONDUCTOR_FIT_WIDTH_TRANSPOSE = Number.isFinite(Number(scoreViewConfig.conductorFitWidthTranspose))
  ? Math.floor(Number(scoreViewConfig.conductorFitWidthTranspose))
  : 6;
const CONDUCTOR_FIT_HEIGHT_FROM_QUARTER = Number.isFinite(Number(scoreViewConfig.conductorFitHeightFromQuarter))
  ? Math.max(0, Math.floor(Number(scoreViewConfig.conductorFitHeightFromQuarter)))
  : 72;
const CONDUCTOR_FIT_HEIGHT_NUM_QUARTERS = Number.isFinite(Number(scoreViewConfig.conductorFitHeightNumQuarters))
  ? Math.max(1, Math.floor(Number(scoreViewConfig.conductorFitHeightNumQuarters)))
  : 5;
const CONDUCTOR_FIT_HEIGHT_TRANSPOSE = Number.isFinite(Number(scoreViewConfig.conductorFitHeightTranspose))
  ? Math.floor(Number(scoreViewConfig.conductorFitHeightTranspose))
  : 9;
var osmdMusicZoom = DEFAULT_OSMD_MUSIC_ZOOM;
const osmdUseAdaptiveViewBoxStretch = false;
const phrasePreviewColor = '#989898';
const dynamics_Height = 32;
const conductorScoreLeftPaddingPx = Number.isFinite(Number(scoreViewConfig.conductorScoreLeftPaddingPx))
  ? Number(scoreViewConfig.conductorScoreLeftPaddingPx)
  : 0;
const conductorDynamicsGapPx = Number.isFinite(Number(scoreViewConfig.conductorDynamicsGapPx))
  ? Number(scoreViewConfig.conductorDynamicsGapPx)
  : 0;
var conductorFitReferenceWidthUnits = OSMD_WIDEST_CASE_VB_WIDTH;
var conductorFitReferenceHeightUnits = OSMD_WIDEST_CASE_VB_HEIGHT;
var conductorFitReferenceReady = false;
var conductorFitCachedVerticalPx = 170;
const game_Width = 16;
const game_Height = 32;
var scoreElement = document.getElementById('score');
var mainScoreElement = scoreElement;
//GAME DATA RECEIVED FROM THE SNAKE-TETRIS
var eaten = [];
var snake = [];
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

function readStartupDefaultsConfig() {
  if (
    typeof SCORE_STARTUP_DEFAULTS !== 'undefined' &&
    SCORE_STARTUP_DEFAULTS &&
    typeof SCORE_STARTUP_DEFAULTS === 'object'
  ) {
    return SCORE_STARTUP_DEFAULTS;
  }
  return {};
}

function parseStartupBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    var normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return fallback;
}

function parseStartupNonNegativeInt(value, fallback) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
}

function parseStartupPositiveInt(value, fallback) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function clampStartupTransposeSemitones(value) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    parsed = 0;
  }
  var intValue = parsed < 0 ? Math.ceil(parsed) : Math.floor(parsed);
  var tMin = (typeof TRANSPOSE_MIN !== 'undefined') ? TRANSPOSE_MIN : -6;
  return Math.max(tMin, Math.min(tMin + 24, intValue));
}

function sanitizeStartupTempoLevels() {
  var rawLevels = Array.isArray(TEMPO_TABLE_BPM) ? TEMPO_TABLE_BPM : [];
  var clean = rawLevels.map(function (value) {
    return Number(value);
  }).filter(function (value) {
    return Number.isFinite(value);
  }).map(function (value) {
    return Math.max(20, Math.min(280, value));
  });
  return clean.length ? clean : [60];
}

function fallbackStartupTempoControlIndex(levels) {
  if (!Array.isArray(levels) || !levels.length) {
    return 0;
  }
  var exactIndex = levels.indexOf(60);
  if (exactIndex !== -1) {
    return exactIndex;
  }
  var bestIndex = 0;
  var bestDistance = Number.POSITIVE_INFINITY;
  for (var i = 0; i < levels.length; i++) {
    var distance = Math.abs(levels[i] - 60);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function resolveStartupTempoControlIndex(levels, startupDefaults) {
  if (!Array.isArray(levels) || !levels.length) {
    return 0;
  }
  var parsed = Number(startupDefaults && startupDefaults.tempoControlIndex);
  if (!Number.isFinite(parsed)) {
    return fallbackStartupTempoControlIndex(levels);
  }
  return Math.max(0, Math.min(levels.length - 1, Math.floor(parsed)));
}

function resolveStartupTempoBpm(levels, tempoControlIndex) {
  if (!Array.isArray(levels) || !levels.length) {
    return 60;
  }
  var safeIndex = Math.max(0, Math.min(levels.length - 1, Math.floor(Number(tempoControlIndex) || 0)));
  return levels[safeIndex];
}

var startupDefaultsConfig = readStartupDefaultsConfig();
var startupTempoLevelsBpm = sanitizeStartupTempoLevels();
var startupTempoControlIndex = resolveStartupTempoControlIndex(startupTempoLevelsBpm, startupDefaultsConfig);

var playbarTimeout;
var playbarAnimationFrame = 0;
var playbarLastStepMs = 0;
// Playhead is disabled until explicitly re-enabled.
var playheadEnabled = false;
// Stored in BPM for stable shared beat logic.
var tempo = resolveStartupTempoBpm(startupTempoLevelsBpm, startupTempoControlIndex);
var metronomeQuarterUntilMs = 0;
var metronomeEighthUntilMs = 0;
var metronomeLastEighthIndex = null;
var lastServerMessageTimeMs = null;
var serverClockOffsetMs = 0;
var bestClockSyncRttMs = Number.POSITIVE_INFINITY;
var hasClockSync = false;
var transportStateVersion = 0;
var transportRunning = false;
var transportBaseQuarters = 0;
var transportStartedAtMs = Number.NaN;
var roomClockQuarterCounter = Number.NaN;
var roomClockBeatInPhrase = 1;
var roomClockBeatsPerPhrase = 1;
var roomClockBpm = tempo;
var roomClockServerMs = Number.NaN;
var pendingRoomBoundaryCount = 0;
var roomStateVersion = 0;
var roomStateSnapshot = null;
var appliedRoomDynamicsVersion = 0;
var queuedDynamics = null;
var tempoLevelsBpm = startupTempoLevelsBpm.slice();
var METRONOME_FLASH_MS = 90;
var phrasePreviewSnapshot = null;
var phrasePreviewSvg = null;
var phrasePreviewAwaitingSwap = false;
var phraseSwapAnimationFrame = 0;
var phraseSwapInProgress = false;
var phraseSwapTargetSnapshot = null;
var phraseDeferredSwapTimer = 0;
var currentPhraseSnapshot = null;
var deferredRoomStateUpdatePending = false;
var TRANSPOSE_TRACE_STORAGE_KEY = 'conductor7TransposeTraceEnabled';
var transposeTraceEnabled = true;
var transposeTraceBufferLimit = 600;
var transposeTraceSeq = 0;
var transposeTraceBuffer = [];
var STEM_RULES_STORAGE_KEY = 'osmdStemRulesEnabled';
var stemRulesEnabled = true;
var stemRulesExtraStemLengthInSpaces = 0.0;

function cloneTraceValue(value, depth) {
  var maxDepth = Number.isFinite(Number(depth)) ? Number(depth) : 0;
  if (maxDepth <= 0) {
    return '[max-depth]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  var valueType = typeof value;
  if (valueType === 'number' || valueType === 'string' || valueType === 'boolean') {
    return value;
  }
  if (valueType === 'bigint') {
    return String(value);
  }
  if (valueType === 'function') {
    return '[function]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(function (item) {
      return cloneTraceValue(item, maxDepth - 1);
    });
  }
  var out = {};
  Object.keys(value).slice(0, 20).forEach(function (key) {
    out[key] = cloneTraceValue(value[key], maxDepth - 1);
  });
  return out;
}

function parseTransposeTraceEnabled(value, fallback) {
  if (typeof value === 'string') {
    var normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return !!fallback;
}

function resolveInitialTransposeTraceEnabled() {
  var fallback = true;
  try {
    var search = (window && window.location && window.location.search) ? String(window.location.search) : '';
    if (search) {
      var params = new URLSearchParams(search);
      if (params.has('traceTranspose')) {
        return parseTransposeTraceEnabled(params.get('traceTranspose'), fallback);
      }
      if (params.has('trace')) {
        return parseTransposeTraceEnabled(params.get('trace'), fallback);
      }
    }
  } catch (error) {
    // ignore malformed location or URLSearchParams issues
  }
  try {
    var storedValue = localStorage.getItem(TRANSPOSE_TRACE_STORAGE_KEY);
    if (storedValue !== null && storedValue !== undefined && storedValue !== '') {
      return parseTransposeTraceEnabled(storedValue, fallback);
    }
  } catch (error) {
    // ignore storage failures
  }
  return fallback;
}

function buildTransposeTraceStateDigest() {
  var roomSnapshot = roomStateSnapshot || {};
  return {
    transposeSemitones: Number(transposeSemitones),
    autoTransposeEnabled: !!autoTransposeEnabled,
    roomStateVersion: Number(roomStateVersion) || 0,
    roomCurrentTranspose: Number(roomSnapshot.currentTranspose),
    roomCandidateTranspose: Number(roomSnapshot.candidateTranspose),
    roomCurrentPhraseSeq: Number(roomSnapshot.currentPhraseSeq),
    roomCandidatePhraseSeq: Number(roomSnapshot.candidatePhraseSeq),
    currentSnapshotTranspose: currentPhraseSnapshot ? Number(currentPhraseSnapshot.transposeSemitones) : Number.NaN,
    pendingSnapshotTranspose: phrasePreviewSnapshot ? Number(phrasePreviewSnapshot.transposeSemitones) : Number.NaN,
    swapInProgress: !!phraseSwapInProgress,
    previewAwaitingSwap: !!phrasePreviewAwaitingSwap,
  };
}

function traceConductorEvent(tag, payload) {
  if (!transposeTraceEnabled) {
    return null;
  }
  var serverTs = Number.NaN;
  if (typeof serverNowMs === 'function') {
    serverTs = Number(serverNowMs());
  } else if (Number.isFinite(Number(lastServerMessageTimeMs))) {
    serverTs = Number(lastServerMessageTimeMs);
  }
  var entry = {
    seq: ++transposeTraceSeq,
    tsClientMs: Date.now(),
    tsServerMs: Number.isFinite(serverTs) ? Math.round(serverTs) : null,
    tag: String(tag || 'event'),
    state: buildTransposeTraceStateDigest(),
  };
  if (payload !== undefined) {
    entry.payload = cloneTraceValue(payload, 4);
  }
  transposeTraceBuffer.push(entry);
  if (transposeTraceBuffer.length > transposeTraceBufferLimit) {
    transposeTraceBuffer.splice(0, transposeTraceBuffer.length - transposeTraceBufferLimit);
  }
  return entry;
}

function getTransposeTrace(limit) {
  var maxItems = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : transposeTraceBuffer.length;
  if (maxItems >= transposeTraceBuffer.length) {
    return transposeTraceBuffer.slice();
  }
  return transposeTraceBuffer.slice(transposeTraceBuffer.length - maxItems);
}

function clearTransposeTrace() {
  transposeTraceBuffer.length = 0;
  transposeTraceSeq = 0;
}

function setTransposeTraceEnabled(enabled, options) {
  options = options || {};
  var nextValue = parseTransposeTraceEnabled(enabled, transposeTraceEnabled);
  transposeTraceEnabled = !!nextValue;
  try {
    localStorage.setItem(TRANSPOSE_TRACE_STORAGE_KEY, transposeTraceEnabled ? '1' : '0');
  } catch (error) {
    // ignore storage failures
  }
  if (!options.silent && transposeTraceEnabled) {
    traceConductorEvent('trace.enabled', { enabled: true });
  }
  return transposeTraceEnabled;
}

function dumpTransposeTrace(limit) {
  var snapshot = getTransposeTrace(limit);
  if (typeof console !== 'undefined' && typeof console.table === 'function') {
    console.table(snapshot.map(function (entry) {
      return {
        seq: entry.seq,
        tag: entry.tag,
        tsClientMs: entry.tsClientMs,
        transpose: entry && entry.state ? entry.state.transposeSemitones : null,
        roomCurrentTranspose: entry && entry.state ? entry.state.roomCurrentTranspose : null,
        roomCandidateTranspose: entry && entry.state ? entry.state.roomCandidateTranspose : null,
      };
    }));
  }
  return snapshot;
}

transposeTraceEnabled = resolveInitialTransposeTraceEnabled();
window.traceConductorEvent = traceConductorEvent;
window.getTransposeTrace = getTransposeTrace;
window.clearTransposeTrace = clearTransposeTrace;
window.setTransposeTraceEnabled = setTransposeTraceEnabled;
window.dumpTransposeTrace = dumpTransposeTrace;
if (transposeTraceEnabled) {
  traceConductorEvent('trace.init', { enabled: true });
}

function parseStemRulesEnabled(value) {
  if (typeof value === 'string') {
    var normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return !!value;
}

function resolveInitialStemRulesEnabled() {
  var configDefault = true;
  if (window && window.SCORE_VIEW_CONFIG && typeof window.SCORE_VIEW_CONFIG.osmdStemRulesEnabled !== 'undefined') {
    configDefault = !!window.SCORE_VIEW_CONFIG.osmdStemRulesEnabled;
  }
  try {
    var storedValue = localStorage.getItem(STEM_RULES_STORAGE_KEY);
    if (storedValue === null || storedValue === undefined || storedValue === '') {
      return configDefault;
    }
    return parseStemRulesEnabled(storedValue);
  } catch (error) {
    return configDefault;
  }
}

function ensureStemRulesRuntimeConfig() {
  if (!window.__OSMD_STEM_RULES_CONFIG || typeof window.__OSMD_STEM_RULES_CONFIG !== 'object') {
    window.__OSMD_STEM_RULES_CONFIG = {};
  }
  window.__OSMD_STEM_RULES_CONFIG.enabled = !!stemRulesEnabled;
  window.__OSMD_STEM_RULES_CONFIG.extraStemLengthInSpaces = Number(stemRulesExtraStemLengthInSpaces) || 0.0;
}

function installStemRulesPatchIfAvailable() {
  ensureStemRulesRuntimeConfig();
  if (typeof window.installStandardStemRulesPatch !== 'function') {
    return;
  }
  try {
    window.installStandardStemRulesPatch(window.Vex || Vex, {
      extraStemLengthInSpaces: Number(stemRulesExtraStemLengthInSpaces) || 0.0,
      applyToUnbeamed: true,
      applyToBeams: true,
      debug: false,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Stem rules patch install failed:', error);
  }
}

function setStemRulesEnabled(value, options) {
  options = options || {};
  stemRulesEnabled = parseStemRulesEnabled(value);
  ensureStemRulesRuntimeConfig();
  try {
    localStorage.setItem(STEM_RULES_STORAGE_KEY, stemRulesEnabled ? '1' : '0');
  } catch (error) {
    // ignore storage failures
  }
  var checkbox = document.getElementById('stemRulesEnabled');
  if (checkbox) {
    checkbox.checked = !!stemRulesEnabled;
  }
  if (!options.silent) {
    renderMusicFromSnake();
  }
}

window.setStemRulesEnabled = setStemRulesEnabled;

stemRulesEnabled = resolveInitialStemRulesEnabled();
ensureStemRulesRuntimeConfig();
installStemRulesPatchIfAvailable();

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

function readViewportSizeForConductorFit() {
  if (typeof window === 'undefined') {
    return {
      width: Number.NaN,
      height: Number.NaN,
    };
  }
  var widthCandidates = [];
  var heightCandidates = [];
  if (window.visualViewport && Number.isFinite(Number(window.visualViewport.width))) {
    widthCandidates.push(Number(window.visualViewport.width));
  }
  if (window.visualViewport && Number.isFinite(Number(window.visualViewport.height))) {
    heightCandidates.push(Number(window.visualViewport.height));
  }
  if (Number.isFinite(Number(window.innerWidth))) {
    widthCandidates.push(Number(window.innerWidth));
  }
  if (Number.isFinite(Number(window.innerHeight))) {
    heightCandidates.push(Number(window.innerHeight));
  }
  if (
    window.document &&
    window.document.documentElement &&
    Number.isFinite(Number(window.document.documentElement.clientWidth))
  ) {
    widthCandidates.push(Number(window.document.documentElement.clientWidth));
  }
  if (
    window.document &&
    window.document.documentElement &&
    Number.isFinite(Number(window.document.documentElement.clientHeight))
  ) {
    heightCandidates.push(Number(window.document.documentElement.clientHeight));
  }
  widthCandidates = widthCandidates.filter(function (value) {
    return Number.isFinite(value) && value > 0;
  });
  heightCandidates = heightCandidates.filter(function (value) {
    return Number.isFinite(value) && value > 0;
  });
  return {
    width: widthCandidates.length ? Math.min.apply(null, widthCandidates) : Number.NaN,
    height: heightCandidates.length ? Math.min.apply(null, heightCandidates) : Number.NaN,
  };
}

function readConductorFitReferenceUnits() {
  var widthUnits = Number(conductorFitReferenceWidthUnits);
  var heightUnits = Number(conductorFitReferenceHeightUnits);
  if (!Number.isFinite(widthUnits) || widthUnits <= 0) {
    widthUnits = OSMD_WIDEST_CASE_VB_WIDTH;
  }
  if (!Number.isFinite(heightUnits) || heightUnits <= 0) {
    heightUnits = OSMD_WIDEST_CASE_VB_HEIGHT;
  }
  return {
    widthUnits: widthUnits,
    heightUnits: heightUnits,
  };
}

function measureConductorFixedVerticalPx() {
  var panel = document.getElementById('control2');
  var fieldset = panel ? panel.querySelector('fieldset') : null;
  var scoreContainer = mainScoreElement || document.getElementById('score');
  if (
    !fieldset ||
    !scoreContainer ||
    typeof fieldset.getBoundingClientRect !== 'function' ||
    typeof scoreContainer.getBoundingClientRect !== 'function'
  ) {
    return conductorFitCachedVerticalPx;
  }
  var fieldsetRect = fieldset.getBoundingClientRect();
  var scoreRect = scoreContainer.getBoundingClientRect();
  if (
    !Number.isFinite(fieldsetRect.height) ||
    fieldsetRect.height <= 0 ||
    !Number.isFinite(scoreRect.height) ||
    scoreRect.height <= 0
  ) {
    return conductorFitCachedVerticalPx;
  }
  var topGap = Number(scoreRect.top) - Number(fieldsetRect.top);
  var bottomGap = Number(fieldsetRect.bottom) - Number(scoreRect.bottom);
  var fixedPx = topGap + bottomGap;
  if (Number.isFinite(fixedPx) && fixedPx > 0) {
    conductorFitCachedVerticalPx = fixedPx;
  }
  return conductorFitCachedVerticalPx;
}

function resolveConductorFitGeometry() {
  var viewport = readViewportSizeForConductorFit();
  var viewportWidth = Number(viewport.width);
  var viewportHeight = Number(viewport.height);
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    viewportWidth = window.innerWidth || 1024;
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    viewportHeight = window.innerHeight || 768;
  }

  var positiveLeftPad = Math.max(0, Number(conductorScoreLeftPaddingPx) || 0);
  var maxScoreWidthPx = Math.max(120, viewportWidth - CONDUCTOR_FIT_PADDING_X * 2 - positiveLeftPad);
  var maxTotalHeightPx = Math.max(120, viewportHeight - CONDUCTOR_FIT_PADDING_Y * 2);
  var fixedVerticalPx = Math.max(0, measureConductorFixedVerticalPx());
  var maxScoreHeightPx = Math.max(80, maxTotalHeightPx - fixedVerticalPx);
  var referenceUnits = readConductorFitReferenceUnits();

  var zoomByWidth = (maxScoreWidthPx * CONDUCTOR_FIT_SAFETY) / referenceUnits.widthUnits;
  var zoomByHeight = (maxScoreHeightPx * CONDUCTOR_FIT_SAFETY) / referenceUnits.heightUnits;
  var fitZoom = Math.min(zoomByWidth, zoomByHeight);
  if (!Number.isFinite(fitZoom) || fitZoom <= 0) {
    fitZoom = DEFAULT_OSMD_MUSIC_ZOOM;
  }
  fitZoom = Math.max(CONDUCTOR_FIT_MIN_ZOOM, Math.min(CONDUCTOR_FIT_MAX_ZOOM, fitZoom));
  var scoreWidthPx = Math.max(1, Math.floor(referenceUnits.widthUnits * fitZoom));
  var scoreHeightPx = Math.max(1, Math.floor(referenceUnits.heightUnits * fitZoom));
  var verticalSparePx = Math.max(0, maxScoreHeightPx - scoreHeightPx);

  return {
    zoom: fitZoom,
    scoreWidthPx: scoreWidthPx,
    scoreHeightPx: scoreHeightPx,
    maxScoreWidthPx: maxScoreWidthPx,
    maxScoreHeightPx: maxScoreHeightPx,
    fixedVerticalPx: fixedVerticalPx,
    verticalSparePx: verticalSparePx,
  };
}

function applyDynamicsCanvasGap(availableSparePx) {
  var canvas = document.getElementById('dynCanvas');
  if (!canvas || !canvas.style) {
    return;
  }
  canvas.style.display = 'block';
  var shift = Number(conductorDynamicsGapPx) || 0;
  if (shift >= 0) {
    // Positive value is a reclaimable gap: use it only when there is spare vertical room.
    var sparePx = Math.max(0, Number(availableSparePx) || 0);
    var effectiveGap = Math.min(shift, sparePx);
    canvas.style.marginTop = effectiveGap + 'px';
    canvas.style.transform = 'none';
    canvas.style.webkitTransform = 'none';
  } else {
    canvas.style.marginTop = '0px';
    var translate = 'translateY(' + shift + 'px)';
    canvas.style.transform = translate;
    canvas.style.webkitTransform = translate;
  }
  // Keep debug controls clickable even if the canvas is shifted upward.
  canvas.style.pointerEvents = 'none';
}

function ensureScoreLayeringContainer() {
  var container = mainScoreElement || document.getElementById('score');
  if (!container) {
    return;
  }
  var geometry = resolveConductorFitGeometry();
  full_Width = geometry.scoreWidthPx;
  full_Height = geometry.scoreHeightPx;
  osmdMusicZoom = geometry.zoom;
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.textAlign = 'left';
  container.style.width = full_Width + 'px';
  container.style.height = full_Height + 'px';
  container.style.marginLeft = String(conductorScoreLeftPaddingPx) + 'px';
  container.style.marginRight = 'auto';
  applyDynamicsCanvasGap(geometry.verticalSparePx);
  var dynCanvas = document.getElementById('dynCanvas');
  if (dynCanvas) {
    dynCanvas.width = Math.max(1, Math.round(full_Width));
    dynCanvas.style.width = full_Width + 'px';
  }
  if (typeof window !== 'undefined' && typeof window.syncConductorLayoutAfterResize === 'function') {
    window.syncConductorLayoutAfterResize();
  }
}

// Variant 2 uses a fixed default instrument (no startup selector).
setRange('piano');

setDynamicsCanvasFont();
ensureScoreLayeringContainer();
window.ensureScoreLayeringContainer = ensureScoreLayeringContainer;
window.getConductorFitWidthCaseConfig = function () {
  return {
    fromQuarter: CONDUCTOR_FIT_WIDTH_FROM_QUARTER,
    numQuarters: CONDUCTOR_FIT_WIDTH_NUM_QUARTERS,
    transpose: CONDUCTOR_FIT_WIDTH_TRANSPOSE,
  };
};
window.getConductorFitHeightCaseConfig = function () {
  return {
    fromQuarter: CONDUCTOR_FIT_HEIGHT_FROM_QUARTER,
    numQuarters: CONDUCTOR_FIT_HEIGHT_NUM_QUARTERS,
    transpose: CONDUCTOR_FIT_HEIGHT_TRANSPOSE,
  };
};
window.setConductorFitReferenceUnits = function (widthUnits, heightUnits) {
  var width = Number(widthUnits);
  var height = Number(heightUnits);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return false;
  }
  var widthChanged = Math.abs(width - conductorFitReferenceWidthUnits) > 1e-6;
  var heightChanged = Math.abs(height - conductorFitReferenceHeightUnits) > 1e-6;
  conductorFitReferenceWidthUnits = width;
  conductorFitReferenceHeightUnits = height;
  conductorFitReferenceReady = true;
  if (widthChanged || heightChanged) {
    handleConductorResponsiveResize();
  }
  return true;
};
window.getConductorFitReferenceUnits = function () {
  return {
    widthUnits: conductorFitReferenceWidthUnits,
    heightUnits: conductorFitReferenceHeightUnits,
    ready: conductorFitReferenceReady,
  };
};

var conductorResponsiveResizeRafID = 0;
function handleConductorResponsiveResize() {
  if (conductorResponsiveResizeRafID) {
    cancelAnimationFrame(conductorResponsiveResizeRafID);
  }
  conductorResponsiveResizeRafID = requestAnimationFrame(function () {
    conductorResponsiveResizeRafID = 0;
    var previousWidth = full_Width;
    var previousHeight = full_Height;
    var previousZoom = osmdMusicZoom;
    ensureScoreLayeringContainer();
    var widthChanged = Math.abs(full_Width - previousWidth) > 0.5;
    var heightChanged = Math.abs(full_Height - previousHeight) > 0.5;
    var zoomChanged = Math.abs(osmdMusicZoom - previousZoom) > 1e-4;
    if ((widthChanged || heightChanged || zoomChanged) && typeof renderMusicFromSnake === 'function' && tannhauserScore) {
      renderMusicFromSnake();
    }
  });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', handleConductorResponsiveResize);
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', handleConductorResponsiveResize);
  }
}

//TEMPO
function normalizeTempoLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    return null;
  }
  var clean = levels.map(function (value) {
    var bpm = Number(value);
    if (!Number.isFinite(bpm)) {
      return Number.NaN;
    }
    return Math.max(20, Math.min(280, bpm));
  }).filter(function (value) {
    return Number.isFinite(value);
  });
  return clean.length > 0 ? clean : null;
}

function tempoControlToBpm(controlValue) {
  var control = Number(controlValue);
  if (!Number.isFinite(control)) {
    return Number.NaN;
  }
  var levels = normalizeTempoLevels(tempoLevelsBpm);
  if (!levels) {
    return Number.NaN;
  }
  // Snake sends tempo bins as 1..N.
  var idx = Math.round(control) - 1;
  if (!Number.isFinite(idx)) {
    return Number.NaN;
  }
  idx = Math.max(0, Math.min(levels.length - 1, idx));
  return levels[idx];
}

function setTempoLevels(levels) {
  var normalized = normalizeTempoLevels(levels);
  if (!normalized) {
    return;
  }
  tempoLevelsBpm = normalized;
}

function setTempo(t) {
  if (!autoTempoEnabled) {
    return;
  }
  if (hasAuthoritativeTransportClock()) {
    return;
  }
  var controlValue = Number(t);
  if (!Number.isFinite(controlValue)) {
    return;
  }
  // Snake sends tempo control bins; map through server-provided table.
  var mappedBpm = tempoControlToBpm(controlValue);
  if (!Number.isFinite(mappedBpm)) {
    return;
  }
  tempo = mappedBpm;
  updateTempoDisplay();
}

function setTempoDirectBpm(bpm) {
  var val = Number(bpm);
  if (!Number.isFinite(val) || val <= 0) {
    return;
  }
  tempo = val;
  updateTempoDisplay();
}
window.setTempoDirectBpm = setTempoDirectBpm;

function setAutoTempo(enabled) {
  autoTempoEnabled = !!enabled;
  if (!autoTempoEnabled) {
    var dropdown = document.getElementById('debugTempoDropdown');
    if (dropdown) {
      setTempoDirectBpm(Number(dropdown.value));
    }
  }
}
window.setAutoTempo = setAutoTempo;

function setAutoTranspose(enabled) {
  var previousValue = !!autoTransposeEnabled;
  autoTransposeEnabled = !!enabled;
  traceConductorEvent('transpose.auto-toggle', {
    previousEnabled: previousValue,
    nextEnabled: !!autoTransposeEnabled,
  });
  if (!autoTransposeEnabled) {
    var dropdown = document.getElementById('debugTransposeSemitones');
    if (dropdown) {
      setTransposeSemitones(dropdown.value);
      return;
    }
  }
  renderMusicFromSnake();
}
window.setAutoTranspose = setAutoTranspose;

function normalizeManualFromQuarter(value) {
  var rawFrom = parseOptionalNonNegativeInt(value);
  if (rawFrom === null) {
    return null;
  }
  if (tannhauserScore) {
    var totalQ = Number(tannhauserScore.getTotalQuarters(selectedStaff()));
    if (Number.isFinite(totalQ) && totalQ > 0) {
      rawFrom = applyScoreLoopMode(rawFrom, totalQ);
    }
  }
  return rawFrom;
}

function normalizeManualNumQuarters(value) {
  var rawNum = parseOptionalNonNegativeInt(value);
  if (rawNum === null) {
    return null;
  }
  return Math.max(1, rawNum);
}

function setManualFromQuarter(value) {
  debugOverrideFromQuarter = normalizeManualFromQuarter(value);
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}
window.setManualFromQuarter = setManualFromQuarter;

function setManualNumQuarters(value) {
  debugOverrideNumQuarters = normalizeManualNumQuarters(value);
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}
window.setManualNumQuarters = setManualNumQuarters;

function setAutoFromQuarter(enabled) {
  autoFromQuarterEnabled = !!enabled;
  if (!autoFromQuarterEnabled) {
    var fromInput = document.getElementById('debugFromQuarter');
    setManualFromQuarter(fromInput ? fromInput.value : debugOverrideFromQuarter);
    return;
  }
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}
window.setAutoFromQuarter = setAutoFromQuarter;

function setAutoNumQuarters(enabled) {
  autoNumQuartersEnabled = !!enabled;
  if (!autoNumQuartersEnabled) {
    var numInput = document.getElementById('debugNumQuarters');
    setManualNumQuarters(numInput ? numInput.value : debugOverrideNumQuarters);
    return;
  }
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}
window.setAutoNumQuarters = setAutoNumQuarters;

function quarterRatePerSecond() {
  return Math.max(tempo, 1e-6) / 60;
}

function updateTempoDisplay() {
  var bpmEl = document.getElementById('bpmValue');
  if (!bpmEl) {
    return;
  }
  var rounded = Math.round(tempo * 10) / 10;
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
  var stemRulesCheckbox = document.getElementById('stemRulesEnabled');
  if (stemRulesCheckbox) {
    stemRulesCheckbox.checked = !!stemRulesEnabled;
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
  // Dynamics are authoritative from ROOM_STATE only in v7.
  void message;
  queuedDynamics = null;
}

function parseDynamicsCsvToken(token) {
  if (token === undefined || token === null) {
    return null;
  }
  var raw = String(token).trim();
  if (!raw || raw === '-') {
    return null;
  }
  var values = raw.split(',').map(Number).filter(Number.isFinite);
  return values.length > 0 ? values : null;
}

function applyRoomStateDynamics(force) {
  var snapshot = roomStateSnapshot;
  if (!snapshot) {
    return false;
  }
  var version = Math.floor(Number(snapshot.dynamicsVersion));
  var shouldApply = !!force;
  if (Number.isFinite(version) && version > 0 && version > appliedRoomDynamicsVersion) {
    shouldApply = true;
  }
  if (!shouldApply) {
    return false;
  }
  var nextDynamics = parseDynamicsCsvToken(snapshot.dynamicsCsv);
  if (!Array.isArray(nextDynamics) || nextDynamics.length === 0) {
    if (Number.isFinite(version) && version > appliedRoomDynamicsVersion) {
      appliedRoomDynamicsVersion = version;
    }
    return false;
  }
  dynamics = nextDynamics.slice();
  queuedDynamics = null;
  if (Number.isFinite(version) && version > 0) {
    appliedRoomDynamicsVersion = version;
  }
  if (typeof window !== 'undefined' && typeof window.redrawDynamicsOnly === 'function') {
    window.redrawDynamicsOnly();
  }
  return true;
}

function applyQueuedDynamicsAtPhraseStart(force) {
  var appliedFromRoomState = applyRoomStateDynamics(force);
  if (!appliedFromRoomState && typeof window !== 'undefined' && typeof window.redrawDynamicsOnly === 'function') {
    window.redrawDynamicsOnly();
  }
  return appliedFromRoomState;
}

//RHYTHM
function setRhythm(message) {
  rhythm = message.split(" ");
}

function serverNowMs() {
  return Date.now() + serverClockOffsetMs;
}

function blendServerClockOffset(serverMs, weight) {
  var parsed = Number(serverMs);
  if (!Number.isFinite(parsed)) {
    return;
  }
  var candidateOffset = parsed - Date.now();
  var blendWeight = Number(weight);
  if (!Number.isFinite(blendWeight)) {
    blendWeight = 0.2;
  }
  blendWeight = Math.max(0.01, Math.min(1, blendWeight));
  if (!hasClockSync) {
    serverClockOffsetMs = candidateOffset;
    bestClockSyncRttMs = Number.POSITIVE_INFINITY;
    hasClockSync = true;
    return;
  }
  serverClockOffsetMs = serverClockOffsetMs * (1 - blendWeight) + candidateOffset * blendWeight;
}

function setServerMessageTime(serverMs) {
  var parsed = Number(serverMs);
  if (Number.isFinite(parsed)) {
    lastServerMessageTimeMs = parsed;
    if (!hasClockSync) {
      // Coarse first estimate until RTT-based SYNC samples arrive.
      blendServerClockOffset(parsed, 1);
    }
  }
}

function hasAuthoritativeTransportClock() {
  return Number.isFinite(transportStateVersion) && transportStateVersion > 0;
}

function normalizeTransportVersion(version) {
  var numeric = Number(version);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Number.NaN;
  }
  return Math.floor(numeric);
}

function normalizeTransportRunning(running) {
  if (typeof running === 'string') {
    var normalized = running.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
      return false;
    }
  }
  if (typeof running === 'number') {
    return running !== 0;
  }
  return !!running;
}

function normalizeTransportQuarters(quarters) {
  var numeric = Number(quarters);
  if (!Number.isFinite(numeric)) {
    return Number.NaN;
  }
  return Math.max(0, numeric);
}

function normalizeServerSentMs(serverSentMs, fallbackMs) {
  var numeric = Number(serverSentMs);
  if (!Number.isFinite(numeric)) {
    return Number.isFinite(Number(fallbackMs)) ? Number(fallbackMs) : Date.now();
  }
  return numeric;
}

function transportAbsoluteQuartersAt(nowMs) {
  if (!hasAuthoritativeTransportClock()) {
    return Number.NaN;
  }
  var baseQuarters = Math.max(0, Number(transportBaseQuarters) || 0);
  if (!transportRunning) {
    return baseQuarters;
  }
  var startedAt = Number(transportStartedAtMs);
  if (!Number.isFinite(startedAt)) {
    return baseQuarters;
  }
  var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : serverNowMs();
  var elapsedMs = Math.max(0, now - startedAt);
  return baseQuarters + elapsedMs * quarterRatePerSecond() / 1000;
}

function transportIsRunning() {
  return !!transportRunning;
}

function applyTransportStateNow(nextVersion, nextRunning, nextBpm, nextQuarters, nextStartedAtMs) {
  var hadTransport = hasAuthoritativeTransportClock();
  var previousVersion = transportStateVersion;
  var previousRunning = transportRunning;

  transportStateVersion = nextVersion;
  transportRunning = !!nextRunning;
  transportBaseQuarters = Math.max(0, Number(nextQuarters) || 0);
  transportStartedAtMs = Number(nextStartedAtMs);
  tempo = nextBpm;
  roomClockBpm = nextBpm;
  roomClockServerMs = Number(nextStartedAtMs);
  blendServerClockOffset(nextStartedAtMs, 0.15);
  updateTempoDisplay();

  if (!hadTransport || transportStateVersion > previousVersion || transportRunning !== previousRunning) {
    // Re-lock flash sequencing to the shared transport when a new transport is accepted.
    metronomeLastEighthIndex = null;
    metronomeQuarterUntilMs = 0;
    metronomeEighthUntilMs = 0;
  }
}

function hasPendingTransportState() {
  return false;
}

function applyPendingTransportState() {
  return false;
}

function setPendingPhraseStartAnchor(anchorQuarters) {
  void anchorQuarters;
}

function consumePendingPhraseStartAnchor() {
  return Number.NaN;
}

function setTransportState(epochMs, bpm, revision, serverSentMs) {
  // Legacy fallback path used by older servers.
  var nextEpoch = Number(epochMs);
  var nextBpm = Number(bpm);
  var nextRevision = normalizeTransportVersion(revision);
  var nextServerSent = Number(serverSentMs);
  if (!Number.isFinite(nextEpoch) || !Number.isFinite(nextBpm) || nextBpm <= 0 || !Number.isFinite(nextRevision)) {
    return;
  }
  var referenceMs = normalizeServerSentMs(nextServerSent, Date.now());
  var nextQuarters = Math.max(0, (referenceMs - nextEpoch) * nextBpm / 60000);
  setTransportSnapshot(nextRevision, 1, nextBpm, nextQuarters, -1, referenceMs);
}

function setTransportSnapshot(version, running, bpm, quarters, startedAtMs, serverSentMs) {
  var nextVersion = normalizeTransportVersion(version);
  var nextRunning = normalizeTransportRunning(running);
  var nextBpm = Number(bpm);
  var nextQuarters = normalizeTransportQuarters(quarters);
  var nextServerSent = normalizeServerSentMs(serverSentMs, startedAtMs);
  if (!Number.isFinite(nextVersion) || !Number.isFinite(nextBpm) || nextBpm <= 0 || !Number.isFinite(nextQuarters)) {
    return;
  }
  if (nextVersion < transportStateVersion) {
    return;
  }
  if (nextVersion === transportStateVersion && Number.isFinite(transportStartedAtMs) && nextServerSent <= transportStartedAtMs) {
    return;
  }

  applyTransportStateNow(nextVersion, nextRunning, nextBpm, nextQuarters, nextServerSent);
}

function setRoomClock(roomId, quarterCounter, beatInPhrase, beatsPerPhrase, bpm, serverMs) {
  void roomId;
  var nextQuarterCounter = Number(quarterCounter);
  var nextBeatInPhrase = Math.floor(Number(beatInPhrase));
  var nextBeatsPerPhrase = Math.max(1, Math.floor(Number(beatsPerPhrase) || 1));
  var nextBpm = Number(bpm);
  var nextServerMs = normalizeServerSentMs(serverMs, Date.now());
  if (!Number.isFinite(nextQuarterCounter) || nextQuarterCounter < 0 || !Number.isFinite(nextBpm) || nextBpm <= 0) {
    return;
  }
  var previousQuarterCounter = Number.isFinite(roomClockQuarterCounter)
    ? Math.floor(Number(roomClockQuarterCounter))
    : Number.NaN;
  if (Number.isFinite(previousQuarterCounter)) {
    // Ignore duplicate quarter packets; they can arrive from periodic sync probes.
    if (nextQuarterCounter <= previousQuarterCounter) {
      return;
    }
  }
  if (nextBeatInPhrase === 1 && Number.isFinite(previousQuarterCounter) && nextQuarterCounter > previousQuarterCounter) {
    pendingRoomBoundaryCount = Math.max(0, Math.floor(Number(pendingRoomBoundaryCount) || 0)) + 1;
  }
  roomClockQuarterCounter = Math.floor(nextQuarterCounter);
  roomClockBeatInPhrase = Math.max(1, Math.min(nextBeatsPerPhrase, nextBeatInPhrase || 1));
  roomClockBeatsPerPhrase = nextBeatsPerPhrase;
  roomClockBpm = nextBpm;
  roomClockServerMs = nextServerMs;
  if (!hasClockSync) {
    blendServerClockOffset(nextServerMs, 1);
  }
  if (transportStateVersion <= 0) {
    transportStateVersion = 1;
  }
  transportRunning = true;
  transportBaseQuarters = roomClockQuarterCounter;
  transportStartedAtMs = nextServerMs;
  if (Math.abs(nextBpm - tempo) > 1e-6) {
    tempo = nextBpm;
    updateTempoDisplay();
  }
  setBeatIndexDisplay(roomClockBeatInPhrase, roomClockBeatsPerPhrase);
}

function setRoomState(roomId, version, paused, currentFrom, currentNum, currentTranspose, candidateFrom, candidateNum, candidateTranspose, pendingTempo, bpm, serverMs, dynamicsVersion, dynamicsCsv, currentPhraseSeq, candidatePhraseSeq) {
  void roomId;
  var parsedVersion = Number(version);
  if (!Number.isFinite(parsedVersion)) {
    parsedVersion = roomStateVersion;
  }
  if (parsedVersion < roomStateVersion) {
    return;
  }
  roomStateVersion = parsedVersion;
  roomStateSnapshot = {
    paused: normalizeTransportRunning(paused),
    currentFrom: Number(currentFrom),
    currentNum: Number(currentNum),
    currentTranspose: Number(currentTranspose),
    candidateFrom: Number(candidateFrom),
    candidateNum: Number(candidateNum),
    candidateTranspose: Number(candidateTranspose),
    pendingTempo: Number(pendingTempo),
    bpm: Number(bpm),
    serverMs: normalizeServerSentMs(serverMs, Date.now()),
    dynamicsVersion: Number(dynamicsVersion),
    dynamicsCsv: (dynamicsCsv === undefined || dynamicsCsv === null) ? '' : String(dynamicsCsv),
    currentPhraseSeq: Number(currentPhraseSeq),
    candidatePhraseSeq: Number(candidatePhraseSeq),
    version: parsedVersion,
  };
  traceConductorEvent('room.state-received', {
    version: parsedVersion,
    currentFrom: roomStateSnapshot.currentFrom,
    currentNum: roomStateSnapshot.currentNum,
    currentTranspose: roomStateSnapshot.currentTranspose,
    candidateFrom: roomStateSnapshot.candidateFrom,
    candidateNum: roomStateSnapshot.candidateNum,
    candidateTranspose: roomStateSnapshot.candidateTranspose,
    currentPhraseSeq: roomStateSnapshot.currentPhraseSeq,
    candidatePhraseSeq: roomStateSnapshot.candidatePhraseSeq,
    pendingTempo: roomStateSnapshot.pendingTempo,
    bpm: roomStateSnapshot.bpm,
    paused: !!roomStateSnapshot.paused,
  });
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
    serverClockOffsetMs = serverClockOffsetMs * 0.85 + candidateOffset * 0.15;
    bestClockSyncRttMs = Math.min(bestClockSyncRttMs, rtt);
  }
}

window.setServerMessageTime = setServerMessageTime;
window.applyClockSyncSample = applyClockSyncSample;
window.setTransportState = setTransportState;
window.setTransportSnapshot = setTransportSnapshot;
window.setRoomClock = setRoomClock;
window.setRoomState = setRoomState;
window.setTempoLevels = setTempoLevels;
window.applyPendingTransportState = applyPendingTransportState;
window.hasPendingTransportState = hasPendingTransportState;
window.hasAuthoritativeTransportClock = hasAuthoritativeTransportClock;
window.transportAbsoluteQuartersAt = transportAbsoluteQuartersAt;
window.transportIsRunning = transportIsRunning;
window.setPendingPhraseStartAnchor = setPendingPhraseStartAnchor;
window.consumePendingPhraseStartAnchor = consumePendingPhraseStartAnchor;
window.applyQueuedDynamicsAtPhraseStart = applyQueuedDynamicsAtPhraseStart;
window.applyRoomStateDynamics = applyRoomStateDynamics;

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

function applyScoreSvgTranslate(svgEl, dyPx) {
  if (!svgEl || !svgEl.style) {
    return;
  }
  var baseOffset = Number(svgEl.__baseOffsetY);
  if (!Number.isFinite(baseOffset)) {
    baseOffset = 0;
  }
  var translate = 'translateY(' + (baseOffset + Number(dyPx || 0)).toFixed(3) + 'px)';
  svgEl.style.transform = translate;
  svgEl.style.webkitTransform = translate;
}

function ensurePreviewOnTop() {
  if (!phrasePreviewSvg || !mainScoreElement) {
    return;
  }
  if (phrasePreviewSvg.parentNode === mainScoreElement) {
    mainScoreElement.appendChild(phrasePreviewSvg);
  }
}

function removePhrasePreviewOverlay(keepSnapshot) {
  if (phrasePreviewSvg && phrasePreviewSvg.parentNode) {
    phrasePreviewSvg.parentNode.removeChild(phrasePreviewSvg);
  }
  phrasePreviewSvg = null;
  phrasePreviewAwaitingSwap = false;
  if (!keepSnapshot) {
    phrasePreviewSnapshot = null;
  }
}

function recolorSvgMonochrome(svgEl, color) {
  if (!svgEl) {
    return;
  }
  var targetColor = color || '#888888';
  function isVisiblePaint(paint) {
    var value = String(paint || '').trim().toLowerCase();
    if (!value) {
      return false;
    }
    if (value === 'none' || value === 'transparent') {
      return false;
    }
    if (value === 'rgba(0,0,0,0)' || value === 'rgba(0, 0, 0, 0)') {
      return false;
    }
    return true;
  }
  var allNodes = [svgEl].concat(Array.prototype.slice.call(svgEl.querySelectorAll('*')));
  allNodes.forEach(function (node) {
    if (node.hasAttribute && node.hasAttribute('fill')) {
      var fill = node.getAttribute('fill');
      if (isVisiblePaint(fill)) {
        node.setAttribute('fill', targetColor);
      }
    }
    if (node.hasAttribute && node.hasAttribute('stroke')) {
      var stroke = node.getAttribute('stroke');
      if (isVisiblePaint(stroke)) {
        node.setAttribute('stroke', targetColor);
      }
    }
  });
}

function startPhraseSwapAnimation(nowMs) {
  if (!phrasePreviewAwaitingSwap || !phrasePreviewSnapshot || !phrasePreviewSvg) {
    return false;
  }
  var baseSvg = getActiveScoreSvg();
  if (!baseSvg) {
    return false;
  }
  if (phraseDeferredSwapTimer) {
    clearTimeout(phraseDeferredSwapTimer);
    phraseDeferredSwapTimer = 0;
  }

  phraseSwapInProgress = true;
  phrasePreviewAwaitingSwap = false;
  phraseSwapTargetSnapshot = phrasePreviewSnapshot;
  traceConductorEvent('swap.start', {
    nowMs: Number(nowMs),
    targetFrom: phraseSwapTargetSnapshot ? Number(phraseSwapTargetSnapshot.fromQuarter) : Number.NaN,
    targetNum: phraseSwapTargetSnapshot ? Number(phraseSwapTargetSnapshot.numQuarters) : Number.NaN,
    targetTranspose: phraseSwapTargetSnapshot ? Number(phraseSwapTargetSnapshot.transposeSemitones) : Number.NaN,
  });

  if (phraseSwapAnimationFrame) {
    cancelAnimationFrame(phraseSwapAnimationFrame);
    phraseSwapAnimationFrame = 0;
  }

  var startMs = Number(nowMs) || serverNowMs();
  var quarterMs = 60000 / Math.max(tempo, 1e-6);
  var durationMs = Math.max(120, quarterMs * 0.5); // blue -> next red beat
  var previewSvg = phrasePreviewSvg;

  function step() {
    var now = serverNowMs();
    var progress = Math.max(0, Math.min(1, (now - startMs) / durationMs));
    applyScoreSvgTranslate(baseSvg, phrasePreviewOffsetY * progress);
    applyScoreSvgTranslate(previewSvg, -phrasePreviewOffsetY * (1 - progress));

    if (progress < 1) {
      phraseSwapAnimationFrame = requestAnimationFrame(step);
      return;
    }

    phraseSwapAnimationFrame = 0;
    applyScoreSvgTranslate(baseSvg, 0);

    var targetSnapshot = phraseSwapTargetSnapshot;
    phraseSwapTargetSnapshot = null;
    removePhrasePreviewOverlay(false);
    if (!targetSnapshot) {
      phraseSwapInProgress = false;
      if (deferredRoomStateUpdatePending && typeof window !== 'undefined' && typeof window.handleRoomStateUpdate === 'function') {
        deferredRoomStateUpdatePending = false;
        window.handleRoomStateUpdate();
      }
      return;
    }
    traceConductorEvent('swap.complete', {
      nowMs: Number(now),
      targetFrom: Number(targetSnapshot.fromQuarter),
      targetNum: Number(targetSnapshot.numQuarters),
      targetTranspose: Number(targetSnapshot.transposeSemitones),
    });
    Promise.resolve(commitPhraseSwapTargetSnapshot(targetSnapshot, now))
      .catch(function (error) {
        var message = 'Phrase swap commit error: ' + (error && error.message ? error.message : error);
        setDebugStatus(message);
      })
      .finally(function () {
        phraseSwapInProgress = false;
        if (deferredRoomStateUpdatePending && typeof window !== 'undefined' && typeof window.handleRoomStateUpdate === 'function') {
          deferredRoomStateUpdatePending = false;
          window.handleRoomStateUpdate();
        }
      });
  }

  phraseSwapAnimationFrame = requestAnimationFrame(step);
  return true;
}

function maybeStartPhraseSwapOnBlueBeat(nowMs) {
  if (phraseSwapInProgress) {
    return;
  }
  if (!phrasePreviewAwaitingSwap || !phrasePreviewSnapshot || !phrasePreviewSvg) {
    return;
  }
  startPhraseSwapAnimation(nowMs);
}

function isPlaybarLoopHealthy(nowMs) {
  if (!playbarAnimationFrame) {
    return false;
  }
  if (!Number.isFinite(playbarLastStepMs) || playbarLastStepMs <= 0) {
    return true;
  }
  var now = Number(nowMs);
  if (!Number.isFinite(now)) {
    now = serverNowMs();
  }
  var thresholdMs = Math.max(900, (60000 / Math.max(tempo, 1e-6)) * 1.75);
  return now - playbarLastStepMs <= thresholdMs;
}

function forceCommitPendingPreviewSwap() {
  if (!phrasePreviewAwaitingSwap || !phrasePreviewSnapshot) {
    return false;
  }
  var snapshot = phrasePreviewSnapshot;
  traceConductorEvent('swap.force-commit', {
    targetFrom: Number(snapshot.fromQuarter),
    targetNum: Number(snapshot.numQuarters),
    targetTranspose: Number(snapshot.transposeSemitones),
  });
  removePhrasePreviewOverlay(false);
  commitPhraseSwapTargetSnapshot(snapshot);
  return true;
}

function ensurePreviewSwapProgress(nowMs) {
  if (phraseSwapInProgress || !phrasePreviewAwaitingSwap) {
    return false;
  }
  var now = Number(nowMs);
  if (!Number.isFinite(now)) {
    now = serverNowMs();
  }
  if (isPlaybarLoopHealthy(now)) {
    return false;
  }
  if (startPhraseSwapAnimation(now)) {
    return true;
  }
  return forceCommitPendingPreviewSwap();
}

function schedulePhraseSwapAfterPhraseEnd(nowMs) {
  if (phraseSwapInProgress) {
    return;
  }
  if (!phrasePreviewAwaitingSwap || !phrasePreviewSnapshot || !phrasePreviewSvg) {
    return;
  }
  if (phraseDeferredSwapTimer) {
    return;
  }
  var halfBeatMs = Math.max(20, (60000 / Math.max(tempo, 1e-6)) * 0.5);
  phraseDeferredSwapTimer = setTimeout(function () {
    phraseDeferredSwapTimer = 0;
    if (phraseSwapInProgress || !phrasePreviewAwaitingSwap) {
      return;
    }
    var now = serverNowMs();
    // Maintain the requested musical feel: swap starts on an offbeat-like pulse.
    flashEighthLed(now);
    refreshMetronomeVisual(now);
    ensurePreviewSwapProgress(now);
  }, halfBeatMs);
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
      // Offbeat eighth pulse.
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
  playbarLastStepMs = 0;
  if (phraseSwapAnimationFrame) {
    cancelAnimationFrame(phraseSwapAnimationFrame);
    phraseSwapAnimationFrame = 0;
  }
  if (phraseDeferredSwapTimer) {
    clearTimeout(phraseDeferredSwapTimer);
    phraseDeferredSwapTimer = 0;
  }
  phraseSwapInProgress = false;
  phraseSwapTargetSnapshot = null;
  deferredSnakeRenderPending = false;
  applyScoreSvgTranslate(getActiveScoreSvg(), 0);
  if (phrasePreviewSvg) {
    applyScoreSvgTranslate(phrasePreviewSvg, -phrasePreviewOffsetY);
  }
  resetMetronome();
  applyPendingTransportState();
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

function dynamicToColor(value) {
  var d = dynamicColorLevel(value);
  var red = Math.min(Math.max(d - 5, 0), 5) * 60;
  var green = (Math.min(4 - Math.max(Math.abs(4 - d), 0), 4)) * 60;
  var blue = (Math.min(Math.max(5 - d, 0), 4)) * 60;
  return 'rgb(' + red + ', ' + green + ', ' + blue + ')';
}

function quarterKey(quarterQ) {
  return Number(quarterQ).toFixed(6);
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

function drawDynamicsForExactSlice(
  fromQuarter,
  numQuarters,
  xForQuarter,
  beatSplitPoints,
  beatSplitPointsCanvas
) {
  var c = document.getElementById('dynCanvas');
  if (!c || typeof xForQuarter !== 'function') {
    return;
  }
  var ctx = c.getContext('2d');
  var canvasWidth = Number(c.width) || 0;
  var canvasHeight = Number(c.height) || dynamics_Height;
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  var values = getDynamicsForQuarterSlice(fromQuarter, numQuarters);
  if (!values.length) {
    return;
  }

  var useSplitPoints = beatSplitPoints && beatSplitPoints.length >= values.length + 1;
  var useCanvasSplitPoints = beatSplitPointsCanvas && beatSplitPointsCanvas.length >= values.length + 1;
  var textMarginX = 4;
  var textMarginY = 2;
  var dynamicsFontFamily = selectedScoreFontName + ', Petaluma';
  var scoreXToCanvasX = function (x) { return x; };
  if (!useCanvasSplitPoints) {
    var svg = typeof getActiveScoreSvg === 'function' ? getActiveScoreSvg() : null;
    if (svg) {
      var viewBox = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
      if (
        viewBox.length >= 4 &&
        Number.isFinite(viewBox[0]) &&
        Number.isFinite(viewBox[2]) &&
        viewBox[2] > 1
      ) {
        var vbMinX = viewBox[0];
        var vbWidth = viewBox[2];
        var scaleX = canvasWidth / vbWidth;
        scoreXToCanvasX = function (x) {
          var nx = Number(x);
          if (!Number.isFinite(nx)) {
            return Number.NaN;
          }
          return (nx - vbMinX) * scaleX;
        };
      }
    }
  }

  function leftEdgeForIndex(index) {
    if (useCanvasSplitPoints) {
      return beatSplitPointsCanvas[index];
    }
    var rawX;
    if (useSplitPoints) {
      rawX = beatSplitPoints[index];
    } else {
      rawX = xForQuarter(fromQuarter + index);
    }
    return scoreXToCanvasX(rawX);
  }

  function rightEdgeForIndex(index) {
    if (useCanvasSplitPoints) {
      return beatSplitPointsCanvas[index + 1];
    }
    var rawX;
    if (useSplitPoints) {
      rawX = beatSplitPoints[index + 1];
    } else {
      rawX = xForQuarter(fromQuarter + index + 1);
    }
    return scoreXToCanvasX(rawX);
  }

  function clampCanvasX(x) {
    var nx = Number(x);
    if (!Number.isFinite(nx)) {
      return Number.NaN;
    }
    if (nx < 0) {
      return 0;
    }
    if (nx > canvasWidth) {
      return canvasWidth;
    }
    return nx;
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
    leftX = clampCanvasX(leftX);
    rightX = clampCanvasX(rightX);
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
    ctx.fillRect(leftX, 0, width, canvasHeight);
  }

  ctx.fillStyle = 'white';
  for (var j = 0; j < values.length; j++) {
    var dyn = dynamicTextIndex(values[j]);
    var leftX = leftEdgeForIndex(j);
    var rightX = rightEdgeForIndex(j);
    leftX = clampCanvasX(leftX);
    rightX = clampCanvasX(rightX);
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

var tannhauserScore = null;
var selectedStaffIndex = 2; // default: 3rd staff
var pendingEatenRender = false;
var snakeSnapshotVersion = 0;
var renderWaitSnakeVersion = 0;
var eatenRenderFallbackTimer = 0;
var EATEN_RENDER_FALLBACK_MS = 250;
var debugOverrideFromQuarter = parseStartupNonNegativeInt(startupDefaultsConfig.fromQuarter, 0);
var debugOverrideNumQuarters = parseStartupPositiveInt(startupDefaultsConfig.numQuarters, 4);
var transposeSemitones = clampStartupTransposeSemitones(startupDefaultsConfig.transposeSemitones);
var autoFromQuarterEnabled = parseStartupBoolean(startupDefaultsConfig.autoFromQuarterEnabled, true);
var autoNumQuartersEnabled = parseStartupBoolean(startupDefaultsConfig.autoNumQuartersEnabled, true);
var autoTransposeEnabled = parseStartupBoolean(startupDefaultsConfig.autoTransposeEnabled, false);
var autoTempoEnabled = parseStartupBoolean(startupDefaultsConfig.autoTempoEnabled, false);
var lockedFromQuarter = null;
var lockedNumQuarters = null;
var lastRenderDiagnostics = null;
var deferredSnakeRenderPending = false;

function setDebugStatus(message) {
  var debugEl = document.getElementById('debug');
  if (debugEl) {
    debugEl.innerHTML = message;
  }
}

function timingDebugInt(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '-';
  }
  return String(Math.floor(numeric));
}

function timingDebugFloat(value, digits) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '-';
  }
  var precision = Number.isFinite(Number(digits)) ? Math.max(0, Math.floor(Number(digits))) : 3;
  return numeric.toFixed(precision);
}

function updateTimingDebugLine(payload) {
  var timingEl = document.getElementById('timingDebug');
  if (!timingEl) {
    return;
  }
  payload = payload || {};
  var currentFrom = currentPhraseSnapshot ? Number(currentPhraseSnapshot.fromQuarter) : Number.NaN;
  var currentLen = currentPhraseSnapshot ? Number(currentPhraseSnapshot.numQuarters) : Number.NaN;
  var pendingFrom = phrasePreviewSnapshot ? Number(phrasePreviewSnapshot.fromQuarter) : Number.NaN;
  var pendingLen = phrasePreviewSnapshot ? Number(phrasePreviewSnapshot.numQuarters) : Number.NaN;
  var line = [
    'st=' + String(payload.state || '-'),
    'rq=' + timingDebugInt(payload.roomQuarter),
    'rb=' + timingDebugInt(payload.roomBeat) + '/' + timingDebugInt(payload.roomBeats),
    'abs=' + timingDebugFloat(payload.absoluteQuarters, 3),
    'prog=' + timingDebugFloat(payload.progressedQuarters, 3),
    'anc=' + timingDebugFloat(payload.anchorQuarters, 3),
    'frm=' + timingDebugInt(payload.fromQuarter),
    'len=' + timingDebugInt(payload.numQuarters),
    'cur=' + timingDebugInt(currentFrom) + '+' + timingDebugInt(currentLen),
    'cand=' + timingDebugInt(pendingFrom) + '+' + timingDebugInt(pendingLen),
    'swap=' + (phraseSwapInProgress ? '1' : '0') + '/' + (phrasePreviewAwaitingSwap ? '1' : '0'),
    'dynQ=' + (Array.isArray(queuedDynamics) ? '1' : '0'),
    'dyn0=' + timingDebugInt(Array.isArray(dynamics) && dynamics.length ? dynamics[0] : Number.NaN),
    'off=' + timingDebugFloat(serverClockOffsetMs, 1),
    'sync=' + (hasClockSync ? '1' : '0'),
  ].join(' | ');
  timingEl.textContent = line;
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
  function meaningfulMessage(id) {
    var text = readElementText(id);
    if (!text) {
      return '';
    }
    var placeholder = String(id || '').trim().toLowerCase();
    if (text.trim().toLowerCase() === placeholder) {
      return '';
    }
    return text;
  }

  var controls = currentRenderControls();
  var staffName = tannhauserScore ? tannhauserScore.getStaffName(controls.staffIndex) : '';
  var hasDebugFrom = debugOverrideFromQuarter !== null && debugOverrideFromQuarter !== undefined;
  var hasDebugNum = debugOverrideNumQuarters !== null && debugOverrideNumQuarters !== undefined;
  var snakeHeadFromQuarter = Number.NaN;
  if (typeof calculateFromQuarterFromSnake === 'function') {
    snakeHeadFromQuarter = Number(calculateFromQuarterFromSnake());
  }
  var effectiveFromQuarter = hasDebugFrom ? debugOverrideFromQuarter : lockedFromQuarter;
  if (!Number.isFinite(Number(effectiveFromQuarter))) {
    effectiveFromQuarter = snakeHeadFromQuarter;
  }
  var effectiveNumQuarters = hasDebugNum ? debugOverrideNumQuarters : lockedNumQuarters;
  if (!Number.isFinite(Number(effectiveNumQuarters)) || Number(effectiveNumQuarters) <= 0) {
    effectiveNumQuarters = typeof calculateNumQuartersFromSnake === 'function'
      ? calculateNumQuartersFromSnake()
      : Number.NaN;
  }
  var currentSnapshotFromQuarter = currentPhraseSnapshot ? Number(currentPhraseSnapshot.fromQuarter) : Number.NaN;
  var pendingSwapFromQuarter = phrasePreviewSnapshot ? Number(phrasePreviewSnapshot.fromQuarter) : Number.NaN;
  return {
    timestamp: new Date().toISOString(),
    controls: {
      staffIndex: controls.staffIndex,
      staffName: staffName,
      fromQuarterInput: controls.fromQuarterInput,
      numQuartersInput: controls.numQuartersInput,
      transposeInput: controls.transposeInput,
      spacingMode: controls.spacingMode,
      scoreFont: controls.scoreFont,
      tempoBpm: roundForReport(tempo),
    },
    messages: {
      snake: meaningfulMessage('snake'),
      eaten: meaningfulMessage('eaten'),
      dynamics: meaningfulMessage('dynamics'),
      tempo: meaningfulMessage('tempo'),
      rhythm: meaningfulMessage('rhythm'),
    },
    ui: {
      renderInfo: readElementText('renderInfo'),
      timingDebug: readElementText('timingDebug'),
    },
    state: {
      clientMode: String(window.SCORE_CLIENT_MODE || ''),
      sliceSource: (hasDebugFrom || hasDebugNum) ? 'debug-override' : 'snake-latched',
      snakeHeadFromQuarter: Number.isFinite(snakeHeadFromQuarter) ? Math.floor(snakeHeadFromQuarter) : null,
      effectiveFromQuarter: Number.isFinite(Number(effectiveFromQuarter)) ? Math.floor(Number(effectiveFromQuarter)) : null,
      effectiveNumQuarters: Number.isFinite(Number(effectiveNumQuarters)) ? Math.floor(Number(effectiveNumQuarters)) : null,
      lockedFromQuarter: Number.isFinite(Number(lockedFromQuarter)) ? Math.floor(Number(lockedFromQuarter)) : null,
      lockedNumQuarters: Number.isFinite(Number(lockedNumQuarters)) ? Math.floor(Number(lockedNumQuarters)) : null,
      currentPhraseFromQuarter: Number.isFinite(currentSnapshotFromQuarter) ? Math.floor(currentSnapshotFromQuarter) : null,
      pendingSwapFromQuarter: Number.isFinite(pendingSwapFromQuarter) ? Math.floor(pendingSwapFromQuarter) : null,
      pendingSwap: !!phrasePreviewAwaitingSwap,
      swapInProgress: !!phraseSwapInProgress,
      deferredSnakeRenderPending: !!deferredSnakeRenderPending,
      transposeSemitones: Number(transposeSemitones),
      autoTransposeEnabled: !!autoTransposeEnabled,
      roomStateVersion: Number(roomStateVersion) || 0,
      roomCurrentTranspose: roomStateSnapshot ? Number(roomStateSnapshot.currentTranspose) : null,
      roomCandidateTranspose: roomStateSnapshot ? Number(roomStateSnapshot.candidateTranspose) : null,
      roomCurrentPhraseSeq: roomStateSnapshot ? Number(roomStateSnapshot.currentPhraseSeq) : null,
      roomCandidatePhraseSeq: roomStateSnapshot ? Number(roomStateSnapshot.candidatePhraseSeq) : null,
    },
    traceTail: getTransposeTrace(80),
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
window.updateTimingDebugLine = updateTimingDebugLine;

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
  var tMin = (typeof TRANSPOSE_MIN !== 'undefined') ? TRANSPOSE_MIN : -6;
  return Math.max(tMin, Math.min(tMin + 24, intValue));
}

function syncTransposeInputControl() {
  var transposeInput = document.getElementById('debugTransposeSemitones');
  if (transposeInput && Number(transposeInput.value) !== transposeSemitones) {
    transposeInput.value = String(transposeSemitones);
  }
}

function setTransposeSemitones(value) {
  var previousTranspose = Number(transposeSemitones);
  transposeSemitones = clampTransposeSemitones(value);
  traceConductorEvent('transpose.manual-set', {
    input: value,
    previousTranspose: previousTranspose,
    nextTranspose: Number(transposeSemitones),
    autoTransposeEnabled: !!autoTransposeEnabled,
  });
  syncTransposeInputControl();
  renderMusicFromSnake();
}

window.setTransposeSemitones = setTransposeSemitones;

function refreshDebugSliceInputs(renderFromQuarter, renderNumQuarters) {
  var fromInput = document.getElementById('debugFromQuarter');
  if (fromInput) {
    var fromValue = autoFromQuarterEnabled ? null : debugOverrideFromQuarter;
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
    var numValue = autoNumQuartersEnabled ? null : debugOverrideNumQuarters;
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
  debugOverrideFromQuarter = normalizeManualFromQuarter(fromQuarterValue);
  debugOverrideNumQuarters = normalizeManualNumQuarters(numQuartersValue);
  refreshDebugSliceInputs();
  renderMusicFromSnake();
}

window.setDebugSliceControls = setDebugSliceControls;

class MusicXMLQuarterSource {
  constructor(staffs, metadata) {
    this.staffs = staffs;
    var meta = metadata || {};
    this.staffGroups = Array.isArray(meta.staffGroups) ? meta.staffGroups.slice() : [];
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

  getStaffShortName(index) {
    var staff = this.getStaff(index);
    if (!staff) {
      return 'Staff ' + index;
    }
    return String(staff.shortName || staff.name || ('Staff ' + index));
  }

  getStaffClef(index) {
    var staff = this.getStaff(index);
    if (!staff || !staff.clef) {
      return { sign: 'G', line: 2, octaveChange: null };
    }
    return staff.clef;
  }

  getStaffGroups() {
    return this.staffGroups.map(function (group) {
      return {
        number: group.number,
        symbol: group.symbol,
        barline: group.barline,
        startStaffIndex: group.startStaffIndex,
        endStaffIndex: group.endStaffIndex,
      };
    });
  }

  getTotalQuarters(staffIndex) {
    var staff = this.getStaff(staffIndex);
    if (!staff) {
      return 0;
    }
    return staff.quarters.length;
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
          wasClipped: !!event.wasClipped,
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
        wasClipped: clipped,
        slurStarts: event.slurStarts.slice(),
        slurStops: event.slurStops.slice(),
        tieStarts: event.tieStarts.slice(),
        tieStops: event.tieStops.slice(),
      };

      if (clipped) {
        clippedEvent.measureRest = false;
        if (
          clippedEvent.isRest &&
          isMeasureBoundary(overlapStart) &&
          isMeasureBoundary(overlapEnd)
        ) {
          clippedEvent.measureRest = true;
          clippedEvent.vexDuration = 'w';
          clippedEvent.dotCount = 0;
        } else {
          var clippedDurationSpec = inferVexDurationSpecFromQuarter(clippedEvent.durationQ);
          clippedEvent.vexDuration = clippedDurationSpec.vexDuration;
          clippedEvent.dotCount = clippedDurationSpec.dotCount;
        }
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
        }
        if (clippedEnd) {
          clippedEvent.slurStops = [];
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

    function uniqueSortedBoundaries(values) {
      var sorted = values
        .map(function (value) { return Number(value); })
        .filter(function (value) { return Number.isFinite(value); })
        .sort(function (a, b) { return a - b; });
      var unique = [];
      sorted.forEach(function (value) {
        if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]) > EPS) {
          unique.push(value);
        }
      });
      return unique;
    }

    var spanBoundaries = [startQ].concat(barlines.slice()).concat([endQ]);
    spanBoundaries = uniqueSortedBoundaries(spanBoundaries);

    // Split rests at visible bar/slice boundaries so each span can be shaped independently.
    var splitEvents = [];
    events.forEach(function (event) {
      if (!event || !event.isRest) {
        splitEvents.push(event);
        return;
      }
      var eventStart = Number(event.startQ);
      var eventEnd = Number(event.startQ) + Number(event.durationQ || 0);
      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventEnd <= eventStart + EPS) {
        return;
      }
      var cutPoints = [eventStart, eventEnd];
      spanBoundaries.forEach(function (boundaryQ) {
        if (boundaryQ > eventStart + EPS && boundaryQ < eventEnd - EPS) {
          cutPoints.push(boundaryQ);
        }
      });
      cutPoints = uniqueSortedBoundaries(cutPoints);
      if (cutPoints.length <= 2) {
        splitEvents.push(event);
        return;
      }

      for (var cp = 0; cp < cutPoints.length - 1; cp++) {
        var segStart = cutPoints[cp];
        var segEnd = cutPoints[cp + 1];
        if (segEnd <= segStart + EPS) {
          continue;
        }
        var segDuration = segEnd - segStart;
        var segSpec = inferVexDurationSpecFromQuarter(segDuration);
        splitEvents.push({
          startQ: segStart,
          durationQ: segDuration,
          keys: [],
          isRest: true,
          measureRest: false,
          vexDuration: segSpec.vexDuration,
          dotCount: segSpec.dotCount,
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
    });
    events = splitEvents;

    // Ensure full silent measures between boundaries are normalized to measure rests.
    for (var i = 0; i < spanBoundaries.length - 1; i++) {
      var leftQ = spanBoundaries[i];
      var rightQ = spanBoundaries[i + 1];
      if (rightQ - leftQ <= EPS) {
        continue;
      }
      if (!isMeasureBoundary(leftQ) || !isMeasureBoundary(rightQ)) {
        continue;
      }
      var overlappingEvents = events.filter(function (event) {
        var eventStart = event.startQ;
        var eventEnd = event.startQ + event.durationQ;
        return eventStart < rightQ - EPS && eventEnd > leftQ + EPS;
      });
      if (overlappingEvents.some(function (event) { return !event.isRest; })) {
        continue;
      }
      events = events.filter(function (event) {
        var eventStart = event.startQ;
        var eventEnd = event.startQ + event.durationQ;
        var overlaps = eventStart < rightQ - EPS && eventEnd > leftQ + EPS;
        return !overlaps;
      });
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

    // Never keep slice events as measure-rest markers in index3/OSMD mode.
    // Serialize as regular timed rests to prevent multi-rest consolidation.
    events = events.map(function (event) {
      if (!event || !event.isRest || !event.measureRest) {
        return event;
      }
      var spec = inferVexDurationSpecFromQuarter(Number(event.durationQ || 0));
      return Object.assign({}, event, {
        measureRest: false,
        vexDuration: spec.vexDuration,
        dotCount: spec.dotCount,
      });
    });

    function markerNumber(marker) {
      if (marker && typeof marker === 'object') {
        return String(marker.number || '1');
      }
      return String(marker || '1');
    }

    function markerPlacement(marker) {
      if (marker && typeof marker === 'object' && marker.placement) {
        return String(marker.placement);
      }
      return '';
    }

    function normalizeSlurMarker(marker) {
      return {
        number: markerNumber(marker),
        placement: markerPlacement(marker),
      };
    }

    function hasMarkerNumber(markers, number) {
      var target = String(number || '1');
      return (markers || []).some(function (marker) {
        return markerNumber(marker) === target;
      });
    }

    function pushUniqueSlurMarker(markers, marker) {
      if (!Array.isArray(markers)) {
        return;
      }
      var normalized = normalizeSlurMarker(marker);
      var found = false;
      markers.forEach(function (current) {
        if (found) {
          return;
        }
        if (markerNumber(current) !== normalized.number) {
          return;
        }
        found = true;
        if (!current.placement && normalized.placement) {
          current.placement = normalized.placement;
        }
      });
      if (!found) {
        markers.push(normalized);
      }
    }

    function dedupeSlurMarkerArray(markers) {
      var deduped = [];
      (markers || []).forEach(function (marker) {
        pushUniqueSlurMarker(deduped, marker);
      });
      return deduped;
    }

    function pushMarkerNumber(markers, number) {
      var target = String(number || '1');
      if (!hasMarkerNumber(markers, target)) {
        markers.push({ number: target, placement: '' });
      }
    }

    function normalizeSliceSlurAnchors(sliceEvents) {
      if (!Array.isArray(sliceEvents) || sliceEvents.length === 0) {
        return;
      }

      function findPrevNoteIndex(fromIndex) {
        for (var i = fromIndex - 1; i >= 0; i--) {
          if (sliceEvents[i] && !sliceEvents[i].isRest) {
            return i;
          }
        }
        return -1;
      }

      function findNextNoteIndex(fromIndex) {
        for (var i = fromIndex + 1; i < sliceEvents.length; i++) {
          if (sliceEvents[i] && !sliceEvents[i].isRest) {
            return i;
          }
        }
        return -1;
      }

      sliceEvents.forEach(function (event) {
        if (!event) {
          return;
        }
        event.slurStarts = dedupeSlurMarkerArray(event.slurStarts);
        event.slurStops = dedupeSlurMarkerArray(event.slurStops);
      });

      for (var idx = 0; idx < sliceEvents.length; idx++) {
        var event = sliceEvents[idx];
        if (!event || !event.isRest) {
          continue;
        }
        var starts = Array.isArray(event.slurStarts) ? event.slurStarts.slice() : [];
        var stops = Array.isArray(event.slurStops) ? event.slurStops.slice() : [];
        if (!starts.length && !stops.length) {
          continue;
        }

        var nextNoteIndex = starts.length ? findNextNoteIndex(idx) : -1;
        if (nextNoteIndex >= 0) {
          var nextNote = sliceEvents[nextNoteIndex];
          if (!Array.isArray(nextNote.slurStarts)) {
            nextNote.slurStarts = [];
          }
          starts.forEach(function (marker) {
            pushUniqueSlurMarker(nextNote.slurStarts, marker);
          });
        }

        var prevNoteIndex = stops.length ? findPrevNoteIndex(idx) : -1;
        if (prevNoteIndex >= 0) {
          var prevNote = sliceEvents[prevNoteIndex];
          if (!Array.isArray(prevNote.slurStops)) {
            prevNote.slurStops = [];
          }
          stops.forEach(function (marker) {
            pushUniqueSlurMarker(prevNote.slurStops, marker);
          });
        }

        event.slurStarts = [];
        event.slurStops = [];
      }

      sliceEvents.forEach(function (event) {
        if (!event) {
          return;
        }
        event.slurStarts = dedupeSlurMarkerArray(event.slurStarts);
        event.slurStops = dedupeSlurMarkerArray(event.slurStops);
      });

      var openStartsByNumber = new Map();
      for (var eventIndex = 0; eventIndex < sliceEvents.length; eventIndex++) {
        var currentEvent = sliceEvents[eventIndex];
        if (!currentEvent) {
          continue;
        }
        var startMarkers = dedupeSlurMarkerArray(currentEvent.slurStarts);
        var stopMarkers = dedupeSlurMarkerArray(currentEvent.slurStops);

        currentEvent.slurStarts = startMarkers;
        currentEvent.slurStops = [];

        startMarkers.forEach(function (marker) {
          var number = marker.number;
          if (!openStartsByNumber.has(number)) {
            openStartsByNumber.set(number, []);
          }
          openStartsByNumber.get(number).push(eventIndex);
        });

        stopMarkers.forEach(function (marker) {
          var number = marker.number;
          var openList = openStartsByNumber.get(number);
          if (!openList || !openList.length) {
            return;
          }
          openList.shift();
          if (!openList.length) {
            openStartsByNumber.delete(number);
          }
          pushUniqueSlurMarker(currentEvent.slurStops, marker);
        });
      }

      if (openStartsByNumber.size > 0) {
        var unmatchedByEvent = new Map();
        openStartsByNumber.forEach(function (eventIndexes, number) {
          eventIndexes.forEach(function (eventIndex) {
            if (!unmatchedByEvent.has(eventIndex)) {
              unmatchedByEvent.set(eventIndex, new Set());
            }
            unmatchedByEvent.get(eventIndex).add(String(number));
          });
        });
        unmatchedByEvent.forEach(function (numberSet, eventIndex) {
          var event = sliceEvents[eventIndex];
          if (!event) {
            return;
          }
          event.slurStarts = (event.slurStarts || []).filter(function (marker) {
            return !numberSet.has(markerNumber(marker));
          });
        });
      }
    }

    function buildFullSlurSpans(allEvents) {
      var spans = [];
      var open = new Map();
      (allEvents || []).forEach(function (event, eventIndex) {
        (event.slurStarts || []).forEach(function (marker) {
          var number = markerNumber(marker);
          if (!open.has(number)) {
            open.set(number, {
              number: number,
              startQ: Number(event.startQ),
              startEventIndex: eventIndex,
            });
          }
        });
        (event.slurStops || []).forEach(function (marker) {
          var number = markerNumber(marker);
          if (!open.has(number)) {
            return;
          }
          var started = open.get(number);
          open.delete(number);
          var endQ = Number(event.startQ);
          if (!Number.isFinite(started.startQ) || !Number.isFinite(endQ)) {
            return;
          }
          if (endQ + EPS < started.startQ) {
            return;
          }
          spans.push({
            number: number,
            startQ: started.startQ,
            endQ: endQ,
            startEventIndex: started.startEventIndex,
            endEventIndex: eventIndex,
          });
        });
      });
      return spans;
    }

    function repairPartialSliceSlurs(sliceEvents, allEvents) {
      var fullSpans = buildFullSlurSpans(allEvents);
      if (!fullSpans.length) {
        return;
      }
      var visibleNotes = sliceEvents.filter(function (event) {
        return event && !event.isRest;
      });
      if (!visibleNotes.length) {
        return;
      }

      fullSpans.forEach(function (span) {
        if (span.endQ < startQ - EPS || span.startQ > endQ + EPS) {
          return;
        }
        var spanVisibleNotes = visibleNotes.filter(function (event) {
          return event.startQ >= span.startQ - EPS && event.startQ <= span.endQ + EPS;
        });
        // Single visible note cannot carry a meaningful slur arc.
        if (spanVisibleNotes.length < 2) {
          return;
        }

        var startSeen = spanVisibleNotes.some(function (event) {
          return hasMarkerNumber(event.slurStarts, span.number);
        });
        var stopSeen = spanVisibleNotes.some(function (event) {
          return hasMarkerNumber(event.slurStops, span.number);
        });

        if (!startSeen) {
          pushMarkerNumber(spanVisibleNotes[0].slurStarts, span.number);
        }
        if (!stopSeen) {
          pushMarkerNumber(spanVisibleNotes[spanVisibleNotes.length - 1].slurStops, span.number);
        }
      });
    }

    normalizeSliceSlurAnchors(events);
    repairPartialSliceSlurs(events, targetStaff.events || []);
    normalizeSliceSlurAnchors(events);

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
