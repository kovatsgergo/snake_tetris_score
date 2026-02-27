var SCORE_FILE = '/dongiovanni.mxl';
// Score loop mode when the snake head exceeds the score length.
// 'wrap'      - modulo: score restarts from the beginning
// 'palindrome' - bounce: score walks back to the start, then forward again
var SCORE_LOOP_MODE = 'wrap';

// BPM levels mapped to the in-game tempo control (index 0 = slowest).
var TEMPO_TABLE_BPM = [50, 65, 85, 110];

// Minimum transposition in semitones.
// The active range is [TRANSPOSE_MIN, TRANSPOSE_MIN + hueBins] where hueBins
// is determined by the snake game (currently 12).
// Example: TRANSPOSE_MIN = -6 → range [-6, +6] with 12 bins
//          TRANSPOSE_MIN =  0 → range [ 0, +12] with 12 bins
var TRANSPOSE_MIN = -6;

// Export for Node.js (server2.js); ignored by browsers.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEMPO_TABLE_BPM: TEMPO_TABLE_BPM, TRANSPOSE_MIN: TRANSPOSE_MIN };
}
