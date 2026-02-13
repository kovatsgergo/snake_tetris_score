VF = Vex.Flow;

const fontStacks = {
  Bravura: [VF.Fonts.Bravura, VF.Fonts.Gonville, VF.Fonts.Custom],
  Gonville: [VF.Fonts.Gonville, VF.Fonts.Bravura, VF.Fonts.Custom],
  Petaluma: [VF.Fonts.Petaluma, VF.Fonts.Gonville, VF.Fonts.Custom],
}

VF.DEFAULT_FONT_STACK = fontStacks['Petaluma'];
const full_Width = 901;
const full_Height = 375;
const scale_Width = 500;
const scale_Height = 200;
const horiz_Padding = 50;
const dynamics_Height = 50;
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
var tempo = 0.66666;
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

document.getElementById("dynCanvas").getContext("2d").font = "40px Petaluma";

function clearScore() {
  renderer.ctx.svg.remove();

  renderer = new VF.Renderer(scoreElement, VF.Renderer.Backends.SVG);
  // Configure the rendering context.
  renderer.resize(full_Width, full_Height);
  context = renderer.getContext()
    .setFont("Arial", 10, "");

  if (instrument.bass) {
    //staveBass = new VF.Stave(0, scale_Height - 70, full_Width - 1);
    //staveBass.addClef("treble");
    //staveBass.setContext(context).draw();

    //var c = document.getElementById("score");
    //var ctx = c.getContext("2d");
    //renderer.ctx.fillText("15", 7, 165);

    staveBass = new VF.Stave(0, scale_Height + 60, full_Width - 1);
    staveBass.addClef("bass");
    staveBass.setContext(context).draw();
  }

  if (instrument.violin) {
    staveMain = new VF.Stave(0, scale_Height, full_Width - 1);
    staveMain.addClef("treble");
    staveMain.setContext(context).draw();
  }

  // Create scale part
  staveScale = new VF.Stave(0, -20, scale_Width - 1);
  allNotes.forEach((element, i) => {
    element.setStyle({
      fillStyle: propabilityToColor(notemap[i]) //"rgba(0, 0, 0, " + notemap[i] + ")"
    });
    element.setLedgerLineStyle({
      strokeStyle: propabilityToColor(notemap[i])
    });
  });
  staveScale.setContext(context).draw();
  voiceScale.draw(context, staveScale);

  // Create rhythm part
  staveRhythm = new VF.Stave(scale_Width + horiz_Padding, -20, rhythm_Width - 1);
  var rhythms = rhythm.map(number => {
    return numberToRhythm(number);
  });
  voiceRhythm = new VF.Voice({
    num_beats: 2,
    beat_value: 1
  });
  voiceRhythm.mode = VF.Voice.Mode.SOFT;
  voiceRhythm.addTickables(rhythms);
  formatter = new VF.Formatter().joinVoices([voiceRhythm]).format([voiceRhythm], rhythm_Width);
  voiceRhythm.draw(context, staveRhythm);

}


//TEMPO
function setTempo(t) {
  tempo = Number(t) * 0.25 + 0.25;
  //console.log('tempo = ' + tempo);
}

//EATEN FOOD
function setEaten(message) {
  eaten = message.split(" ");
}

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
  clearTimeout(playbarTimeout);

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
  const group = context.openGroup();
  context.beginPath();
  context.moveTo(startX, scale_Height - 100);
  context.lineTo(startX, scale_Height + 200);
  context.stroke();
  context.closeGroup();

  //group.classList.remove('scroll');
  const box = group.getBoundingClientRect();
  group.classList.add('scroll');

  var x = snake.length / (tempo * 2);
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
    var red = Math.min(Math.max(d - 5, 0), 5) * 60;
    var green = (Math.min(4 - Math.max(Math.abs(4 - d), 0), 4)) * 60;
    var blue = (Math.min(Math.max(5 - d, 0), 4)) * 60;
    var col = 'rgb(' + red + ', ' +
      green + ', ' +
      blue + ')';
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
  ctx.font = "40px Petaluma";
  ctx.textBaseline = "middle";
  var noteWidth = (full_Width - xs[0]) / dynamics.length;
  var y = dynamics_Height * 0.666;
  dynamics.forEach((d, i) => {
    var dyn = Math.max(Math.min(9, d), 0);
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