// Work <-> case study page transitions, loaded synchronously in <head> on Work
// and on every case page.
//  Any link into or out of a case study: the page-transition Lottie fills the screen with pink, the browser
//  navigates while covered, then the new page opens covered in the same pink and the pink slab lowers (its top
//  edge drops to the bottom) to reveal the page from the top.
//  Fallback when lottie-web or the JSON isn't loaded yet: a growing circle in, a closing/shrinking circle out.
// ---- Cache warm-up ----
// A cross-page transition is dropped by Chrome when the destination isn't ready almost immediately, which is
// exactly what happens on a first visit with an empty cache (HTML, CSS, JS and the Lottie library all download
// mid-click). So once this page has finished loading and the browser is idle, quietly fetch the other main pages
// and the CSS/JS/images/Lottie files they reference into the HTTP cache. Plain fetch() only fills the cache; it
// does not prerender (which is what used to make transitions time out).
(function () {
  var MAIN = ["index.html", "pages/work.html", "pages/about.html"];
  var inPages = /\/pages\//.test(location.pathname);
  var root = new URL(inPages ? "../" : "./", location.href);
  var seen = {};
  function warm(url, noCors) {
    if (seen[url]) return;
    seen[url] = 1;
    try { fetch(url, noCors ? { mode: "no-cors" } : undefined).catch(function () {}); } catch (e) {}
  }
  function warmPage(url) {
    seen[url] = 1;
    fetch(url).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
      var re = /(?:href|src)="([^"#]+\.(?:css|js|json|webp|png|jpg|jpeg|svg|woff2)(?:\?[^"]*)?)"/gi;
      while ((m = re.exec(html))) {
        if (/^(mailto|tel|data):/.test(m[1])) continue;
        var u = new URL(m[1], url);
        if (u.pathname === location.pathname) continue;
        warm(u.href, u.origin !== location.origin);
      }
    }).catch(function () {});
  }
  function run() {
    var c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ""))) return;
    MAIN.forEach(function (p) {
      var u = new URL(p, root).href;
      if (new URL(u).pathname !== location.pathname) warmPage(u);
    });
  }
  window.addEventListener("load", function () {
    (window.requestIdleCallback || function (f) { setTimeout(f, 800); })(run, { timeout: 3000 });
  });
})();

// ---- Transition diagnostics (off unless you turn them on) ----
// In DevTools -> Console, run:  localStorage.vtdebug = "1"   (turn off with: localStorage.removeItem("vtdebug"))
// then, with "Preserve log" ticked in the Console settings, click through the site. Each page logs one line
// on the way out and one on arrival saying whether the browser actually ran a view transition, plus the timing
// and (if it was skipped) the browser's own reason. Nothing is logged for regular visitors.
(function () {
  var on = false;
  try { on = localStorage.getItem("vtdebug") === "1"; } catch (e) {}
  if (!on) return;
  var tag = "%c[vt]";
  var css = "color:#d33;font-weight:bold";
  var page = location.pathname.split("/").pop() || "index.html";
  addEventListener("pageswap", function (e) {
    var vt = e.viewTransition;
    console.log(tag, css, "LEAVING " + page + " ->", e.activation && e.activation.entry && e.activation.entry.url,
      vt ? "(transition started)" : "(NO transition on the leaving side)",
      "visibility=" + document.visibilityState, "focus=" + document.hasFocus(), "dpr=" + devicePixelRatio, "viewport=" + innerWidth + "x" + innerHeight);
    if (vt) {
      var t0 = performance.now();
      vt.ready.then(function () { console.log(tag, css, "ready after " + Math.round(performance.now() - t0) + "ms"); },
        function (err) { console.warn(tag, css, "READY REJECTED:", err && err.name, err && err.message); });
      vt.finished.catch(function (err) { console.warn(tag, css, "FINISHED REJECTED:", err && err.name, err && err.message); });
    }
  });
  addEventListener("pagereveal", function (e) {
    var nav = performance.getEntriesByType("navigation")[0] || {};
    console.log(tag, css, "ARRIVED " + page, e.viewTransition ? "(transition running)" : "(NO transition: skipped before this page was shown)",
      "data-transition=" + root0().getAttribute("data-transition"), "prerendered=" + (nav.activationStart > 0),
      "readyState=" + document.readyState, "t=" + Math.round(performance.now()) + "ms",
      "responseEnd=" + Math.round(nav.responseEnd || 0) + "ms", "fromCache=" + (nav.transferSize === 0));
    if (e.viewTransition) {
      e.viewTransition.ready.catch(function (err) { console.warn(tag, css, "READY REJECTED:", err && err.name, err && err.message); });
      e.viewTransition.finished.catch(function (err) { console.warn(tag, css, "FINISHED REJECTED:", err && err.name, err && err.message); });
    }
  });
  function root0() { return document.documentElement; }
})();

(function () {
  var KEY = "caseTransition";
  var OUT_MS = 450;
  var PAUSE_MS = 60;
  var IN_MS = 500;
  var LOWER_MS = 700; // pink slab lowering to reveal a case study
  var EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
  var Z = 2147483000;
  var THEMES = { muji: "#8B0013", damai: "#6665FE", wapoo: "#45DBE9" };
  var pageMatch = location.pathname.match(/\/(muji|damai|wapoo)\.html$/);
  // Leaving a case page keeps that page's own theme color for the overlay.
  var ownTheme = pageMatch ? THEMES[pageMatch[1]] : null;
  function resolveBg(v) {
    return v === "exit" ? ownTheme : v;
  }
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function maxRadius(x, y) {
    return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  }

  // Solves the CSS cubic-bezier(0.65, 0, 0.35, 1) curve so the JS-driven hole
  // animation matches the WAAPI-driven circle exactly.
  function makeEase(x1, y1, x2, y2) {
    function coord(t, a, b) {
      var u = 1 - t;
      return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
    }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 24; i++) {
        var cx = coord(t, x1, x2);
        if (Math.abs(cx - x) < 1e-5) break;
        if (cx < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return coord(t, y1, y2);
    };
  }
  var ease = makeEase(0.65, 0, 0.35, 1);

  function makeOverlay(color) {
    var el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;inset:0;z-index:" + Z + ";pointer-events:none;background:" + color + ";";
    return el;
  }

  // ---- Lottie cover (assets/lottie/page-transition1.json) ----
  // Leaving for a case study plays this animation (shapes fill the screen) instead of the plain growing
  // circle. The case page then opens covered in the same
  // color (LOTTIE_COLOR) so the handoff is seamless. If lottie-web or the JSON isn't loaded yet the circle is used instead.
  var LOTTIE_SPEED = 2; // 1 = the animation's own 2.5s; it is a click response, so it plays faster
  var LOTTIE_COLOR = "#FFC3C3"; // pink for every case study; set to null to use each case study's theme color instead
  var LOTTIE_COVER_FRAME = 140; // first frame where the screen is solid
  var lottieJson = null;
  function loadLottieAssets() {
    if (!document.querySelector("a[data-case-color]")) return;
    var base = /\/pages\//.test(location.pathname) ? "../" : "";
    if (!window.lottie) {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
      sc.async = true;
      document.head.appendChild(sc);
    }
    fetch(base + "assets/lottie/page-transition1.json")
      .then(function (r) { return r.json(); })
      .then(function (j) { lottieJson = JSON.stringify(j); })
      .catch(function () {});
  }
  window.addEventListener("load", function () {
    (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(loadLottieAssets, { timeout: 2000 });
  });
  function hexToRgb01(hex) {
    var n = parseInt(hex.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function recolor(o, rgb) {
    if (Array.isArray(o)) { o.forEach(function (v) { recolor(v, rgb); }); return; }
    if (!o || typeof o !== "object") return;
    if (o.ty === "fl" && o.c && Array.isArray(o.c.k) && typeof o.c.k[0] === "number") {
      o.c.k = [rgb[0], rgb[1], rgb[2], o.c.k[3] === undefined ? 1 : o.c.k[3]];
    }
    for (var k in o) recolor(o[k], rgb);
  }
  // Returns true if the cover started; `done` is called once the screen is fully covered.
  function playLottieCover(color, done) {
    color = LOTTIE_COLOR || color;
    if (!window.lottie || !lottieJson || !/^#[0-9a-f]{6}$/i.test(color)) return false;
    var data = JSON.parse(lottieJson);
    recolor(data, hexToRgb01(color));
    var box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.setAttribute("data-case-overlay", "");
    box.style.cssText = "position:fixed;inset:0;z-index:" + Z + ";pointer-events:none;";
    document.body.appendChild(box);
    var anim;
    try {
      anim = window.lottie.loadAnimation({
        container: box,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
        rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
      });
    } catch (e) { box.remove(); return false; }
    anim.setSpeed(LOTTIE_SPEED);
    var finished = false;
    function finish() { if (finished) return; finished = true; done(); }
    anim.addEventListener("enterFrame", function (ev) { if (ev.currentTime >= LOTTIE_COVER_FRAME) { anim.pause(); finish(); } });
    anim.addEventListener("complete", finish);
    anim.play();
    return true;
  }

  // ---- Back/forward sweep (the Lottie can't play there) ----
  // The old page is already gone, so to cover IT we use the browser's own view transition: its snapshot of the
  // old page stays on screen, and a pink layer (html::after, given its own transition name) is animated over
  // it in two steps: the bottom edge travels from the top of the screen to the bottom until everything is
  // pink; once that is done AND the new page has finished loading, the new page is swapped in underneath and
  // the top edge travels down to uncover it. Named elements (work tabs, background shapes...) are un-named
  // for the duration so they stay part of the plain page snapshots.
  var SWEEP_MS = 600;
  var NO_NAMES = "view-transition-name:none!important;";
  function sweepCss(color) {
    return (
      "html.case-sweep-out *,html.case-sweep *{" + NO_NAMES + "}" +
      "html.case-sweep::after{content:'';position:fixed;inset:0;z-index:" + Z + ";pointer-events:none;background:" + color +
      ";view-transition-name:case-sweep}" +
      "html.case-sweep::view-transition-group(*),html.case-sweep::view-transition-old(*),html.case-sweep::view-transition-new(*){animation:none!important}" +
      "html.case-sweep::view-transition-new(root){opacity:0}" +
      "html.case-sweep::view-transition-new(case-sweep){clip-path:inset(0 0 100% 0)}"
    );
  }
  function addSweepStyle(color) {
    var st = document.createElement("style");
    st.setAttribute("data-case-sweep", "");
    st.textContent = sweepCss(color);
    document.head.appendChild(st);
    return st;
  }
  function pseudoAnim(pseudo, frames, opts) {
    opts.pseudoElement = pseudo;
    return root.animate(frames, opts);
  }
  function dbg(msg) {
    try { if (localStorage.vtdebug === "1") console.log("[sweep] " + msg + " @" + Math.round(performance.now()) + "ms"); } catch (e) {}
  }
  function runSweep(vt) {
    dbg("transition ready: cover starts");
    var NEW_PINK = "::view-transition-new(case-sweep)";
    var cover = pseudoAnim(NEW_PINK, [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: SWEEP_MS, easing: EASING, fill: "forwards",
    });
    // Keeps the transition alive while we wait for the page to finish loading.
    var hold = pseudoAnim(NEW_PINK, [{ opacity: 1 }, { opacity: 1 }], { duration: 5000 });
    cover.finished.then(function () { dbg("screen fully pink"); });
    Promise.all([cover.finished, waitUntilReady()]).then(function () {
      dbg("page ready: top edge starts lowering");
      setTimeout(function () {
        pseudoAnim("::view-transition-new(root)", [{ opacity: 1 }, { opacity: 1 }], { duration: LOWER_MS, fill: "forwards" });
        pseudoAnim(NEW_PINK, [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }], {
          duration: LOWER_MS, easing: EASING, fill: "forwards",
        }).finished.then(function () { hold.cancel(); });
      }, PAUSE_MS);
    });
  }

  // Resolves once the page is ready to be looked at: fonts loaded and the images
  // visible on first screen decoded, then two animation frames so layout and the
  // first paint are done. Never waits longer than MAX_WAIT_MS.
  var MAX_WAIT_MS = 1200;
  function waitUntilReady() {
    var ready = Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      Promise.all(
        Array.prototype.slice
          .call(document.images)
          .filter(function (img) {
            var r = img.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0 && r.width > 0;
          })
          .map(function (img) {
            return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
          })
      ),
    ]);
    var cap = new Promise(function (res) {
      setTimeout(res, MAX_WAIT_MS);
    });
    return Promise.race([ready, cap]).then(function () {
      return new Promise(function (res) {
        requestAnimationFrame(function () {
          requestAnimationFrame(res);
        });
      });
    });
  }

  // ---- Incoming page ----
  var incoming = null;
  try {
    incoming = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch (e) {}
  if (incoming && Date.now() - incoming.t > 10000) incoming = null;

  function slabArrival() {
    // Cover the page from the very first paint so nothing flashes before the
    // overlay exists (the overlay itself needs <body>, which isn't parsed yet).
    var style = document.createElement("style");
    style.textContent =
      "html.case-enter{background:" + incoming.color + "}html.case-enter body{visibility:hidden}";
    document.head.appendChild(style);
    root.classList.add("case-enter");

    // The overlay replaces the default cross-fade / slide transition here.
    window.addEventListener("pagereveal", function (e) {
      if (e.viewTransition) e.viewTransition.skipTransition();
    });

    var reveal = function () {
      var overlay = makeOverlay(incoming.color);
      document.body.appendChild(overlay);
      root.classList.remove("case-enter");
      style.remove();

      var x = incoming.x, y = incoming.y;
      var R = maxRadius(x, y);
      waitUntilReady().then(function () {
        setTimeout(startReveal, PAUSE_MS);
      });
      function startReveal() {
        if (incoming.mode === "shrink") {
          // Case -> Work: theme-color screen shrinks down to the click point.
          overlay
            .animate(
              [
                { clipPath: "circle(" + R + "px at " + x + "px " + y + "px)" },
                { clipPath: "circle(0px at " + x + "px " + y + "px)" },
              ],
              { duration: IN_MS, easing: EASING, fill: "forwards" }
            )
            .finished.then(function () {
              overlay.remove();
            });
          return;
        }
        // Work/About -> case: the covering slab lowers itself (its top edge drops to the bottom of the
        // screen, so it keeps getting flatter) and reveals the page from the top.
        overlay
          .animate(
            [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }],
            { duration: LOWER_MS, easing: EASING, fill: "forwards" }
          )
          .finished.then(function () {
            overlay.remove();
          });
      }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reveal);
    else reveal();

    setTimeout(function () {
      root.classList.remove("case-enter");
    }, 4000);
  }

  if (incoming && !reduceMotion) {
    if (incoming.mode === "sweep") {
      // Back/forward: pink sweep over the old page's snapshot (view transition); if the browser didn't start
      // one, fall back to opening covered in pink and lowering it, like after a click.
      var sweepStyle = addSweepStyle(incoming.color);
      root.classList.add("case-sweep");
      window.addEventListener("pagereveal", function (e) {
        var vt = e.viewTransition;
        if (!vt) {
          root.classList.remove("case-sweep");
          sweepStyle.remove();
          slabArrival();
          return;
        }
        vt.ready.then(function () { runSweep(vt); }, function () {});
        vt.finished.then(cleanup, cleanup);
        function cleanup() {
          root.classList.remove("case-sweep");
          sweepStyle.remove();
        }
      });
    } else {
      slabArrival();
    }
  }

  // ---- Outgoing page ----
  var busy = false;

  var onCasePage = /\/(muji|damai|wapoo)\.html$/.test(location.pathname);

  window.addEventListener("pageswap", function (e) {
    if (busy) {
      if (e.viewTransition) e.viewTransition.skipTransition();
      return;
    }
    // Browser back/forward button or swipe gesture into or out of a case study: there's no click and the
    // old page can't be held back to play the Lottie cover, so the new page plays the pink sweep instead.
    var dest = e.activation && e.activation.entry && e.activation.entry.url;
    if (!dest) return;
    var path = new URL(dest).pathname;
    var toCase = /\/(muji|damai|wapoo)\.html$/.test(path);
    var toMain = /\/(work|about|index)\.html$|\/$/.test(path);
    if (!(toCase || (onCasePage && toMain))) return;
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: LOTTIE_COLOR || ownTheme || "#FFC3C3", mode: "sweep", t: Date.now() })
      );
    } catch (err) {}
    // Keep the browser's snapshot of this page (the pink sweeps over it); un-name its named elements first.
    if (e.viewTransition) {
      addSweepStyle(LOTTIE_COLOR || ownTheme || "#FFC3C3");
      root.classList.add("case-sweep-out");
    }
  });

  // Coming back via bfcache would otherwise show the old page still covered.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    busy = false;
    var stale = document.querySelectorAll("[data-case-overlay]");
    for (var i = 0; i < stale.length; i++) stale[i].remove();
    // Restored from the back/forward cache: scripts don't re-run, so play the arrival here.
    var inc = null;
    try {
      inc = JSON.parse(sessionStorage.getItem(KEY));
      sessionStorage.removeItem(KEY);
    } catch (err) {}
    if (!inc || Date.now() - inc.t > 10000 || reduceMotion) return;
    var ov = makeOverlay(inc.color);
    ov.setAttribute("data-case-overlay", "");
    document.body.appendChild(ov);
    waitUntilReady().then(function () {
      setTimeout(function () {
        ov.animate(
          [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }],
          { duration: LOWER_MS, easing: EASING, fill: "forwards" }
        ).finished.then(function () { ov.remove(); });
      }, PAUSE_MS);
    });
  });

  // A restored page would otherwise also run its own cross-fade/slide underneath the pink.
  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    try {
      var peek = JSON.parse(sessionStorage.getItem(KEY));
      if (peek && Date.now() - peek.t <= 10000 && !reduceMotion) e.viewTransition.skipTransition();
    } catch (err) {}
  });

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[data-case-color][href]");
    if (!link || busy || reduceMotion) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target !== "_self") return;

    e.preventDefault();
    busy = true;

    // No real pointer (keyboard activation) -> viewport center.
    var x = e.detail === 0 ? window.innerWidth / 2 : e.clientX;
    var y = e.detail === 0 ? window.innerHeight / 2 : e.clientY;
    var raw = link.getAttribute("data-case-color");
    var color = resolveBg(raw);
    var R = maxRadius(x, y);

    function go(mode) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ x: x, y: y, color: color, mode: mode, t: Date.now() }));
      } catch (err) {}
      window.location.href = link.href;
    }

    // Anywhere -> anywhere: the Lottie shapes cover the screen; the next page then lowers the slab.
    if (playLottieCover(color, function () { color = LOTTIE_COLOR || color; go(); })) return;

    if (raw === "exit") {
      // Case -> Work/About/Home: a full-screen overlay closes in from the corners (hole
      // shrinks from the max radius to 0), then Work opens covered and the
      // covering shrinks down to a small circle at the click point.
      var closer = makeOverlay(color);
      closer.setAttribute("data-case-overlay", "");
      function setHole(r) {
        var mask =
          "radial-gradient(circle at " + x + "px " + y + "px, transparent " + r + "px, #000 " + (r + 1) + "px)";
        closer.style.webkitMaskImage = mask;
        closer.style.maskImage = mask;
      }
      setHole(R);
      document.body.appendChild(closer);
      var t0 = null;
      requestAnimationFrame(function frame(now) {
        if (t0 === null) t0 = now;
        var p = Math.min((now - t0) / OUT_MS, 1);
        setHole((1 - ease(p)) * R);
        if (p < 1) requestAnimationFrame(frame);
        else go("shrink");
      });
      return;
    }

    // Fallback: circle of the theme color grows from the click point.
    var overlay = makeOverlay(color);
    overlay.setAttribute("data-case-overlay", "");
    overlay.style.clipPath = "circle(0px at " + x + "px " + y + "px)";
    document.body.appendChild(overlay);
    var anim = overlay.animate(
      [
        { clipPath: "circle(0px at " + x + "px " + y + "px)" },
        { clipPath: "circle(" + R + "px at " + x + "px " + y + "px)" },
      ],
      { duration: OUT_MS, easing: EASING, fill: "forwards" }
    );
    anim.onfinish = go;
  });
})();
