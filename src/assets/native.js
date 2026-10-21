/* EnactusNG Plus – native layer: platform bridge, splash, server-driven onboarding, ripples, keyboard & offline handling */
(function () {
  'use strict';
  var C = window.Capacitor, isCap = !!(C && C.isNativePlatform && C.isNativePlatform());
  var isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
  var platform = isCap ? 'mobile' : (isTauri ? 'desktop' : 'web');
  var root = document.documentElement, CFG = window.PLUS_CONFIG || {};
  var ONB_KEY = 'plus_onboarded_v1', CACHE_KEY = 'plus_slides_cache_v1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function plug(name) { try { return (C.Plugins && C.Plugins[name]) || (C.registerPlugin && C.registerPlugin(name)); } catch (e) { return null; } }
  function invoke(cmd, args) { var i = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core); return i.invoke(cmd, args || {}); }
  function $(s) { return document.querySelector(s); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  if (platform === 'web' && !/[?&]native=1/.test(location.search)) { return; } // plain website: leave everything as it was
  root.classList.add('native', 'is-' + platform);
  var BASE = String(CFG.api || '').replace(/api\/index\.php.*$/, '');

  /* ---------- bridge used by app.js ---------- */
  function toBase64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  window.PlusNative = {
    platform: platform,
    openExternal: function (url) {
      if (!/^https?:\/\//i.test(url)) return Promise.resolve();
      try {
        if (isCap) { var B = plug('Browser'); if (B) return B.open({ url: url }); }
        if (isTauri) return invoke('open_external', { url: url });
      } catch (e) {}
      window.open(url, '_blank', 'noopener'); return Promise.resolve();
    },
    saveUrl: function (url) { return window.PlusNative.openExternal(url); },
    saveBlob: function (blob, name) {
      name = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_');
      return toBase64(blob).then(function (b64) {
        if (isTauri) return invoke('save_download', { name: name, data: b64 });
        if (isCap) {
          var F = plug('Filesystem'), S = plug('Share');
          return F.writeFile({ path: 'downloads/' + name, data: b64, directory: 'CACHE', recursive: true })
            .then(function () { return F.getUri({ path: 'downloads/' + name, directory: 'CACHE' }); })
            .then(function (u) { return S.share({ title: name, url: u.uri }); });
        }
      });
    }
  };

  /* external links open in the system browser, never inside the app window */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href) && !a.hasAttribute('download')) { e.preventDefault(); window.PlusNative.openExternal(href); }
  }, true);

  /* ---------- ripples (clipped in their own layer so badges are never cut off) + haptics ---------- */
  var RIP = '.btn,.bn,.nav-btn,.side-link,.pill-tabs button,.post-actions button,.post-actions a,.attach-btn,.b-btn';
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(RIP);
    if (!t || t.disabled) return;
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    if (getComputedStyle(t).position === 'static') t.classList.add('ripple-host');
    var wrap = document.createElement('span'); wrap.className = 'rip-wrap';
    var s = document.createElement('span'); s.className = 'rip' + (t.matches('.btn-primary,.b-btn.primary') ? '' : ' dark');
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    wrap.appendChild(s); t.appendChild(wrap);
    s.addEventListener('animationend', function () { wrap.remove(); });
    try { navigator.vibrate && navigator.vibrate(8); } catch (x) {}
  }, true);

  /* ---------- keyboard: hide the floating bottom bar while typing ---------- */
  var kbT;
  function isField(el) { return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|file|button|submit)$/i.test(el.type || ''); }
  document.addEventListener('focusin', function (e) { if (isField(e.target)) { clearTimeout(kbT); root.classList.add('kb'); } });
  document.addEventListener('focusout', function () { clearTimeout(kbT); kbT = setTimeout(function () { if (!isField(document.activeElement)) root.classList.remove('kb'); }, 120); });

  /* ---------- offline banner ---------- */
  ready(function () {
    var b = document.createElement('div'); b.id = 'net-banner'; b.setAttribute('role', 'status'); b.innerHTML = '<i></i><span>You are offline – reconnecting…</span>';
    document.body.appendChild(b);
    function upd() { b.classList.toggle('show', navigator.onLine === false); }
    window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
  });

  /* ---------- status bar / native splash ---------- */
  if (isCap) {
    try { var SB = plug('StatusBar'); if (SB) { SB.setStyle({ style: 'LIGHT' }); SB.setBackgroundColor({ color: '#FFFFFF' }); } } catch (e) {}
    try { var SP = plug('SplashScreen'); if (SP) SP.hide({ fadeOutDuration: 200 }); } catch (e) {}
  }

  /* ---------- onboarding slides come from the server (Site settings → EnactusNG Plus → sign-in slides) ---------- */
  function abs(u) { u = String(u || ''); if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; return BASE + u.replace(/^\//, ''); }
  function fetchSlides() {
    var cached = null; try { cached = JSON.parse(lsGet(CACHE_KEY) || 'null'); } catch (e) {}
    return new Promise(function (res) {
      var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); res(null); }, 6000);
      fetch(CFG.api + '?r=public', { cache: 'no-store', signal: c && c.signal }).then(function (r) { return r.json(); }).then(function (d) {
        clearTimeout(t); if (d && d.ok && d.slides) { lsSet(CACHE_KEY, JSON.stringify(d.slides)); res(d.slides); } else res(null);
      }).catch(function () { clearTimeout(t); res(null); });
    }).then(function (s) { return s || cached; });
  }
  function loadImg(src) {
    return new Promise(function (res) { var i = new Image(), t = setTimeout(function () { res(false); }, 7000); i.onload = function () { clearTimeout(t); res(true); }; i.onerror = function () { clearTimeout(t); res(false); }; i.src = src; });
  }
  function applySlides(slides, els) {
    if (!slides) return Promise.resolve();
    return Promise.all(els.map(function (el, i) {
      var s = slides[i]; if (!s) return null;
      var h2 = el.querySelector('h2'), p = el.querySelector('p'), art = el.querySelector('.b-art');
      if (s.title) h2.textContent = s.title; if (s.text) p.textContent = s.text;
      var src = abs(s.image); if (!src) return null;
      return loadImg(src).then(function (ok) {
        if (!ok) return; art.classList.add('photo'); art.innerHTML = '';
        var im = document.createElement('img'); im.className = 'b-photo'; im.alt = ''; im.draggable = false; im.src = src; art.appendChild(im);
      });
    }));
  }

  /* ---------- boot: splash -> onboarding (first launch) -> app ---------- */
  ready(function () {
    var boot = $('#boot'); if (!boot) return;
    var splash = $('#b-splash'), onb = $('#b-onb');
    var slides = [].slice.call(document.querySelectorAll('.b-slide')), dots = [].slice.call(document.querySelectorAll('.b-dot'));
    var track = $('#b-track'), vp = $('#b-vp'), next = $('#b-next'), skip = $('#b-skip'), idx = 0;
    var first = !(lsGet(ONB_KEY) || lsGet('plus_token'));
    var slidesP = first ? fetchSlides().then(function (s) { return applySlides(s, slides); }) : Promise.resolve();
    function show(el) { [splash, onb].forEach(function (s) { s.classList.toggle('show', s === el); }); }
    function dismiss() { boot.classList.add('gone'); setTimeout(function () { boot.remove(); }, 800); }
    function finish() { lsSet(ONB_KEY, '1'); onb.classList.remove('show'); dismiss(); }
    function go(i) {
      idx = Math.max(0, Math.min(slides.length - 1, i));
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      slides.forEach(function (s, n) { s.classList.toggle('active', n === idx); });
      dots.forEach(function (d, n) { d.classList.toggle('active', n === idx); });
      var last = idx === slides.length - 1;
      next.querySelector('.lbl').textContent = last ? 'Get started' : 'Next';
      skip.style.visibility = last ? 'hidden' : 'visible';
    }
    var sx = 0, sy = 0, dx = 0, drag = false, locked = false;
    vp.addEventListener('pointerdown', function (e) { drag = true; locked = false; sx = e.clientX; sy = e.clientY; dx = 0; track.classList.add('drag'); });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; dx = e.clientX - sx;
      if (!locked && Math.abs(e.clientY - sy) > Math.abs(dx) + 6) { drag = false; track.classList.remove('drag'); go(idx); return; }
      locked = true; track.style.transform = 'translateX(' + (-idx * vp.clientWidth + dx) + 'px)';
    });
    function end() { if (!drag) return; drag = false; track.classList.remove('drag'); var t = vp.clientWidth * 0.18; go(dx < -t ? idx + 1 : dx > t ? idx - 1 : idx); }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', function (e) { if (!onb.classList.contains('show')) return; if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') go(idx - 1); });
    next.addEventListener('click', function () { idx === slides.length - 1 ? finish() : go(idx + 1); });
    skip.addEventListener('click', finish);
    go(0);

    var started = Date.now();
    function appReady() { return !!document.querySelector('#app > *:not(.splash)'); }
    sleep(2600).then(function () {
      if (!first) {                                   // returning user: wait for the app itself to be ready, then reveal it
        var wait = function () { if (appReady() || Date.now() - started > 9000) dismiss(); else setTimeout(wait, 120); };
        wait();
      } else {                                        // first launch: give the slides (and their photos) a moment, then show them
        Promise.race([slidesP, sleep(2500)]).then(function () { show(onb); });
      }
    });
  });
})();
