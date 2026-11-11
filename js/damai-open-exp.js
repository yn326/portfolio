// Experiment: the Work page's Damai card and the Damai page's first screen ("middle state") turn into each other.
// OPENING (this file on pages/work.html, on a click on the Damai card): the card itself grows into the Damai page's first screen, and only then does the browser go to
// that page, which opens in the same state. Nothing is cross-faded by the browser: a hidden copy of the Damai page (an iframe) supplies the real final layout, and the pieces
// are clones of its elements, animated with the Web Animations API:
//   - the card's glass (a clone of the card) grows from 600 x 500 to the tab's size, scale and place; everything inside it is clipped by the glass's own edge, so the old
//     picture slides out through the edge and the new cover slides in through it;
//   - the card's three lights, title and description become the tab's: the clones are scaled (one factor on both axes) and moved from where the old ones were;
//   - the MUJI and Wapoo cards slide out to the window's edges, the background changes colour, the strip of three dashes slides out of the bottom;
//   - the address bar pops out as a circle, stretches and types its address; Year and Role rise into place.
// CLOSING (the same file inside a hidden copy of pages/work.html?closing=1 that the Damai page keeps for its back arrow, see pages/damai.html): the same animations,
// built from the Damai page's current first screen and played backwards, so everything happens in reverse order; at the end the browser goes to the Work page.
(function () {
  var EASE = 'cubic-bezier(0.76, 0, 0.24, 1)', MS = 1000;
  var FILE = location.pathname.split('/').pop(); // this page, e.g. damai.html
  var closing = /[?&]closing=1/.test(location.search);
  var narrow = window.matchMedia('(max-width: 999px)'), reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var armed = null; // a held copy of the Work page's cards, for when a case study page comes back from the back/forward cache
  // While an animation plays, the page takes no clicks, no scrolling and no keys (a transparent sheet over everything, up to `ms` ms): whatever is clicked meanwhile does nothing, so nothing
  // can be started in the middle of another. Returns the function that takes the sheet away at once (it also goes by itself after `ms`, and when a page comes back from the back/forward cache).
  window.__xLock = function (ms) {
    var el = document.createElement('div'), timer = 0;
    el.setAttribute('data-x-lock', '');
    el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483640;background:transparent;cursor:default;touch-action:none';
    function stop(e) { e.preventDefault(); e.stopPropagation(); }
    // (only up and down movement is held back: a sideways swipe on a trackpad is the browser's own Back / Forward gesture, which has to stay free)
    el.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; stop(e); }, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    // (and no key with Cmd / Ctrl / Alt: Cmd + Left Arrow and Alt + Left Arrow are the browser's Back shortcuts)
    function keys(e) { if (!e.metaKey && !e.ctrlKey && !e.altKey && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) e.preventDefault(); }
    window.addEventListener('keydown', keys, true);
    (document.body || document.documentElement).appendChild(el);
    function release() { clearTimeout(timer); window.removeEventListener('keydown', keys, true); if (el.parentNode) el.parentNode.removeChild(el); }
    timer = setTimeout(release, ms);
    return release;
  };
  window.addEventListener('pageshow', function (e) { if (e.persisted) Array.prototype.forEach.call(document.querySelectorAll('[data-x-lock]'), function (n) { n.parentNode.removeChild(n); }); });
  window.__xMakeTyper = makeTyper; // (js/case-exp-extras.js types the address the same way when one case study turns into another)

  function extract(fd, fw) {
    var q = function (s) { return fd.querySelector(s); };
    var tab = q('.glass-card--case'), T = tab.getBoundingClientRect(), cs = fw.getComputedStyle(tab);
    var box = function (el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
    var d = {
      w: innerWidth, h: innerHeight,
      T: box(tab), W1: tab.offsetWidth, H1: tab.offsetHeight, s1: T.width / tab.offsetWidth,
      pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft, gap: cs.rowGap,
      hd: q('.page-canvas--damai').style.getPropertyValue('--hd') || '1', descFs: q('.page-canvas--damai').style.getPropertyValue('--desc-fs') || '', canvasClass: q('.page-canvas--damai').className.split(/\s+/).filter(function (c) { return c && c !== 'page-canvas' && c !== 'page-canvas--case'; }).join(' '), // the page's own classes, which the copied pieces need to be styled heroMin: fw.getComputedStyle(q('.case-hero')).minHeight,
      topbar: document.importNode(q('.dm-topbar'), true), hero: document.importNode(q('.case-hero'), true),
      bg: document.importNode(q('.case-bg'), true), scroll: document.importNode(q('.dm-scroll'), true), scrollLeft: q('.dm-scroll').getBoundingClientRect().left,
      gutter: Math.max(0, innerWidth - fd.documentElement.clientWidth), // the Damai page's scrollbar space, if it has one
      lights: box(q('.dm-topbar__lights')), title: runOf(q('.case-hero__title')), desc: runOf(q('.case-hero__desc')), peeks: {}
    };
    d.peekHTML = {};
    Array.prototype.forEach.call(fd.querySelectorAll('.dm-peek'), function (el) { // the tabs at the window's edges, by the name of the Work card that becomes each (data-peek)
      var key = el.getAttribute('data-peek');
      if (!key || fw.getComputedStyle(el).display === 'none') return;
      d.peeks[key] = box(el);
      var pl = el.querySelector('.traffic-lights'); if (pl) d.peeks[key].lights = box(pl); // (the three dots: where they are on the tab, so the card's can end exactly there)
      d.peeks[key].radius = parseFloat(fw.getComputedStyle(el).borderTopLeftRadius) || 30; // (the card's corners are made round again at this radius, see below)
      d.peekHTML[key] = el.outerHTML;
    });
    [d.topbar, d.hero, d.bg].forEach(function (n) { // start loading the pictures now, so they are there when the animation needs them
      Array.prototype.forEach.call(n.querySelectorAll('img'), function (im) { var i = new Image(); i.src = im.getAttribute('src'); });
    });
    return d;
  }

  function damaiSide() {
    // The browser's own Back / Forward buttons used to rebuild heavy animations here (the Work cards opening into this page, held copies of the Work page, scroll flags). They depended on what
    // the browser happened to do with the page (restore it from its cache or load it again, a record of the navigation that is not always right), and went wrong in many different ways.
    // They are gone: a page reached with those buttons simply comes in with one small, fixed movement (js/case-exp-extras.js, section 8). The buttons on the page keep their animations.
    window.__damaiArrive = function () {};
  }

  function buildArrival() { // the copy of the Work page over this page, with the opening animation built and held at its start; null if it cannot or should not be shown
    function note(m) { try { console.info('[damai-open] arrival:', m); sessionStorage.setItem('xArrive', m + ' @' + Date.now()); } catch (err) {} } // why the animation did or did not play
    try {
      if (window.matchMedia('(max-width: 650px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { note('narrow or reduced motion'); return null; }
      var st = JSON.parse(sessionStorage.getItem('xWorkState')), ds = JSON.parse(sessionStorage.getItem('xCaseState:' + FILE) || 'null');
      var cv = document.querySelector('.page-canvas--damai');
      if (!st || (ds && ds.scrolled) || st.w !== innerWidth || st.h !== innerHeight || window.scrollY > 2 || !cv || !cv.style.getPropertyValue('--h0')) {
        note('conditions: st=' + !!st + ' scrolled=' + !!(ds && ds.scrolled) + ' size=' + (st && (st.w === innerWidth && st.h === innerHeight)) + ' scrollY=' + window.scrollY + ' h0=' + !!(cv && cv.style.getPropertyValue('--h0')));
        return null;
      }
      var d = extract(document, window);
      var host = document.createElement('div');
      host.id = 'x-work-host';
      host.style.cssText = 'position:fixed;left:0;top:0;width:' + st.w + 'px;height:' + st.h + 'px;z-index:9;overflow:hidden'; // below the navigation (z-index 10), over everything else
      var sr = host.attachShadow({ mode: 'open' }), sheets = [];
      Array.prototype.forEach.call(document.styleSheets, function (ss) { // the site's stylesheet and the cover css, which the Work page's pieces and the Damai pieces need
        if (!ss.href || !/\/css\/(style|damai-exp-cover)\.css/.test(ss.href)) return;
        try { var sh = new CSSStyleSheet(); sh.replaceSync(Array.prototype.map.call(ss.cssRules, function (r) { return r.cssText; }).join('\n')); sheets.push(sh); } catch (err) {}
      });
      var work = new CSSStyleSheet();
      work.replaceSync(st.css); // the Work page's own css
      sheets.push(work);
      sr.adoptedStyleSheets = sheets;
      var wrap = document.createElement('div');
      wrap.innerHTML = st.bg + st.canvas;
      Array.prototype.forEach.call(wrap.querySelectorAll('.page-nav, .site-footer'), function (e) { e.parentNode.removeChild(e); }); // this page has its own
      Array.prototype.forEach.call(wrap.querySelectorAll('img'), function (im) { im.decoding = 'sync'; });
      var mount = document.createElement('div');
      sr.appendChild(mount);
      while (wrap.firstChild) sr.appendChild(wrap.firstChild);
      document.body.appendChild(host);
      var cardEl = sr.querySelector('[data-open-case][href="' + FILE + '"]');
      if (!cardEl) { host.parentNode.removeChild(host); return null; }
      return { host: host, b: build(d, { card: cardEl, root: sr, mount: mount, hold: true }), w: st.w, h: st.h };
    } catch (err) { note('error: ' + (err && err.message)); return null; }
  }

  function playArrival(p) {
    var unlockA = window.__xLock(2600);
    var end = function () { unlockA(); p.b.typer.cancel(); if (p.host.parentNode) p.host.parentNode.removeChild(p.host); };
    p.b.anims.forEach(function (a) { a.play(); });
    p.b.typer.play();
    Promise.all(p.b.anims.map(function (a) { return a.finished; })).then(end, end);
  }

  // arriving from the Work page with the browser's FORWARD button (not Back: going Back from the Work page to a case study that was open before it must not play the Work page's opening over it)
  function fromWork() {
    var act = window.navigation && window.navigation.activation;
    if (!act || act.navigationType !== 'traverse' || !act.from || !/\/work\.html/.test(act.from.url)) return false;
    return !!(act.entry && act.from && act.from.index >= 0 && act.entry.index > act.from.index); // (an entry that is no longer in the list has index -1: then it is not known, and not taken as Forward)
  }

  function arriveOnDamai() { // a fresh load by the Forward button
    if (!fromWork()) { try { sessionStorage.setItem('xArrive', 'not a traversal from the work page @' + Date.now()); } catch (err) {} return; }
    var p = buildArrival();
    if (p) playArrival(p);
  }

  function log() { try { console.info.apply(console, ['[damai-open]'].concat([].slice.call(arguments))); } catch (err) {} }

  function rectOf(el) { var r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }

  function runOf(el) { // the text's own box and the number of lines
    var r = el.ownerDocument.createRange(); r.selectNodeContents(el);
    var b = r.getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, n: r.getClientRects().length };
  }

  function makeTyper(el, start, per, D) {
    var spans = Array.prototype.slice.call(el.querySelectorAll('span')), full = spans.map(function (s) { return s.textContent; });
    var total = full.join('').length, raf = 0, caret = document.createElement('i');
    caret.style.cssText = 'display:inline-block;flex:none;width:2px;height:20px;margin:1px 0 0 2px;border-radius:1px;background:#5f5f5f;opacity:.7';
    function put(n, showCaret) {
      var left = n;
      spans.forEach(function (s, i) { var k = Math.min(left, full[i].length); s.textContent = full[i].slice(0, k); left -= k; });
      if (showCaret && !caret.parentNode) el.appendChild(caret); else if (!showCaret && caret.parentNode) caret.parentNode.removeChild(caret);
    }
    put(0, false);
    return {
      set: function (f) { put(f ? total : 0, false); },
      play: function () {
        var t0 = performance.now();
        (function tick(now) {
          var e = now - t0;
          put(Math.max(0, Math.min(total, Math.floor((e - start) / per))), e > start - 300 && e < start + total * per + 400);
          if (e < D + 800) raf = requestAnimationFrame(tick);
        })(performance.now());
      },
      erase: function (from, step) { // untypes the address from its end, beginning `from` ms from now
        var t0 = performance.now();
        (function tick(now) {
          var e = now - t0, n = Math.max(0, Math.min(total, total - Math.floor((e - from) / step)));
          put(n, e > from - 200 && n > 0);
          if (n > 0) raf = requestAnimationFrame(tick);
        })(performance.now());
      },
      cancel: function () { cancelAnimationFrame(raf); spans.forEach(function (s, i) { s.textContent = full[i]; }); if (caret.parentNode) caret.parentNode.removeChild(caret); }
    };
  }

  function build(d, opt) {
    var cardEl = opt.card, R = opt.root || document, M = opt.mount || document.body, extraEls = []; // the clicked card on the Work page, or on a copy of it (see buildArrival)
    var T = d.T, s1 = d.s1, W1 = d.W1, H1 = d.H1;
    var C = cardEl.getBoundingClientRect(), W0 = cardEl.offsetWidth, H0 = cardEl.offsetHeight, ts = C.width / W0;
    var anims = [], o = { duration: MS, easing: EASE, fill: 'both' };
    function A(el, kf, op) { var a = el.animate(kf, op); if (opt && (opt.closing || opt.hold)) a.pause(); anims.push(a); return a; } // closing / hold: held at the start until asked to play

    // the glass: a clone of the card, so it looks exactly like it, growing to the tab's size, scale and place
    var ov = cardEl.cloneNode(false);
    ['href', 'data-open-case', 'data-case-color'].forEach(function (a) { ov.removeAttribute(a); });
    ov.className = 'w4-tab'; // not w4-tab--damai: the page would give this clone the card's view-transition name too (two elements, one name)
    ov.style.cssText = 'position:fixed;margin:0;z-index:6;pointer-events:none;transform-origin:0 0;left:' + C.left + 'px;top:' + C.top + 'px;width:' + W0 + 'px;height:' + H0 + 'px;transform:scale(' + ts + ')';
    ov.appendChild(cardEl.querySelector('.w4-tab__glass').cloneNode(true));

    // the old picture, in the card's own pixels
    var cov = cardEl.querySelector('.w4-tab__cover'), cr = rectOf(cov);
    var oc = document.createElement('div');
    oc.style.cssText = 'position:absolute;z-index:1;left:' + ((cr.l - C.left) / ts) + 'px;top:' + ((cr.t - C.top) / ts) + 'px;width:' + cov.offsetWidth + 'px;height:' + cov.offsetHeight + 'px';
    var cc = cov.cloneNode(true);
    cc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    oc.appendChild(cc);
    ov.appendChild(oc);
    var arrow = cardEl.querySelector('.w4-tab__arrow'), ac = null;
    if (arrow) {
      var ar = rectOf(arrow);
      ac = arrow.cloneNode(true);
      ac.style.cssText = 'position:absolute;z-index:1;margin:0;left:' + ((ar.l - C.left) / ts) + 'px;top:' + ((ar.t - C.top) / ts) + 'px;width:' + (ar.w / ts) + 'px;height:' + (ar.h / ts) + 'px';
      ov.appendChild(ac);
    }

    // the new content: clones of the Damai page's own top bar and hero, laid out the way the tab lays them out
    var content = document.createElement('div');
    content.className = d.canvasClass || 'page-canvas--damai';
    content.style.cssText = 'position:absolute;z-index:2;left:0;top:0;box-sizing:border-box;display:flex;flex-direction:column;width:' + W1 + 'px;padding:' + d.pad + ';gap:' + d.gap;
    content.style.setProperty('--hd', d.hd);
    if (d.descFs) content.style.setProperty('--desc-fs', d.descFs); // (the description's font size that keeps it on one line, see js/case-exp-extras.js section 9)
    var topbar = d.topbar.cloneNode(true), hero = d.hero.cloneNode(true);
    hero.style.minHeight = d.heroMin;
    // (the cover panel sits in the middle of the room between the address bar and the text, and the text at the bottom: that is in the css, css/damai-exp-scale.css)
    content.appendChild(topbar);
    content.appendChild(hero);
    ov.appendChild(content);

    // the same text and lights, as they are on the card, to move from
    var oldLights = rectOf(cardEl.querySelector('.traffic-lights'));
    var oldTitle = runOf(cardEl.querySelector('.w4-tab__text h2')), oldDesc = runOf(cardEl.querySelector('.w4-tab__text p'));

    M.appendChild(ov);
    cardEl.style.visibility = 'hidden';
    // the pictures on the card float up and down: let their copies carry on from the same point of the movement, so nothing jumps when the card is replaced
    (function () {
      var from = [cov].concat(Array.prototype.slice.call(cov.querySelectorAll('*'))), to = [cc].concat(Array.prototype.slice.call(cc.querySelectorAll('*')));
      from.forEach(function (el, i) {
        var a = el.getAnimations(), b = to[i] && to[i].getAnimations();
        if (b) a.forEach(function (x, k) { if (b[k]) b[k].currentTime = x.currentTime; });
      });
    })();

    // Every animation goes from `from` (how things are before the page opens: the card) to `to` (the Damai first screen) when opening, and from `to` to `from` when closing,
    // each with its own timing [duration, delay, easing] in ms. Closing is not the opening played backwards: its own order is used (the new content leaves first, from the right,
    // one piece after another, then the glass shrinks back and the old picture comes in), and each piece leaves with an exit curve instead of the reverse of its entrance curve.
    var closing = !!(opt && opt.closing);
    var POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)', OUT = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.36, 0, 0.66, -0.56)', SLIDE = 'cubic-bezier(0.65, 0, 0.35, 1)';
    function P(el, from, to, openT, closeT, pseudo) {
      var t = closing ? closeT : openT, op = { duration: t[0], delay: t[1], easing: t[2], fill: 'both' };
      if (pseudo) op.pseudoElement = pseudo;
      return A(el, closing ? [to, from] : [from, to], op);
    }
    var GLASS = [MS, 0, EASE], GLASS_C = [1000, 1000, EASE];

    // the card's diagonal highlight (::before) is not on the Damai tab: fade it out with the growth
    P(ov, { opacity: 1 }, { opacity: 0 }, GLASS, GLASS_C, '::before');
    // glass
    P(ov, { left: C.left + 'px', top: C.top + 'px', width: W0 + 'px', height: H0 + 'px', transform: 'scale(' + ts + ')' },
          { left: T.left + 'px', top: T.top + 'px', width: W1 + 'px', height: H1 + 'px', transform: 'scale(' + s1 + ')' }, GLASS, GLASS_C);

    // a piece that moves from the card to its place on the tab: scale (one factor) and move together, in the glass's own pixels
    function travel(el, from, to, k) { // from / to: { l, t } in the window; the clone's own scale is 1 in the glass's pixels
      var dx = (from.l - C.left) / ts - (to.l - T.left) / s1, dy = (from.t - C.top) / ts - (to.t - T.top) / s1;
      el.style.transformOrigin = '0 0';
      P(el, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')' }, { transform: 'translate(0,0) scale(1)' }, GLASS, GLASS_C);
    }
    var fl = d.lights;
    travel(topbar.querySelector('.dm-topbar__lights'), { l: oldLights.l, t: oldLights.t }, { l: fl.left, t: fl.top }, (oldLights.w / ts) / (fl.width / s1));
    [['.case-hero__title', oldTitle, d.title], ['.case-hero__desc', oldDesc, d.desc]].forEach(function (p) {
      var el = hero.querySelector(p[0]), nr = p[2], or = p[1];
      if (or.n === 1 && nr.n === 1 && nr.w) travel(el, { l: or.l, t: or.t }, { l: nr.l, t: nr.t }, (or.w / ts) / (nr.w / s1));
      else P(el, { opacity: 0 }, { opacity: 1 }, [450, 700, 'ease-out'], [300, 600, 'ease-in']);
    });

    // the old picture leaves through the glass's left edge (and comes back the same way); the new cover enters through its right edge and leaves through it (both clipped by the glass)
    P(oc, { transform: 'translateX(0)' }, { transform: 'translateX(' + (-((cr.l - C.left) / ts + cov.offsetWidth + 40)) + 'px)' }, [800, 0, EASE], [800, 1200, EASE]);
    P(hero.querySelector('.dm-illus'), { transform: 'translateX(' + W1 + 'px)' }, { transform: 'translateX(0)' }, [1000, 700, 'cubic-bezier(0.22, 1, 0.36, 1)'], [800, 0, SLIDE]);
    if (ac) P(ac, { opacity: 1 }, { opacity: 0 }, [300, 0, 'ease-out'], [300, 1700, 'ease-in']);

    // the address bar: the back button pops in, then the bar pops out as a circle, stretches to its full length and types the address (closing: it erases the address, shrinks, pops away, then the button)
    var back = topbar.querySelector('.case-topbar__back'), urlBar = topbar.querySelector('.case-topbar__url');
    var uw = urlBar.offsetWidth, uh = urlBar.offsetHeight;
    urlBar.style.transformOrigin = (uh / 2) + 'px 50%';
    P(back, { transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }, [450, 800, POP], [400, 1050, IN]);
    P(urlBar, { transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }, [450, 900, POP], [400, 950, IN]);
    P(urlBar, { clipPath: 'inset(0px ' + (uw - uh) + 'px 0px 0px round ' + (uh / 2) + 'px)' }, { clipPath: 'inset(0px 0px 0px 0px round ' + (uh / 2) + 'px)' }, [750, 1250, EASE], [600, 500, EASE]);
    var typer = makeTyper(urlBar, 1600, 38, 2250);
    if (closing) typer.set(1); else if (!(opt && opt.hold)) typer.play();

    // Year and Role: each label and value rises into place from a little below, one after the other (closing: they drop and fade away, the last one first)
    var metaSpans = Array.prototype.slice.call(hero.querySelectorAll('.dm-hero-text__meta span'));
    metaSpans.forEach(function (sp, i) {
      P(sp, { opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }, [700, 1000 + i * 80, OUT], [500, (metaSpans.length - 1 - i) * 70, 'cubic-bezier(0.5, 0, 0.75, 0)']);
    });
    A(ov, [{ opacity: 1 }, { opacity: 1 }], { duration: closing ? 2000 : 2250 }); // the whole thing lasts this long (then the other page opens)

    // the other two cards go to the window's edges (their tabs on the Damai page)
    Object.keys(d.peeks).forEach(function (key) {
      var el = R.querySelector('.w4-tab--' + key), t = d.peeks[key];
      if (!el || el === cardEl) {
        if (!d.peekHTML || !d.peekHTML[key]) return;
        // no card on the Work page to travel to this edge tab (or the card is the clicked one): its tab fades in (closing: out)
        var holder = document.createElement('div');
        holder.className = 'page-canvas--damai page-canvas--wapoo';
        holder.innerHTML = d.peekHTML[key];
        M.appendChild(holder);
        extraEls.push(holder);
        // it slides in from beyond its own edge of the window (and out again, closing) with a fade, as the edge tabs do when a case study is swapped for another
        var dir = t.left + t.width / 2 > innerWidth / 2 ? 1 : -1, SOFT = 'cubic-bezier(0.45, 0.05, 0.2, 1)';
        P(holder.firstElementChild, { translate: dir * 520 + 'px 0', opacity: 0 }, { translate: '0 0', opacity: 1 }, [1100, 350, SOFT], [900, 800, SOFT]);
        return;
      }
      var r = rectOf(el);
      // the strip the cards sit on is scaled with the window (1.2 at 1728px wide), and a translation is in the strip's pixels: find out by how much it moves the card
      el.style.translate = '100px 0';
      var k = (el.getBoundingClientRect().left - r.l) / 100 || 1;
      el.style.translate = '';
      // the card has its own transform (its place in the strip), which the scale below also scales: so measure where it really lands and correct the translation
      var tx = (t.left - r.l) / k, ty = (t.top - r.t) / k, sc = (t.width / r.w) + ' ' + (t.height / r.h);
      el.style.scale = sc;
      for (var it = 0; it < 3; it++) {
        el.style.translate = tx + 'px ' + ty + 'px';
        var rr = el.getBoundingClientRect();
        tx += (t.left - rr.left) / k; ty += (t.top - rr.top) / k;
      }
      el.style.translate = ''; el.style.scale = '';
      var cl = el.querySelector('.traffic-lights'), L0 = cl && cl.getBoundingClientRect();
      P(el, { translate: '0 0', scale: '1' }, { translate: tx + 'px ' + ty + 'px', scale: sc }, GLASS, GLASS_C); // ends on the tab's exact place and size
      // the card is stretched unevenly into the tab (600 x 500 to 780 x 450), which would turn its round corners oval: the radius is changed along the way so that at the end the corners
      // are round, at the tab's own radius (otherwise they change shape when the page's own tab takes over)
      var csr = getComputedStyle(el), r0 = parseFloat(csr.borderTopLeftRadius) || 0, fx = t.width / el.offsetWidth, fy = t.height / el.offsetHeight;
      // the three dots would be stretched the same way (round dots turn into ovals): they are scaled back by the opposite amounts, to the tab's own dots' size and place
      if (cl && L0 && t.lights) {
        var kx0 = r.w / el.offsetWidth, ky0 = r.h / el.offsetHeight, lx = (L0.left - r.l) / kx0, ly = (L0.top - r.t) / ky0, lw = L0.width / kx0, lh = L0.height / ky0;
        cl.style.transformOrigin = '0 0';
        P(cl, { translate: '0 0', scale: '1 1' }, { translate: ((t.lights.left - t.left) / fx - lx) + 'px ' + ((t.lights.top - t.top) / fy - ly) + 'px', scale: (t.lights.height / lh / fx) + ' ' + (t.lights.height / lh / fy) }, GLASS, GLASS_C);
      }
      P(el, { borderRadius: r0 + 'px / ' + r0 + 'px' }, { borderRadius: (t.radius / fx) + 'px / ' + (t.radius / fy) + 'px' }, GLASS, GLASS_C);
      // on the way their pictures and text fade out (the Damai page's tabs at the edges are plain glass): the lights stay
      ['.w4-tab__cover', '.w4-tab__foot'].forEach(function (s) {
        var ch = el.querySelector(s);
        if (ch) P(ch, { opacity: 1 }, { opacity: 0 }, [600, 0, 'ease-in-out'], [600, 1400, 'ease-in-out']);
      });
    });

    // any other card that has no edge tab to go to (MUJI when Wapoo opens) slides out of the window, away from the opened card
    Array.prototype.forEach.call(R.querySelectorAll('.w4-tab'), function (el) {
      if (el === cardEl || el === ov || ov.contains(el) || /w4-tab--(\w+)/.test(el.className) && d.peeks[RegExp.$1]) return; // (not the animation's own copy of the card)
      var r = rectOf(el), c0 = rectOf(cardEl);
      el.style.translate = '100px 0';
      var k = (el.getBoundingClientRect().left - r.l) / 100 || 1;
      el.style.translate = '';
      var dx = (r.l < c0.l ? -(r.l + r.w + 40) : (innerWidth - r.l + 40)) / k;
      P(el, { translate: '0 0' }, { translate: dx + 'px 0' }, GLASS, GLASS_C);
    });

    // background colours: the Damai page's own background fades in over the Work page's
    var bg = d.bg.cloneNode(true);
    bg.style.zIndex = '0';
    if (d.gutter) bg.style.right = d.gutter + 'px';
    var w4 = R.querySelector('.w4');
    (w4 || M).insertAdjacentElement(w4 ? 'afterend' : 'beforeend', bg);
    P(bg, { opacity: 0 }, { opacity: 1 }, [MS, 0, 'ease-out'], [1000, 1000, 'ease-out']);

    // the strip of three dashes slides out of the bottom
    var dots = R.querySelector('.w4-dots');
    if (dots) P(dots, { translate: '0 0', opacity: 1 }, { translate: '0 160px', opacity: 0 }, [800, 0, EASE], [800, 1200, EASE]);

    // "Scroll" and its arrow arrive last (closing: they go first)
    var scroller = document.createElement('div');
    scroller.className = d.canvasClass || 'page-canvas--damai';
    var sc = d.scroll.cloneNode(true);
    sc.style.left = d.scrollLeft + 'px'; // exactly where the Damai page puts it
    sc.style.marginLeft = '0';
    scroller.appendChild(sc);
    M.appendChild(scroller);
    P(sc, { opacity: 0 }, { opacity: 1 }, [600, 900, 'ease-out'], [350, 0, 'ease-in']);

    return { anims: anims, els: [ov, bg, scroller].concat(extraEls), typer: typer };
  }

  // Arriving on the Work page with the browser's Back button from a case study, when the page cannot play the closing animation (the case study was scrolled, or the window changed size):
  // the cards slide in a little from the right, fading in, one after the other from the left (nothing else moves).
  function cameFromCase() {
    var act = window.navigation && window.navigation.activation;
    return !!act && act.navigationType === 'traverse';
  }
  function cardsSlideIn() {
    if (window.matchMedia('(max-width: 650px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.__xLock(950);
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.w4-tab')).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    tabs.forEach(function (el, i) {
      if (el.animate) el.animate([{ translate: '72px 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 600, delay: i * 70, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    });
  }

  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-open-case]'));
  if (!cards.length) { if (document.querySelector('.dm-topbar')) damaiSide(); return; } // a case study page
  cards.forEach(function (c, i) { workSide(c, i === 0); }); // the Work page: each case study card opens its page the same way

  function workSide(card, first) {
    var frame = null, data = null, ready = false, busy = false, made = null, stopper = null, pushedOpen = false, cancelled = false, unlock = function () {};

    function prepare() {
      if (frame || data || narrow.matches) return;
      frame = document.createElement('iframe');
      frame.src = card.getAttribute('href');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-100000px;top:0;border:0;visibility:hidden;opacity:0;pointer-events:none;z-index:-5;width:' + innerWidth + 'px;height:' + innerHeight + 'px';
      var done = false;
      function finish() { // take what is needed out of the hidden page, then remove it: nothing of it stays on this page
        if (done) return;
        done = true;
        try { data = extract(frame.contentDocument, frame.contentWindow); ready = true; log('hidden Damai page measured and removed'); } catch (err) { log('could not measure the hidden Damai page:', err && err.message); }
        if (frame.parentNode) frame.parentNode.removeChild(frame);
        frame = null;
      }
      frame.addEventListener('load', function () { setTimeout(finish, 300); });
      document.body.appendChild(frame);
      var tries = 0;
      (function poll() { // its layout is final once its own script has measured the window and the fonts are in
        if (done || ++tries > 120) return;
        try {
          var d = frame.contentDocument, cv = d && d.querySelector('.page-canvas--damai');
          if (cv && cv.style.getPropertyValue('--h0') && d.fonts && d.fonts.status === 'loaded') { finish(); return; }
        } catch (err) {}
        setTimeout(poll, 100);
      })();
    }
    // everything the animation needs to know about the Damai page's first screen, and copies of the pieces it moves
    // ---- On the Damai page: remember what its first screen looks like (sizes, positions, copies of the pieces) for the Work page to play the closing animation from on arrival ----
    // ---- On the Damai page: arriving from the Work page with the browser's Forward button (which a page cannot hold back), a copy of the Work page's cards is put over the page
    // before its first paint (inside a shadow root, so the Work page's styles cannot touch this page) and the opening animation plays over it; then the copy is removed ----
    // ---- On the Work page: arriving from the Damai page with the browser's Back button (which a page cannot hold back), the Damai first screen is put over the cards and the closing animation plays ----
    function revive(st) {
      var d = {};
      Object.keys(st).forEach(function (k) {
        var v = st[k];
        if (typeof v === 'string' && v.charAt(0) === '<') { var t = document.createElement('template'); t.innerHTML = v; v = t.content.firstElementChild; }
        d[k] = v;
      });
      [d.topbar, d.hero, d.bg].forEach(function (n) { Array.prototype.forEach.call(n.querySelectorAll('img'), function (im) { var i = new Image(); i.src = im.getAttribute('src'); }); });
      return d;
    }
    function savedState(needTraversal) {
      if (narrow.matches || reduce.matches) return null;
      if (needTraversal) {
        var act = window.navigation && window.navigation.activation;
        if (!act || act.navigationType !== 'traverse' || !act.from || act.from.url.split('?')[0].split('/').pop() !== card.getAttribute('href')) return null;
      }
      var st = null;
      try { st = JSON.parse(sessionStorage.getItem('xCaseState:' + card.getAttribute('href'))); } catch (err) {}
      if (!st || st.scrolled || st.w !== innerWidth || st.h !== innerHeight) return null;
      return st;
    }
    function closeHere() {
      var b = build(data, { closing: true, card: card });
      var mine = made = { anims: b.anims, els: b.els, typer: b.typer };
      busy = true; unlock = window.__xLock(2600);
      log('closing animation on arrival');
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (made !== mine) return;
        b.anims.forEach(function (a) { a.play(); });
        b.typer.erase(0, 38);
        var end = function () { if (made === mine) { reset(); prepare(); } unlock(); };
        Promise.all(b.anims.map(function (a) { return a.finished; })).then(end, end);
      }); });
    }


    if (closing) {
      var want = (location.search.match(/[?&]case=([^&]+)/) || [])[1];
      if (!want || card.getAttribute('href') !== decodeURIComponent(want)) return; // only the clicked case study's card takes part
      // inside the Damai page's hidden copy of this page: wait to be asked (see pages/damai.html), then build the Damai first screen from the parent page, as it is now
      var cb = null;
      window.__xReady = false;
      window.addEventListener('load', function () { setTimeout(function () { window.__xReady = true; }, 600); });
      // The cards' pictures float up and down and the fake screens play; on the real Work page that all starts from rest when it loads. If the copy kept floating while it closes,
      // the pictures would be up in the air at the end and drop to rest when the real page takes over. So everything is held at rest here.
      function freezeWork() {
        var st = document.createElement('style');
        st.textContent = '.w4-tab__cover img, .w4-tab__cover [class*="w4-cover-"] { animation: none !important; }';
        document.head.appendChild(st);
        try { (window.lottie ? window.lottie.getRegisteredAnimations() : []).forEach(function (a) { a.goToAndStop(0, true); }); } catch (err) {}
      }
      window.__xPrepareClosing = function () {
        freezeWork();
        cb = build(extract(parent.document, parent), { closing: true, card: card }); // everything held in the opened state: looks exactly like the Damai page
      };
      window.__xStartClosing = function (done) { // `done` is a function of the Damai page: it opens the Work page (a link, or the browser's own Back)
        cb.anims.forEach(function (a) { a.play(); });
        cb.typer.erase(0, 38);
        var end = function () { done(); };
        Promise.all(cb.anims.map(function (a) { return a.finished; })).then(end, end);
      };
      return;
    }
    if (first) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepare); else prepare(); }
    if (first && cameFromCase()) cardsSlideIn(); // reached with the browser's Back / Forward: the cards come in a little from the right
    card.addEventListener('mouseenter', prepare);
    var resizeTimer = 0;
    window.addEventListener('resize', function () { // the measurements belong to one window size: measure again after it changes
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (data && (data.w !== innerWidth || data.h !== innerHeight)) { data = null; ready = false; if (first) prepare(); } }, 400);
    });

    // the Work page as it looks when it is left, for the Damai page to show on arrival if the browser's Forward button was used (see arriveOnDamai)
    function saveWorkState() {
      return; // (no longer used: nothing is rebuilt from it)
      try {
        var canvas = document.querySelector('.page-canvas--work'), bgEl = document.querySelector('.page-bg-gradient');
        if (made || busy || !canvas || document.querySelector('[data-open-case][style*="hidden"]') || narrow.matches) return;
        var css = Array.prototype.map.call(document.querySelectorAll('style'), function (st) { return st.textContent; }).join('\n');
        sessionStorage.setItem('xWorkState', JSON.stringify({ w: innerWidth, h: innerHeight, at: Date.now(), css: css, bg: bgEl ? bgEl.outerHTML : '', canvas: canvas.outerHTML }));
      } catch (err) {}
    }
    // also when the page is at rest, so that it is saved even if it is left while an animation is still running (Forward pressed right after Back)
    var saveTimer = 0;
    function saveLater(ms) { clearTimeout(saveTimer); saveTimer = setTimeout(saveWorkState, ms); }


    // Types the text of an element's spans one letter at a time (with a thin caret) from `start` ms of a timeline D ms long; erase() takes it away again.

    // builds the pieces and their animations for the Damai first screen described by `d`, over the card; returns them (nothing is navigated here)

    function run() {
      var b = build(data, { card: card });
      stopper = document.createElement('style'); // no browser page transition on the way out: the pieces are already where the Damai page puts them
      stopper.textContent = '@view-transition { navigation: none; }';
      document.head.appendChild(stopper);
      log('opening animation started');
      made = { anims: b.anims, els: b.els.concat([stopper]), typer: b.typer };
      var go = function () { if (made && made.anims === b.anims) { log('opening animation finished, going to the Damai page'); window.location.href = card.href; } }; // not after a reset
      Promise.all(b.anims.map(function (a) { return a.finished; })).then(go, go);
    }

    // Coming back with the browser's Back button can bring this page back exactly as it was left (in its opened state): put everything back
    function reset() {
      unlock();
      if (!made) return;
      var m = made;
      made = null;
      m.anims.forEach(function (a) { try { a.cancel(); } catch (err) {} });
      if (m.typer) m.typer.cancel();
      m.els.forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
      card.style.visibility = '';
      busy = false;
      saveLater(500);
    }
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      reset(); // (whatever of an opening was left on the page is taken away)
      if (first) cardsSlideIn(); // restored from the browser's cache by Back / Forward: the same small movement
    });

    card.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // Below 1000px (no middle state there) or with reduced motion the card does not open into the case study: the click is left to the site's own transition (the shapes, js/case-transition.js),
      // which is a listener on the document. Otherwise that transition must not take the click.
      if (narrow.matches || reduce.matches) { log('shape transition / plain link: ' + (narrow.matches ? 'window is under 1000px wide' : 'reduced motion is on')); return; }
      e.stopPropagation();
      e.preventDefault();
      if (busy) return;
      busy = true; cancelled = false; unlock = window.__xLock(4500);
      if (data && (data.w !== innerWidth || data.h !== innerHeight)) { data = null; ready = false; }
      prepare();
      var t0 = Date.now();
      log('clicked; hidden Damai page ready: ' + ready);
      (function go() {
        if (cancelled) { cancelled = false; return; }
        if (ready) { try { run(); } catch (err) { log('failed, opening the page without the animation:', err && err.message); window.location.href = card.href; } }
        else if (Date.now() - t0 > 6000) { log('hidden Damai page not ready after 6s, opening the page without the animation'); window.location.href = card.href; }
        else setTimeout(go, 60);
      })();
    }, true);
  }
})();
