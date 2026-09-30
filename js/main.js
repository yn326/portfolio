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
// crossed a reference line (30% down the viewport) as .is-current.
function initScrollspy() {
  const nav = document.querySelector(".scrollspy");
  if (!nav) return;
  const pairs = [...nav.querySelectorAll(".scrollspy__item")]
    .map((item) => ({ item, section: document.querySelector(item.getAttribute("href")) }))
    .filter((p) => p.section);
  if (!pairs.length) return;

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
  const links = document.querySelectorAll('.hero-nav__item[href$="work.html"], .hero-nav__item[href$="about.html"]');
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

document.addEventListener("DOMContentLoaded", () => {
  initWorkRing();
  initPageNavFade();
  initNoteModal();
  initAboutPhotoHover();
  initScrollspy();
  initHomeBgEntrance();
  initHomeBgExit();
});
