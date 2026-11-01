// The snake game the quick exit turns into (owner decisions 2026-10-22, docs/plan-feathered-edition.md 4.5), drawn as a modern phone game (owner's
// request 2026-10-26): a smooth, glowing snake that glides between squares, food that bobs and sparkles, a little burst and "+1" when it eats, a shake
// when it crashes, and a game-over sheet. It eats a key or a flame (or, in the plain look, an apple or a berry). The way back to the app is the
// high-score name: the server unlocks when it is the account's password and otherwise treats it as a name. Names are never kept, and the table shows
// only their first three letters, arcade style, so a mistyped password is never shown whole. Plain script, no imports, no outgoing request.
(function () {
  "use strict";

  var SIZE = 15;
  var START_MS = 140;
  var FASTEST_MS = 75;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  var KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  };

  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var look = "hekate";
  try {
    if (window.localStorage.getItem("ds-snake-look") === "plain") look = "plain";
  } catch (e) {
    // A browser that keeps nothing still plays.
  }

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var wrapEl = document.getElementById("board-wrap");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var hint = document.getElementById("hint");
  var hintTitle = hint.querySelector(".hint-title");
  var hintText = document.getElementById("hint-text");
  var over = document.getElementById("over");
  var badge = document.getElementById("badge");
  var finalEl = document.getElementById("final");
  var form = document.getElementById("name-form");
  var nameInput = document.getElementById("name");
  var table = document.getElementById("table");
  var again = document.getElementById("again");
  var said = document.getElementById("said");

  // A few friendly names already on the table, so a new one sits among others.
  var scores = [{ n: "OWL", s: 12 }, { n: "CAT", s: 7 }, { n: "DOG", s: 4 }];
  var best = 0;
  var mine = null;

  var snake, prev, dir, nextDir, queued, food, foodKind, foodBorn, score, timer, running, ended, lastStep, stepMs, blinkUntil, nextBlink, tongueUntil;
  var sparks = [];
  var pops = [];
  var colours = {};

  function readColours() {
    var s = getComputedStyle(document.documentElement);
    ["--snake-head", "--snake-tail", "--eye", "--pupil", "--cheek", "--tongue", "--gold", "--flame", "--flame-core", "--apple", "--leaf", "--berry",
      "--spark", "--tile-a", "--tile-b", "--board", "--ink"].forEach(function (name) {
      colours[name.slice(2)] = s.getPropertyValue(name).trim();
    });
  }

  function fit() {
    var px = canvas.clientWidth;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(px * ratio);
    canvas.height = Math.round(px * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(performance.now());
  }

  function cell() {
    return canvas.clientWidth / SIZE;
  }

  function reset() {
    var mid = Math.floor(SIZE / 2);
    snake = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
    prev = snake.map(function (p) { return p.slice(); });
    dir = "right";
    nextDir = "right";
    queued = null;
    score = 0;
    ended = false;
    running = false;
    stepMs = START_MS;
    lastStep = performance.now();
    blinkUntil = 0;
    tongueUntil = 0;
    nextBlink = Date.now() + 2500;
    sparks = [];
    pops = [];
    mine = null;
    scoreEl.textContent = "0";
    placeFood();
    hintTitle.textContent = "Tap to play";
    hintText.textContent = "Swipe, use the arrows below, or press an arrow key";
    hint.hidden = false;
    over.hidden = true;
  }

  function placeFood() {
    var free = [];
    for (var x = 0; x < SIZE; x++) {
      for (var y = 0; y < SIZE; y++) {
        if (!snake.some(function (p) { return p[0] === x && p[1] === y; })) free.push([x, y]);
      }
    }
    food = free[Math.floor(Math.random() * free.length)];
    foodKind = Math.random() < 0.5 ? 0 : 1;
    foodBorn = performance.now();
  }

  function speed() {
    return Math.max(FASTEST_MS, START_MS - score * 3);
  }

  function start() {
    if (running || ended) return;
    running = true;
    hint.hidden = true;
    lastStep = performance.now();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    stepMs = speed();
    timer = setTimeout(step, stepMs);
  }

  // A second quick turn waits for the next step, so two fast swipes (up, then left) both count.
  function turn(d) {
    if (ended) return;
    if (!running) start();
    if (nextDir !== dir) {
      if (d !== nextDir && d !== OPPOSITE[nextDir]) queued = d;
      return;
    }
    if (d !== OPPOSITE[dir]) nextDir = d;
  }

  function buzz(ms) {
    if (calm || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) { /* not every browser lets a page buzz */ }
  }

  function step() {
    if (!running) return;
    dir = nextDir;
    if (queued) {
      nextDir = queued;
      queued = null;
    }
    var head = snake[0];
    var nx = head[0] + DIRS[dir][0];
    var ny = head[1] + DIRS[dir][1];
    var hitsWall = nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE;
    var eats = food && nx === food[0] && ny === food[1];
    var body = eats ? snake : snake.slice(0, -1);
    var hitsSelf = body.some(function (p) { return p[0] === nx && p[1] === ny; });
    if (hitsWall || hitsSelf) return end();
    prev = snake.map(function (p) { return p.slice(); });
    snake.unshift([nx, ny]);
    if (eats) {
      score += 1;
      scoreEl.textContent = String(score);
      bump(scoreEl);
      celebrate(nx, ny);
      buzz(12);
      placeFood();
    } else {
      snake.pop();
    }
    lastStep = performance.now();
    if (Math.random() < 0.06) tongueUntil = Date.now() + 300;
    schedule();
  }

  function bump(el) {
    if (calm) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function celebrate(x, y) {
    if (calm) return;
    var c = cell();
    var cx = (x + 0.5) * c;
    var cy = (y + 0.5) * c;
    var tint = look === "plain" ? (foodKind ? colours.berry : colours.apple) : (foodKind ? colours.flame : colours.gold);
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = c * (0.04 + Math.random() * 0.08);
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: c * (0.05 + Math.random() * 0.07), color: i % 3 ? tint : colours.spark });
    }
    pops.push({ x: cx, y: cy - c * 0.3, life: 1 });
  }

  function end() {
    running = false;
    ended = true;
    clearTimeout(timer);
    buzz([30, 40, 60]);
    if (!calm) {
      wrapEl.classList.remove("shake");
      void wrapEl.offsetWidth;
      wrapEl.classList.add("shake");
    }
    var newBest = score > best && score > 0;
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      bump(bestEl);
    }
    badge.hidden = !newBest;
    finalEl.textContent = String(score);
    document.getElementById("final-label").textContent = score === 1 ? "point" : "points";
    said.textContent = "Round over. You scored " + score + "." + (newBest ? " A new best." : "");
    // A moment to see the crash before the sheet rises.
    setTimeout(function () {
      over.hidden = false;
      renderTable();
      nameInput.value = "";
      nameInput.focus();
    }, calm ? 0 : 550);
  }

  function renderTable() {
    var sorted = scores.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 5);
    table.textContent = "";
    sorted.forEach(function (row, i) {
      var li = document.createElement("li");
      if (row === mine) li.className = "mine";
      var rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = String(i + 1);
      var who = document.createElement("span");
      who.className = "who";
      who.textContent = row.n;
      var pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = String(row.s);
      li.appendChild(rank);
      li.appendChild(who);
      li.appendChild(pts);
      table.appendChild(li);
    });
  }

  /** Arcade initials: the first three letters or numbers, so a whole name is never shown. */
  function initials(name) {
    var letters = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
    return letters || "???";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput.value;
    nameInput.value = "";
    if (!name.trim()) return;
    var shown = { n: initials(name), s: score };
    fetch("/api/snake/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name }),
    })
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; })
      .then(function (answer) {
        if (answer && typeof answer.to === "string" && answer.to.charAt(0) === "/" && answer.to.charAt(1) !== "/") {
          window.location.replace(answer.to);
          return;
        }
        scores.push(shown);
        mine = shown;
        renderTable();
        said.textContent = "Saved to the table.";
        again.focus();
      });
  });

  again.addEventListener("click", function () {
    reset();
    canvas.focus();
  });

  // ---- drawing ---------------------------------------------------------------------------------------------------------------------------

  function dot(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mix(a, b, t) {
    var pa = parse(a);
    var pb = parse(b);
    if (!pa || !pb) return a;
    return "rgb(" + Math.round(pa[0] + (pb[0] - pa[0]) * t) + "," + Math.round(pa[1] + (pb[1] - pa[1]) * t) + "," + Math.round(pa[2] + (pb[2] - pa[2]) * t) + ")";
  }

  /** The same colour at another opacity, so a glow fades to nothing rather than to grey. */
  function fade(hex, alpha) {
    var p = parse(hex);
    return p ? "rgba(" + p[0] + "," + p[1] + "," + p[2] + "," + alpha + ")" : hex;
  }

  function parse(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function drawBoard(c, w) {
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = colours.board;
    ctx.fillRect(0, 0, w, w);
    for (var x = 0; x < SIZE; x++) {
      for (var y = 0; y < SIZE; y++) {
        ctx.fillStyle = (x + y) % 2 ? colours["tile-a"] : colours["tile-b"];
        roundRect(x * c + c * 0.06, y * c + c * 0.06, c * 0.88, c * 0.88, c * 0.22);
        ctx.fill();
      }
    }
  }

  function drawKey(cx, cy, c) {
    ctx.strokeStyle = colours.gold;
    ctx.lineWidth = c * 0.13;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx - c * 0.2, cy, c * 0.19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + c * 0.4, cy);
    ctx.moveTo(cx + c * 0.26, cy);
    ctx.lineTo(cx + c * 0.26, cy + c * 0.15);
    ctx.moveTo(cx + c * 0.4, cy);
    ctx.lineTo(cx + c * 0.4, cy + c * 0.18);
    ctx.stroke();
  }

  function drop(cx, cy, w, h, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.bezierCurveTo(cx + w, cy - h * 0.2, cx + w, cy + h * 0.6, cx, cy + h * 0.6);
    ctx.bezierCurveTo(cx - w, cy + h * 0.6, cx - w, cy - h * 0.2, cx, cy - h);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawFlame(cx, cy, c, now) {
    var flick = calm ? 1 : 1 + Math.sin(now / 90) * 0.06;
    drop(cx, cy + c * 0.04, c * 0.4 * flick, c * 0.46 * flick, colours.flame);
    drop(cx, cy + c * 0.12, c * 0.2, c * 0.22, colours["flame-core"]);
  }

  function drawApple(cx, cy, c) {
    dot(cx, cy + c * 0.04, c * 0.34, colours.apple);
    dot(cx - c * 0.1, cy - c * 0.06, c * 0.08, "rgba(255,255,255,0.45)");
    ctx.beginPath();
    ctx.ellipse(cx + c * 0.1, cy - c * 0.28, c * 0.12, c * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = colours.leaf;
    ctx.fill();
  }

  function drawBerry(cx, cy, c) {
    dot(cx - c * 0.12, cy + c * 0.06, c * 0.15, colours.berry);
    dot(cx + c * 0.12, cy + c * 0.06, c * 0.15, colours.berry);
    dot(cx, cy - c * 0.12, c * 0.15, colours.berry);
    dot(cx - c * 0.04, cy - c * 0.16, c * 0.04, "rgba(255,255,255,0.5)");
  }

  function drawFood(c, now) {
    if (!food) return;
    var cx = (food[0] + 0.5) * c;
    var bob = calm ? 0 : Math.sin(now / 260) * c * 0.06;
    var cy = (food[1] + 0.5) * c + bob;
    var born = calm ? 1 : Math.min(1, (now - foodBorn) / 220);
    var grow = born < 1 ? 0.4 + 0.6 * (1 - Math.pow(1 - born, 3)) * 1.08 : 1;
    var tint = look === "plain" ? (foodKind ? colours.berry : colours.apple) : (foodKind ? colours.flame : colours.gold);
    // A soft glow under it.
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c * 0.75);
    g.addColorStop(0, fade(tint, 1));
    g.addColorStop(1, fade(tint, 0));
    ctx.globalAlpha = 0.35 + (calm ? 0 : Math.sin(now / 300) * 0.1);
    ctx.fillStyle = g;
    ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(grow, grow);
    if (look === "plain") foodKind ? drawBerry(0, 0, c) : drawApple(0, 0, c);
    else foodKind ? drawFlame(0, 0, c, now) : drawKey(0, 0, c);
    ctx.restore();
  }

  /** Where segment i is drawn this frame: part way from where it was to where it is, so the snake glides. */
  function at(i, t, c) {
    var to = snake[i];
    var from = prev[i] || prev[prev.length - 1] || to;
    return [(from[0] + (to[0] - from[0]) * t + 0.5) * c, (from[1] + (to[1] - from[1]) * t + 0.5) * c];
  }

  function drawSnake(c, now, t) {
    var n = snake.length;
    var pts = [];
    for (var i = 0; i < n; i++) pts.push(at(i, t, c));
    // The tail end eases in, so the last piece does not jump when the snake grows.
    var width = c * 0.74;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // A soft shadow under the whole body.
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(function (p, k) { if (k === 0) ctx.moveTo(p[0], p[1] + c * 0.08); else ctx.lineTo(p[0], p[1] + c * 0.08); });
    ctx.stroke();
    // The body, tail to head, each piece a little closer to the head's colour.
    for (var k = n - 1; k >= 1; k--) {
      var frac = k / Math.max(1, n - 1);
      ctx.strokeStyle = mix(colours["snake-head"], colours["snake-tail"], frac);
      ctx.lineWidth = width * (1 - frac * 0.25);
      ctx.beginPath();
      ctx.moveTo(pts[k][0], pts[k][1]);
      ctx.lineTo(pts[k - 1][0], pts[k - 1][1]);
      ctx.stroke();
    }
    // A shine along the top of the body.
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = width * 0.22;
    ctx.beginPath();
    pts.forEach(function (p, k) { if (k === 0) ctx.moveTo(p[0] - c * 0.08, p[1] - c * 0.12); else ctx.lineTo(p[0] - c * 0.08, p[1] - c * 0.12); });
    ctx.stroke();

    var hx = pts[0][0];
    var hy = pts[0][1];
    var d = DIRS[dir];
    var side = [-d[1], d[0]];
    dot(hx, hy, c * 0.44, colours["snake-head"]);
    // A tongue, now and then.
    if (!calm && now < tongueUntil && !ended) {
      ctx.strokeStyle = colours.tongue;
      ctx.lineWidth = c * 0.06;
      ctx.beginPath();
      var tx = hx + d[0] * c * 0.45;
      var ty = hy + d[1] * c * 0.45;
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + d[0] * c * 0.2, ty + d[1] * c * 0.2);
      ctx.moveTo(tx + d[0] * c * 0.2, ty + d[1] * c * 0.2);
      ctx.lineTo(tx + d[0] * c * 0.28 + side[0] * c * 0.07, ty + d[1] * c * 0.28 + side[1] * c * 0.07);
      ctx.moveTo(tx + d[0] * c * 0.2, ty + d[1] * c * 0.2);
      ctx.lineTo(tx + d[0] * c * 0.28 - side[0] * c * 0.07, ty + d[1] * c * 0.28 - side[1] * c * 0.07);
      ctx.stroke();
    }
    // Two eyes looking the way it goes, and rosy cheeks. Crossed out after a crash.
    var ex = hx + d[0] * c * 0.12;
    var ey = hy + d[1] * c * 0.12;
    var blink = !calm && now < blinkUntil;
    [-1, 1].forEach(function (s) {
      var x = ex + side[0] * c * 0.19 * s;
      var y = ey + side[1] * c * 0.19 * s;
      if (ended) {
        ctx.strokeStyle = colours.pupil;
        ctx.lineWidth = c * 0.06;
        ctx.beginPath();
        ctx.moveTo(x - c * 0.07, y - c * 0.07);
        ctx.lineTo(x + c * 0.07, y + c * 0.07);
        ctx.moveTo(x + c * 0.07, y - c * 0.07);
        ctx.lineTo(x - c * 0.07, y + c * 0.07);
        ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle = colours.pupil;
        ctx.lineWidth = c * 0.06;
        ctx.beginPath();
        ctx.moveTo(x - c * 0.07, y);
        ctx.lineTo(x + c * 0.07, y);
        ctx.stroke();
      } else {
        dot(x, y, c * 0.12, colours.eye);
        dot(x + d[0] * c * 0.035, y + d[1] * c * 0.035, c * 0.065, colours.pupil);
        dot(x + d[0] * c * 0.01 - c * 0.03, y + d[1] * c * 0.01 - c * 0.03, c * 0.025, colours.eye);
      }
      dot(hx - d[0] * c * 0.08 + side[0] * c * 0.3 * s, hy - d[1] * c * 0.08 + side[1] * c * 0.3 * s, c * 0.065, colours.cheek);
    });
  }

  function drawEffects(c) {
    sparks = sparks.filter(function (p) { return p.life > 0; });
    sparks.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= 0.035;
      ctx.globalAlpha = Math.max(0, p.life);
      dot(p.x, p.y, p.r * (0.5 + p.life * 0.5), p.color);
    });
    pops = pops.filter(function (p) { return p.life > 0; });
    pops.forEach(function (p) {
      p.y -= c * 0.025;
      p.life -= 0.025;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = colours.ink;
      ctx.font = "900 " + Math.round(c * 0.6) + "px ui-rounded, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+1", p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!snake) return;
    var c = cell();
    var w = canvas.clientWidth;
    var t = calm || !running ? 1 : Math.min(1, (now - lastStep) / stepMs);
    if (!calm && Date.now() > nextBlink) {
      blinkUntil = Date.now() + 160;
      nextBlink = Date.now() + 2500 + Math.random() * 3000;
    }
    drawBoard(c, w);
    drawFood(c, now);
    drawSnake(c, Date.now(), t);
    drawEffects(c);
  }

  function frame(now) {
    draw(now);
    window.requestAnimationFrame(frame);
  }

  // ---- controls --------------------------------------------------------------------------------------------------------------------------

  canvas.tabIndex = 0;
  document.addEventListener("keydown", function (e) {
    if (e.target === nameInput) return;
    var d = KEYS[e.key];
    if (d) {
      e.preventDefault();
      turn(d);
      var key = document.querySelector('.key[data-dir="' + d + '"]');
      if (key) {
        key.classList.add("pressed");
        setTimeout(function () { key.classList.remove("pressed"); }, 120);
      }
    } else if ((e.key === " " || e.key === "p" || e.key === "P") && !ended) {
      e.preventDefault();
      if (running) {
        running = false;
        clearTimeout(timer);
        hintTitle.textContent = "Paused";
        hintText.textContent = "Press an arrow key, or tap, to go on";
        hint.hidden = false;
      } else {
        start();
      }
    }
  });

  // On a touch screen the turn happens on touch-down, which feels quicker than waiting for the click; the click that follows is then ignored.
  var touchedAt = 0;
  Array.prototype.forEach.call(document.querySelectorAll(".key"), function (btn) {
    btn.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      touchedAt = Date.now();
      turn(btn.getAttribute("data-dir"));
      buzz(5);
    });
    btn.addEventListener("click", function () {
      if (Date.now() - touchedAt < 600) return;
      turn(btn.getAttribute("data-dir"));
    });
  });

  // Swipes anywhere on the board turn the snake as soon as the finger has moved far enough.
  var touch = null;
  canvas.addEventListener("pointerdown", function (e) {
    touch = [e.clientX, e.clientY];
    if (!running && !ended) start();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!touch) return;
    var dx = e.clientX - touch[0];
    var dy = e.clientY - touch[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touch = [e.clientX, e.clientY];
  });
  canvas.addEventListener("pointerup", function () { touch = null; });
  canvas.addEventListener("pointercancel", function () { touch = null; });

  if (window.matchMedia) {
    var scheme = window.matchMedia("(prefers-color-scheme: light)");
    if (scheme.addEventListener) scheme.addEventListener("change", readColours);
  }
  window.addEventListener("resize", fit);
  readColours();
  reset();
  fit();
  window.requestAnimationFrame(frame);
})();
