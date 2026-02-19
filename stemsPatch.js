/**
 * OSMD / VexFlow stem-length patch for browser script usage.
 *
 * Runtime toggle:
 *   window.__OSMD_STEM_RULES_CONFIG = {
 *     enabled: true,
 *     extraStemLengthInSpaces: 0.0
 *   }
 */
(function (root) {
  'use strict';

  function runtimeRulesConfig() {
    if (!root.__OSMD_STEM_RULES_CONFIG || typeof root.__OSMD_STEM_RULES_CONFIG !== 'object') {
      root.__OSMD_STEM_RULES_CONFIG = {};
    }
    return root.__OSMD_STEM_RULES_CONFIG;
  }

  function getLineDistancePx(stave) {
    if (!stave || typeof stave.getYForLine !== 'function') {
      return 10;
    }
    var y0 = stave.getYForLine(0);
    var y1 = stave.getYForLine(1);
    var d = Math.abs(y1 - y0);
    if (!Number.isFinite(d) || d <= 0) {
      return 10;
    }
    return d;
  }

  function resolveFlow(vexOrFlow) {
    if (!vexOrFlow) {
      return null;
    }
    if (vexOrFlow.Flow) {
      return vexOrFlow.Flow;
    }
    if (vexOrFlow.Beam && vexOrFlow.Stem) {
      return vexOrFlow;
    }
    return null;
  }

  function collectNotePrototypesFromFlow(flow) {
    var protos = [];
    var seen = [];

    function pushProto(proto) {
      if (!proto || seen.indexOf(proto) >= 0) {
        return;
      }
      if (typeof proto.postFormat !== 'function') {
        return;
      }
      seen.push(proto);
      protos.push(proto);
    }

    pushProto(flow.StemmableNote && flow.StemmableNote.prototype);
    pushProto(flow.StaveNote && flow.StaveNote.prototype);
    pushProto(flow.GraceNote && flow.GraceNote.prototype);
    pushProto(flow.TabNote && flow.TabNote.prototype);
    pushProto(flow.GhostNote && flow.GhostNote.prototype);

    return protos;
  }

  function normalizeTargets(targets) {
    targets = targets || {};
    var out = {
      beamPrototype: targets.beamPrototype || null,
      notePrototypes: Array.isArray(targets.notePrototypes) ? targets.notePrototypes.slice() : [],
      stemUp: Number(targets.stemUp),
      stemDown: Number(targets.stemDown),
    };
    if (!Number.isFinite(out.stemUp)) {
      out.stemUp = 1;
    }
    if (!Number.isFinite(out.stemDown)) {
      out.stemDown = -1;
    }
    return out;
  }

  function installPatchOnTargets(targets, options) {
    var t = normalizeTargets(targets);
    options = options || {};

    if (!t.beamPrototype && (!Array.isArray(t.notePrototypes) || t.notePrototypes.length === 0)) {
      return false;
    }

    var cfg = {
      middleLine: Number.isFinite(Number(options.middleLine)) ? Number(options.middleLine) : 2,
      extraStemLengthInSpaces: Number.isFinite(Number(options.extraStemLengthInSpaces))
        ? Number(options.extraStemLengthInSpaces)
        : 0,
      applyToUnbeamed: options.applyToUnbeamed !== false,
      applyToBeams: options.applyToBeams !== false,
      debug: !!options.debug,
    };

    var globalCfg = runtimeRulesConfig();
    if (typeof globalCfg.enabled === 'undefined') {
      globalCfg.enabled = true;
    }
    if (!Number.isFinite(Number(globalCfg.extraStemLengthInSpaces))) {
      globalCfg.extraStemLengthInSpaces = cfg.extraStemLengthInSpaces;
    }

    function isRuleEnabled() {
      return !!runtimeRulesConfig().enabled;
    }

    function resolvedExtraStemLengthInSpaces() {
      var runtimeValue = Number(runtimeRulesConfig().extraStemLengthInSpaces);
      if (Number.isFinite(runtimeValue)) {
        return runtimeValue;
      }
      return cfg.extraStemLengthInSpaces;
    }

    function ensureStemReachesMiddleLine(note, extentsHint) {
      try {
        if (!isRuleEnabled()) {
          return false;
        }
        if (!note) {
          return false;
        }
        if (typeof note.isRest === 'function' && note.isRest()) {
          return false;
        }

        var stave = note.stave;
        var stem = (typeof note.getStem === 'function') ? note.getStem() : note.stem;
        if (!stave || !stem) {
          return false;
        }

        if (typeof note.hasStem === 'function' && !note.hasStem()) {
          return false;
        }

        var direction = (typeof note.getStemDirection === 'function')
          ? note.getStemDirection()
          : stem.stem_direction;

        if (direction !== t.stemUp && direction !== t.stemDown) {
          return false;
        }

        if (!extentsHint && typeof note.getStemExtents !== 'function') {
          return false;
        }

        var extents = extentsHint || note.getStemExtents();
        if (!extents) {
          return false;
        }

        var lineDist = getLineDistancePx(stave);
        var padPx = resolvedExtraStemLengthInSpaces() * lineDist;
        var midY = stave.getYForLine(cfg.middleLine);
        var targetTipY = midY - direction * padPx;
        var tipY = extents.topY;
        if (!Number.isFinite(tipY)) {
          return false;
        }

        var needed = (direction === t.stemUp)
          ? (tipY - targetTipY)
          : (targetTipY - tipY);

        if (needed > 0.25) {
          var prev = (typeof stem.getExtension === 'function') ? stem.getExtension() : 0;
          if (typeof stem.setExtension === 'function') {
            stem.setExtension(prev + needed);
            if (cfg.debug) {
              // eslint-disable-next-line no-console
              console.log('[stem-rule] extended stem', {
                needed: needed,
                prev: prev,
                next: prev + needed,
              });
            }
            return true;
          }
        }
        return false;
      } catch (error) {
        if (cfg.debug) {
          // eslint-disable-next-line no-console
          console.warn('[stem-rule] ensureStemReachesMiddleLine failed', error);
        }
        return false;
      }
    }

    var patchedAny = false;

    if (cfg.applyToBeams && t.beamPrototype && !t.beamPrototype.__standardStemRulesPatched) {
      var originalBeamPostFormat = t.beamPrototype.postFormat;
      if (typeof originalBeamPostFormat === 'function') {
        t.beamPrototype.postFormat = function patchedBeamPostFormat() {
          if (isRuleEnabled() && !this.postFormatted && Array.isArray(this.notes)) {
            for (var i = 0; i < this.notes.length; i += 1) {
              ensureStemReachesMiddleLine(this.notes[i]);
            }
          }
          return originalBeamPostFormat.call(this);
        };
        t.beamPrototype.__standardStemRulesPatched = true;
        patchedAny = true;
      }
    }

    if (cfg.applyToUnbeamed && Array.isArray(t.notePrototypes)) {
      t.notePrototypes.forEach(function (noteProto) {
        if (!noteProto || noteProto.__standardStemRulesPostFormatPatched) {
          return;
        }
        var originalGetStemExtents = noteProto.getStemExtents;
        if (typeof originalGetStemExtents === 'function' && !noteProto.__standardStemRulesExtentsPatched) {
          noteProto.getStemExtents = function patchedGetStemExtents() {
            var extents = originalGetStemExtents.call(this);
            if (isRuleEnabled()) {
              var changed = ensureStemReachesMiddleLine(this, extents);
              if (changed) {
                extents = originalGetStemExtents.call(this);
              }
            }
            return extents;
          };
          noteProto.__standardStemRulesExtentsPatched = true;
          patchedAny = true;
        }

        if (!noteProto.__standardStemRulesPostFormatPatched && typeof noteProto.postFormat === 'function') {
          var originalNotePostFormat = noteProto.postFormat;
          noteProto.postFormat = function patchedNotePostFormat() {
            var res = originalNotePostFormat.call(this);
            if (isRuleEnabled() && !this.beam && typeof this.getStemExtents === 'function') {
              this.getStemExtents();
            }
            return res;
          };
          noteProto.__standardStemRulesPostFormatPatched = true;
          patchedAny = true;
        }
      });
    }

    return patchedAny;
  }

  function installStandardStemRulesPatch(vexOrFlow, options) {
    var flow = resolveFlow(vexOrFlow);
    if (!flow) {
      throw new Error(
        "installStandardStemRulesPatch: couldn't resolve VexFlow Flow namespace."
      );
    }

    var beamProto = flow.Beam && flow.Beam.prototype;
    if (!beamProto) {
      throw new Error('installStandardStemRulesPatch: missing Beam prototype.');
    }

    return installPatchOnTargets({
      beamPrototype: beamProto,
      notePrototypes: collectNotePrototypesFromFlow(flow),
      stemUp: flow.Stem && flow.Stem.UP,
      stemDown: flow.Stem && flow.Stem.DOWN,
    }, options || {});
  }

  function addMaybeVfNote(candidate, out) {
    if (!candidate) {
      return;
    }
    if (Array.isArray(candidate)) {
      for (var i = 0; i < candidate.length; i += 1) {
        addMaybeVfNote(candidate[i], out);
      }
      return;
    }
    if (typeof candidate !== 'object') {
      return;
    }
    if (
      typeof candidate.postFormat === 'function' &&
      (typeof candidate.getStemExtents === 'function' || typeof candidate.getStemDirection === 'function')
    ) {
      out.push(candidate);
    }
  }

  function collectTargetsFromOsmdInstance(osmdInstance) {
    if (!osmdInstance || !osmdInstance.GraphicSheet) {
      return null;
    }

    var measureList = osmdInstance.GraphicSheet.MeasureList;
    if (!Array.isArray(measureList)) {
      return null;
    }

    var notePrototypes = [];
    var seenNotePrototypes = [];
    var beamPrototype = null;
    var stemUp = Number.NaN;
    var stemDown = Number.NaN;

    function pushNotePrototype(proto) {
      if (!proto || seenNotePrototypes.indexOf(proto) >= 0) {
        return;
      }
      if (typeof proto.postFormat !== 'function') {
        return;
      }
      seenNotePrototypes.push(proto);
      notePrototypes.push(proto);
    }

    var done = false;
    for (var si = 0; si < measureList.length && !done; si += 1) {
      var systemMeasures = measureList[si];
      if (!Array.isArray(systemMeasures)) {
        continue;
      }

      for (var mi = 0; mi < systemMeasures.length && !done; mi += 1) {
        var graphicalMeasure = systemMeasures[mi];
        if (!graphicalMeasure || !Array.isArray(graphicalMeasure.staffEntries)) {
          continue;
        }

        for (var sei = 0; sei < graphicalMeasure.staffEntries.length && !done; sei += 1) {
          var staffEntry = graphicalMeasure.staffEntries[sei];
          var voiceEntries = staffEntry && staffEntry.graphicalVoiceEntries;
          if (!Array.isArray(voiceEntries)) {
            continue;
          }

          for (var vei = 0; vei < voiceEntries.length && !done; vei += 1) {
            var voiceEntry = voiceEntries[vei];
            var graphicalNotes = voiceEntry && voiceEntry.notes;
            if (!Array.isArray(graphicalNotes)) {
              continue;
            }

            for (var ni = 0; ni < graphicalNotes.length && !done; ni += 1) {
              var graphicalNote = graphicalNotes[ni];
              if (!graphicalNote) {
                continue;
              }

              var vfNotes = [];
              addMaybeVfNote(graphicalNote.vfnote, vfNotes);
              addMaybeVfNote(
                graphicalNote.parentVoiceEntry && graphicalNote.parentVoiceEntry.mVexFlowStaveNote,
                vfNotes
              );

              for (var vfi = 0; vfi < vfNotes.length; vfi += 1) {
                var vfNote = vfNotes[vfi];
                if (!vfNote) {
                  continue;
                }

                pushNotePrototype(Object.getPrototypeOf(vfNote));

                if (!beamPrototype && vfNote.beam && vfNote.beam.constructor) {
                  beamPrototype = vfNote.beam.constructor.prototype || null;
                }

                var stem = (typeof vfNote.getStem === 'function') ? vfNote.getStem() : vfNote.stem;
                if (stem && stem.constructor) {
                  if (!Number.isFinite(stemUp) && Number.isFinite(Number(stem.constructor.UP))) {
                    stemUp = Number(stem.constructor.UP);
                  }
                  if (!Number.isFinite(stemDown) && Number.isFinite(Number(stem.constructor.DOWN))) {
                    stemDown = Number(stem.constructor.DOWN);
                  }
                }

                if (notePrototypes.length >= 4 && beamPrototype && Number.isFinite(stemUp) && Number.isFinite(stemDown)) {
                  done = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (notePrototypes.length === 0 && !beamPrototype) {
      return null;
    }

    return {
      beamPrototype: beamPrototype,
      notePrototypes: notePrototypes,
      stemUp: stemUp,
      stemDown: stemDown,
    };
  }

  function ensureOsmdStemRulesPatchedFromInstance(osmdInstance, options) {
    var targets = collectTargetsFromOsmdInstance(osmdInstance);
    if (!targets) {
      return false;
    }
    return installPatchOnTargets(targets, options || {});
  }

  root.installStandardStemRulesPatch = installStandardStemRulesPatch;
  root.ensureOsmdStemRulesPatchedFromInstance = ensureOsmdStemRulesPatchedFromInstance;
})(typeof window !== 'undefined' ? window : globalThis);
