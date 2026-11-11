// Extras for the experiment case-study pages (damai-exp / wapoo-exp / muji-exp).
// 1. Dashed frames: an SVG outline with 18px dashes and 18px gaps, adjusted a little so the pattern closes up evenly all the way round the rounded corners.
// 2. "Back to top" goes to the top of the case study (the tab already all white), not back to the first screen.
// 3. The Home / Work / About / Resume bar is shown at the top of the case study once the tab has turned white (it leaves again as the page scrolls on, and comes back when scrolling up, as before).
(function () {
  // The Work page starts its carousel where the last case study that was SHOWN sits (see work.html). A page that is only prerendered in the background (hovering an edge tab asks for that) runs its
  // scripts too, so it must not write this before it is really shown, or it would move the Work page's cards to the wrong case study.
  function noteCase() { try { sessionStorage.setItem("xLastCase", location.pathname.split("/").pop()); } catch (e) {} }
  if (document.prerendering) document.addEventListener("prerenderingchange", noteCase, { once: true }); else noteCase();
  function G() { return typeof window.__caseGrow === "number" ? window.__caseGrow : 360; } // how far the page scrolls while the tab grows to white (set by the page)
  var R = 40, SW = 4, DASH = 18, NS = "http://www.w3.org/2000/svg";

  // ---- 1. dashes ----
  function draw(el) {
    var svg = el.__dash;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    var rect = svg.firstChild, r = Math.min(R, w / 2, h / 2), iw = w - SW, ih = h - SW, rr = Math.max(0, r - SW / 2);
    svg.setAttribute("width", w); svg.setAttribute("height", h);
    rect.setAttribute("x", SW / 2); rect.setAttribute("y", SW / 2); rect.setAttribute("width", iw); rect.setAttribute("height", ih);
    rect.setAttribute("rx", rr); rect.setAttribute("ry", rr);
    var per = 2 * (iw + ih - 4 * rr) + 2 * Math.PI * rr, n = Math.max(2, Math.round(per / (2 * DASH))), d = per / n / 2;
    rect.setAttribute("stroke-dasharray", d.toFixed(3) + " " + d.toFixed(3));
    rect.setAttribute("stroke-dashoffset", (d / 2).toFixed(3));
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { draw(e.target); }); }) : null;
  Array.prototype.forEach.call(document.querySelectorAll(".dx-col, .dx-group"), function (el) {
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "dx-dash"); svg.setAttribute("aria-hidden", "true");
    svg.appendChild(document.createElementNS(NS, "rect"));
    el.insertBefore(svg, el.firstChild);
    el.__dash = svg;
    if (el.classList.contains("dx-group")) svg.style.setProperty("--x", "1");
    draw(el);
    if (ro) ro.observe(el);
  });
  addEventListener("load", function () { Array.prototype.forEach.call(document.querySelectorAll(".dx-col, .dx-group"), draw); });

  // ---- 2. back to top ----
  window.__caseTop = function () {
    var y = window.scrollY;
    if (y <= G() + 2) { if (window.smoothScrollTo) smoothScrollTo(0); else window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (window.smoothScrollTo) smoothScrollTo(G()); else window.scrollTo({ top: G(), behavior: "smooth" });
  };

  // ---- 3. the navigation at the top of the white page ----
  var nav = document.querySelector(".page-nav");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Reloading (or coming back with Back / Forward) part-way down: the page is first drawn at the top and then put back at the saved place, so the navigation bar (which is shown at the top) would
  // flash for a moment and fade away again. Here it is hidden from the first drawing when the saved place is below where it fades away (120px), and handed back to the normal scroll logic
  // (main.js and this section) once the page has got there.
  (function () {
    if (!nav || reduce) return;
    var saved = 0;
    try {
      var nt = performance.getEntriesByType("navigation")[0], v = sessionStorage.getItem("xScroll:" + location.pathname);
      if (nt && (nt.type === "reload" || nt.type === "back_forward") && v !== null) saved = +v || 0;
    } catch (e) {}
    if (saved <= 120) return;
    nav.style.transition = "none"; nav.style.opacity = "0"; nav.style.pointerEvents = "none"; nav.style.transform = "translate(-50%, -84px)";
    var t0 = performance.now();
    (function wait() {
      if (Math.abs(window.scrollY - saved) < 3 || performance.now() - t0 > 3500) { window.dispatchEvent(new Event("scroll")); return; }
      requestAnimationFrame(wait);
    })();
  })();
  if (nav && !reduce) {
    var STAY = 140; // it stays for this many px of scrolling past the white-out, then fades like it does on the other pages
    var ticking = false;
    // main.js calls this for every scroll position (before it does anything to the bar): inside the range below the bar is mine, outside it is main.js's again. (It used to be a second scroll
    // listener that set the bar to shown while main.js set it to hidden in the same frame: the bar flickered, most of all when the page was reloaded part-way down.)
    var beenDown = false;
    window.__caseNavHold = function (y) {
      // Below 1000px there is no middle state: the page is opened (from the Work page, with the shape transition) already at the top of the white page, and the bar is not shown there: it is
      // away for the first stretch of the page and comes back, like on the other pages, when the reader scrolls up from further down (main.js)
      // ... but only on arrival: once the reader has been further down, coming back to the top (scrolling up, or "Back to top") shows the bar there, as it does above 1000px
      if (G() === 0 && !beenDown) {
        if (y <= STAY + 80) { nav.style.opacity = "0"; nav.style.pointerEvents = "none"; return true; }
        beenDown = true;
      }
      if (y < G() - 1 || y > G() + STAY + 80) return false;
      var o = y <= G() + STAY ? 1 : 1 - (y - G() - STAY) / 80;
      nav.style.opacity = String(o);
      nav.style.transform = "translate(-50%, " + (-(56 - (parseFloat(document.documentElement.style.getPropertyValue("--nav-up")) || 0))) + "px)"; // pinned 24px from the top of the window
      nav.style.pointerEvents = o < 0.01 ? "none" : "";
      nav.style.transition = "opacity 0.3s ease";
      return true;
    };
    if (G() === 0 && window.scrollY <= STAY + 80) { nav.style.transition = "none"; window.__caseNavHold(window.scrollY); } // (hidden from the very first drawing)
  }
  // ---- 4. sections slide up a little and fade in as they first scroll into view (the same effect as main.js gives the other case studies) ----
  (function () {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    var line = window.innerHeight * 0.95;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; e.target.classList.add("is-revealed"); io.unobserve(e.target); });
    }, { rootMargin: "0px 0px -5% 0px", threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll(".dx-sec, .dx-end"), function (el) {
      if (el.getBoundingClientRect().top < line) return; // already on screen (or passed): nothing to animate
      el.classList.add("reveal-ready");
      io.observe(el);
    });
  })();
  // ---- 5. the glass tabs at the window's edges (first screen): click one and the tabs rotate: the middle tab shrinks and travels to the opposite edge (where it is the edge tab of the next page),
  //         the clicked tab grows into the middle, the third one leaves, and the background colour melts into the next page's. Then the page is swapped (the next page's first screen is
  //         exactly where the animation ended and its content fades in). Hover one and it moves out a little. ----
  (function () {
    var allPeeks = Array.prototype.slice.call(document.querySelectorAll(".dm-peek"));
    function goKey(p) { return p.getAttribute("data-go") || p.getAttribute("data-peek"); } // data-go: where a tab leads when that differs from the card the Work page moves into it (data-peek)
    var peeks = allPeeks.filter(function (p) { var k = goKey(p); return k && k !== "none"; });
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canvas = document.querySelector(".page-canvas--damai");
    var tab = document.querySelector(".glass-card--case");
    var going = false;
    function visible() { return canvas && parseFloat(getComputedStyle(canvas).getPropertyValue("--g") || "0") < 0.5 && window.matchMedia("(min-width: 1000px)").matches; }
    function sideOf(p) { var r = p.getBoundingClientRect(); return r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right"; } // by where it is (Damai calls its tabs --muji / --wapoo, the others --left / --right)

    // The first screen's content comes in and goes out with the same pieces and curves as when a case study is opened from (or closed to) the Work page, one piece after another:
    // the picture slides in from the right through the tab's edge, the address bar pops out as a circle, stretches and types its address, Year and Role rise into place...
    // (and the reverse for leaving), at the full speed of that opening on arrival (K is a time scale, 1 = the same); when leaving, the content simply slides out sideways together with the tab.
    var K = 1, POP = "cubic-bezier(0.34, 1.56, 0.64, 1)", OUT = "cubic-bezier(0.16, 1, 0.3, 1)", IN = "cubic-bezier(0.36, 0, 0.66, -0.56)", SLIDE = "cubic-bezier(0.65, 0, 0.35, 1)", EASE = "cubic-bezier(0.76, 0, 0.24, 1)";
    function parts(root) {
      root = root || tab;
      var q = function (s) { return root && root.querySelector(s); };
      return { illus: q(".dm-illus"), back: q(".case-topbar__back"), url: q(".case-topbar__url"), title: q(".case-hero__title"), desc: q(".case-hero__desc"),
        meta: root ? Array.prototype.slice.call(root.querySelectorAll(".dm-hero-text__meta span")) : [], scroll: root === tab ? document.querySelector(".dm-scroll") : null };
    }
    var OFF = 800; // the opening from the Work page waits for the card to grow first; here the tab is already in place, so everything starts that much earlier
    function anim(el, kf, dur, delay, easing, fill) { if (!el) return null; return el.animate(kf, { duration: dur * K, delay: Math.max(0, delay - OFF) * K, easing: easing, fill: fill }); }
    function contentIn(root, W1) {
      var p = parts(root); W1 = W1 || tab.offsetWidth;
      anim(p.illus, [{ transform: "translateX(" + W1 + "px)" }, { transform: "translateX(0)" }], 1000, 700, OUT, "backwards");
      anim(p.back, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], 450, 800, POP, "backwards");
      if (p.url) {
        var uw = p.url.offsetWidth, uh = p.url.offsetHeight;
        p.url.style.transformOrigin = (uh / 2) + "px 50%";
        anim(p.url, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], 450, 900, POP, "backwards");
        anim(p.url, [{ clipPath: "inset(0px " + (uw - uh) + "px 0px 0px round " + (uh / 2) + "px)" }, { clipPath: "inset(0px 0px 0px 0px round " + (uh / 2) + "px)" }], 750, 1250, EASE, "backwards");
        if (window.__xMakeTyper) window.__xMakeTyper(p.url, (1600 - OFF) * K, 38 * K, (2250 - OFF) * K).play();
      }
      [p.title, p.desc].forEach(function (el) { anim(el, [{ opacity: 0 }, { opacity: 1 }], 450, 700, "ease-out", "backwards"); });
      p.meta.forEach(function (sp, i) { anim(sp, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }], 700, 1000 + i * 80, OUT, "backwards"); });
      anim(p.scroll, [{ opacity: 0 }, { opacity: 1 }], 600, 900, "ease-out", "backwards");
    }
    // leaving: the "Scroll" button fades at once (the rest of the content slides out with the tab, see rotate() below)
    function contentOut() {
      var sc = document.querySelector(".dm-scroll");
      if (sc) sc.animate([{ opacity: parseFloat(getComputedStyle(sc).opacity) }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    }

    // Arriving through one of those tabs. The page is swapped BEFORE the movement has finished (so the entrance can start while the tab is still settling): this page then plays the rest of
    // it, with the very same animations the old page was playing (same keyframes, same curve, started at the time that has already gone by), so nothing jumps at the swap:
    // the middle tab (this page's) is still growing, the old tab is still shrinking into its edge slot, the third tab is still coming in, the old background is still fading out.
    var CURVE = "cubic-bezier(0.45, 0.05, 0.2, 1)";
    function arrive() {
    try {
      var raw = localStorage.getItem("xSlide"), st = null;   // (localStorage, not sessionStorage: a page that was prerendered in the background sees it live)
      if (raw) { localStorage.removeItem("xSlide"); try { st = JSON.parse(raw); } catch (e) { st = null; } }
      if (st && Date.now() - st.t0 > 5000) st = null;       // an old leftover
      if (st && st.to && st.to !== location.pathname.split("/").pop()) st = null; // meant for another page
      if (st) try { var navE = performance.getEntriesByType("navigation")[0]; localStorage.setItem("xPR", navE && navE.activationStart > 0 ? "1" : "0"); } catch (e) {}
      if (st && st.side && !reduce && tab && tab.animate) {
        var MSa = st.ms || 1450, elapsed = Math.max(0, Math.min(MSa + 50, Date.now() - st.t0)), from = st.side;
        var thirdP = allPeeks.filter(function (q) { return sideOf(q) === from; })[0], oldP = allPeeks.filter(function (q) { return sideOf(q) !== from; })[0];
        var tabR2 = rectOf(tab), W2 = tab.offsetWidth, H2 = tab.offsetHeight, s02 = tabR2.width / W2, tcx2 = tabR2.left + tabR2.width / 2;
        var replays = [];
        function play(el, kf, opt) { var a = el.animate(kf, opt); replays.push(a); try { a.currentTime = elapsed; } catch (e) {} return a; }
        if (thirdP) {
          var pr2 = rectOf(thirdP), pcx2 = pr2.left + pr2.width / 2;
          // this page's tab: still growing from the edge slot
          play(tab, [{ transform: "scale(" + (pr2.height / H2) + ")", translate: (pcx2 - tcx2) + "px " + (pr2.top - tabR2.top) + "px" }, { transform: "scale(" + s02 + ")", translate: "0 0" }], { duration: MSa * 0.94, delay: MSa * 0.06, easing: CURVE, fill: "both" });
          // the third tab: still sliding in from the far side
          play(thirdP, [{ translate: (from === "left" ? -1 : 1) * 520 + "px 0", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: MSa * 0.7, delay: MSa * 0.3, easing: CURVE, fill: "both" });
        }
        if (oldP) {
          // the old tab: still shrinking from the middle into its slot (the edge tab is the middle tab scaled evenly, so it follows the same path and size)
          var or2 = rectOf(oldP);
          oldP.style.transformOrigin = "0 0";
          var sn = st.snap, oldLights = oldP.querySelector(".traffic-lights");
          if (sn && sn.html) {
            // the old tab's content, as a copy at the tab's size, scaled to the edge tab's proportions: it goes on being carried by the old tab to the end of its movement, and fades out
            // only at the very end, when the tab has all but left the window (the edge tab's own lights take over from the copy's)
            var wrap = document.createElement("div");
            wrap.className = String(sn.cls).split(/\s+/).filter(function (c) { return c && c !== "page-canvas" && c !== "page-canvas--case" && c !== "is-open"; }).join(" ");
            wrap.setAttribute("style", sn.vars + ";position:absolute;left:0;top:0;margin:0;box-sizing:border-box;display:flex;flex-direction:column;width:" + sn.W + "px;height:" + sn.H + "px;padding:" + sn.pad + ";gap:" + sn.gap + ";overflow:hidden;border-radius:40px;pointer-events:none;transform-origin:0 0;transform:scale(" + (or2.height / sn.H) + ")");
            wrap.innerHTML = sn.html;
            var wh = wrap.querySelector(".case-hero"); if (wh) wh.style.minHeight = sn.heroMin;
            oldP.appendChild(wrap);
            if (oldLights) play(oldLights, [{ opacity: 0 }, { opacity: 1 }], { duration: MSa * 0.2, delay: MSa * 0.8, easing: "linear", fill: "both" });
            play(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: MSa * 0.28, delay: MSa * 0.72, easing: "ease-in", fill: "both" }).onfinish = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
          }
          play(oldP, [{ translate: (tabR2.left - or2.left) + "px " + (tabR2.top - or2.top) + "px", scale: String(tabR2.height / or2.height) }, { translate: "0 0", scale: "1" }], { duration: MSa, easing: CURVE, fill: "both" });
        }
        // the old page's background colours, still fading out over this page's
        var bg = document.querySelector(".case-bg");
        if (bg && st.prev) {
          var bgOld = bg.cloneNode(true);
          bgOld.className = bg.className.replace(/case-bg--\w+/, "case-bg--" + st.prev);
          bgOld.style.zIndex = getComputedStyle(bg).zIndex === "auto" ? "0" : getComputedStyle(bg).zIndex;
          bg.parentNode.insertBefore(bgOld, bg.nextSibling);
          play(bgOld, [{ opacity: 1 }, { opacity: 0 }], { duration: MSa * 0.75, easing: "ease-in-out", fill: "both" }).onfinish = function () { if (bgOld.parentNode) bgOld.parentNode.removeChild(bgOld); };
        }
        if (st.entered) { var scr = document.querySelector(".dm-scroll"); if (scr) scr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: "backwards", easing: "ease-out" }); } // (the content's entrance has already been played in the old page, on this tab)
        else contentIn();
        // The time that has passed is read again at the moment the first frame is drawn: between this script and that frame a variable amount of time (the page's first render takes from
        // a few to 100+ ms) goes by, and a movement started from the time read here would be that much behind the old page's, a visible step back that happens one time in a few.
        requestAnimationFrame(function () {
          var e2 = Math.max(0, Math.min(MSa + 50, Date.now() - st.t0));
          replays.forEach(function (a) {
            try { a.currentTime = e2; } catch (e) {}
            // Once an animation has finished it is let go: its end state is what the page's own css gives anyway, and a finished animation that is kept (fill: both) goes on overriding
            // the tab's own transform for good, so that when the page is scrolled and the tab grows (its scale goes from the first screen's to 1) it would stay stuck at the first scale.
            a.finished.then(function () { try { a.cancel(); } catch (e) {} }, function () {});
          });
        });
      }
    } catch (e) {}
    }
    // A page that the other case studies prerendered in the background (see the speculation rules below) is not shown until it is activated by the click: do it then
    if (document.prerendering) document.addEventListener("prerenderingchange", arrive, { once: true }); else arrive();

    function rectOf(el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    function box(r, radius, extra) {
      var o = { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", marginTop: "0px", borderRadius: radius + "px" };
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    }

    peeks.forEach(function (p) {
      var side = sideOf(p), key = goKey(p);
      p.classList.add("is-link");
      p.addEventListener("click", function () {
        if (going || window.__caseClosing || !visible()) return;
        going = true; window.__caseGoing = true; // (the back arrow and the nav's Work take no clicks while the tabs turn, and the tabs none while the page closes)
        if (window.__xLock) window.__xLock(2700); // (no clicks, scrolling or keys while the tabs turn)
        var url = key + ".html";
        var bgNow = document.querySelector(".case-bg"), prevKey = bgNow && (bgNow.className.match(/case-bg--(\w+)/) || [])[1];
        var snap = null;
        try {
          var tb = tab.querySelector(".dm-topbar"), hr = tab.querySelector(".case-hero"), tcs = getComputedStyle(tab);
          snap = { html: (tb ? tb.outerHTML : "") + (hr ? hr.outerHTML : ""), cls: canvas.className, vars: canvas.getAttribute("style") || "", pad: tcs.padding, gap: tcs.rowGap, W: tab.offsetWidth, H: tab.offsetHeight, heroMin: hr ? getComputedStyle(hr).minHeight : "0px" };
        } catch (e) {}
        // (what the next page picks up is written only when the page is really swapped, see go(): a rotation that is left half way, with the browser's Back button, leaves nothing behind)
        var xs = { side: side, t0: Date.now(), ms: 1450, prev: prevKey || "", snap: snap, to: url };
        if (reduce || !tab || !tab.animate) { location.href = url; return; }
        var MS = 1450, SLIDE_DELAY = MS * 0.02, SLIDE_MS = MS * 0.46, SWAP = MS * 0.78, outMs = 0; // the content slides out early and is gone well before SWAP; the next page takes over at SWAP, when the tab is already in the slow tail of its movement (a swap takes a moment during which the old page stands still, and while the tab is moving fast that shows as a jump)
        contentOut();
        function rotate() {
          // where everything is now (the hover offset is taken away first)
          allPeeks.forEach(function (q) { q.style.transition = "none"; q.style.transform = "none"; });
          var tabR = rectOf(tab), pr = rectOf(p);
          var opp = allPeeks.filter(function (q) { return sideOf(q) !== side; })[0];      // the edge tab on the other side
          var oppR = opp ? rectOf(opp) : { left: side === "left" ? window.innerWidth - 74 : 74 - pr.width, top: pr.top, width: pr.width, height: pr.height };
          // The edge tabs are the middle tab scaled down evenly (same proportions), so everything here is ONE movement per tab, made of translate and scale only (nothing that needs the
          // page to be laid out again or redrawn every frame): the middle tab scales down and travels to the opposite edge with its content on it (the content is clipped by the tab's
          // own edge, so it needs no extra clipping), the clicked edge tab scales up into the middle, and the third one slides away. All with one soft, long-tailed curve.
          var CURVE = "cubic-bezier(0.45, 0.05, 0.2, 1)"; // eases in a little and settles slowly: soft at both ends
          var W = tab.offsetWidth, H = tab.offsetHeight, s0 = tabR.width / W, sE = oppR.height / H;
          var tcx = tabR.left + tabR.width / 2, ocx = oppR.left + oppR.width / 2;
          tab.classList.add("dx-leaving");
          tab.animate([{ transform: "scale(" + s0 + ")" }, { transform: "scale(" + sE + ")" }], { duration: MS, easing: CURVE, fill: "forwards" });
          // (the shrunk tab's inner edge lands exactly on the edge slot's inner edge: when the middle tab is narrower than the design's (a narrower or shorter window) it is not the edge tab's
          // proportions any more, and centred on the slot it would end up wholly outside the window, to pop in only when the page is swapped)
          var endW = W * sE, endCx = (ocx < tcx) ? (oppR.left + oppR.width - endW / 2) : (oppR.left + endW / 2);
          tab.animate([{ translate: "0 0" }, { translate: (endCx - tcx) + "px " + (oppR.top - tabR.top) + "px" }], { duration: MS, easing: CURVE, fill: "forwards" });
          // the clicked tab grows into the middle. It is made exactly like the middle tab: the tab's own (unscaled) size, scaled about its top centre in the same way, so that at the end its
          // rim, blur, shadows and lights are rendered at exactly the scale the next page's real tab has (otherwise they change a little when the page swaps). It starts scaled down to
          // the edge tab's size and grows to the tab's scale; scaling a picture up from a smaller version makes it soft, so it is never drawn small and enlarged.
          var kStart = pr.height / H, pcx = pr.left + pr.width / 2;
          p.style.zIndex = "1"; p.style.transformOrigin = "50% 0"; p.style.marginTop = "0px"; p.style.borderRadius = "40px"; p.classList.add("dx-as-tab");
          p.style.left = (tcx - W / 2) + "px"; p.style.top = tabR.top + "px"; p.style.width = W + "px"; p.style.height = H + "px";
          p.animate([{ translate: (pcx - tcx) + "px " + (pr.top - tabR.top) + "px", scale: String(kStart) }, { translate: "0 0", scale: String(s0) }], { duration: MS * 0.94, delay: MS * 0.06, easing: CURVE, fill: "both" });
          // the third tab: the old edge tab on the other side goes off, and (the three of them go round) it comes back in from the far side into the slot the clicked tab left, so that
          // when the animation ends all three are exactly where the next page has them
          if (opp) {
            var third = opp.cloneNode(true);
            third.classList.remove("is-link"); third.removeAttribute("data-peek"); third.removeAttribute("data-go");
            third.style.cssText = "pointer-events:none;left:" + pr.left + "px;transform:none;";
            p.parentNode.insertBefore(third, p);
            third.animate([{ translate: (side === "left" ? -1 : 1) * 520 + "px 0", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: MS * 0.7, delay: MS * 0.3, easing: CURVE, fill: "both" });
          }
          // the old edge tab on the other side makes room and leaves (without its blur, which is the costliest thing to redraw)
          allPeeks.forEach(function (q) { if (q !== p) { q.style.backdropFilter = "none"; q.style.webkitBackdropFilter = "none"; } });
          if (opp) opp.animate([{ translate: "0 0", opacity: 1 }, { translate: (side === "left" ? 1 : -1) * 460 + "px 0", opacity: 0 }], { duration: MS * 0.8, easing: CURVE, fill: "forwards" });
          // (The old content is carried along by the shrinking, travelling tab and fades out at the very end of the movement, like the copy that the next page carries on with, see arrive().)
          Array.prototype.forEach.call(tab.querySelectorAll(".dm-topbar, .case-hero"), function (c) { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MS * 0.28, delay: MS * 0.72, easing: "ease-in", fill: "forwards" }); });
          // the background colours melt into the next page's: its own background (same shapes) fades in over this one
          var bg = document.querySelector(".case-bg");
          if (bg) {
            var bg2 = bg.cloneNode(true);
            bg2.className = bg.className.replace(/case-bg--\w+/, "case-bg--" + key);
            bg2.style.zIndex = getComputedStyle(bg).zIndex === "auto" ? "0" : getComputedStyle(bg).zIndex;
            bg.parentNode.insertBefore(bg2, bg.nextSibling);
            bg2.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MS * 0.75, easing: "ease-in-out", fill: "forwards" }); // (a shorter fade than the tabs' movement: while the colours change, every blurred glass tab has to be redrawn on each frame)
          }
        }
        rotate();
        var done = false, entered = false;
        window.addEventListener("pagehide", function () { done = true; }); // (a rotation that is left half way, with the browser's Back button, must not finish when the page comes back from the cache: its timers would carry on and open the next page)
        function go() { if (done) return; done = true; xs.entered = entered; try { localStorage.setItem("xSlide", JSON.stringify(xs)); } catch (e) {} location.href = url; }
        // The next page's content comes in HERE, on the tab that is growing into the middle, as soon as the tab is on its way (ENT_AT), with the full entrance of the opening from the Work
        // page. The page is swapped only when all of it has come in and everything has stopped: the swap (a page load is a pause of ~80ms that cannot be made shorter) then happens
        // while nothing moves, so there is nothing to stutter, and the entrance is not held back by it. If the page cannot be fetched in time the old way is used (swap while the tab settles).
        var ENT_AT = MS * 0.4, ENT_LEN = 1500;
        var pageP = fetch(url).then(function (r) { return r.text(); }).catch(function () { return ""; });
        setTimeout(function () {
          pageP.then(function (txt) {
            if (done) return;
            try {
              var d = new DOMParser().parseFromString(txt, "text/html");
              var dc = d.querySelector(".page-canvas--damai"), dt = d.querySelector(".glass-card--case");
              var tb = dt && dt.querySelector(".dm-topbar"), hr = dt && dt.querySelector(".case-hero");
              if (!dc || !tb || !hr || !snap) { go(); return; }
              var wrap = document.createElement("div");
              wrap.className = String(dc.className).split(/\s+/).filter(function (c) { return c && c !== "page-canvas" && c !== "page-canvas--case" && c !== "is-open"; }).join(" ");
              wrap.setAttribute("style", snap.vars + ";position:absolute;left:0;top:0;margin:0;box-sizing:border-box;display:flex;flex-direction:column;width:" + snap.W + "px;height:" + snap.H + "px;padding:" + snap.pad + ";gap:" + snap.gap + ";overflow:hidden;border-radius:40px;pointer-events:none;");
              wrap.innerHTML = tb.outerHTML + hr.outerHTML;
              var wh = wrap.querySelector(".case-hero"); if (wh) wh.style.minHeight = snap.heroMin;
              p.appendChild(wrap);
              // the next page's description fits its own line (what was copied from this page is this page's font size)
              try {
                var wm = wrap.querySelector(".dm-hero-text__main"), wd = wm && wm.querySelector(".case-hero__desc");
                if (wd) {
                  wrap.style.setProperty("--desc-fs", "24px"); // (set, not removed: the copy sits inside this page, whose own fitted size it would otherwise inherit)
                  var wr = document.createRange(); wr.selectNodeContents(wd);
                  var wn = wr.getBoundingClientRect().width, wa = wm.getBoundingClientRect().width;
                  if (wn > wa && wn > 0) wrap.style.setProperty("--desc-fs", (Math.floor((24 * wa / wn) * 10) / 10) + "px");
                }
              } catch (e) {}
              entered = true;
              contentIn(wrap, snap.W);
              setTimeout(go, ENT_LEN + 80);
            } catch (e) { go(); }
          });
        }, ENT_AT);
        setTimeout(function () { if (!entered) go(); }, ENT_AT + 1200); // (the page has not arrived in time: the old way)
      });
    });
    addEventListener("pageshow", function (e) { if (!e.persisted) return; if (going) location.reload(); else going = false; }); // (restored from the back/forward cache in the middle of a rotation: start again from a clean page)
  })();
  // ---- 6. the case study that a side tab leads to is prerendered in the background once the pointer is on that tab (Chrome's speculation rules), so the click's page swap is quicker.
  //         (Not all of them at page load: prerendering two whole pages while the page itself is still animating in is a lot of background work, and it can make a click shortly after
  //         arriving stutter.) Without support nothing changes: the page just loads normally. ----
  (function () {
    if (document.prerendering || !HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;
    var asked = {};
    Array.prototype.forEach.call(document.querySelectorAll(".dm-peek[data-peek], .dm-peek[data-go]"), function (p) {
      var key = p.getAttribute("data-go") || p.getAttribute("data-peek");
      if (!key || key === "none") return;
      function ask() {
        if (asked[key]) return;
        asked[key] = true;
        var s = document.createElement("script");
        s.type = "speculationrules";
        s.textContent = JSON.stringify({ prerender: [{ source: "list", urls: [key + ".html"], eagerness: "immediate" }] });
        document.head.appendChild(s);
      }
      p.addEventListener("pointerenter", ask); p.addEventListener("touchstart", ask, { passive: true });
    });
  })();
})();

// ---- 7. coming back to a case study that was left part-way down, with the browser's Forward (or Back) button: the page is at that place, and the pieces of text and pictures that are
//         on screen lift a little and fade in, one after another from the top (nothing else moves: not the glass, not the nav, not what is out of sight) ----
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var t = document.querySelector(".glass-card--case");
  if (reduce || !t || !t.animate) return;
  var SEL = ".dm-illus, .case-hero__title, .case-hero__desc, .dm-hero-text__meta, .dx-sec > *, .dx-end > *";
  function lift() {
    var vh = window.innerHeight, list = Array.prototype.filter.call(document.querySelectorAll(SEL), function (el) {
      var r = el.getBoundingClientRect();
      return r.height > 0 && r.bottom > 60 && r.top < vh - 20;
    });
    list = list.filter(function (el) { return !list.some(function (o) { return o !== el && o.contains(el); }); }); // (the outer piece, not the pieces inside it too)
    list.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    list.forEach(function (el, i) {
      el.animate([{ opacity: 0, translate: "0 26px" }, { opacity: 1, translate: "0 0" }], { duration: 650, delay: Math.min(i, 8) * 50, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" });
    });
  }
  // restored from the browser's back/forward cache: the page is exactly as it was left
  window.addEventListener("pageshow", function (e) { if (e.persisted && window.scrollY > 2) lift(); });
  // loaded again: the position is put back by the page's own script (it scrolls there as soon as the page is tall enough): what is hidden meanwhile comes in once it is there
  if (window.__xRestored > 2) {
    var hold = document.createElement("style");
    hold.textContent = ".glass-card--case > *:not(.traffic-lights) { opacity: 0 !important; }";
    document.head.appendChild(hold);
    var t0 = performance.now();
    (function wait() {
      if (Math.abs(window.scrollY - window.__xRestored) < 3 || performance.now() - t0 > 3000) { hold.remove(); lift(); return; }
      requestAnimationFrame(wait);
    })();
  }
})();

// ---- 8. reaching a case study with the browser's Back / Forward buttons: ONE small, fixed movement, whatever the browser did with the page (restored it from its cache or loaded it again) or where
//         the visitor came from: the first screen and the two edge tabs come in a little from the side they are behind (Back: from the left, Forward: from the right), fading in.
//         (Nothing heavier is tried for these buttons: the Work page's cards turning into this page and back are played only by the buttons on the pages themselves.) ----
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tab = document.querySelector(".glass-card--case");
  if (reduce || !tab || !tab.animate) return;
  function entry(dir) { // dir: -1 = came with Back (from the left), 1 = came with Forward (from the right)
    if (window.scrollY > 2 || window.__xRestored > 2 || !window.matchMedia("(min-width: 1000px)").matches) return;
    if (window.__xLock) window.__xLock(950);
    var els = [tab].concat(Array.prototype.slice.call(document.querySelectorAll(".dm-peek")));
    els.forEach(function (el, i) {
      el.animate([{ translate: (dir * 72) + "px 0", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: 600, delay: i * 70, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" });
    });
  }
  // loaded again by Back or Forward
  var act = window.navigation && window.navigation.activation;
  if (act && act.navigationType === "traverse" && act.from && act.entry && act.from.index >= 0) entry(act.entry.index < act.from.index ? -1 : 1);
  // restored from the back/forward cache (the browser's record of the navigation is not reliable then): how this page was LEFT tells which way it comes back: left by going forward (a link, a button,
  // Forward) -> it can only come back with Back; left with Back -> it can only come back with Forward
  var left = "forward";
  if (window.navigation && navigation.addEventListener) navigation.addEventListener("navigate", function (e) {
    left = (e.navigationType === "traverse" && e.destination && e.destination.index < navigation.currentEntry.index) ? "back" : "forward";
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) entry(left === "forward" ? -1 : 1); });
})();

// ---- 9. in the middle state the description under the title stays on ONE line: when the room beside Year / Role is not enough for it at 24px, its font gets smaller (as small as needed). It grows
//         back to 24px as the tab turns white (css/damai-exp-cover.css: --desc-fs and --g). ----
(function () {
  var canvas = document.querySelector(".page-canvas--damai"), row = document.querySelector(".glass-card--case .dm-hero-text"); // (this page's own: arriving through an edge tab, a copy of the OLD page's first screen sits in an edge tab for a moment, earlier in the page)
  if (!canvas || !row) return;
  var main = row.querySelector(".dm-hero-text__main"), desc = main && main.querySelector(".case-hero__desc");
  if (!desc) return;
  var mid = window.matchMedia("(min-width: 1000px)");
  function fit() {
    if (!mid.matches) { canvas.style.removeProperty("--desc-fs"); return; }
    var prev = canvas.style.getPropertyValue("--g");
    canvas.style.setProperty("--g", "0"); // measured on the first screen, at the normal 24px
    canvas.style.removeProperty("--desc-fs");
    var avail = main.getBoundingClientRect().width, r = document.createRange();
    r.selectNodeContents(desc);
    var natural = r.getBoundingClientRect().width, fs = natural > avail && natural > 0 ? Math.floor((24 * avail / natural) * 10) / 10 : 24;
    canvas.style.setProperty("--g", prev || "0");
    if (fs < 24) canvas.style.setProperty("--desc-fs", fs + "px");
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

