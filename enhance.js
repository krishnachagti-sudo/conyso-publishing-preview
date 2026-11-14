/* Conyso enhance.js — sitewide motion & polish. Progressive enhancement: no JS = everything visible.
   All motion is gated by prefers-reduced-motion. */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1) Scroll-reveal for content BELOW the initial viewport only. Above-fold content renders
  //    instantly (no flash). Uses a throttled scroll sweep (not IntersectionObserver) so a fast
  //    fling can never leave a section stuck hidden. Marks targets via JS only — non-JS visitors
  //    see everything.
  //    Opt-in via body.cy-reveal-page — applied only to structurally-uniform content pages.
  //    Bespoke marketing pages (homepage, company pages) have their own cinematic layout and are
  //    deliberately excluded to avoid conflicts.
  if (!reduce && document.body.classList.contains("cy-reveal-page")) {
    docEl.classList.add("cy-js");
    var targets = document.querySelectorAll(
      "main > section, main > .cy-tool-cta, .article-body > h2, .article-body > .article-quote"
    );
    var pending = [];
    var fold0 = window.innerHeight * 0.85;
    Array.prototype.forEach.call(targets, function (el) {
      if (el.getBoundingClientRect().top < fold0) return; // already on screen: leave visible
      el.classList.add("cy-reveal");
      pending.push(el);
    });
    var last = 0;
    function sweep() {
      var fold = window.innerHeight * 0.92;
      for (var i = pending.length - 1; i >= 0; i--) {
        if (pending[i].getBoundingClientRect().top < fold) {
          pending[i].classList.add("cy-in");
          pending.splice(i, 1);
        }
      }
      if (!pending.length) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    }
    // Direct (rAF-free) throttle so a paused-rAF tab can never strand hidden content.
    function onScroll() {
      var now = (window.performance && performance.now) ? performance.now() : +new Date();
      if (now - last < 90) return;
      last = now;
      sweep();
    }
    if (pending.length) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      sweep(); // initial pass for anything sitting right at the fold
      // Safety net: if a visitor never scrolls (or scroll events misbehave), reveal everything
      // still pending after a few seconds so nothing can stay invisible.
      setTimeout(function () {
        for (var i = 0; i < pending.length; i++) pending[i].classList.add("cy-in");
        pending.length = 0;
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }, 4000);
    }
  }


  // 2b) Overlay header: solid once the hero photograph has scrolled past.
  //     The overlay variant carries light ink for the photo behind it. Sticky,
  //     it then sits over the paper ground where that ink measures about 1:1.
  //     Adding .is-solid past the hero hands it back to the page palette.
  (function () {
    var h = document.querySelector(".cy-header-overlay");
    if (!h) return;
    var hero = document.querySelector(".cy-hero-full, .cy-page-hero");
    var trigger = function () {
      return hero ? hero.offsetHeight - h.offsetHeight : 120;
    };
    var tick = function () {
      var solid = window.pageYOffset > trigger();
      h.classList.toggle("is-solid", solid);
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick, { passive: true });
  })();


  // 2c) Nav "More": keep aria-expanded truthful, and close on Escape.
  //     The panel opens from CSS on hover and focus-within, which is what makes
  //     it work without JS. This only reports the state a screen reader needs
  //     and gives keyboard users a way out, so the menu still works if this
  //     script never runs.
  (function () {
    var wrap = document.querySelector(".cy-nav-more");
    if (!wrap) return;
    var btn = wrap.querySelector(".cy-nav-more-trigger");
    var panel = wrap.querySelector(".cy-nav-dropdown");
    if (!btn || !panel) return;

    var open = function (state) {
      btn.setAttribute("aria-expanded", state ? "true" : "false");
    };
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      open(btn.getAttribute("aria-expanded") !== "true");
    });
    wrap.addEventListener("focusin", function () { open(true); });
    wrap.addEventListener("focusout", function () {
      // let focus land before deciding, or tabbing between links closes it
      window.setTimeout(function () {
        if (!wrap.contains(document.activeElement)) open(false);
      }, 0);
    });
    wrap.addEventListener("mouseenter", function () { open(true); });
    wrap.addEventListener("mouseleave", function () {
      if (!wrap.contains(document.activeElement)) open(false);
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
        open(false);
        btn.focus();
      }
    });
  })();


  // 2d) The one piece of motion that argues something.
  //     Everything else on this site earns its place: the copy argues, the
  //     evidence table argues, the names in the hero argue. Fading things up
  //     as they scroll does not, and a brand that says "deployed without
  //     ornament" should not decorate.
  //
  //     So the evidence block performs the check instead of describing it. The
  //     computed column resolves digit by digit, the reference column settles,
  //     and the match is marked only when the two strings are actually equal.
  //     If they ever disagree the mark does not appear, which is the same
  //     contract the build gate enforces.
  (function () {
    var fig = document.querySelector(".cy-evidence");
    if (!fig || !window.IntersectionObserver) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var rows = [].slice.call(fig.querySelectorAll("tbody tr"));
    if (!rows.length) return;

    var GLYPHS = "0123456789";
    var scramble = function (cell, done) {
      var target = cell.textContent;
      var chars = target.split("");
      // Driven by elapsed time, not by a frame count. A hidden or throttled tab
      // gets requestAnimationFrame at roughly 1fps, and a 16-frame counter then
      // takes 16 seconds, leaving unsettled digits on screen for the whole of
      // it. On wall clock the same tab finishes in one or two frames.
      var DURATION = 280;
      var began = (window.performance && performance.now) ? performance.now() : Date.now();
      // For the moment the digits are unsettled the cell's text is not the real
      // figure. Pin the accessible name to the true value first, so a screen
      // reader reading mid-resolve reads the published number and never a
      // random one. On a site whose claim is that the figures are checkable,
      // showing a reader a figure that is not the figure is the one failure
      // this effect must not have.
      cell.setAttribute("aria-label", target);
      cell.classList.add("is-resolving");
      var tick = function () {
        var now = (window.performance && performance.now) ? performance.now() : Date.now();
        var p = Math.min(1, (now - began) / DURATION);
        var settled = Math.floor(p * chars.length);
        cell.textContent = chars.map(function (c, i) {
          if (i < settled || !/\d/.test(c)) return c;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }).join("");
        if (p < 1) {
          window.requestAnimationFrame(tick);
        } else {
          cell.textContent = target;
          cell.removeAttribute("aria-label");
          cell.classList.remove("is-resolving");
          if (done) done();
        }
      };
      window.requestAnimationFrame(tick);
    };

    var run = function () {
      rows.forEach(function (tr, i) {
        var cells = tr.querySelectorAll("td");
        if (cells.length < 2) return;
        window.setTimeout(function () {
          scramble(cells[0], function () {
            // mark the match only when the two values genuinely agree
            if (cells[0].textContent.trim() === cells[1].textContent.trim()) {
              tr.classList.add("is-matched");
            }
          });
        }, i * 180);
      });
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(fig);
  })();

  // 2) Reading-progress bar (was dead — no driver). Drives width on scroll for article pages.
  var bar = document.querySelector(".reading-progress");
  if (bar) {
    var article = document.querySelector(".article-container, article, main");
    var tick = false;
    function update() {
      tick = false;
      var h = (article || document.body);
      var top = h.getBoundingClientRect().top + window.pageYOffset;
      var total = h.offsetHeight - window.innerHeight;
      var p = total > 0 ? (window.pageYOffset - top) / total : 0;
      p = Math.max(0, Math.min(1, p));
      bar.style.width = (p * 100).toFixed(2) + "%";
    }
    window.addEventListener("scroll", function () {
      if (!tick) { tick = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  // 3) Sitewide "real" motion: count-up stat numbers + staggered card reveals.
  //    Reduced-motion users get static content. Feature-gated on IntersectionObserver.
  if (!reduce && "IntersectionObserver" in window) {
    docEl.classList.add("cy-js");

    // 3a) Count-up numbers — static stat displays only, never live calculator outputs.
    var numEls = document.querySelectorAll(".cy-statstrip-n, .cs-stat .n, .cy-proof-n, [data-countup]");
    var numIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        numIO.unobserve(en.target);
        countUp(en.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(numEls, function (el) {
      if (/\d/.test(el.textContent)) numIO.observe(el);
    });
    function countUp(el) {
      var raw = el.textContent.trim();
      var m = raw.match(/^(\D*?)([\d,]*\.?\d+)(.*)$/);
      if (!m) return;
      var pre = m[1], numText = m[2], suf = m[3];
      var hasComma = numText.indexOf(",") > -1;
      var clean = numText.replace(/,/g, "");
      var target = parseFloat(clean);
      if (isNaN(target)) return;
      var dec = (clean.split(".")[1] || "").length;
      var dur = 1200, t0 = null;
      el.classList.add("cy-counting");
      function fmt(v) {
        var s = dec ? v.toFixed(dec) : String(Math.round(v));
        if (hasComma) s = Number(s).toLocaleString("en-US");
        return pre + s + suf;
      }
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(tick);
        else { el.textContent = raw; el.classList.remove("cy-counting"); }
      }
      el.textContent = fmt(0);
      requestAnimationFrame(tick);
    }

    // 3b) removed 2026-09-15. The staggered card reveal was already inert: a
    //     later rule set [data-reveal] to opacity 1 / transform none with
    //     !important, so nothing it marked ever animated. The loop still ran on
    //     every page, reading getBoundingClientRect for every card in every
    //     grid, to produce no visible result. Deleted rather than revived,
    //     because fading cards up as they scroll is decoration and this brand
    //     does not decorate.
  }

  // 3c) Hand-drawn SVG line-art draw-in, for any page that opts a stroke-only illustration in
  //     via .cy-illo-draw (none do yet — this is plumbing for future use, inert until adopted).
  //     Same recipe as Beacon Forge's bf-motion.js: measure each stroke, hide it, paint it back
  //     on when it scrolls into view. Gated on reduced-motion + IntersectionObserver; content is
  //     never left hidden if the observer never fires (safety-net timeout).
  if ("IntersectionObserver" in window) {
    var cyIllos = document.querySelectorAll(".cy-illo-draw");
    if (cyIllos.length) {
      var drawIn = function (svg, doReduce) {
        var parts = svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon");
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], len = p.getTotalLength ? p.getTotalLength() : 0;
          if (!len) continue;
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = doReduce ? 0 : len;
        }
        if (doReduce) return;
        for (var j = 0; j < parts.length; j++) {
          var q = parts[j];
          if (!(q.getTotalLength && q.getTotalLength())) continue;
          q.style.transition = "stroke-dashoffset 1s ease " + (j * 85) + "ms";
          q.style.strokeDashoffset = 0;
        }
      };
      Array.prototype.forEach.call(cyIllos, function (svg) { drawIn(svg, true); });
      if (!reduce) {
        var illoIO = new IntersectionObserver(function (ents) {
          ents.forEach(function (e) {
            if (e.isIntersecting) { drawIn(e.target, false); illoIO.unobserve(e.target); }
          });
        }, { threshold: 0.25 });
        Array.prototype.forEach.call(cyIllos, function (svg) { illoIO.observe(svg); });
        setTimeout(function () {
          Array.prototype.forEach.call(cyIllos, function (svg) {
            var parts = svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon");
            for (var k = 0; k < parts.length; k++) parts[k].style.strokeDashoffset = 0;
          });
        }, 2800);
      }
    }
  }

  // 4) Sitewide scroll-progress hairline (Forward motif). Injected once; gradient via CSS.
  if (!reduce) {
    var prog = document.createElement("div");
    prog.className = "cy-progress";
    prog.setAttribute("aria-hidden", "true");
    document.body.appendChild(prog);
    function progUpdate() {
      var de = document.documentElement;
      var max = de.scrollHeight - de.clientHeight;
      prog.style.transform = "scaleX(" + (max > 0 ? de.scrollTop / max : 0) + ")";
    }
    window.addEventListener("scroll", progUpdate, { passive: true });
    window.addEventListener("resize", progUpdate, { passive: true });
    progUpdate();
  }

  // 5) Footer notify capture. Config-driven, mirrors analytics.js: the markup ships on every
  //    page but stays hidden (dormant) until data/site.json's formspreeId is set and build.py
  //    rewrites the placeholder. No live ID -> the block never appears, never posts. When live,
  //    reveal it and submit over AJAX so the visitor stays on the page.
  var notify = document.getElementById("cy-notify");
  if (notify) {
    var nform = notify.querySelector("form");
    var dormant = !nform || nform.getAttribute("action").indexOf("YOUR_FORM_ID") !== -1;
    if (!dormant) {
      notify.hidden = false;
      nform.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var btn = nform.querySelector("button");
        if (btn) { btn.disabled = true; }
        fetch(nform.action, {
          method: "POST",
          body: new FormData(nform),
          headers: { "Accept": "application/json" }
        }).then(function (r) {
          if (r.ok) {
            notify.innerHTML = '<p class="cy-footer-notify-done">Thanks. You are on the list. We send at most one email a week.</p>';
          } else {
            if (btn) { btn.disabled = false; }
            nform.submit(); // fall back to a normal Formspree page post
          }
        }).catch(function () {
          if (btn) { btn.disabled = false; }
          nform.submit();
        });
      });
    }
  }

  /* PWA: register the service worker for offline support (installable app) */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  /* Live-viz motion: when a tool's calculator SVG redraws (its children change),
     replay a short settle animation so the update reads as something happening.
     Tools that animate via CSS transitions on stable elements (no child churn)
     are unaffected. Skipped under prefers-reduced-motion. */
  if ("MutationObserver" in window &&
      !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    var vizNodes = document.querySelectorAll('svg[id$="-curve"], svg[id$="-box"], #ds-lens, #cap-lens');
    for (var vi = 0; vi < vizNodes.length; vi++) {
      (function (node) {
        var mo = new MutationObserver(function () {
          node.classList.remove("cy-viz-in");
          void node.getBoundingClientRect();   // force reflow so the animation restarts
          node.classList.add("cy-viz-in");
        });
        mo.observe(node, { childList: true });
      })(vizNodes[vi]);
    }
  }

  /* 2e) The annual letter's contents marks where you are.
     A list of links that never says which one you are reading is a list of
     links. This sets is-here from the heading currently closest to the top of
     the viewport, so the gutter answers "where am I" without being asked. */
  (function letterContents() {
    var toc = document.querySelector(".cy-letter-toc");
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    if (!links.length) return;
    var targets = links.map(function (a) {
      return { link: a, el: document.getElementById(a.getAttribute("href").slice(1)) };
    }).filter(function (t) { return t.el; });
    if (!targets.length) return;

    var ticking = false;
    function mark() {
      ticking = false;
      var best = null, bestTop = Infinity;
      for (var i = 0; i < targets.length; i++) {
        var top = targets[i].el.getBoundingClientRect().top - 120;
        if (top <= 0 && Math.abs(top) < bestTop) { bestTop = Math.abs(top); best = targets[i]; }
      }
      if (!best) best = targets[0];
      for (var j = 0; j < targets.length; j++) {
        targets[j].link.classList.toggle("is-here", targets[j] === best);
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(mark);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // requestAnimationFrame is throttled in a background tab, so a tab that
    // returns can show a mark from wherever it was when it was hidden. Correct
    // on the way back rather than waiting for the next scroll.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) mark();
    });
    mark();
  })();

  // Phones: folds the reader opens. The FAQ answers, the footer's link
  // columns and the homepage's name directory each get a real button with
  // aria-expanded. The CSS only folds anything below 900px and only once the
  // cy-*-wired class is set here, so with no script, or on a desktop, every
  // word is on the page exactly as before.
  (function () {
    var wire = function (btn, target, onToggle) {
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        var open = !target.classList.contains("is-open");
        target.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (onToggle) { onToggle(open); }
      });
    };
    var qs = document.querySelectorAll(".cy-faq-q");
    var faqs = 0;
    Array.prototype.forEach.call(qs, function (q) {
      var a = q.nextElementSibling;
      if (!a || !a.classList.contains("cy-faq-a") || q.querySelector(".cy-faq-b")) { return; }
      var b = document.createElement("button");
      b.className = "cy-faq-b";
      while (q.firstChild) { b.appendChild(q.firstChild); }
      q.appendChild(b);
      wire(b, a);
      faqs++;
    });
    if (faqs) { docEl.classList.add("cy-faq-wired"); }

    var cols = document.querySelectorAll(".cy-footer-grand .cy-footer-col");
    Array.prototype.forEach.call(cols, function (col) {
      var h = col.querySelector(":scope > h3");
      if (!h || h.querySelector(".cy-foot-b")) { return; }
      var b = document.createElement("button");
      b.className = "cy-foot-b";
      while (h.firstChild) { b.appendChild(h.firstChild); }
      h.appendChild(b);
      wire(b, col);
    });
    if (cols.length) { docEl.classList.add("cy-foot-wired"); }

    // The homepage now ships its own button (see render_hero_names); only
    // build one here for a page that has the list without it.
    var names = document.querySelector(".cy-names");
    if (names && !document.querySelector(".cy-names-b")) {
      var n = names.querySelectorAll("li").length, g = names.querySelectorAll(".cy-names-group").length;
      var nb = document.createElement("button");
      nb.className = "cy-names-b";
      nb.innerHTML = "<span>What Conyso is made of<small>" + g + " branches, " + n + " names</small></span>";
      names.parentNode.insertBefore(nb, names);
      wire(nb, names);
      docEl.classList.add("cy-names-wired");
    }
  })();

  // "See it working" on the homepage: real product screens behind tabs.
  // Proper ARIA tabs: click, or arrow keys between tabs. Without this script
  // every screen simply shows, stacked.
  // Every tab set on the page (the product pages carry their own), each
  // wired on its own.
  Array.prototype.forEach.call(document.querySelectorAll(".cy-show-tabs"), function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var pick = function (t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute("aria-selected", on ? "true" : "false");
        x.tabIndex = on ? 0 : -1;
        var p = document.getElementById(x.getAttribute("aria-controls"));
        if (p) { p.classList.toggle("is-on", on); }
      });
      if (focus) { t.focus(); }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!n) { return; }
        e.preventDefault();
        pick(tabs[(i + n + tabs.length) % tabs.length], true);
      });
    });
    pick(tabs[0], false);
    docEl.classList.add("cy-show-wired");
  });

  // "Try it" on the homepage. The data is the published research, written
  // into the page at build time (render_play). Guess a verdict and the real
  // one is shown with the Atlas's own one-line reason; shuffle a law. Without
  // this script the first finding and the first law still show, with links.
  (function () {
    var el = document.getElementById("cy-play-data");
    if (!el) { return; }
    var data;
    try { data = JSON.parse(el.textContent); } catch (e) { return; }
    var esc = function (t) {
      return String(t).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };
    // A fresh order each visit, but the first card stays the one the page was
    // drawn with, so nothing changes under the reader on load.
    var deck = function (list) {
      var rest = list.slice(1);
      for (var i = rest.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t;
      }
      return [list[0]].concat(rest);
    };
    var LABEL = { r: "Replicated", m: "Mixed", f: "Failed to replicate" };

    var g = document.querySelector(".cy-play-guess");
    if (g && data.claims && data.claims.length) {
      var claims = deck(data.claims), gi = 0, right = 0, seen = 0;
      var name = g.querySelector(".cy-play-name"), q = g.querySelector(".cy-play-q");
      var out = g.querySelector(".cy-play-out"), score = g.querySelector(".cy-play-score");
      var opts = Array.prototype.slice.call(g.querySelectorAll(".cy-play-opts button"));
      var next = g.querySelector(".cy-play-next");
      var show = function () {
        var c = claims[gi];
        name.textContent = c.n; q.textContent = c.q; out.innerHTML = "";
        g.classList.remove("is-done");
        opts.forEach(function (b) { b.disabled = false; b.className = ""; b.removeAttribute("aria-pressed"); });
      };
      opts.forEach(function (b) {
        b.addEventListener("click", function () {
          var c = claims[gi], ok = b.getAttribute("data-v") === c.v;
          seen++; if (ok) { right++; }
          opts.forEach(function (x) {
            x.disabled = true;
            if (x.getAttribute("data-v") === c.v) { x.className = "is-answer"; }
          });
          b.setAttribute("aria-pressed", "true");
          if (!ok) { b.className = "is-wrong"; }
          out.innerHTML = '<p class="cy-play-verdict"><b>' + (ok ? "Right. " : "Not quite. ") +
            esc(LABEL[c.v]) + ".</b> " + esc(c.w) + '</p><a class="cy-link" href="' + esc(c.u) +
            '">The evidence &rarr;</a>';
          score.textContent = right + " of " + seen;
          g.classList.add("is-done");
          next.focus();
        });
      });
      next.addEventListener("click", function () {
        gi = (gi + 1) % claims.length;
        show();
        opts[0].focus();
      });
      show();
    }

    var l = document.querySelector(".cy-play-law");
    if (l && data.laws && data.laws.length) {
      var laws = deck(data.laws), li = 0, lout = l.querySelector(".cy-play-out");
      l.querySelector(".cy-play-next").addEventListener("click", function () {
        li = (li + 1) % laws.length;
        var x = laws[li];
        lout.innerHTML = '<p class="cy-play-cat">' + esc(x.c) + '</p><p class="cy-play-name">' + esc(x.n) +
          '</p><p class="cy-play-q">' + esc(x.q) + '</p><a class="cy-link" href="' + esc(x.u) + '">Read the entry &rarr;</a>';
      });
    }
    docEl.classList.add("cy-play-wired");
  })();

  // Lens page: the engine, live. lens-embed.js is large (it carries its map
  // data), so it loads only when the reader comes near the widget or picks a
  // chart; until then the counts table stands in, and without script it stays.
  (function () {
    var box = document.getElementById("try-lens");
    var el = document.getElementById("cy-lens-data");
    if (!box || !el) { return; }
    var rows; try { rows = JSON.parse(el.textContent); } catch (e) { return; }
    var stage = box.querySelector(".cy-lens-stage");
    var btns = Array.prototype.slice.call(box.querySelectorAll(".cy-lens-pick button"));
    var state = "idle", want = btns[0];
    var draw = function (b) {
      want = b;
      btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      if (state !== "ready") { load(); return; }
      var host = document.createElement("div");
      host.className = "cy-lens-host";
      var cfg; try { cfg = JSON.parse(b.getAttribute("data-config")); } catch (e) { cfg = {}; }
      var node = window.Lens.render(host, { chart: b.getAttribute("data-chart"), config: cfg }, rows);
      if (!node) { return; }
      // the embed's own credit line links out; the page already says what it is
      Array.prototype.forEach.call(host.querySelectorAll("a[href*='lens']"), function (a) {
        var p = a.closest("div, span"); if (p && p !== host) { p.parentNode.removeChild(p); }
      });
      stage.innerHTML = ""; stage.appendChild(host);
      box.classList.add("is-live");
    };
    var load = function () {
      if (state !== "idle") { return; }
      state = "loading";
      box.classList.add("is-loading");
      var sc = document.createElement("script");
      sc.src = "/lens-embed.js";
      sc.onload = function () { state = "ready"; box.classList.remove("is-loading"); draw(want); };
      sc.onerror = function () { state = "failed"; box.classList.remove("is-loading"); };
      document.head.appendChild(sc);
    };
    btns.forEach(function (b) { b.addEventListener("click", function () { draw(b); }); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
      }, { rootMargin: "300px 0px" });
      io.observe(box);
    }
    docEl.classList.add("cy-lens-wired");
  })();

  // Live calculators on explainer pages: the frame follows its content's
  // height (same origin), so the calculator never scrolls inside the page.
  Array.prototype.forEach.call(document.querySelectorAll("iframe.cy-try-frame"), function (f) {
    var fit = function () {
      try {
        var d = f.contentDocument; if (!d || !d.body) { return; }
        var h = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight);
        if (h > 200) { f.style.height = h + "px"; }
      } catch (e) {}
    };
    f.addEventListener("load", function () {
      fit();
      try { if ("ResizeObserver" in window) { new ResizeObserver(fit).observe(f.contentDocument.body); } } catch (e) {}
    });
  });

  // Numeric reference tables (chi-square, t, z, control-chart constants...):
  // pick the row and the column and the value is read out, or tap any cell
  // and its row and column light up. Reading a critical-value table by eye
  // is where people misread it.
  Array.prototype.forEach.call(document.querySelectorAll("table.cy-ref-table--num"), function (t, ti) {
    if (t.classList.contains("cy-lk-table")) { return; }
    var head = t.tHead && t.tHead.rows[0]; if (!head || !t.tBodies[0] || !t.tBodies[0].rows.length) { return; }
    // a lookup table has numbers down its first column; a results table
    // (dataset names, say) is left alone
    if (isNaN(parseFloat(t.tBodies[0].rows[0].cells[0].textContent))) { return; }
    var cols = Array.prototype.map.call(head.cells, function (c) { return c.textContent.trim(); });
    var rows = Array.prototype.slice.call(t.tBodies[0].rows);
    if (cols.length < 3) { return; }
    var isZ = /^z$/i.test(cols[0]) && /^\+?\.\d\d$/.test(cols[1]);
    var label = function (r, c) {
      var rv = rows[r].cells[0].textContent.trim(), cv = cols[c];
      if (isZ) {
        var z = (parseFloat(rv) + (rv.trim().charAt(0) === "-" ? -1 : 1) * parseFloat(cv.replace("+", ""))).toFixed(2);
        return "z = " + z;
      }
      // "α = 0.10 | 0.05 | 0.025": the later headers carry only the number
      var pre = (cols[1].match(/^(.+?=)\s*/) || [])[1];
      if (pre && cv.indexOf("=") < 0) { cv = pre + " " + cv; }
      return cols[0] + " " + rv + ", " + cv;
    };
    var out = document.createElement("p");
    out.className = "cy-lk-out"; out.setAttribute("aria-live", "polite");
    var clear = function () {
      Array.prototype.forEach.call(t.querySelectorAll(".is-row, .is-col, .is-hit"), function (x) {
        x.classList.remove("is-row", "is-col", "is-hit");
      });
    };
    var hit = function (r, c, scroll) {
      clear();
      rows[r].classList.add("is-row");
      head.cells[c].classList.add("is-col");
      rows.forEach(function (row) { if (row.cells[c]) { row.cells[c].classList.add("is-col"); } });
      var cell = rows[r].cells[c]; cell.classList.add("is-hit");
      out.innerHTML = label(r, c) + ": <b>" + cell.textContent.trim() + "</b>";
      if (rs) { rs.value = String(r); cs.value = String(c); }
      if (scroll && cell.scrollIntoView) { cell.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    };
    var rs = null, cs = null;
    if (rows.length >= 8) {
      var bar = document.createElement("div");
      bar.className = "cy-lk";
      var id = "cy-lk-" + ti;
      var opt = function (v, txt) { return '<option value="' + v + '">' + txt + "</option>"; };
      bar.innerHTML =
        '<label for="' + id + '-r">' + cols[0] + '</label><select id="' + id + '-r">' +
        rows.map(function (r, i) { return opt(i, r.cells[0].textContent.trim()); }).join("") + "</select>" +
        '<label for="' + id + '-c">Column</label><select id="' + id + '-c">' +
        cols.slice(1).map(function (c, i) { return opt(i + 1, c); }).join("") + "</select>";
      var anchor = t.closest(".cy-ref-wrap") || t;   // outside the sideways scroller
      anchor.parentNode.insertBefore(bar, anchor);
      rs = bar.querySelector("#" + id + "-r"); cs = bar.querySelector("#" + id + "-c");
      var go = function () { hit(+rs.value, +cs.value, true); };
      rs.addEventListener("change", go); cs.addEventListener("change", go);
      bar.appendChild(out);
    } else {
      var anc = t.closest(".cy-ref-wrap") || t;
      anc.parentNode.insertBefore(out, anc);
    }
    t.classList.add("cy-lk-table");
    t.addEventListener("click", function (e) {
      var td = e.target.closest("td"); if (!td || td.cellIndex < 1) { return; }
      hit(rows.indexOf(td.parentNode), td.cellIndex, false);
    });
  });

})();
