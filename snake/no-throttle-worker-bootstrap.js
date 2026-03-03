// Bootstraps a Web Worker that drives all timers, bypassing background-tab
// throttling that browsers apply to requestAnimationFrame / setTimeout /
// setInterval on hidden tabs.
(function () {
  var worker = new Worker('no-throttle-worker.js');
  var idSeq = 0;
  var callbacks = {}; // id -> { fn, repeat }

  worker.onmessage = function (e) {
    var entry = callbacks[e.data.id];
    if (!entry) return;
    if (!entry.repeat) delete callbacks[e.data.id];
    entry.fn();
  };

  function _setTimeout(fn, delay) {
    var id = ++idSeq;
    callbacks[id] = { fn: fn, repeat: false };
    worker.postMessage({ type: 'setTimeout', id: id, delay: delay || 0 });
    return id;
  }

  function _clearTimeout(id) {
    delete callbacks[id];
    worker.postMessage({ type: 'clear', id: id });
  }

  function _setInterval(fn, delay) {
    var id = ++idSeq;
    callbacks[id] = { fn: fn, repeat: true };
    worker.postMessage({ type: 'setInterval', id: id, delay: delay || 0 });
    return id;
  }

  function _clearInterval(id) {
    delete callbacks[id];
    worker.postMessage({ type: 'clear', id: id });
  }

  // rAF targets 60 fps; route through the worker so it isn't frozen in bg tabs
  function _requestAnimationFrame(fn) {
    return _setTimeout(fn, 1000 / 60);
  }

  function _cancelAnimationFrame(id) {
    _clearTimeout(id);
  }

  window.setTimeout              = _setTimeout;
  window.clearTimeout            = _clearTimeout;
  window.setInterval             = _setInterval;
  window.clearInterval           = _clearInterval;
  window.requestAnimationFrame   = _requestAnimationFrame;
  window.cancelAnimationFrame    = _cancelAnimationFrame;
})();
