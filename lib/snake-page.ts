// The snake game's page (owner decisions 2026-10-22, docs/plan-feathered-edition.md 4.5): what the tab shows after the quick exit. It is a whole document of
// its own, not a page of the app, so none of the app's header, navigation, footer, title or icon is there to give it away. The game itself is
// public/snake/game.js and its look public/snake/game.css; both come from this same server, so the page makes no outgoing request.
// Pure, so the tests can read what it sends.

/** A small round green dot, drawn here, as the tab's icon in place of the app's. */
const ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#7fcfae"/></svg>');

/** The whole page. `nonce` is the one proxy.ts made for this request (lib/csp.ts); the game's script carries it. */
export function snakePage(nonce: string): string {
  const n = nonce.replace(/[^A-Za-z0-9+/=]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#140f26">
<meta name="robots" content="noindex">
<title>Snake</title>
<link rel="icon" href="${ICON}">
<link rel="stylesheet" href="/snake/game.css">
</head>
<body>
<div class="glow glow-a" aria-hidden="true"></div>
<div class="glow glow-b" aria-hidden="true"></div>
<main class="wrap">
  <header class="top">
    <h1 class="title">Snake</h1>
    <div class="pills" aria-hidden="true">
      <p class="pill"><span class="pill-label">Score</span><span id="score" class="pill-value">0</span></p>
      <p class="pill pill-best"><span class="pill-label">Best</span><span id="best" class="pill-value">0</span></p>
    </div>
  </header>
  <div class="board-wrap" id="board-wrap">
    <canvas id="board" class="board" role="img" aria-label="Snake game board"></canvas>
    <div id="hint" class="hint">
      <p class="hint-title">Tap to play</p>
      <p id="hint-text" class="hint-text">Swipe, use the arrows below, or press an arrow key</p>
    </div>
  </div>
  <div class="pad" aria-label="Turn the snake">
    <button type="button" class="key up" data-dir="up" aria-label="Up"><span aria-hidden="true" class="chev"></span></button>
    <button type="button" class="key left" data-dir="left" aria-label="Left"><span aria-hidden="true" class="chev"></span></button>
    <button type="button" class="key right" data-dir="right" aria-label="Right"><span aria-hidden="true" class="chev"></span></button>
    <button type="button" class="key down" data-dir="down" aria-label="Down"><span aria-hidden="true" class="chev"></span></button>
  </div>
  <div id="over" class="over" hidden>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <p id="badge" class="badge" hidden>New best!</p>
      <h2 id="over-title" class="over-title">Game over</h2>
      <p class="final"><span id="final" class="final-score">0</span><span id="final-label" class="final-label">points</span></p>
      <form id="name-form" class="name-form" autocomplete="off">
        <label for="name" class="label">Name for the high-score table</label>
        <div class="name-row">
          <input id="name" name="name" class="name" type="text" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button type="submit" class="btn btn-soft">Save</button>
        </div>
      </form>
      <ol id="table" class="table" aria-label="High scores"></ol>
      <button type="button" id="again" class="btn btn-play">Play again</button>
    </section>
  </div>
  <p id="said" class="sr-only" aria-live="polite"></p>
</main>
<script nonce="${n}" src="/snake/game.js"></script>
</body>
</html>
`;
}
