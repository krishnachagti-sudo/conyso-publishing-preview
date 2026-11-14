/* Conyso Publishing: guess first, then the verdict.
   Without JS every answer is visible and the buttons are hidden (publishing.css).
   With JS the reveal waits for a guess. Guesses stay in this browser only. */
(function () {
  var WORD = { TRUE: 'True', FOLKLORE: 'Folklore', DISPUTED: 'Disputed' };
  function load(id) { try { return JSON.parse(localStorage.getItem('tf:' + id) || 'null'); } catch (e) { return null; } }
  function save(id, v) { try { localStorage.setItem('tf:' + id, JSON.stringify(v)); } catch (e) {} }

  function score() {
    var right = 0, done = 0, seen = {};
    document.querySelectorAll('.tf-play[data-guessed]').forEach(function (p) {
      var id = p.getAttribute('data-id');
      if (seen[id]) return;
      seen[id] = 1; done++;
      if (p.getAttribute('data-guessed') === p.getAttribute('data-v')) right++;
    });
    if (!done) return;
    document.querySelectorAll('[data-score]').forEach(function (b) { b.textContent = right + ' of ' + done; });
    document.querySelectorAll('.tf-score-hint').forEach(function (h) { h.textContent = 'right so far'; });
  }

  function reveal(p, guess, sure, restored) {
    var v = p.getAttribute('data-v');
    p.classList.add('done');
    var res = p.querySelector('.tf-result');
    if (guess) {
      p.setAttribute('data-guessed', guess);
      var b = p.querySelector('[data-guess="' + guess + '"]');
      if (b) b.classList.add(guess === v ? 'is-right' : 'is-wrong');
      var msg = guess === v
        ? (restored ? 'You called it ' + WORD[guess] + '. Right.' : 'Right. It is ' + WORD[v] + '.')
        : 'You said ' + WORD[guess] + '. The record says ' + WORD[v] + '.';
      if (guess !== v && sure === true) msg += ' A confident miss: those are the ones that stick.';
      if (res) { res.textContent = msg; res.className = 'tf-result ' + (guess === v ? 'is-right' : 'is-wrong'); }
    } else if (res) {
      res.textContent = '';
    }
    p.querySelectorAll('[data-guess]').forEach(function (x) { x.disabled = true; });
    score();
  }

  document.querySelectorAll('.tf-play').forEach(function (p) {
    var id = p.getAttribute('data-id'), sure = null;
    p.querySelectorAll('[data-sure]').forEach(function (b) {
      b.addEventListener('click', function () {
        sure = b.getAttribute('data-sure') === '1';
        p.querySelectorAll('[data-sure]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
    p.querySelectorAll('[data-guess]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (p.classList.contains('done')) return;
        var g = b.getAttribute('data-guess');
        save(id, { g: g, sure: sure });
        // the same story can sit twice on a page (hub hero and round wall)
        document.querySelectorAll('.tf-play[data-id="' + id + '"]').forEach(function (q) {
          if (!q.classList.contains('done')) reveal(q, g, sure, q !== p);
        });
      });
    });
    var skip = p.querySelector('.tf-skip');
    if (skip) skip.addEventListener('click', function () { reveal(p, null, null, false); });
    var prev = load(id);
    if (prev && prev.g) reveal(p, prev.g, prev.sure, true);
  });
  score();

  document.querySelectorAll('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () { window.print(); });
  });

  document.querySelectorAll('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.href.split('#')[0], title = b.getAttribute('data-title') || document.title;
      if (navigator.share) { navigator.share({ title: title, text: title + ' True, folklore or disputed?', url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
        var ok = document.querySelector('[data-share-ok]'); if (ok) { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2500); }
      });
    });
  });
})();
