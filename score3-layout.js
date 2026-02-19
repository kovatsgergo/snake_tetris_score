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

function clearEatenRenderPendingState() {
  pendingEatenRender = false;
  renderWaitSnakeVersion = 0;
  if (eatenRenderFallbackTimer) {
    clearTimeout(eatenRenderFallbackTimer);
    eatenRenderFallbackTimer = 0;
  }
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
  if (phraseSwapInProgress) {
    // Keep current phrase untouched until preview swap finishes.
    return;
  }
  if (phrasePreviewAwaitingSwap) {
    // If preview is waiting but playback loop already stopped, kick off the
    // pending swap so metronome/highlight can continue on the committed phrase.
    ensurePreviewSwapProgress(serverNowMs());
    return;
  }
  if (playbarAnimationFrame) {
    // Queue snake-driven rerender for phrase boundary to avoid truncating the last beat.
    deferredSnakeRenderPending = true;
    return;
  }
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

// ------------------------------
// Variant 3: OSMD engraving path
// ------------------------------
var OSMD_DIVISIONS = 480;
var osmdInstance = null;
var osmdContainerRef = null;
var osmdRenderEpoch = 0;
var osmdRenderQueue = Promise.resolve();
var osmdLayout = {
  svg: null,
  staffLeftX: 0,
  staffRightX: 900,
  leftX: 0,
  rightX: 900,
  topY: 142,
  bottomY: 182,
};

function getActiveScoreSvg() {
  return osmdLayout && osmdLayout.svg ? osmdLayout.svg : null;
}

function clearScore(options) {
  options = options || {};
  var container = mainScoreElement || document.getElementById('score');
  if (container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.textAlign = 'left';
    container.style.width = full_Width + 'px';
    container.style.height = full_Height + 'px';
  }
  osmdLayout.svg = null;
  if (!options.keepRenderInfo) {
    setRenderInfo('');
  }
}

function showScoreError(message) {
  clearScore({ keepRenderInfo: true });
  var container = mainScoreElement || document.getElementById('score');
  if (!container) {
    return;
  }
  var box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.left = '0';
  box.style.top = '0';
  box.style.right = '0';
  box.style.bottom = '0';
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.padding = '8px';
  box.style.color = '#9b1c1c';
  box.style.fontSize = '14px';
  box.style.fontWeight = '700';
  box.style.textAlign = 'center';
  box.textContent = String(message || 'Render error');
  container.appendChild(box);
}

function staffRightEdgeX() {
  return Number.isFinite(osmdLayout.rightX) ? osmdLayout.rightX : Number.NaN;
}

function osmdEscapeXml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function applyFixedScoreSvgStyle(svg) {
  if (!svg || !svg.style) {
    return;
  }
  // Keep engraving size fixed by explicit pixel scaling from viewBox.
  // Do not stretch to canvas dimensions.
  var vbRaw = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  var vbWidth = vbRaw.length >= 3 && Number.isFinite(vbRaw[2]) ? vbRaw[2] : null;
  var vbHeight = vbRaw.length >= 4 && Number.isFinite(vbRaw[3]) ? vbRaw[3] : null;
  var fixedScale = Number.isFinite(osmdMusicZoom) && osmdMusicZoom > 0 ? osmdMusicZoom : 1;
  if (Number.isFinite(vbWidth) && vbWidth > 0 && Number.isFinite(vbHeight) && vbHeight > 0) {
    svg.style.width = (vbWidth * fixedScale).toFixed(3) + 'px';
    svg.style.height = (vbHeight * fixedScale).toFixed(3) + 'px';
  } else {
    svg.style.width = 'auto';
    svg.style.height = 'auto';
  }
  svg.style.maxWidth = 'none';
  svg.style.maxHeight = 'none';
  svg.style.display = 'block';
  svg.style.margin = '0';
  svg.style.pointerEvents = 'none';
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
}

function osmdDisableMultiRestGeneration(osmd) {
  if (!osmd || !osmd.EngravingRules) {
    return;
  }
  var rules = osmd.EngravingRules;
  // OSMD had a historic typo in this property name; set both if present.
  if ('AutoGenerateMultipleRestMeasuresFromRestMeasures' in rules) {
    rules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false;
  }
  if ('AutoGenerateMutipleRestMeasuresFromRestMeasures' in rules) {
    rules.AutoGenerateMutipleRestMeasuresFromRestMeasures = false;
  }
}

function osmdParseKeyToPitch(key) {
  var parsed = parseKeyComponents(key);
  if (!parsed) {
    return null;
  }
  return {
    step: String(parsed.step || '').toUpperCase(),
    alter: Number(parsed.alter || 0),
    octave: Number(parsed.octave),
  };
}

function osmdTypeFromVexDuration(vexDuration, durationQ) {
  var token = String(vexDuration || '').toLowerCase();
  token = token.replace(/r/g, '').replace(/d/g, '');
  var map = {
    w: 'whole',
    h: 'half',
    q: 'quarter',
    '8': 'eighth',
    '16': '16th',
    '32': '32nd',
    '64': '64th',
    '128': '128th',
    '256': '256th',
  };
  if (map[token]) {
    return map[token];
  }
  var inferred = inferVexDurationSpecFromQuarter(Number(durationQ)).vexDuration;
  return map[String(inferred)] || 'quarter';
}

function osmdQuarterLengthToTimeSignature(quarterLength) {
  var q = Number(quarterLength);
  if (!Number.isFinite(q) || q <= 0) {
    return { beats: 4, beatType: 4 };
  }
  var beatTypes = [4, 8, 16, 2, 1, 32];
  var EPS = 1e-6;
  for (var i = 0; i < beatTypes.length; i++) {
    var beatType = beatTypes[i];
    var beatsRaw = q * beatType / 4;
    var beatsRounded = Math.round(beatsRaw);
    if (Math.abs(beatsRaw - beatsRounded) <= EPS && beatsRounded > 0 && beatsRounded <= 64) {
      return { beats: beatsRounded, beatType: beatType };
    }
  }
  return { beats: Math.max(1, Math.round(q)), beatType: 4 };
}

function osmdSortedUniqueBoundaries(startQ, endQ, barlinesQ) {
  var EPS = 1e-6;
  var out = [Number(startQ), Number(endQ)];
  (barlinesQ || []).forEach(function (q) {
    var n = Number(q);
    if (!Number.isFinite(n)) {
      return;
    }
    if (n <= startQ + EPS || n >= endQ - EPS) {
      return;
    }
    out.push(n);
  });
  out.sort(function (a, b) { return a - b; });
  var uniq = [];
  out.forEach(function (n) {
    if (!uniq.length || Math.abs(n - uniq[uniq.length - 1]) > EPS) {
      uniq.push(n);
    }
  });
  return uniq;
}

function osmdEventClone(event) {
  return {
    startQ: Number(event.startQ),
    durationQ: Number(event.durationQ),
    keys: Array.isArray(event.keys) ? event.keys.slice() : [],
    isRest: !!event.isRest,
    measureRest: !!event.measureRest,
    vexDuration: event.vexDuration,
    dotCount: Number(event.dotCount || 0),
    tuplet: event.tuplet ? {
      actual: Number(event.tuplet.actual),
      normal: Number(event.tuplet.normal),
    } : null,
    tupletStarts: Array.isArray(event.tupletStarts) ? event.tupletStarts.slice() : [],
    tupletStops: Array.isArray(event.tupletStops) ? event.tupletStops.slice() : [],
    beams: event && event.beams ? Object.assign({}, event.beams) : {},
    wasClipped: !!(event && event.wasClipped),
    slurStarts: Array.isArray(event.slurStarts) ? event.slurStarts.slice() : [],
    slurStops: Array.isArray(event.slurStops) ? event.slurStops.slice() : [],
    tieStarts: Array.isArray(event.tieStarts) ? event.tieStarts.slice() : [],
    tieStops: Array.isArray(event.tieStops) ? event.tieStops.slice() : [],
  };
}

function osmdGapRestEvent(startQ, durationQ) {
  var spec = inferVexDurationSpecFromQuarter(Number(durationQ));
  return {
    startQ: Number(startQ),
    durationQ: Number(durationQ),
    keys: [],
    isRest: true,
    measureRest: false,
    vexDuration: spec.vexDuration,
    dotCount: spec.dotCount,
    tuplet: null,
    tupletStarts: [],
    tupletStops: [],
    beams: {},
    wasClipped: false,
    slurStarts: [],
    slurStops: [],
    tieStarts: [],
    tieStops: [],
  };
}

function osmdNormalizeMeasureEvents(events, measureStartQ, measureEndQ) {
  var EPS = 1e-6;
  var normalized = [];
  var sorted = (events || []).slice().sort(function (a, b) {
    if (a.startQ !== b.startQ) {
      return a.startQ - b.startQ;
    }
    return a.durationQ - b.durationQ;
  });
  var cursor = measureStartQ;
  sorted.forEach(function (event) {
    var start = Number(event.startQ);
    var duration = Number(event.durationQ);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= EPS) {
      return;
    }
    if (start > cursor + EPS) {
      normalized.push(osmdGapRestEvent(cursor, start - cursor));
    }
    normalized.push(osmdEventClone(event));
    cursor = Math.max(cursor, start + duration);
  });
  if (cursor < measureEndQ - EPS) {
    normalized.push(osmdGapRestEvent(cursor, measureEndQ - cursor));
  }
  if (normalized.length === 0) {
    normalized.push(osmdGapRestEvent(measureStartQ, measureEndQ - measureStartQ));
  }
  return normalized;
}

function osmdNormalizeEdgeTupletFragments(measureEvents, measureStartQ, measureEndQ) {
  if (!Array.isArray(measureEvents) || measureEvents.length === 0) {
    return;
  }
  var EPS = 1e-6;
  var TUPLET_DURATION_EPS = 0.03;

  function isEdgeBeat(beatStartQ) {
    return Math.abs(beatStartQ - measureStartQ) <= EPS ||
      Math.abs((beatStartQ + 1) - measureEndQ) <= EPS;
  }

  function markerNumberValue(marker, fallback) {
    if (typeof marker === 'string') {
      return String(marker || fallback || '1');
    }
    if (marker && marker.number !== undefined && marker.number !== null && marker.number !== '') {
      return String(marker.number);
    }
    return String(fallback || '1');
  }

  function hasTupletStart(event, number) {
    return (event.tupletStarts || []).some(function (marker) {
      return markerNumberValue(marker, number) === String(number);
    });
  }

  function hasTupletStop(event, number) {
    return (event.tupletStops || []).some(function (marker) {
      return markerNumberValue(marker, number) === String(number);
    });
  }

  function removeTupletStartsByNumber(event, number) {
    if (!Array.isArray(event.tupletStarts)) {
      event.tupletStarts = [];
      return;
    }
    event.tupletStarts = event.tupletStarts.filter(function (marker) {
      return markerNumberValue(marker, number) !== String(number);
    });
  }

  function removeTupletStopsByNumber(event, number) {
    if (!Array.isArray(event.tupletStops)) {
      event.tupletStops = [];
      return;
    }
    event.tupletStops = event.tupletStops.filter(function (marker) {
      return markerNumberValue(marker, number) !== String(number);
    });
  }

  function forceTupletStart(event, number, bracketed) {
    if (!Array.isArray(event.tupletStarts)) {
      event.tupletStarts = [];
    }
    removeTupletStartsByNumber(event, number);
    event.tupletStarts.push({
      number: String(number),
      bracketed: !!bracketed,
    });
  }

  function forceTupletStop(event, number) {
    if (!Array.isArray(event.tupletStops)) {
      event.tupletStops = [];
    }
    removeTupletStopsByNumber(event, number);
    event.tupletStops.push(String(number));
  }

  function applyForcedBeamPolicy(groupIndices, noteOnlyGroup) {
    for (var i = 0; i < groupIndices.length; i++) {
      var event = measureEvents[groupIndices[i]];
      event.beams = {};
      if (!noteOnlyGroup || event.isRest) {
        continue;
      }
      if (groupIndices.length === 2) {
        event.beams['1'] = i === 0 ? 'begin' : 'end';
      } else if (i === 0) {
        event.beams['1'] = 'begin';
      } else if (i === groupIndices.length - 1) {
        event.beams['1'] = 'end';
      } else {
        event.beams['1'] = 'continue';
      }
    }
  }

  var beatStart = Math.floor(measureStartQ + EPS);
  var beatEnd = Math.ceil(measureEndQ - EPS);
  for (var beatQ = beatStart; beatQ < beatEnd; beatQ++) {
    if (!isEdgeBeat(beatQ)) {
      continue;
    }
    var groupIndices = [];
    for (var idx = 0; idx < measureEvents.length; idx++) {
      var event = measureEvents[idx];
      var startQ = Number(event && event.startQ);
      var durationQ = Number(event && event.durationQ);
      var actual = Number(event && event.tuplet && event.tuplet.actual);
      var normal = Number(event && event.tuplet && event.tuplet.normal);
      if (!Number.isFinite(startQ) || !Number.isFinite(durationQ)) {
        continue;
      }
      if (startQ < beatQ - EPS || startQ >= beatQ + 1 - EPS) {
        continue;
      }
      if (actual !== 6 || normal !== 4) {
        continue;
      }
      if (Math.abs(durationQ - (1 / 3)) > TUPLET_DURATION_EPS) {
        continue;
      }
      groupIndices.push(idx);
    }
    if (groupIndices.length !== 3) {
      continue;
    }
    groupIndices.sort(function (a, b) {
      return Number(measureEvents[a].startQ) - Number(measureEvents[b].startQ);
    });

    var groupHasAnyStart = groupIndices.some(function (groupIdx) {
      var eventRef = measureEvents[groupIdx];
      return Array.isArray(eventRef && eventRef.tupletStarts) && eventRef.tupletStarts.length > 0;
    });
    var groupHasAnyStop = groupIndices.some(function (groupIdx) {
      var eventRef = measureEvents[groupIdx];
      return Array.isArray(eventRef && eventRef.tupletStops) && eventRef.tupletStops.length > 0;
    });
    var firstEdge = Math.abs(beatQ - measureStartQ) <= EPS;
    var lastEdge = Math.abs((beatQ + 1) - measureEndQ) <= EPS;
    var looksClippedFragment = false;
    if (firstEdge && !groupHasAnyStart && groupHasAnyStop) {
      looksClippedFragment = true;
    }
    if (lastEdge && groupHasAnyStart && !groupHasAnyStop) {
      looksClippedFragment = true;
    }
    if (!looksClippedFragment) {
      continue;
    }

    var nearTripletGrid = true;
    for (var gi = 0; gi < groupIndices.length; gi++) {
      var eventAt = measureEvents[groupIndices[gi]];
      var expectedQ = beatQ + (gi / 3);
      if (Math.abs(Number(eventAt.startQ) - expectedQ) > 0.06) {
        nearTripletGrid = false;
        break;
      }
    }
    if (!nearTripletGrid) {
      continue;
    }

    var tupletNumber = '1';
    var firstEvent = measureEvents[groupIndices[0]];
    var lastEvent = measureEvents[groupIndices[groupIndices.length - 1]];
    if (Array.isArray(firstEvent.tupletStarts) && firstEvent.tupletStarts.length > 0) {
      tupletNumber = markerNumberValue(firstEvent.tupletStarts[0], '1');
    } else if (Array.isArray(lastEvent.tupletStops) && lastEvent.tupletStops.length > 0) {
      tupletNumber = markerNumberValue(lastEvent.tupletStops[0], '1');
    }

    groupIndices.forEach(function (groupIdx) {
      var eventRef = measureEvents[groupIdx];
      eventRef.tuplet = { actual: 3, normal: 2 };
    });
    var hasRestInGroup = groupIndices.some(function (groupIdx) {
      return !!(measureEvents[groupIdx] && measureEvents[groupIdx].isRest);
    });
    groupIndices.forEach(function (groupIdx) {
      var eventRef = measureEvents[groupIdx];
      removeTupletStartsByNumber(eventRef, tupletNumber);
      removeTupletStopsByNumber(eventRef, tupletNumber);
    });
    // Visual policy:
    // note-only converted groups: force beaming and hide bracket.
    // groups containing rests: remove forced beams and show bracket.
    applyForcedBeamPolicy(groupIndices, !hasRestInGroup);
    forceTupletStart(firstEvent, tupletNumber, hasRestInGroup);
    forceTupletStop(lastEvent, tupletNumber);
  }
}

function osmdHasExplicitBeam(event) {
  var beams = event && event.beams ? event.beams : null;
  if (!beams) {
    return false;
  }
  return Object.keys(beams).some(function (beamNumber) {
    return String(beams[beamNumber] || '').trim() !== '';
  });
}

function osmdCanFallbackBeam(event) {
  var durationQ = Number(event && event.durationQ);
  return !!event &&
    !event.isRest &&
    Number.isFinite(durationQ) &&
    durationQ > 1e-6 &&
    durationQ < 1 - 1e-6 &&
    !osmdHasExplicitBeam(event);
}

function osmdApplyFallbackBeamingForClippedEdges(measureEvents, measureStartQ, measureEndQ) {
  if (!Array.isArray(measureEvents) || measureEvents.length < 2) {
    return;
  }
  var EPS = 1e-6;

  function applyGroup(groupIndices) {
    if (!groupIndices || groupIndices.length < 2) {
      return;
    }
    var hasClipped = groupIndices.some(function (idx) {
      return !!measureEvents[idx].wasClipped;
    });
    if (!hasClipped) {
      return;
    }
    var hasExplicit = groupIndices.some(function (idx) {
      return osmdHasExplicitBeam(measureEvents[idx]);
    });
    if (hasExplicit) {
      return;
    }
    for (var i = 0; i < groupIndices.length; i++) {
      var event = measureEvents[groupIndices[i]];
      if (!event.beams) {
        event.beams = {};
      }
      if (groupIndices.length === 2) {
        event.beams['1'] = i === 0 ? 'begin' : 'end';
      } else if (i === 0) {
        event.beams['1'] = 'begin';
      } else if (i === groupIndices.length - 1) {
        event.beams['1'] = 'end';
      } else {
        event.beams['1'] = 'continue';
      }
    }
  }

  var beatStart = Math.floor(measureStartQ + EPS);
  var beatEnd = Math.ceil(measureEndQ - EPS);
  for (var beatQ = beatStart; beatQ < beatEnd; beatQ++) {
    var group = [];
    var previousIndex = -1;
    for (var idx = 0; idx < measureEvents.length; idx++) {
      var event = measureEvents[idx];
      var startQ = Number(event.startQ);
      if (!Number.isFinite(startQ)) {
        continue;
      }
      if (startQ < beatQ - EPS || startQ >= beatQ + 1 - EPS) {
        continue;
      }

      if (!osmdCanFallbackBeam(event)) {
        applyGroup(group);
        group = [];
        previousIndex = -1;
        continue;
      }

      if (group.length > 0 && previousIndex >= 0) {
        var prevEvent = measureEvents[previousIndex];
        var prevEndQ = Number(prevEvent.startQ) + Number(prevEvent.durationQ || 0);
        if (!Number.isFinite(prevEndQ) || Math.abs(startQ - prevEndQ) > 1e-4) {
          applyGroup(group);
          group = [];
          previousIndex = -1;
        }
      }

      group.push(idx);
      previousIndex = idx;
    }
    applyGroup(group);
  }
}

function osmdSerializeSlurMarkers(markers, type) {
  var out = [];
  (markers || []).forEach(function (marker) {
    var number = typeof marker === 'string' ? marker : marker.number;
    if (!number) {
      number = '1';
    }
    var placement = typeof marker === 'string' ? '' : (marker.placement || '');
    var attrs = ' type="' + osmdEscapeXml(type) + '" number="' + osmdEscapeXml(String(number)) + '"';
    if (placement) {
      attrs += ' placement="' + osmdEscapeXml(String(placement)) + '"';
    }
    out.push('<slur' + attrs + '/>');
  });
  return out;
}

function osmdSerializeTupletMarkers(starts, stops) {
  var out = [];
  (starts || []).forEach(function (startMarker) {
    var number = startMarker && startMarker.number ? String(startMarker.number) : '1';
    var bracketed = !(startMarker && startMarker.bracketed === false);
    out.push(
      '<tuplet type="start" number="' + osmdEscapeXml(number) + '" bracket="' + (bracketed ? 'yes' : 'no') + '"/>'
    );
  });
  (stops || []).forEach(function (stopMarker) {
    var number = typeof stopMarker === 'string' ? String(stopMarker) : String((stopMarker && stopMarker.number) || '1');
    out.push('<tuplet type="stop" number="' + osmdEscapeXml(number) + '"/>');
  });
  return out;
}

function osmdBuildSliceMusicXml(events, fromQuarter, numQuarters, barlinesQ, keyChanges, staffName) {
  var EPS = 1e-6;
  var safeFrom = Math.floor(Number(fromQuarter));
  var safeNum = Math.max(1, Math.floor(Number(numQuarters)));
  var safeEnd = safeFrom + safeNum;
  var boundaries = osmdSortedUniqueBoundaries(safeFrom, safeEnd, barlinesQ || []);
  var eventList = (events || []).filter(function (event) {
    var start = Number(event.startQ);
    var end = start + Number(event.durationQ || 0);
    return start < safeEnd - EPS && end > safeFrom + EPS;
  }).map(osmdEventClone);

  var measuresXml = [];
  var previousKey = null;
  var previousTimeSig = null;
  var timeSignatureStartsQ = [];

  for (var m = 0; m < boundaries.length - 1; m++) {
    var measureStartQ = boundaries[m];
    var measureEndQ = boundaries[m + 1];
    var measureLengthQ = measureEndQ - measureStartQ;
    if (measureLengthQ <= EPS) {
      continue;
    }
    var measureEvents = eventList.filter(function (event) {
      return event.startQ >= measureStartQ - EPS && event.startQ < measureEndQ - EPS;
    });
    measureEvents = osmdNormalizeMeasureEvents(measureEvents, measureStartQ, measureEndQ);
    osmdApplyFallbackBeamingForClippedEdges(measureEvents, measureStartQ, measureEndQ);
    osmdNormalizeEdgeTupletFragments(measureEvents, measureStartQ, measureEndQ);

    var keyFifths = getFifthsAtQuarter(keyChanges || [{ q: safeFrom, fifths: 0 }], measureStartQ);
    var timeSig = osmdQuarterLengthToTimeSignature(measureLengthQ);

    var measureBody = [];
    var keyChanged = (previousKey === null || previousKey !== keyFifths);
    var timeChanged =
      (previousTimeSig === null ||
      previousTimeSig.beats !== timeSig.beats ||
      previousTimeSig.beatType !== timeSig.beatType);
    var includeAttributes = (m === 0) || keyChanged || timeChanged;

    if (includeAttributes) {
      measureBody.push('<attributes>');
      if (m === 0) {
        measureBody.push('<divisions>' + OSMD_DIVISIONS + '</divisions>');
      }
      if (m === 0 || keyChanged) {
        measureBody.push('<key><fifths>' + keyFifths + '</fifths></key>');
      }
      if (m === 0 || timeChanged) {
        measureBody.push('<time><beats>' + timeSig.beats + '</beats><beat-type>' + timeSig.beatType + '</beat-type></time>');
        timeSignatureStartsQ.push(measureStartQ);
      }
      if (m === 0) {
        measureBody.push('<clef><sign>G</sign><line>2</line></clef>');
      }
      measureBody.push('</attributes>');
    }
    previousKey = keyFifths;
    previousTimeSig = timeSig;

    measureEvents.forEach(function (event) {
      var durationDiv = Math.max(1, Math.round(Number(event.durationQ || 0) * OSMD_DIVISIONS));
      var noteType = osmdTypeFromVexDuration(event.vexDuration, event.durationQ);
      var dotCount = Math.max(0, Math.floor(Number(event.dotCount || 0)));
      var eventKeys = event.isRest ? [null] : (event.keys && event.keys.length ? event.keys : [null]);
      var tieStarts = new Set((event.tieStarts || []).map(String));
      var tieStops = new Set((event.tieStops || []).map(String));

      for (var keyIdx = 0; keyIdx < eventKeys.length; keyIdx++) {
        var key = eventKeys[keyIdx];
        var isChordTone = keyIdx > 0 && !event.isRest;
        var pitch = key ? osmdParseKeyToPitch(key) : null;
        var hasTieStart = key ? tieStarts.has(String(key)) : false;
        var hasTieStop = key ? tieStops.has(String(key)) : false;

        var noteXml = [];
        noteXml.push('<note>');
        if (isChordTone) {
          noteXml.push('<chord/>');
        }

        if (event.isRest || !pitch) {
          // Avoid multi-measure rest rendering: always serialize regular rests.
          noteXml.push('<rest/>');
        } else {
          noteXml.push('<pitch>');
          noteXml.push('<step>' + osmdEscapeXml(pitch.step) + '</step>');
          if (pitch.alter !== 0) {
            noteXml.push('<alter>' + pitch.alter + '</alter>');
          }
          noteXml.push('<octave>' + pitch.octave + '</octave>');
          noteXml.push('</pitch>');
        }

        noteXml.push('<duration>' + durationDiv + '</duration>');
        noteXml.push('<voice>1</voice>');
        noteXml.push('<type>' + noteType + '</type>');
        for (var d = 0; d < dotCount; d++) {
          noteXml.push('<dot/>');
        }
        if (event.tuplet && Number.isFinite(event.tuplet.actual) && Number.isFinite(event.tuplet.normal)) {
          noteXml.push('<time-modification>');
          noteXml.push('<actual-notes>' + Math.max(1, Math.floor(event.tuplet.actual)) + '</actual-notes>');
          noteXml.push('<normal-notes>' + Math.max(1, Math.floor(event.tuplet.normal)) + '</normal-notes>');
          noteXml.push('</time-modification>');
        }
        if (!event.isRest && keyIdx === 0) {
          Object.keys(event.beams || {})
            .sort(function (a, b) { return Number(a) - Number(b); })
            .forEach(function (beamNumber) {
              var beamText = String(event.beams[beamNumber] || '').trim();
              if (!beamText) {
                return;
              }
              noteXml.push(
                '<beam number="' + osmdEscapeXml(String(beamNumber)) + '">' +
                osmdEscapeXml(beamText) +
                '</beam>'
              );
            });
        }

        if (hasTieStart) {
          noteXml.push('<tie type="start"/>');
        }
        if (hasTieStop) {
          noteXml.push('<tie type="stop"/>');
        }

        var notations = [];
        if (hasTieStart) {
          notations.push('<tied type="start"/>');
        }
        if (hasTieStop) {
          notations.push('<tied type="stop"/>');
        }
        if (keyIdx === 0) {
          notations = notations.concat(osmdSerializeSlurMarkers(event.slurStarts, 'start'));
          notations = notations.concat(osmdSerializeSlurMarkers(event.slurStops, 'stop'));
          notations = notations.concat(osmdSerializeTupletMarkers(event.tupletStarts, event.tupletStops));
        }
        if (notations.length > 0) {
          noteXml.push('<notations>');
          notations.forEach(function (item) {
            noteXml.push(item);
          });
          noteXml.push('</notations>');
        }

        noteXml.push('</note>');
        measureBody.push(noteXml.join(''));
      }
    });

    if (m === boundaries.length - 2) {
      measureBody.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
    }

    measuresXml.push('<measure number="' + (m + 1) + '">' + measureBody.join('') + '</measure>');
  }

  var partName = staffName || 'Staff';
  return {
    xml: [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    '<part-list>',
    '<score-part id="P1"><part-name>' + osmdEscapeXml(partName) + '</part-name></score-part>',
    '</part-list>',
    '<part id="P1">',
    measuresXml.join(''),
    '</part>',
    '</score-partwise>'
    ].join(''),
    timeSignatureStartsQ: timeSignatureStartsQ,
  };
}

function osmdParsePathLineSegment(pathD) {
  var text = String(pathD || '').trim();
  var match = text.match(/^M\s*([\-\d\.]+)\s+([\-\d\.]+)\s*L\s*([\-\d\.]+)\s+([\-\d\.]+)/i);
  if (!match) {
    match = text.match(/^M([\-\d\.]+)\s+([\-\d\.]+)L([\-\d\.]+)\s+([\-\d\.]+)/i);
  }
  if (!match) {
    return null;
  }
  var x1 = Number(match[1]);
  var y1 = Number(match[2]);
  var x2 = Number(match[3]);
  var y2 = Number(match[4]);
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return null;
  }
  return { x1: x1, y1: y1, x2: x2, y2: y2 };
}

function osmdDetectLayout(svgEl) {
  var fallback = {
    staffLeftX: 0,
    staffRightX: 900,
    leftX: 0,
    rightX: 900,
    topY: 142,
    bottomY: 182,
  };
  if (!svgEl) {
    return fallback;
  }
  var horizontalSegments = [];
  Array.prototype.forEach.call(svgEl.querySelectorAll('path'), function (pathEl) {
    var seg = osmdParsePathLineSegment(pathEl.getAttribute('d'));
    if (!seg) {
      return;
    }
    var dy = Math.abs(seg.y2 - seg.y1);
    var span = Math.abs(seg.x2 - seg.x1);
    if (dy > 0.25 || span < 40) {
      return;
    }
    horizontalSegments.push({
      y: (seg.y1 + seg.y2) / 2,
      xLeft: Math.min(seg.x1, seg.x2),
      xRight: Math.max(seg.x1, seg.x2),
    });
  });

  if (horizontalSegments.length < 5) {
    return fallback;
  }

  horizontalSegments.sort(function (a, b) { return a.y - b.y; });

  var mergedRows = [];
  horizontalSegments.forEach(function (seg) {
    var last = mergedRows.length ? mergedRows[mergedRows.length - 1] : null;
    if (last && Math.abs(last.y - seg.y) <= 0.8) {
      var count = Number(last._count || 1);
      last.y = (last.y * count + seg.y) / (count + 1);
      last._count = count + 1;
      last.xLeft = Math.min(last.xLeft, seg.xLeft);
      last.xRight = Math.max(last.xRight, seg.xRight);
      return;
    }
    mergedRows.push({
      y: seg.y,
      xLeft: seg.xLeft,
      xRight: seg.xRight,
      _count: 1,
    });
  });

  var horizontal = mergedRows.map(function (row) {
    return {
      y: row.y,
      xLeft: row.xLeft,
      xRight: row.xRight,
      span: Math.abs(row.xRight - row.xLeft),
    };
  });

  if (horizontal.length < 5) {
    return fallback;
  }

  var bestGroup = null;
  var bestGroupSpan = -1;
  for (var i = 0; i <= horizontal.length - 5; i++) {
    var candidate = horizontal.slice(i, i + 5);
    var minSpan = Math.min.apply(null, candidate.map(function (row) { return row.span; }));
    if (minSpan < 220) {
      continue;
    }
    var d1 = candidate[1].y - candidate[0].y;
    var d2 = candidate[2].y - candidate[1].y;
    var d3 = candidate[3].y - candidate[2].y;
    var d4 = candidate[4].y - candidate[3].y;
    var avg = (d1 + d2 + d3 + d4) / 4;
    if (avg < 6 || avg > 16) {
      continue;
    }
    if (minSpan > bestGroupSpan) {
      bestGroup = candidate;
      bestGroupSpan = minSpan;
    }
  }

  if (!bestGroup) {
    bestGroup = horizontal.slice(0, 5);
  }

  var staffLeft = Math.min.apply(null, bestGroup.map(function (row) { return row.xLeft; }));
  var staffRight = Math.max.apply(null, bestGroup.map(function (row) { return row.xRight; }));
  var topY = bestGroup[0].y;
  var bottomY = bestGroup[4].y;
  var leftX = staffLeft;

  return {
    staffLeftX: staffLeft,
    staffRightX: staffRight,
    leftX: leftX,
    rightX: staffRight,
    topY: topY,
    bottomY: bottomY,
  };
}

function osmdApplyFullWidthViewBox(svgEl, layout) {
  if (!svgEl || !layout) {
    return;
  }
  var vbRaw = String(svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (vbRaw.length < 4 || !Number.isFinite(vbRaw[0]) || !Number.isFinite(vbRaw[1]) ||
      !Number.isFinite(vbRaw[2]) || !Number.isFinite(vbRaw[3])) {
    return;
  }
  var vbY = vbRaw[1];
  var vbHeight = vbRaw[3];
  var staffLeft = Number(layout.staffLeftX);
  var staffRight = Number(layout.staffRightX);
  if (!Number.isFinite(staffLeft) || !Number.isFinite(staffRight) || staffRight <= staffLeft + 1) {
    return;
  }
  var vbWidth = staffRight - staffLeft;
  svgEl.setAttribute('viewBox', [staffLeft, vbY, vbWidth, vbHeight].join(' '));
}

function osmdAlignViewBoxToStaffLeft(svgEl, layout) {
  if (!svgEl || !layout) {
    return;
  }
  var vbRaw = String(svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (vbRaw.length < 4 || !Number.isFinite(vbRaw[0]) || !Number.isFinite(vbRaw[1]) ||
      !Number.isFinite(vbRaw[2]) || !Number.isFinite(vbRaw[3])) {
    return;
  }
  var staffLeft = Number(layout.staffLeftX);
  if (!Number.isFinite(staffLeft)) {
    return;
  }
  var contentLeft = staffLeft;
  try {
    var bbox = svgEl.getBBox();
    if (bbox && Number.isFinite(bbox.x)) {
      contentLeft = Math.min(contentLeft, bbox.x);
    }
  } catch (_error) {
    // Ignore getBBox failures and keep staff-left alignment.
  }
  var vbY = vbRaw[1];
  var vbWidth = vbRaw[2];
  var vbHeight = vbRaw[3];
  svgEl.setAttribute('viewBox', [contentLeft, vbY, vbWidth, vbHeight].join(' '));
}

function osmdSetBaseOffsetForLowEb(svgEl, layout) {
  if (!svgEl || !layout) {
    return;
  }
  var vbRaw = String(svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (vbRaw.length < 4 || !Number.isFinite(vbRaw[1]) || !Number.isFinite(vbRaw[3]) || vbRaw[3] <= 0) {
    svgEl.__baseOffsetY = 0;
    return;
  }
  var topY = Number(layout.topY);
  var bottomY = Number(layout.bottomY);
  if (!Number.isFinite(topY) || !Number.isFinite(bottomY) || bottomY <= topY) {
    svgEl.__baseOffsetY = 0;
    return;
  }
  var staffSpace = (bottomY - topY) / 4;
  // Clarinet low E-flat sits below multiple ledger lines; keep extra headroom.
  var lowEbY = bottomY + staffSpace * 8.5;
  var fixedScale = Number.isFinite(osmdMusicZoom) && osmdMusicZoom > 0 ? osmdMusicZoom : 1;
  var lowEbPx = (lowEbY - vbRaw[1]) * fixedScale;
  var marginBottomPx = 2;
  var baseOffset = Math.max(0, full_Height - marginBottomPx - lowEbPx);
  svgEl.__baseOffsetY = baseOffset;
}

function osmdDedupSortedXs(xs, minDelta) {
  var out = [];
  var delta = Number.isFinite(minDelta) ? Math.max(0.01, minDelta) : 1;
  xs
    .map(Number)
    .filter(function (x) { return Number.isFinite(x); })
    .sort(function (a, b) { return a - b; })
    .forEach(function (x) {
      if (!out.length || Math.abs(x - out[out.length - 1]) > delta) {
        out.push(x);
      } else {
        out[out.length - 1] = (out[out.length - 1] + x) / 2;
      }
    });
  return out;
}

function osmdDetectBarlineXs(svgEl, layout) {
  if (!svgEl || !layout) {
    return [];
  }
  var staffTop = Number(layout.topY);
  var staffBottom = Number(layout.bottomY);
  var staffLeft = Number(layout.staffLeftX);
  var staffRight = Number(layout.staffRightX);
  if (!Number.isFinite(staffTop) || !Number.isFinite(staffBottom) ||
      !Number.isFinite(staffLeft) || !Number.isFinite(staffRight)) {
    return [];
  }
  var minHeight = Math.max(8, (staffBottom - staffTop) - 1);
  var xs = [];
  Array.prototype.forEach.call(svgEl.querySelectorAll('rect'), function (rectEl) {
    var x = Number(rectEl.getAttribute('x'));
    var y = Number(rectEl.getAttribute('y'));
    var w = Number(rectEl.getAttribute('width'));
    var h = Number(rectEl.getAttribute('height'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return;
    }
    if (w > 4 || h < minHeight) {
      return;
    }
    if (x < staffLeft - 2 || x > staffRight + 2) {
      return;
    }
    if (y > staffTop + 3 || (y + h) < staffBottom - 3) {
      return;
    }
    xs.push(x);
  });
  var deduped = osmdDedupSortedXs(xs, 1.5);
  return deduped.filter(function (x) {
    return x > staffLeft + 2 && x <= staffRight + 2;
  });
}

function osmdDetectTimeSignatureBoxes(svgEl) {
  if (!svgEl) {
    return [];
  }
  var boxes = [];
  Array.prototype.forEach.call(svgEl.querySelectorAll('g.vf-timesignature'), function (el) {
    try {
      var box = el.getBBox();
      if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.width)) {
        return;
      }
      boxes.push({
        left: Number(box.x),
        right: Number(box.x + box.width),
      });
    } catch (_error) {
      // Ignore getBBox failures.
    }
  });
  boxes.sort(function (a, b) {
    return a.left - b.left;
  });
  return boxes;
}

function osmdBuildTimeSignatureBoundsByQuarter(timeSignatureStartsQ, timeSigBoxes) {
  var map = new Map();
  var starts = (timeSignatureStartsQ || [])
    .map(function (q) { return normalizeQuarterBoundary(q); })
    .filter(function (q) { return Number.isFinite(q); })
    .sort(function (a, b) { return a - b; });
  var boxes = (timeSigBoxes || []).slice();
  var count = Math.min(starts.length, boxes.length);
  for (var i = 0; i < count; i++) {
    map.set(quarterKey(starts[i]), {
      left: Number(boxes[i].left),
      right: Number(boxes[i].right),
    });
  }
  return map;
}

function osmdUniqueOnsetQuarters(sliceEvents, fromQuarter, numQuarters) {
  var eps = 1e-6;
  var fromQ = Number(fromQuarter);
  var toQ = fromQ + Number(numQuarters);
  var out = [];
  (sliceEvents || []).forEach(function (event) {
    var q = Number(event && event.startQ);
    if (!Number.isFinite(q) || q < fromQ - eps || q >= toQ - eps) {
      return;
    }
    var duplicate = out.some(function (existingQ) {
      return Math.abs(existingQ - q) <= eps;
    });
    if (!duplicate) {
      out.push(q);
    }
  });
  out.sort(function (a, b) { return a - b; });
  return out;
}

function normalizeQuarterBoundary(q) {
  var n = Number(q);
  if (!Number.isFinite(n)) {
    return Number.NaN;
  }
  var nearestInt = Math.round(n);
  if (Math.abs(n - nearestInt) <= 1e-3) {
    return nearestInt;
  }
  return n;
}

function osmdBuildOnsetAnchorMap(svgEl, sliceEvents, fromQuarter, numQuarters) {
  var map = new Map();
  if (!svgEl) {
    return map;
  }
  var onsetQs = osmdUniqueOnsetQuarters(sliceEvents, fromQuarter, numQuarters);
  if (!onsetQs.length) {
    return map;
  }
  var glyphXs = [];
  Array.prototype.forEach.call(svgEl.querySelectorAll('g.vf-stavenote'), function (groupEl) {
    var box = null;
    try {
      box = groupEl.getBBox();
    } catch (err) {
      box = null;
    }
    if (!box || !Number.isFinite(box.x)) {
      return;
    }
    glyphXs.push(box.x);
  });
  glyphXs = osmdDedupSortedXs(glyphXs, 0.5);
  var count = Math.min(onsetQs.length, glyphXs.length);
  for (var i = 0; i < count; i++) {
    map.set(String(onsetQs[i]), glyphXs[i]);
  }
  return map;
}

function osmdFindFirstOnsetAnchor(onsetAnchorMap, startQ, endQ) {
  var out = { q: Number.NaN, x: Number.NaN };
  if (!(onsetAnchorMap instanceof Map) || onsetAnchorMap.size === 0) {
    return out;
  }
  var start = Number(startQ);
  var end = Number(endQ);
  var bestQ = Number.POSITIVE_INFINITY;
  var bestX = Number.NaN;
  onsetAnchorMap.forEach(function (x, key) {
    var q = Number(key);
    var nx = Number(x);
    if (!Number.isFinite(q) || !Number.isFinite(nx)) {
      return;
    }
    if (q < start - 1e-6 || q >= end - 1e-6) {
      return;
    }
    if (q < bestQ) {
      bestQ = q;
      bestX = nx;
    }
  });
  if (Number.isFinite(bestQ)) {
    out.q = bestQ;
    out.x = bestX;
  }
  return out;
}

function osmdMapDetectedBarlinesByQuarter(
  detectedBarlineXs,
  barlinesQ,
  startQ,
  endQ,
  startX,
  endX
) {
  var map = new Map();
  var bars = (barlinesQ || [])
    .map(function (q) { return normalizeQuarterBoundary(q); })
    .filter(function (q) {
      return Number.isFinite(q) && q > startQ + 1e-6 && q < endQ - 1e-6;
    })
    .sort(function (a, b) { return a - b; });
  if (!bars.length) {
    return map;
  }

  var candidates = osmdDedupSortedXs(detectedBarlineXs || [], 1.25).filter(function (x) {
    return Number.isFinite(x) && x > startX + 0.5 && x < endX - 0.5;
  });
  if (!candidates.length) {
    return map;
  }

  var cursor = 0;
  for (var i = 0; i < bars.length; i++) {
    var remainingBars = bars.length - i;
    var searchEnd = candidates.length - remainingBars;
    if (searchEnd < cursor) {
      searchEnd = cursor;
    }
    var expected = startX + ((bars[i] - startQ) / Math.max(1e-6, endQ - startQ)) * (endX - startX);
    var bestIdx = cursor;
    var bestDist = Number.POSITIVE_INFINITY;
    for (var c = cursor; c <= searchEnd; c++) {
      var dist = Math.abs(candidates[c] - expected);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = c;
      }
    }
    map.set(quarterKey(bars[i]), candidates[bestIdx]);
    cursor = bestIdx + 1;
    if (cursor >= candidates.length) {
      break;
    }
  }

  return map;
}

function osmdResolveRightAnchorX(detectedBarlineXs, layoutRightX) {
  var fallbackRight = Number(layoutRightX);
  if (!Number.isFinite(fallbackRight)) {
    return fallbackRight;
  }
  var candidates = (detectedBarlineXs || [])
    .map(Number)
    .filter(function (x) { return Number.isFinite(x) && x <= fallbackRight + 2; })
    .sort(function (a, b) { return a - b; });
  if (!candidates.length) {
    return fallbackRight;
  }
  var nearRight = candidates.filter(function (x) {
    return x >= fallbackRight - 12;
  });
  if (!nearRight.length) {
    return fallbackRight;
  }
  if (nearRight.length >= 2) {
    var last = nearRight[nearRight.length - 1];
    var prev = nearRight[nearRight.length - 2];
    if (last - prev <= 6) {
      return prev;
    }
  }
  return nearRight[nearRight.length - 1];
}

function ensureOsmdInstance(container) {
  if (!container) {
    throw new Error('Missing #score container for OSMD rendering.');
  }
  if (!window.opensheetmusicdisplay || !window.opensheetmusicdisplay.OpenSheetMusicDisplay) {
    throw new Error('OpenSheetMusicDisplay was not loaded.');
  }
  if (!osmdInstance || osmdContainerRef !== container) {
    osmdInstance = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      backend: 'svg',
      autoResize: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawPartNames: false,
      drawPartAbbreviations: false,
      drawMeasureNumbers: false,
      renderSingleHorizontalStaffline: true,
      stretchLastSystemLine: false,
    });
    osmdContainerRef = container;
  }
  return osmdInstance;
}

function buildStrictQuarterGridSplitPoints(totalBeats, leftX, rightX) {
  var beats = Math.max(1, Math.floor(Number(totalBeats) || 1));
  var left = Number(leftX);
  var right = Number(rightX);
  if (!Number.isFinite(left)) {
    left = 0;
  }
  if (!Number.isFinite(right) || right <= left + 1) {
    right = left + beats;
  }
  var out = new Array(beats + 1);
  for (var i = 0; i <= beats; i++) {
    out[i] = left + ((right - left) * i) / beats;
  }
  return out;
}

function buildBeatSplitPointsForOsmd(
  fromQuarter,
  numQuarters,
  sliceEvents,
  barlinesQ,
  timeSignatureBoundsByQuarter,
  onsetAnchorMap,
  barlineXByQuarter,
  leftEdgeX,
  rightEdgeX
) {
  var eps = 1e-6;
  var totalBeats = Math.max(1, Math.ceil(Number(numQuarters) - 1e-9));
  var startQ = Number(fromQuarter);
  var endQ = startQ + totalBeats;
  var splitPoints = new Array(totalBeats + 1);
  var firstOnset = osmdFindFirstOnsetAnchor(onsetAnchorMap, startQ, endQ);
  if (!Number.isFinite(firstOnset.x)) {
    throw new Error('Unable to detect first note/rest onset for split-point alignment.');
  }

  var startTimeSig = timeSignatureBoundsByQuarter instanceof Map
    ? timeSignatureBoundsByQuarter.get(quarterKey(startQ))
    : null;
  var startX = Number(firstOnset.x);
  if (
    startTimeSig &&
    Number.isFinite(startTimeSig.right) &&
    startX > Number(startTimeSig.right) + eps
  ) {
    startX = (Number(startTimeSig.right) + startX) / 2;
  }

  var endX = Number(rightEdgeX);
  if (!Number.isFinite(endX) || endX <= startX + eps) {
    throw new Error('Invalid final barline anchor for split-point alignment.');
  }

  var anchorsByQ = new Map();
  function setAnchor(q, x, priority) {
    var nq = Number(q);
    var nx = Number(x);
    if (!Number.isFinite(nq) || !Number.isFinite(nx)) {
      return;
    }
    if (nq < startQ - eps || nq > endQ + eps) {
      return;
    }
    var key = quarterKey(nq);
    var prev = anchorsByQ.get(key);
    if (!prev || Number(priority) >= Number(prev.priority)) {
      anchorsByQ.set(key, { q: nq, x: nx, priority: Number(priority) });
    }
  }

  // 1) Native note/rest onset anchors from OSMD spacing.
  if (onsetAnchorMap instanceof Map) {
    onsetAnchorMap.forEach(function (x, key) {
      var q = Number(key);
      if (!Number.isFinite(q) || q <= startQ + eps || q >= endQ - eps) {
        return;
      }
      setAnchor(q, Number(x), 1);
    });
  }

  // 2) Forced barline anchors (internal). Barline has higher priority than TS.
  (barlinesQ || []).forEach(function (barQ) {
    var q = normalizeQuarterBoundary(barQ);
    if (!Number.isFinite(q) || q <= startQ + eps || q >= endQ - eps) {
      return;
    }
    var key = quarterKey(q);
    if (barlineXByQuarter instanceof Map && barlineXByQuarter.has(key)) {
      setAnchor(q, Number(barlineXByQuarter.get(key)), 3);
    }
  });

  // 3) Forced time-signature-left anchors for internal changes.
  if (timeSignatureBoundsByQuarter instanceof Map) {
    timeSignatureBoundsByQuarter.forEach(function (bounds, key) {
      var q = Number(key);
      if (!Number.isFinite(q) || q <= startQ + eps || q >= endQ - eps) {
        return;
      }
      if (!bounds || !Number.isFinite(bounds.left)) {
        return;
      }
      setAnchor(q, Number(bounds.left), 2);
    });
  }

  // 4) Start/end anchors.
  setAnchor(startQ, startX, 4);
  setAnchor(endQ, endX, 4);

  var anchors = Array.from(anchorsByQ.values())
    .sort(function (a, b) {
      if (Math.abs(a.q - b.q) > eps) {
        return a.q - b.q;
      }
      return a.x - b.x;
    });
  if (!anchors.length) {
    throw new Error('No split-point anchors available.');
  }

  for (var a = 1; a < anchors.length; a++) {
    if (anchors[a].x <= anchors[a - 1].x + eps) {
      throw new Error('Non-increasing anchor positions near quarter ' + anchors[a].q + '.');
    }
  }

  function findAnchorAtQuarter(targetQ) {
    var key = quarterKey(targetQ);
    if (!anchorsByQ.has(key)) {
      return null;
    }
    return anchorsByQ.get(key);
  }

  function findBracket(targetQ) {
    var left = null;
    var right = null;
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      if (anchor.q < targetQ - eps) {
        left = anchor;
        continue;
      }
      if (anchor.q > targetQ + eps) {
        right = anchor;
        break;
      }
    }
    return { left: left, right: right };
  }

  for (var i = 0; i <= totalBeats; i++) {
    var q = startQ + i;
    var exact = findAnchorAtQuarter(q);
    if (exact) {
      splitPoints[i] = Number(exact.x);
      continue;
    }
    var bracket = findBracket(q);
    if (!bracket.left || !bracket.right) {
      throw new Error('Cannot bracket split point for quarter ' + q + '.');
    }
    var dq = bracket.right.q - bracket.left.q;
    if (!(dq > eps)) {
      throw new Error('Invalid anchor interval around quarter ' + q + '.');
    }
    var ratio = (q - bracket.left.q) / dq;
    splitPoints[i] = bracket.left.x + ratio * (bracket.right.x - bracket.left.x);
  }

  splitPoints[0] = startX;
  splitPoints[splitPoints.length - 1] = endX;
  return splitPoints;
}

function buildQuarterInterpolatorFromSplitPointsForOsmd(fromQuarter, splitPoints) {
  var startQ = Number(fromQuarter);
  var points = Array.isArray(splitPoints) ? splitPoints.slice() : [];
  var beatCount = Math.max(1, points.length - 1);
  if (points.length < 2) {
    points = [0, 1];
    beatCount = 1;
  }
  return function (quarterQ) {
    var rel = Number(quarterQ) - startQ;
    if (!Number.isFinite(rel)) {
      return Number.NaN;
    }
    if (rel <= 0) {
      return points[0];
    }
    if (rel >= beatCount) {
      return points[points.length - 1];
    }
    var index = Math.floor(rel);
    var frac = rel - index;
    var left = points[index];
    var right = points[index + 1];
    return left + frac * (right - left);
  };
}

function mapScoreSplitPointsToCanvas(splitPoints, svgEl, targetCanvas) {
  if (!Array.isArray(splitPoints) || splitPoints.length === 0) {
    return [];
  }
  var svg = svgEl || getActiveScoreSvg();
  if (!svg) {
    return splitPoints.slice();
  }
  var canvas = targetCanvas || document.getElementById('dynCanvas');
  var canvasWidth = canvas ? Number(canvas.width) : Number.NaN;
  var canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function'
    ? canvas.getBoundingClientRect()
    : null;
  var canUseScreenTransform =
    canvas &&
    Number.isFinite(canvasWidth) &&
    canvasWidth > 0 &&
    canvasRect &&
    Number.isFinite(canvasRect.left) &&
    Number.isFinite(canvasRect.width) &&
    canvasRect.width > 0 &&
    typeof svg.createSVGPoint === 'function' &&
    typeof svg.getScreenCTM === 'function' &&
    svg.getScreenCTM();
  if (canUseScreenTransform) {
    var point = svg.createSVGPoint();
    var ctm = svg.getScreenCTM();
    var scaleToCanvas = canvasWidth / canvasRect.width;
    var mappedScreen = splitPoints.map(function (x) {
      var nx = Number(x);
      if (!Number.isFinite(nx)) {
        return Number.NaN;
      }
      point.x = nx;
      point.y = 0;
      var screen = point.matrixTransform(ctm);
      return (screen.x - canvasRect.left) * scaleToCanvas;
    });
    for (var s = 1; s < mappedScreen.length; s++) {
      if (!Number.isFinite(mappedScreen[s])) {
        mappedScreen[s] = mappedScreen[s - 1] + 1;
      }
      if (mappedScreen[s] <= mappedScreen[s - 1]) {
        mappedScreen[s] = mappedScreen[s - 1] + 1;
      }
    }
    return mappedScreen;
  }
  var viewBox = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (
    viewBox.length < 4 ||
    !Number.isFinite(viewBox[0]) ||
    !Number.isFinite(viewBox[2]) ||
    viewBox[2] <= 1
  ) {
    return splitPoints.slice();
  }
  var vbMinX = viewBox[0];
  var vbWidth = viewBox[2];
  var width = Number(canvasWidth);
  if (!Number.isFinite(width) || width <= 0) {
    width = full_Width;
  }
  var scaleX = width / vbWidth;
  var mapped = splitPoints.map(function (x) {
    var nx = Number(x);
    if (!Number.isFinite(nx)) {
      return Number.NaN;
    }
    return (nx - vbMinX) * scaleX;
  });
  for (var i = 1; i < mapped.length; i++) {
    if (!Number.isFinite(mapped[i])) {
      mapped[i] = mapped[i - 1] + 1;
    }
    if (mapped[i] <= mapped[i - 1]) {
      mapped[i] = mapped[i - 1] + 1;
    }
  }
  return mapped;
}

function createBeatHighlightOverlay(context, fromQuarter, safeNumQuarters, xForQuarter, beatSplitPoints) {
  var svgRoot = getActiveScoreSvg();
  if (!svgRoot || typeof xForQuarter !== 'function') {
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

  var topY = Math.max(0, Number(osmdLayout.topY) - 14);
  var bottomY = Math.min(full_Height - 1, Number(osmdLayout.bottomY) + 14);
  var height = Math.max(1, bottomY - topY);

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

  return { rect: rect };
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
    buildStrictQuarterGridSplitPoints(
      totalQuarterBeats,
      Number(xForQuarter(fromQuarter)),
      Number(xForQuarter(fromQuarter + totalQuarterBeats))
    );

  var beatOverlay = createBeatHighlightOverlay(
    null,
    fromQuarter,
    safeNumQuarters,
    xForQuarter,
    splitPoints
  );

  var playheadLine = null;
  var svgRoot = getActiveScoreSvg();
  if (playheadEnabled && svgRoot) {
    var playbarTopY = Math.max(0, Number(osmdLayout.topY) - 70);
    var playbarBottomY = Math.min(full_Height - 1, Number(osmdLayout.bottomY) + 80);
    playheadLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    playheadLine.setAttribute('x1', String(startX));
    playheadLine.setAttribute('x2', String(startX));
    playheadLine.setAttribute('y1', String(playbarTopY));
    playheadLine.setAttribute('y2', String(playbarBottomY));
    playheadLine.setAttribute('stroke', '#000000');
    playheadLine.setAttribute('stroke-width', '1');
    playheadLine.setAttribute('opacity', '0.85');
    svgRoot.appendChild(playheadLine);
  }

  playbarLastStepMs = serverNowMs();
  var snakeRequestedForCycle = false;
  var lastCycleIndex = null;
  var phrasePhaseAnchorQuarters = null;

  function requestSnakeForCycle() {
    if (snakeRequestedForCycle) {
      return;
    }
    snakeRequestedForCycle = true;
    if (typeof wsSend === 'function') {
      wsSend('snake');
    }
  }

  function showPreStartFrame(now) {
    var preStartWindow = buildQuarterBeatWindow(
      fromQuarter,
      safeNumQuarters,
      0,
      xForQuarter,
      splitPoints
    );
    setBeatIndexDisplay(preStartWindow.beatNumber, preStartWindow.totalBeats);
    updateBeatHighlightOverlay(beatOverlay, preStartWindow.startX, preStartWindow.endX);
    if (playheadLine) {
      playheadLine.setAttribute('x1', String(preStartWindow.startX));
      playheadLine.setAttribute('x2', String(preStartWindow.startX));
    }
    refreshMetronomeVisual(now);
    playbarAnimationFrame = requestAnimationFrame(step);
  }

  function handleCycleBoundary(now, totalQuarterBeats) {
    requestSnakeForCycle();
    refreshMetronomeVisual(now);
    setBeatIndexDisplay(totalQuarterBeats, totalQuarterBeats);
    schedulePhraseSwapAfterPhraseEnd(now);
    if (phraseSwapInProgress || phrasePreviewAwaitingSwap) {
      playbarAnimationFrame = 0;
      playbarLastStepMs = 0;
      return true;
    }
    if (deferredSnakeRenderPending) {
      deferredSnakeRenderPending = false;
      playbarAnimationFrame = 0;
      playbarLastStepMs = 0;
      renderMusicFromSnake();
      return true;
    }
    snakeRequestedForCycle = false;
    return false;
  }

  function step() {
    var now = serverNowMs();
    playbarLastStepMs = now;

    var tempoQps = Math.max(quarterRatePerSecond(), 1e-6);
    var totalSeconds = safeNumQuarters / tempoQps;
    var prefetchLeadSeconds = Math.max(0.2, Math.min(totalSeconds * 0.5, 1 / tempoQps));
    var absoluteQuarters;
    var phraseQuarters;
    var cycleIndex;
    var progressedQuarters;
    var phaseSeconds;

    if (!Number.isFinite(transportEpochMs)) {
      showPreStartFrame(now);
      return;
    }

    absoluteQuarters = (now - transportEpochMs) * tempoQps / 1000;
    if (!Number.isFinite(absoluteQuarters) || absoluteQuarters < 0) {
      showPreStartFrame(now);
      return;
    }

    if (!Number.isFinite(phrasePhaseAnchorQuarters)) {
      // Reset phrase timing phase when this phrase becomes active.
      // Keep it transport-anchored (quarter boundary) so all clients stay aligned.
      phrasePhaseAnchorQuarters = Math.floor(absoluteQuarters + 1e-6);
    }

    phraseQuarters = absoluteQuarters - phrasePhaseAnchorQuarters;
    if (!Number.isFinite(phraseQuarters) || phraseQuarters < 0) {
      phraseQuarters = 0;
    }

    cycleIndex = Math.floor(phraseQuarters / safeNumQuarters);
    progressedQuarters = phraseQuarters - cycleIndex * safeNumQuarters;
    if (!Number.isFinite(progressedQuarters) || progressedQuarters < 0) {
      progressedQuarters = 0;
    }
    if (progressedQuarters >= safeNumQuarters) {
      progressedQuarters = Math.max(0, safeNumQuarters - 1e-6);
    }
    phaseSeconds = progressedQuarters / tempoQps;

    if (lastCycleIndex === null) {
      lastCycleIndex = cycleIndex;
    } else if (cycleIndex > lastCycleIndex) {
      if (handleCycleBoundary(now, totalQuarterBeats)) {
        return;
      }
      lastCycleIndex = cycleIndex;
    } else if (cycleIndex < lastCycleIndex) {
      // Transport epoch/tempo revision can move phase backwards; restart per-cycle local flags.
      snakeRequestedForCycle = false;
      lastCycleIndex = cycleIndex;
    }

    if (!snakeRequestedForCycle && phaseSeconds >= Math.max(0, totalSeconds - prefetchLeadSeconds)) {
      requestSnakeForCycle();
    }

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

    if (playheadLine) {
      var currentX = xForQuarter(currentQuarter);
      if (Number.isFinite(currentX)) {
        playheadLine.setAttribute('x1', String(currentX));
        playheadLine.setAttribute('x2', String(currentX));
      }
    }

    // Drive metronome from absolute transport time so all clients share the same pulse timeline.
    advanceMetronome(absoluteQuarters, now);
    playbarAnimationFrame = requestAnimationFrame(step);
  }

  playbarAnimationFrame = requestAnimationFrame(step);
}

function buildPhraseSnapshot(fromQuarter, numQuarters, staffIndex) {
  if (!tannhauserScore) {
    return null;
  }
  var safeFrom = Math.floor(Number(fromQuarter));
  var safeNum = Math.max(1, Math.floor(Number(numQuarters)));
  var safeStaff = Math.max(0, Math.floor(Number(staffIndex)));

  var sliceData = tannhauserScore.getExactSliceData(safeFrom, safeNum, safeStaff);
  var sourceKeyChanges = sliceData.keyChanges || [{ q: safeFrom, fifths: 0 }];
  var transposedKeyChanges = transposeKeyChanges(sourceKeyChanges, transposeSemitones);
  var transposedEvents = transposeSliceEvents(
    sliceData.events,
    transposeSemitones,
    safeFrom,
    safeNum,
    sliceData.barlines,
    transposedKeyChanges
  );

  return {
    fromQuarter: safeFrom,
    numQuarters: safeNum,
    staffIndex: safeStaff,
    barlinesQ: (sliceData.barlines || []).slice(),
    keyChanges: transposedKeyChanges,
    preparedEvents: transposedEvents,
    transposeSemitones: transposeSemitones,
  };
}

async function renderMusicSlice(events, fromQuarter, numQuarters, staffIndex, barlinesQ, options) {
  options = options || {};
  clearScore({ keepRenderInfo: !!options.skipRenderInfo });

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
    slurStarts: [],
    slurStops: [],
    tieStarts: [],
    tieStops: [],
  }];

  var safeNumQuarters = Math.max(0, Number(numQuarters) || 0);
  var token = ++osmdRenderEpoch;

  var partName = tannhauserScore ? tannhauserScore.getStaffName(staffIndex) : ('Staff ' + staffIndex);
  var xmlBuild = osmdBuildSliceMusicXml(
    sliceEvents,
    fromQuarter,
    safeNumQuarters,
    barlinesQ || [],
    options.keyChanges || [{ q: fromQuarter, fifths: 0 }],
    partName
  );
  var xml = xmlBuild && xmlBuild.xml ? xmlBuild.xml : '';
  var timeSignatureStartsQ = xmlBuild && Array.isArray(xmlBuild.timeSignatureStartsQ)
    ? xmlBuild.timeSignatureStartsQ
    : [];

  var osmd = ensureOsmdInstance(scoreElement);
  osmd.Zoom = 1;
  osmd.setOptions({
    backend: 'svg',
    autoResize: false,
    drawTitle: false,
    drawSubtitle: false,
    drawComposer: false,
    drawPartNames: false,
    drawPartAbbreviations: false,
    drawMeasureNumbers: false,
    renderSingleHorizontalStaffline: true,
    stretchLastSystemLine: false,
  });
  osmdDisableMultiRestGeneration(osmd);

  await osmd.load(xml);
  if (token !== osmdRenderEpoch) {
    return false;
  }
  osmd.render();
  if (typeof window.ensureOsmdStemRulesPatchedFromInstance === 'function') {
    var patchedStemRules = false;
    try {
      patchedStemRules = !!window.ensureOsmdStemRulesPatchedFromInstance(osmd, {
        extraStemLengthInSpaces: 0.0,
        applyToUnbeamed: true,
        applyToBeams: true,
        debug: false,
      });
    } catch (stemPatchError) {
      // eslint-disable-next-line no-console
      console.warn('Stem rules runtime patch failed:', stemPatchError);
    }
    if (patchedStemRules) {
      osmd.render();
    }
  }
  if (token !== osmdRenderEpoch) {
    return false;
  }

  var svg = scoreElement ? scoreElement.querySelector('svg') : null;
  if (!svg) {
    throw new Error('OSMD did not create an SVG output.');
  }
  applyFixedScoreSvgStyle(svg);

  var layout = osmdDetectLayout(svg);
  if (osmdUseAdaptiveViewBoxStretch) {
    osmdApplyFullWidthViewBox(svg, layout);
    layout = osmdDetectLayout(svg);
  } else {
    osmdAlignViewBoxToStaffLeft(svg, layout);
    layout = osmdDetectLayout(svg);
  }
  applyFixedScoreSvgStyle(svg);
  osmdSetBaseOffsetForLowEb(svg, layout);
  applyScoreSvgTranslate(svg, 0);

  var detectedBarlineXs = osmdDetectBarlineXs(svg, layout);
  var onsetAnchorMap = osmdBuildOnsetAnchorMap(svg, sliceEvents, fromQuarter, safeNumQuarters);
  var timeSigBoxes = osmdDetectTimeSignatureBoxes(svg);
  var timeSignatureBoundsByQuarter = osmdBuildTimeSignatureBoundsByQuarter(
    timeSignatureStartsQ,
    timeSigBoxes
  );
  var firstOnsetAnchor = osmdFindFirstOnsetAnchor(
    onsetAnchorMap,
    Number(fromQuarter),
    Number(fromQuarter) + Math.max(1, Math.ceil(safeNumQuarters - 1e-9))
  );
  var leftAnchorX = Number.isFinite(firstOnsetAnchor.x) ? Number(firstOnsetAnchor.x) : Number(layout.leftX);
  if (!Number.isFinite(leftAnchorX)) {
    leftAnchorX = Number(layout.staffLeftX);
  }
  var rightAnchorX = osmdResolveRightAnchorX(detectedBarlineXs, layout.rightX);
  if (!Number.isFinite(rightAnchorX) || rightAnchorX <= leftAnchorX + 1) {
    rightAnchorX = layout.rightX;
  }
  var totalQuarterBeats = Math.max(1, Math.ceil(safeNumQuarters - 1e-9));
  var endQuarter = Number(fromQuarter) + totalQuarterBeats;
  var barlineXByQuarter = osmdMapDetectedBarlinesByQuarter(
    detectedBarlineXs,
    barlinesQ || [],
    Number(fromQuarter),
    endQuarter,
    leftAnchorX,
    rightAnchorX
  );
  var beatSplitPoints = buildBeatSplitPointsForOsmd(
    fromQuarter,
    safeNumQuarters,
    sliceEvents,
    barlinesQ || [],
    timeSignatureBoundsByQuarter,
    onsetAnchorMap,
    barlineXByQuarter,
    leftAnchorX,
    rightAnchorX
  );
  var dynCanvas = document.getElementById('dynCanvas');
  var beatSplitPointsCanvas = mapScoreSplitPointsToCanvas(
    beatSplitPoints,
    svg,
    dynCanvas
  );
  var xForQuarter = buildQuarterInterpolatorFromSplitPointsForOsmd(fromQuarter, beatSplitPoints);
  var xForQuarterBarline = function (q) {
    var nq = normalizeQuarterBoundary(q);
    var key = quarterKey(nq);
    if (barlineXByQuarter.has(key)) {
      return Number(barlineXByQuarter.get(key));
    }
    if (Math.abs(nq - endQuarter) <= 1e-6) {
      return Number(beatSplitPoints[beatSplitPoints.length - 1]);
    }
    return xForQuarter(nq);
  };

  osmdLayout.svg = svg;
  osmdLayout.staffLeftX = layout.staffLeftX;
  osmdLayout.staffRightX = layout.staffRightX;
  osmdLayout.leftX = Number.isFinite(beatSplitPoints[0]) ? beatSplitPoints[0] : leftAnchorX;
  osmdLayout.rightX = Number.isFinite(beatSplitPoints[beatSplitPoints.length - 1]) ?
    beatSplitPoints[beatSplitPoints.length - 1] :
    rightAnchorX;
  osmdLayout.topY = layout.topY;
  osmdLayout.bottomY = layout.bottomY;

  if (!options.skipDynamics) {
    drawDynamicsForExactSlice(
      fromQuarter,
      numQuarters,
      xForQuarter,
      beatSplitPoints,
      beatSplitPointsCanvas
    );
  }
  if (!options.skipPlayback) {
    drawAndAnimatePlaybarTimeMapped(
      fromQuarter,
      numQuarters,
      xForQuarter,
      null,
      sliceEvents,
      [],
      beatSplitPoints,
      barlinesQ,
      xForQuarterBarline
    );
  }

  var header = (tannhauserScore ? tannhauserScore.getStaffName(staffIndex) : ('Staff ' + staffIndex)) +
    ' | from quarter ' + fromQuarter +
    ' | length ' + Math.floor(numQuarters) +
    ' | transpose ' + (transposeSemitones >= 0 ? '+' : '') + transposeSemitones + ' st' +
    ' | OSMD engraving' +
    ' | spacing: ' + spacingMode +
    ' | font: ' + selectedScoreFontName;

  if (!options.skipRenderInfo) {
    setRenderInfo(header);
  }

  if (!options.skipDiagnostics) {
    var onsetAnchorSample = Array.from(onsetAnchorMap.entries())
      .map(function (entry) {
        return {
          q: roundForReport(Number(entry[0])),
          x: roundForReport(Number(entry[1])),
        };
      })
      .filter(function (entry) { return Number.isFinite(entry.q) && Number.isFinite(entry.x); })
      .sort(function (a, b) { return a.q - b.q; });
    var barlineMapSample = Array.from(barlineXByQuarter.entries())
      .map(function (entry) {
        return {
          q: roundForReport(Number(entry[0])),
          x: roundForReport(Number(entry[1])),
        };
      })
      .filter(function (entry) { return Number.isFinite(entry.q) && Number.isFinite(entry.x); })
      .sort(function (a, b) { return a.q - b.q; });
    var resolvedBarlines = (barlinesQ || []).map(function (q) {
      var nq = normalizeQuarterBoundary(q);
      return {
        quarterQ: roundForReport(nq),
        x: roundForReport(xForQuarterBarline(nq)),
      };
    });
    lastRenderDiagnostics = {
      timestamp: new Date().toISOString(),
      staffIndex: Number(staffIndex),
      staffName: tannhauserScore ? tannhauserScore.getStaffName(staffIndex) : '',
      fromQuarter: roundForReport(fromQuarter),
      numQuarters: roundForReport(numQuarters),
      transposeSemitones: transposeSemitones,
      spacingMode: spacingMode,
      scoreFont: selectedScoreFontName,
      header: header,
      barlinesQ: (barlinesQ || []).map(function (q) {
        return roundForReport(normalizeQuarterBoundary(q));
      }),
      detectedBarlineXs: (detectedBarlineXs || []).map(roundForReport),
      barlineMapSample: barlineMapSample.slice(0, 40),
      resolvedBarlines: resolvedBarlines,
      onsetAnchorSample: onsetAnchorSample.slice(0, 40),
      beatSplitPoints: beatSplitPoints.map(roundForReport),
      measureRestWindows: [],
      measureRestRecenterAdjustments: [],
      longRestRecenterAdjustments: [],
      staffLineTopY: roundForReport(osmdLayout.topY),
      staffLineBottomY: roundForReport(osmdLayout.bottomY),
      staffLeftX: roundForReport(osmdLayout.staffLeftX),
      staffRightX: roundForReport(osmdLayout.staffRightX),
      engravingEngine: 'OSMD',
    };
    window.lastRenderDiagnostics = lastRenderDiagnostics;
  }

  return true;
}

async function renderPhraseSnapshot(snapshot, options) {
  if (!snapshot) {
    return false;
  }
  options = options || {};
  if (Number.isFinite(snapshot.transposeSemitones)) {
    transposeSemitones = snapshot.transposeSemitones;
    syncTransposeInputControl();
  }
  var ok = await renderMusicSlice(
    snapshot.preparedEvents,
    snapshot.fromQuarter,
    snapshot.numQuarters,
    snapshot.staffIndex,
    snapshot.barlinesQ,
    {
      skipDynamics: !!options.skipDynamics,
      skipPlayback: !!options.skipPlayback,
      skipRenderInfo: !!options.skipRenderInfo,
      skipDiagnostics: !!options.skipDiagnostics,
      keyChanges: snapshot.keyChanges,
    }
  );
  if (!options.skipPreviewOnTop) {
    ensurePreviewOnTop();
  }
  return ok;
}

async function renderPhraseSnapshotToSvg(snapshot, renderOptions) {
  if (!snapshot || typeof document === 'undefined') {
    return null;
  }
  renderOptions = renderOptions || {};
  var tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-99999px';
  tempContainer.style.top = '-99999px';
  tempContainer.style.width = full_Width + 'px';
  tempContainer.style.height = full_Height + 'px';
  document.body.appendChild(tempContainer);

  var savedScoreElement = scoreElement;
  var savedMainScoreElement = mainScoreElement;
  var savedRenderInfoText = readElementText('renderInfo');
  var savedDiagnostics = lastRenderDiagnostics;
  var savedOsmdInstance = osmdInstance;
  var savedOsmdContainerRef = osmdContainerRef;
  var savedOsmdLayout = Object.assign({}, osmdLayout);
  var previewSvg = null;

  try {
    scoreElement = tempContainer;
    mainScoreElement = tempContainer;
    osmdInstance = null;
    osmdContainerRef = null;

    var svgRenderOptions = {
      skipDynamics: true,
      skipPlayback: true,
      skipRenderInfo: true,
      skipDiagnostics: true,
      skipPreviewOnTop: true,
    };
    Object.keys(renderOptions).forEach(function (key) {
      svgRenderOptions[key] = renderOptions[key];
    });

    await renderPhraseSnapshot(snapshot, svgRenderOptions);
    var previewDiagnostics = null;
    if (!svgRenderOptions.skipDiagnostics && lastRenderDiagnostics) {
      previewDiagnostics = JSON.parse(JSON.stringify(lastRenderDiagnostics));
    }
    var tempSvg = tempContainer.querySelector('svg');
    if (tempSvg) {
      previewSvg = tempSvg.cloneNode(true);
      if (previewDiagnostics) {
        previewSvg.__renderDiagnostics = previewDiagnostics;
      }
    }
  } finally {
    scoreElement = savedScoreElement;
    mainScoreElement = savedMainScoreElement;
    osmdInstance = savedOsmdInstance;
    osmdContainerRef = savedOsmdContainerRef;
    osmdLayout = savedOsmdLayout;
    lastRenderDiagnostics = savedDiagnostics;
    setRenderInfo(savedRenderInfoText);
    if (tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
  }

  return previewSvg;
}

async function showPhrasePreview(snapshot) {
  var svg = await renderPhraseSnapshotToSvg(snapshot);
  if (!svg || !mainScoreElement) {
    return false;
  }
  removePhrasePreviewOverlay(false);
  recolorSvgMonochrome(svg, phrasePreviewColor);
  applyFixedScoreSvgStyle(svg);
  osmdSetBaseOffsetForLowEb(svg, osmdDetectLayout(svg));
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '5';
  applyScoreSvgTranslate(svg, -phrasePreviewOffsetY);
  mainScoreElement.appendChild(svg);

  phrasePreviewSvg = svg;
  phrasePreviewSnapshot = snapshot;
  phrasePreviewAwaitingSwap = true;
  phraseSwapTargetSnapshot = null;
  return true;
}

async function commitPhraseSwapTargetSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  stopPlaybarMotion();
  await renderPhraseSnapshot(snapshot);
  currentPhraseSnapshot = snapshot;
  lockedFromQuarter = snapshot.fromQuarter;
  lockedNumQuarters = snapshot.numQuarters;
  refreshDebugSliceInputs(snapshot.fromQuarter, snapshot.numQuarters);
}

async function renderMusicFromSnakeCore() {
  if (!tannhauserScore) {
    return false;
  }
  if (phraseSwapInProgress) {
    return false;
  }

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
  var snapshot = buildPhraseSnapshot(fromQuarter, numQuarters, staffIndex);
  if (!snapshot) {
    clearEatenRenderPendingState();
    return false;
  }

  if (pendingEatenRender && currentPhraseSnapshot) {
    var previewShown = await showPhrasePreview(snapshot);
    if (!previewShown) {
      stopPlaybarMotion();
      await renderPhraseSnapshot(snapshot);
      currentPhraseSnapshot = snapshot;
      clearEatenRenderPendingState();
      return true;
    }
    clearEatenRenderPendingState();
    if (!playbarAnimationFrame) {
      schedulePhraseSwapAfterPhraseEnd(serverNowMs());
      ensurePreviewSwapProgress(serverNowMs());
    }
    return true;
  }

  stopPlaybarMotion();
  await renderPhraseSnapshot(snapshot);
  currentPhraseSnapshot = snapshot;
  clearEatenRenderPendingState();
  return true;
}

function renderMusicFromSnake() {
  osmdRenderQueue = osmdRenderQueue.then(function () {
    return renderMusicFromSnakeCore();
  }).catch(function (error) {
    var message = 'OSMD render error: ' + (error && error.message ? error.message : error);
    setDebugStatus(message);
    showScoreError(message);
    return false;
  });
  return osmdRenderQueue;
}

loadTannhauserMxl();
