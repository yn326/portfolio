// About page: note modal
function initNoteModal() {
  const trigger = document.querySelector("[data-open-note]");
  const overlay = document.querySelector("[data-note-overlay]");
  if (!trigger || !overlay) return;
  const close = overlay.querySelector("[data-close-note]");
  const modal = overlay.querySelector(".modal");

  trigger.addEventListener("click", () => overlay.classList.add("is-open"));
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      overlay.classList.add("is-open");
    }
  });
  close?.addEventListener("click", () => overlay.classList.remove("is-open"));
  overlay.addEventListener("click", (e) => {
    if (modal && !modal.contains(e.target)) overlay.classList.remove("is-open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") overlay.classList.remove("is-open");
  });
}

// About page: swap the photo-strip subtitle on photo hover
function initAboutPhotoHover() {
  const subtitle = document.querySelector(".about-header__subtitle");
  const photos = document.querySelectorAll(".photo-space__img[data-hover-text]");
  if (!subtitle || !photos.length) return;
  // innerHTML (not textContent) so the "hover"/"click" word span survives the round trip.
  const defaultHTML = subtitle.innerHTML;

  photos.forEach((photo) => {
    photo.addEventListener("mouseenter", () => {
      subtitle.textContent = photo.dataset.hoverText;
    });
    photo.addEventListener("mouseleave", () => {
      subtitle.innerHTML = defaultHTML;
    });
  });
}

// Case-study scrollspy: marks whichever section's top has most recently
// crossed a reference line (30% down the viewport) as .is-current on its
// sidebar nav dot.
function initScrollspy() {
  const nav = document.querySelector(".scrollspy");
  if (!nav) return;
  const pairs = [...nav.querySelectorAll(".scrollspy__item")]
    .map((item) => ({ item, section: document.querySelector(item.getAttribute("href")) }))
    .filter((p) => p.section);
  if (!pairs.length) return;
  pairs.forEach((p, i) => {
    p.item.style.setProperty("--i", i);
    p.item.style.setProperty("--r", pairs.length - 1 - i);
  });

  let ticking = false;
  function update() {
    ticking = false;
    const line = window.innerHeight * 0.3;
    let current = pairs[0];
    for (const pair of pairs) {
      if (pair.section.getBoundingClientRect().top <= line) current = pair;
    }
    for (const pair of pairs) {
      pair.item.classList.toggle("is-current", pair === current);
    }
    // Only show the nav once the reader reaches the first marked section.
    nav.classList.toggle("is-visible", pairs[0].section.getBoundingClientRect().top <= line);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

// Case-study white frames (the hero title/CTA card plus each .case-section)
// scale up a touch while the reader is on them. Separate from initScrollspy
// above -- that one only tracks sections with a sidebar nav entry, which
// left out .case-hero__card entirely, and needed its own reference line for
// a different purpose. A frame counts as current once its own top has
// scrolled up to/past the line, so a line further DOWN the viewport (a
// bigger percentage) means less scrolling is needed to cross it -- it
// triggers sooner, while the frame's still mostly below the fold, not
// later. (Got this backwards on the first pass: went 30%->15% meaning to
// make it earlier and actually made it later, since a smaller number is a
// line closer to the top. 65% -- most of the way down the viewport --
// actually triggers early.)
// EXPERIMENT switch for the white case-study frames:
//   "reveal" = a frame slides up and fades in once, as it first scrolls into view (no enlarging)
//   "focus"  = the original behaviour: the frame the reader is on enlarges slightly (code below, untouched)
const CASE_FRAME_EFFECT = "reveal";

// Slide-up + fade-in. Frames already on screen at load are left alone; the rest start hidden (class added by
// script, so with JS off everything stays visible) and get .is-revealed the first time their top passes 95% of the
// viewport height. Styles: .case-section.reveal-ready in style.css.
function initCaseFrameReveal(frames) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;
  const line = window.innerHeight * 0.95;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -5% 0px", threshold: 0 }
  );
  frames.forEach((frame) => {
    // Already above the line (or scrolled past, e.g. when reloaded part-way down): nothing to animate.
    if (frame.getBoundingClientRect().top < line) return;
    frame.classList.add("reveal-ready");
    io.observe(frame);
  });
}

function initCaseFrameFocus() {
  // The hero card (heading box at the top) deliberately does not take part: it stays put and only the sections enlarge.
  const frames = document.querySelectorAll(".case-section.case-section--built");
  if (!frames.length) return;
  if (CASE_FRAME_EFFECT === "reveal") {
    // The coloured "Final designs" sections (section.case-final) join in too; they never took part in the enlarge.
    initCaseFrameReveal(document.querySelectorAll(".case-section.case-section--built, section.case-final"));
    return;
  }

  // Don't focus anything until the reader actually scrolls -- otherwise the
  // hero card pops in already-expanded on load, before they've done
  // anything, which reads as pre-decided rather than a response to where
  // they're looking.
  let hasScrolled = window.scrollY > 0;
  let ticking = false;

  function update() {
    ticking = false;
    if (!hasScrolled) return;
    const line = window.innerHeight * 0.5; // was 0.65: a smaller number = a line nearer the top = the frame enlarges later
    let current = null; // none until the first section's top reaches the line
    for (const frame of frames) {
      if (frame.getBoundingClientRect().top <= line) current = frame;
    }
    for (const frame of frames) {
      frame.classList.toggle("is-focused", frame === current);
    }
  }
  function scheduleUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  function onScroll() {
    hasScrolled = true;
    scheduleUpdate();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
}

// Work/About tab edge ring: the two "dim" corners of the ring gradient sit at
// arctan(halfW / halfH) of the tab, which changes as the tab resizes/reflows.
function initWorkRing() {
  const card = document.querySelector(".glass-card--work, .glass-card--about");
  if (!card || typeof ResizeObserver === "undefined") return;
  function update() {
    const { width, height } = card.getBoundingClientRect();
    if (!width || !height) return;
    const tr = (Math.atan2(width / 2, height / 2) * 180) / Math.PI / 3.6;
    card.style.setProperty("--ring-tr", tr.toFixed(2) + "%");
    card.style.setProperty("--ring-bl", (tr + 50).toFixed(2) + "%");
  }
  new ResizeObserver(update).observe(card);
  update();
}

// Small Home/Work/About(/back) icon row above the glass tab -- .page-nav on
// Work/About, .case-nav on the Muji/Wapoo/Damai case studies (same
// component, different class per page). Fades out as the page scrolls, and
// travels upward a bit faster than the normal 1:1 scroll rate on top of
// that (position:absolute, so it's already moving with scroll -- this adds
// extra drift on top, a small parallax against the glass tab scrolling
// underneath it at the normal rate) -- no shrink.
function initPageNavFade() {
  const nav = document.querySelector(".page-nav, .case-nav");
  if (!nav) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const FADE_DISTANCE = 120; // scrollY (px) at which the nav is fully faded
  const RETREAT_PX = 28; // extra upward drift added on top of the normal scroll, at full fade
  let ticking = false;

  function update() {
    ticking = false;
    const progress = Math.min(Math.max(window.scrollY / FADE_DISTANCE, 0), 1);
    nav.style.opacity = String(1 - progress);
    nav.style.transform = `translate(-50%, ${(-progress * RETREAT_PX).toFixed(2)}px)`;
    nav.style.pointerEvents = progress >= 0.99 ? "none" : "";
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
}

// Case-study prototype videos (Damai Final designs): they autoplay muted and loop. Each gets a
// floating bar at the bottom in the style of Safari's inline video controls (frosted dark pill,
// play/pause + scrubber), inset from the video's rounded corners. Click the video to toggle too.
// Shown on hover, keyboard focus, while paused and on touch screens. Reduced-motion visitors get
// the videos paused to start with.
function initCaseVideos() {
  const boxes = document.querySelectorAll(".case-final-row__video");
  if (!boxes.length) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PAUSE = '<svg class="vc__pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.4" height="12" rx="1.1"/><rect x="9.6" y="2" width="3.4" height="12" rx="1.1"/></svg>';
  const PLAY = '<svg class="vc__play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.9v10.2a.6.6 0 0 0 .92.5l8-5.1a.6.6 0 0 0 0-1l-8-5.1A.6.6 0 0 0 4 2.9z"/></svg>';
  boxes.forEach((box) => {
    const video = box.querySelector("video");
    if (!video) return;
    const bar = document.createElement("div");
    bar.className = "vc";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Video controls");
    bar.innerHTML =
      '<button type="button" class="vc__btn">' + PAUSE + PLAY + "</button>" +
      '<input class="vc__scrub" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">';
    const btn = bar.querySelector(".vc__btn");
    const scrub = bar.querySelector(".vc__scrub");
    let raf = 0;
    let dragging = false;
    let resumeAfter = false;

    function progress() {
      const d = video.duration;
      const frac = d && isFinite(d) ? video.currentTime / d : 0;
      scrub.value = String(Math.round(frac * 1000));
      scrub.style.setProperty("--p", (frac * 100).toFixed(2) + "%");
      scrub.setAttribute("aria-valuetext", Math.round(video.currentTime) + " of " + Math.round(d || 0) + " seconds");
    }
    function tick() {
      if (!dragging) progress();
      raf = video.paused ? 0 : requestAnimationFrame(tick);
    }
    function sync() {
      const paused = video.paused;
      box.classList.toggle("is-paused", paused);
      btn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
      if (!paused && !raf) raf = requestAnimationFrame(tick);
      if (paused) progress();
    }
    function toggle() {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }

    btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    bar.addEventListener("click", (e) => e.stopPropagation());
    box.addEventListener("click", toggle);
    scrub.addEventListener("pointerdown", () => {
      dragging = true;
      resumeAfter = !video.paused;
      video.pause();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      if (resumeAfter) video.play().catch(() => {});
    };
    scrub.addEventListener("pointerup", endDrag);
    scrub.addEventListener("pointercancel", endDrag);
    scrub.addEventListener("input", () => {
      const d = video.duration;
      if (d && isFinite(d)) video.currentTime = (scrub.value / 1000) * d;
      scrub.style.setProperty("--p", (scrub.value / 10).toFixed(2) + "%");
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("loadedmetadata", progress);
    if (reduce) video.pause();
    box.appendChild(bar);
    sync();
  });
}

// EXPERIMENT switch for the top nav:
//   true  = the nav is pinned to the viewport. It fades away as you scroll down, and
//           slides back in with a progressive blur along the top edge as soon as you scroll up.
//   false = the old behaviour (initPageNavFade: fades away near the top and stays gone).
const NAV_REVEAL = true;

function initPageNavReveal() {
  const nav = document.querySelector(".page-nav, .case-nav");
  if (!nav) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const FADE_DISTANCE = 120; // same top-of-page fade as initPageNavFade
  const RETREAT_PX = 28;
  const FOLLOW = 56; // natural top is 80px; pinned sits 24px from the top of the window
  const DIRECTION_PX = 8; // ignore tiny scroll jitters

  // A full-width progressive blur along the top edge (three stacked blur layers with
  // different strengths and fade-out masks, see .nav-blur in style.css). It is a
  // sibling of the nav (not a child) because the nav carries a view-transition-name,
  // which makes it a backdrop root and would stop a blur inside it from seeing the page
  // behind it. It sits right before the nav so both share a stacking context (page
  // wrappers like .a2-page create their own).
  const capsule = document.createElement("div");
  capsule.className = "nav-blur";
  capsule.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) capsule.appendChild(document.createElement("i"));
  nav.parentNode.insertBefore(capsule, nav);
  nav.classList.add("is-reveal");

  let lastY = window.scrollY;
  let revealed = false; // true once the reader scrolls up, until they scroll down again
  let ticking = false;

  function update() {
    ticking = false;
    const y = Math.max(window.scrollY, 0);
    const dy = y - lastY;
    if (dy > DIRECTION_PX) revealed = false;
    else if (dy < -DIRECTION_PX) revealed = true;
    if (Math.abs(dy) > DIRECTION_PX) lastY = y;

    let opacity;
    let shift;
    if (revealed) {
      // Pinned 24px from the top of the window. Within the last FOLLOW px of the
      // scroll it rides along with the page instead (top = 80 - scrollY), so it
      // glides down into its normal spot and never sits on the glass tab.
      opacity = 1;
      shift = -Math.min(y, FOLLOW);
    } else if (y < FADE_DISTANCE) {
      // Scrolling down from the top: ride away with the page (shift = -y, i.e. exactly
      // where the old in-page nav would be) plus the extra drift, while fading. The glass
      // tab below it moves at the same speed, so the two never overlap.
      const progress = y / FADE_DISTANCE;
      opacity = 1 - progress;
      shift = -y - progress * RETREAT_PX;
    } else {
      opacity = 0;
      shift = -(FOLLOW + RETREAT_PX);
    }
    nav.style.opacity = String(opacity);
    nav.style.transform = `translate(-50%, ${shift.toFixed(2)}px)`;
    nav.style.pointerEvents = opacity < 0.01 ? "none" : "";
    // No transform easing while the nav tracks the scroll position (it would lag behind it).
    const following = revealed ? y <= FOLLOW + DIRECTION_PX : y < FADE_DISTANCE;
    nav.style.transition = following ? "opacity 0.3s ease" : "";
    capsule.classList.toggle("is-on", revealed && y > FOLLOW);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
}

// Home background shapes: the drop-in used to run unconditionally from the
// moment style.css was parsed, which meant a slow first paint (bad network,
// a cold cache) ate into the animation's own timeline -- the shapes could
// already be mid-fall, or done, by the time the page was actually visible.
// Gating the animation behind a class added once the page is genuinely
// ready to be looked at decouples "how long the shapes take to fall" from
// "how long the page took to load": whatever that load time was, the visitor
// always sees the complete drop starting from the top, once.
//
// The class goes directly onto each .home-bg__shape element (not <html> or
// a wrapper) so the CSS rule that keys off it (.home-bg__shape--N.home-bg-
// ready in style.css) has a genuinely identical specificity to .home-bg__
// shape--N.is-exiting -- both are just two classes on the same element, no
// type/id selectors involved. Two earlier attempts got this wrong: a
// wrapper class made the entrance rule MORE specific outright, and using
// <html> as the flag host looked equal (two classes either way) but "html"
// is itself a type selector that silently adds its own specificity point.
// With a true tie, the cascade falls back to source order, and .is-exiting
// is declared later in style.css, so it correctly wins whenever both
// classes are present during exit.
function initHomeBgEntrance() {
  const shapes = document.querySelectorAll(".home-bg__shape");
  if (!shapes.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    shapes.forEach((shape) => shape.classList.add("home-bg-ready"));
    return;
  }
  const MAX_WAIT_MS = 1200;
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const cap = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS));
  Promise.race([fontsReady, cap]).then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        shapes.forEach((shape) => shape.classList.add("home-bg-ready"));
      });
    });
  });
}

// Home background shapes: before leaving for Work/About, let each shape keep
// falling out the bottom of the screen the same way it fell in on load --
// literally the same mechanism, not a lookalike. The drop-in is a plain CSS
// @keyframes animation with its own static duration/delay per shape (see
// .home-bg__shape--N / home-bg-drop-N in style.css), which is what makes it
// read as organic instead of a synchronized drop. The exit reuses that exact
// setup (home-bg-exit-N, same per-shape durations/delays as home-bg-drop-N)
// so it's the same staggered motion in reverse, not a separate hand-tuned
// JS animation -- that's what made the fall-out feel uniform before.
//
// Only two things can't be known until the moment of the click, so they're
// supplied as CSS custom properties right before the .is-exiting class (which
// switches the shape onto home-bg-exit-N) is added:
//   --exit-from: wherever the float loop currently is (its animations are
//     paused and read via the computed transform matrix first).
//   --exit-to: how far it needs to fall, computed from its real on-screen
//     position (getBoundingClientRect), not a fixed px amount -- the shapes
//     live inside .home-bg__canvas, which is scaled to cover the viewport
//     and can be scaled *below* 1 on a browser window smaller than the
//     1440x900 design canvas, so a fixed local-space distance could map to
//     fewer real screen px than needed and fade out short of the fold.
//     Dividing the needed real-px travel by the canvas's current scale keeps
//     it bottoming out below the viewport (with margin) on any window size.
function initHomeBgExit() {
  const canvas = document.querySelector(".home-bg__canvas");
  const shapes = document.querySelectorAll(".home-bg__shape");
  // The fall-out is no longer used by any live link: Home -> About and Home -> Work (Work 4.0) morph the shapes
  // into the next page's matching shapes instead (view-transition names, see style.css). It's kept for the
  // archived old Work page (work-v1.html); to bring it back for Work or About, list that link here, e.g.
  // '.hero-nav__item[href$="work.html"]' or '.hero-nav__item[href$="about.html"]'.
  const links = document.querySelectorAll('.hero-nav__item[href$="work-v1.html"]');
  if (!canvas || !shapes.length || !links.length) return;
  const CLEAR_MARGIN = 80;
  const FALLBACK_MS = 1500;
  let exiting = false;

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (exiting) {
        e.preventDefault();
        return;
      }
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target && link.target !== "_self") return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      e.preventDefault();
      exiting = true;

      const canvasScale = new DOMMatrixReadOnly(getComputedStyle(canvas).transform).a || 1;

      const finishes = Array.from(shapes).map((shape) => {
        const running = shape.getAnimations();
        running.forEach((a) => a.pause());
        const y = new DOMMatrixReadOnly(getComputedStyle(shape).transform).m42;
        const top = shape.getBoundingClientRect().top;
        // Cancelling the running drop/float animation makes the shape fall
        // back to its plain (non-animated) CSS value for the instant before
        // .is-exiting's animation takes over -- and since .home-bg__shape's
        // own base rule now defaults to hidden (translateY(-1200px), opacity
        // 0), that's a real flash to invisible, not just a theoretical one.
        // Pinning the current position as an inline style first papers over
        // that gap: inline styles lose to any CSS animation regardless of
        // specificity, so this has zero effect once .is-exiting's animation
        // is running, it only fills the brief window where none is.
        shape.style.transform = `translateY(${y}px)`;
        shape.style.opacity = "1";
        running.forEach((a) => a.cancel());

        const realDistanceNeeded = Math.max(0, window.innerHeight - top) + CLEAR_MARGIN;
        const localDistance = realDistanceNeeded / canvasScale;

        shape.style.setProperty("--exit-from", y + "px");
        shape.style.setProperty("--exit-to", y + localDistance + "px");

        return Promise.race([
          new Promise((resolve) => {
            shape.addEventListener("animationend", function handler(ev) {
              if (ev.target !== shape) return;
              shape.removeEventListener("animationend", handler);
              resolve();
            });
            shape.classList.add("is-exiting");
          }),
          new Promise((resolve) => setTimeout(resolve, FALLBACK_MS)),
        ]);
      });

      Promise.all(finishes).then(() => {
        window.location.href = link.href;
      });
    });
  });
}

// Eased scroll for in-page links, "View final designs" and "Back to top". Safari's own `scroll-behavior: smooth` has
// no easing curve, so the page drives the scroll itself, reproducing Chrome's native smooth scroll (measured: a
// duration of about sqrt(distance) frames at 60fps, and an ease close to cubic-bezier(.4, 0, .05, 1)) so every
// browser feels the same. Any wheel / touch / key input hands control straight back to the reader.
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s;
  const Y = (s) => ((ay * s + by) * s + cy) * s;
  return (t) => {
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 24; i++) {
      s = (lo + hi) / 2;
      if (X(s) < t) lo = s; else hi = s;
    }
    return Y(s);
  };
}
const scrollEase = cubicBezier(0.4, 0, 0.05, 1);
let scrollAnim = null;
function smoothScrollTo(targetY) {
  const root = document.documentElement;
  const max = Math.max(0, root.scrollHeight - window.innerHeight);
  const to = Math.min(Math.max(0, targetY), max);
  if (scrollAnim) scrollAnim.cancel();
  const from = window.scrollY;
  const dist = to - from;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!dist || reduce) {
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, to);
    root.style.scrollBehavior = "";
    return;
  }
  const duration = Math.min(3333, Math.sqrt(Math.abs(dist)) * (1000 / 60));
  const start = performance.now();
  let raf = 0;
  root.style.scrollBehavior = "auto"; // otherwise the CSS smooth scroll fights every frame we set
  const stops = ["wheel", "touchstart", "keydown", "mousedown"];
  function finish() {
    cancelAnimationFrame(raf);
    stops.forEach((t) => window.removeEventListener(t, finish));
    root.style.scrollBehavior = "";
    scrollAnim = null;
  }
  stops.forEach((t) => window.addEventListener(t, finish, { passive: true }));
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + dist * scrollEase(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else finish();
  }
  scrollAnim = { cancel: finish };
  raf = requestAnimationFrame(step);
}
window.smoothScrollTo = smoothScrollTo;

function initSmoothAnchors() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = link.getAttribute("href");
    if (hash.length < 2) return;
    let target = null;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (err) {}
    if (!target) return;
    e.preventDefault();
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    smoothScrollTo(target.getBoundingClientRect().top + window.scrollY - margin);
    try { history.replaceState(history.state, "", hash); } catch (err) {}
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initWorkRing();
  if (NAV_REVEAL) initPageNavReveal();
  else initPageNavFade();
  initNoteModal();
  initAboutPhotoHover();
  initScrollspy();
  initSmoothAnchors();
  initCaseFrameFocus();
  initHomeBgEntrance();
  initHomeBgExit();
  initCaseVideos();
});
