// Work <-> case study page transitions, loaded synchronously in <head> on Work
// and on every case page.
//  Work -> case: a circle of the case study's theme color grows from the click
//    point until it covers the screen.
//  Case -> Work, About or Home: an overlay in the case page's theme color closes in from the
//    corners (hole shrinks to 0), the browser navigates while covered, then Work
//    opens covered and the covering shrinks down to a small circle at the click
//    point, revealing Work.
// Work -> case additionally navigates while covered, then the new page opens a
// growing hole in the same overlay from the same point.
(function () {
  var KEY = "caseTransition";
  var OUT_MS = 450;
  var PAUSE_MS = 60;
  var IN_MS = 500;
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

  if (incoming && !reduceMotion) {
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
        var start = null;
        function frame(now) {
          if (start === null) start = now;
          var p = Math.min((now - start) / IN_MS, 1);
          var r = ease(p) * R;
          var mask =
            "radial-gradient(circle at " + x + "px " + y + "px, transparent " + r + "px, #000 " + (r + 1) + "px)";
          overlay.style.webkitMaskImage = mask;
          overlay.style.maskImage = mask;
          if (p < 1) requestAnimationFrame(frame);
          else overlay.remove();
        }
        requestAnimationFrame(frame);
      }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reveal);
    else reveal();

    setTimeout(function () {
      root.classList.remove("case-enter");
    }, 4000);
  }

  // ---- Outgoing page ----
  var busy = false;

  var onCasePage = /\/(muji|damai|wapoo)\.html$/.test(location.pathname);

  window.addEventListener("pageswap", function (e) {
    if (busy) {
      if (e.viewTransition) e.viewTransition.skipTransition();
      return;
    }
    // Browser back button / swipe gesture from a case page to Work/About/Home: there's no
    // click, and the page can't be held back to play the closing animation, so
    // hand the new page a viewport-center origin for its reveal.
    if (!onCasePage) return;
    var dest = e.activation && e.activation.entry && e.activation.entry.url;
    if (!dest || !/\/(work|about|index)\.html$|\/$/.test(new URL(dest).pathname)) return;
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: ownTheme, mode: "shrink", t: Date.now() })
      );
    } catch (err) {}
    if (e.viewTransition) e.viewTransition.skipTransition();
  });

  // Coming back via bfcache would otherwise show the old page still covered.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    busy = false;
    var stale = document.querySelectorAll("[data-case-overlay]");
    for (var i = 0; i < stale.length; i++) stale[i].remove();
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

    // Work -> case: circle of the theme color grows from the click point.
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
