// Web Worker: runs timers without browser background-tab throttling.
var timers = {};

self.onmessage = function(e) {
  var d = e.data;
  if (d.type === 'setTimeout') {
    timers[d.id] = self.setTimeout(function() {
      delete timers[d.id];
      self.postMessage({ id: d.id });
    }, d.delay);
  } else if (d.type === 'setInterval') {
    timers[d.id] = self.setInterval(function() {
      self.postMessage({ id: d.id });
    }, d.delay);
  } else if (d.type === 'clear') {
    self.clearTimeout(timers[d.id]);
    self.clearInterval(timers[d.id]);
    delete timers[d.id];
  }
};
