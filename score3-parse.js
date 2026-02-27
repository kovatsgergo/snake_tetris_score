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

function inferVexDurationSpecFromQuarter(durationQ) {
  var baseCandidates = [
    { q: 4, vex: 'w' },
    { q: 2, vex: 'h' },
    { q: 1, vex: 'q' },
    { q: 0.5, vex: '8' },
    { q: 0.25, vex: '16' },
    { q: 0.125, vex: '32' },
    { q: 0.0625, vex: '64' },
  ];
  var dotMultipliers = [1, 1.5, 1.75, 1.875];
  var EPS = 1e-5;

  for (var i = 0; i < baseCandidates.length; i++) {
    for (var dots = 0; dots < dotMultipliers.length; dots++) {
      if (Math.abs(durationQ - baseCandidates[i].q * dotMultipliers[dots]) < EPS) {
        return {
          vexDuration: baseCandidates[i].vex,
          dotCount: dots,
        };
      }
    }
  }

  return {
    vexDuration: inferVexDurationFromQuarter(durationQ),
    dotCount: 0,
  };
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
  var initialClef = null;
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
        if (initialClef === null) {
          var clefEl = child.querySelector('clef');
          if (clefEl) {
            var clefSign = textOf(clefEl, 'sign') || 'G';
            var clefLineText = textOf(clefEl, 'line');
            var clefLine = clefLineText ? Number(clefLineText) : 2;
            var clefOctaveText = textOf(clefEl, 'clef-octave-change');
            var clefOctave = clefOctaveText ? Number(clefOctaveText) : 0;
            initialClef = {
              sign: clefSign,
              line: Number.isFinite(clefLine) ? clefLine : 2,
              octaveChange: (Number.isFinite(clefOctave) && clefOctave !== 0) ? clefOctave : null,
            };
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
    clef: initialClef,
  };
}

function parseMusicXMLDocument(scoreDoc) {
  function normalizeGroupSymbol(symbolText) {
    var symbol = String(symbolText || '').trim().toLowerCase();
    if (symbol === 'brace') {
      return 'brace';
    }
    if (symbol === 'bracket' || symbol === 'square') {
      return 'bracket';
    }
    if (symbol === 'line') {
      return 'line';
    }
    return null;
  }

  var partNameMap = new Map();
  var partShortNameMap = new Map();
  Array.from(scoreDoc.getElementsByTagName('score-part')).forEach(function (partInfo) {
    var id = partInfo.getAttribute('id');
    if (!id) {
      return;
    }
    var name = textOf(partInfo, 'part-name') || id;
    var shortName = textOf(partInfo, 'part-abbreviation') || name;
    partNameMap.set(id, name);
    partShortNameMap.set(id, shortName);
  });

  var topLevelParts = Array.from(scoreDoc.documentElement.children)
    .filter(function (el) { return el.tagName === 'part'; });

  var rawStaffGroups = [];
  var partOrderIds = [];
  var partList = scoreDoc.querySelector('part-list');
  if (partList) {
    var openGroupsByNumber = new Map();
    Array.from(partList.children || []).forEach(function (childEl) {
      var tag = (childEl.tagName || '').toLowerCase();
      if (tag === 'score-part') {
        var partId = childEl.getAttribute('id');
        if (partId) {
          partOrderIds.push(partId);
        }
        return;
      }
      if (tag !== 'part-group') {
        return;
      }

      var type = String(childEl.getAttribute('type') || '').toLowerCase();
      var number = String(childEl.getAttribute('number') || '1');
      if (type === 'start') {
        openGroupsByNumber.set(number, {
          number: number,
          startPartOrderIndex: partOrderIds.length,
          symbol: normalizeGroupSymbol(textOf(childEl, 'group-symbol')),
          barline: String(textOf(childEl, 'group-barline') || '').trim().toLowerCase(),
        });
        return;
      }
      if (type === 'stop') {
        var openGroup = openGroupsByNumber.get(number);
        if (!openGroup) {
          return;
        }
        var endPartOrderIndex = Math.max(openGroup.startPartOrderIndex, partOrderIds.length - 1);
        rawStaffGroups.push({
          number: openGroup.number,
          symbol: openGroup.symbol,
          barline: openGroup.barline,
          startPartOrderIndex: openGroup.startPartOrderIndex,
          endPartOrderIndex: endPartOrderIndex,
        });
        openGroupsByNumber.delete(number);
      }
    });

    openGroupsByNumber.forEach(function (openGroup) {
      var endPartOrderIndex = Math.max(openGroup.startPartOrderIndex, partOrderIds.length - 1);
      rawStaffGroups.push({
        number: openGroup.number,
        symbol: openGroup.symbol,
        barline: openGroup.barline,
        startPartOrderIndex: openGroup.startPartOrderIndex,
        endPartOrderIndex: endPartOrderIndex,
      });
    });
  }

  var staffs = topLevelParts.map(function (partEl, index) {
    var id = partEl.getAttribute('id') || ('staff-' + index);
    var timeline = parsePartToTimeline(partEl);
    return {
      id: id,
      name: partNameMap.get(id) || ('Staff ' + index),
      shortName: partShortNameMap.get(id) || partNameMap.get(id) || ('Staff ' + index),
      quarters: timeline.quarters,
      events: timeline.events,
      measureBoundariesQ: timeline.measureBoundariesQ,
      keyChanges: timeline.keyChanges || [{ q: 0, fifths: 0 }],
      clef: timeline.clef || null,
    };
  });
  var staffIndexByPartId = new Map();
  staffs.forEach(function (staff, index) {
    if (staff && staff.id) {
      staffIndexByPartId.set(staff.id, index);
    }
  });

  var staffGroups = [];
  rawStaffGroups.forEach(function (group) {
    if (!group || !group.symbol || partOrderIds.length === 0) {
      return;
    }
    var startOrder = Math.max(0, Math.min(partOrderIds.length - 1, group.startPartOrderIndex));
    var endOrder = Math.max(startOrder, Math.min(partOrderIds.length - 1, group.endPartOrderIndex));
    var startPartId = partOrderIds[startOrder];
    var endPartId = partOrderIds[endOrder];
    var startStaffIndex = staffIndexByPartId.get(startPartId);
    var endStaffIndex = staffIndexByPartId.get(endPartId);
    if (!Number.isFinite(startStaffIndex) || !Number.isFinite(endStaffIndex)) {
      return;
    }
    staffGroups.push({
      number: group.number,
      symbol: group.symbol,
      barline: group.barline || '',
      startStaffIndex: Math.min(startStaffIndex, endStaffIndex),
      endStaffIndex: Math.max(startStaffIndex, endStaffIndex),
    });
  });
  staffGroups.sort(function (left, right) {
    if (left.startStaffIndex !== right.startStaffIndex) {
      return left.startStaffIndex - right.startStaffIndex;
    }
    if (left.endStaffIndex !== right.endStaffIndex) {
      return left.endStaffIndex - right.endStaffIndex;
    }
    return String(left.number).localeCompare(String(right.number));
  });

  return new MusicXMLQuarterSource(staffs, {
    staffGroups: staffGroups,
  });
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

  var transposed = events.map(function (event) {
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

  return applyEngravingSlurPlacements(transposed);
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
  // For chords, use the note farthest from the middle line (tie -> down).
  var STEM_PIVOT_MIDI = 71; // B4
  var maxAbove = 0;
  var maxBelow = 0;
  var count = 0;
  event.keys.forEach(function (key) {
    var midi = keyToMidi(key);
    if (Number.isFinite(midi)) {
      var diff = midi - STEM_PIVOT_MIDI;
      if (diff >= 0) {
        if (diff > maxAbove) {
          maxAbove = diff;
        }
      } else {
        var below = -diff;
        if (below > maxBelow) {
          maxBelow = below;
        }
      }
      count += 1;
    }
  });
  if (count === 0) {
    return VF.Stem.UP;
  }
  if (Math.abs(maxAbove - maxBelow) <= 1e-6) {
    return VF.Stem.DOWN;
  }
  return maxAbove > maxBelow ? VF.Stem.DOWN : VF.Stem.UP;
}

function normalizeSlurMarker(marker) {
  if (marker && typeof marker === 'object') {
    return {
      number: String(marker.number || '1'),
      placement: String(marker.placement || '').toLowerCase(),
    };
  }
  return {
    number: String(marker || '1'),
    placement: '',
  };
}

function slurPlacementFromStemDirection(stemDirection) {
  return stemDirection === VF.Stem.DOWN ? 'above' : 'below';
}

function applyEngravingSlurPlacements(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return events || [];
  }
  // Let OSMD place slurs by engraving rules from rendered context.
  // We normalize marker shape but omit MusicXML placement attributes.
  events.forEach(function (event) {
    event.slurStarts = (event.slurStarts || []).map(function (marker) {
      var normalized = normalizeSlurMarker(marker);
      normalized.placement = '';
      return normalized;
    });
    event.slurStops = (event.slurStops || []).map(function (marker) {
      var normalized = normalizeSlurMarker(marker);
      normalized.placement = '';
      return normalized;
    });
  });

  return events;
}

function slurInvertForStemAndPlacement(stemDirection, placement) {
  var normalizedPlacement = String(placement || '').toLowerCase();
  // VexFlow curve orientation in this renderer:
  // invert=true -> below (downward bend), invert=false -> above (upward bend).
  // Engraving rule requested for default direction:
  // stems up => slur below, stems down => slur above.
  var isStemDown = stemDirection === VF.Stem.DOWN;
  if (normalizedPlacement === 'below') {
    return isStemDown;
  }
  if (normalizedPlacement === 'above') {
    return !isStemDown;
  }
  return isStemDown;
}
