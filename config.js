var SCORE_FILE = '/dongiovanni.mxl';
// Score loop mode when the snake head exceeds the score length.
// 'wrap'      - modulo: score restarts from the beginning
// 'palindrome' - bounce: score walks back to the start, then forward again
var SCORE_LOOP_MODE = 'wrap';

// BPM levels mapped to the in-game tempo control (index 0 = slowest).
var TEMPO_TABLE_BPM = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

// Minimum transposition in semitones.
// The active range is [TRANSPOSE_MIN, TRANSPOSE_MIN + hueBins] where hueBins
// is determined by the snake game (currently 12).
// Example: TRANSPOSE_MIN = -6 → range [-6, +6] with 12 bins
//          TRANSPOSE_MIN =  0 → range [ 0, +12] with 12 bins
var TRANSPOSE_MIN = -2;

// Shared startup defaults for v7 score/conductor clients and room tempo state.
// tempoControlIndex is a 0-based index into TEMPO_TABLE_BPM.
var SCORE_STARTUP_DEFAULTS = {
  fromQuarter: 0,
  autoFromQuarterEnabled: true,
  transposeSemitones: 0,
  autoTransposeEnabled: false,
  numQuarters: 6,
  autoNumQuartersEnabled: true,
  tempoControlIndex: 4, // TEMPO_TABLE_BPM[4] = 60 with the current table.
  autoTempoEnabled: false,
};

// Export for Node.js (server2.js); ignored by browsers.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEMPO_TABLE_BPM: TEMPO_TABLE_BPM,
    TRANSPOSE_MIN: TRANSPOSE_MIN,
    SCORE_STARTUP_DEFAULTS: SCORE_STARTUP_DEFAULTS,
  };
}
