/* EnactusNG Plus – native layer: platform bridge, splash, onboarding, ripples */
(function () {
  'use strict';
  var C = window.Capacitor, isCap = !!(C && C.isNativePlatform && C.isNativePlatform());
  var isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
  var platform = isCap ? 'mobile' : (isTauri ? 'desktop' : 'web');
  var root = document.documentElement;
  var ONB_KEY = 'plus_onboarded_v1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function plug(name) { try { return (C.Plugins && C.Plugins[name]) || (C.registerPlugin && C.registerPlugin(name)); } catch (e) { return null; } }
  function invoke(cmd, args) { var i = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core); return i.invoke(cmd, args || {}); }

  if (platform === 'web' && !/[?&]native=1/.test(location.search)) { return; } // plain website: leave everything as it was
  root.classList.add('native', 'is-' + platform);

  /* ---------- bridge used by app.js ---------- */
  function toBase64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  window.PlusNative = {
    platform: platform,
    openExternal: function (url) {
      if (!/^https?:\/\//i.test(url)) return Promise.resolve();
      if (isCap) { var B = plug('Browser'); if (B) return B.open({ url: url }); }
      if (isTauri) return invoke('open_external', { url: url });
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
    else if (/^(mailto|tel):/i.test(href)) { /* let the OS handle it */ }
  }, true);

  /* ---------- ripples + haptics ---------- */
  var RIP = '.btn,.bn,.nav-btn,.side-link,.pill-tabs button,.post-actions button,.post-actions a,.attach-btn,.b-btn';
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(RIP);
    if (!t) return;
    if (!t.classList.contains('b-btn')) t.classList.add('ripple-host');
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'rip' + (t.matches('.btn-primary,.b-btn.primary') ? '' : ' dark');
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    t.appendChild(s); s.addEventListener('animationend', function () { s.remove(); });
    try { navigator.vibrate && navigator.vibrate(8); } catch (x) {}
  }, true);

  /* ---------- status bar / native splash ---------- */
  if (isCap) {
    try { var SB = plug('StatusBar'); if (SB) { SB.setStyle({ style: 'LIGHT' }); SB.setBackgroundColor({ color: '#FFFFFF' }); } } catch (e) {}
    try { var SP = plug('SplashScreen'); if (SP) SP.hide({ fadeOutDuration: 200 }); } catch (e) {}
  }

  /* ---------- boot: splash -> onboarding (first launch) -> app ---------- */
  function $(s) { return document.querySelector(s); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    var boot = $('#boot'); if (!boot) return;
    var splash = $('#b-splash'), onb = $('#b-onb');
    var slides = [].slice.call(document.querySelectorAll('.b-slide')), dots = [].slice.call(document.querySelectorAll('.b-dot'));
    var track = $('#b-track'), vp = $('#b-vp'), next = $('#b-next'), skip = $('#b-skip'), idx = 0;
    function show(el) { [splash, onb].forEach(function (s) { s.classList.toggle('show', s === el); }); }
    function finish() { lsSet(ONB_KEY, '1'); onb.classList.remove('show'); boot.classList.add('gone'); setTimeout(function () { boot.remove(); }, 800); }
    function go(i) {
      idx = Math.max(0, Math.min(slides.length - 1, i));
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      slides.forEach(function (s, n) { s.classList.toggle('active', n === idx); });
      dots.forEach(function (d, n) { d.classList.toggle('active', n === idx); });
      var last = idx === slides.length - 1;
      next.querySelector('.lbl').textContent = last ? 'Get started' : 'Next';
      skip.style.visibility = last ? 'hidden' : 'visible';
    }
    var sx = 0, dx = 0, drag = false;
    vp.addEventListener('pointerdown', function (e) { drag = true; sx = e.clientX; dx = 0; track.classList.add('drag'); });
    window.addEventListener('pointermove', function (e) { if (!drag) return; dx = e.clientX - sx; track.style.transform = 'translateX(' + (-idx * vp.clientWidth + dx) + 'px)'; });
    function end() { if (!drag) return; drag = false; track.classList.remove('drag'); var t = vp.clientWidth * 0.18; go(dx < -t ? idx + 1 : dx > t ? idx - 1 : idx); }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', function (e) { if (!onb.classList.contains('show')) return; if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') go(idx - 1); });
    next.addEventListener('click', function () { idx === slides.length - 1 ? finish() : go(idx + 1); });
    skip.addEventListener('click', finish);
    go(0);
    sleep(2800).then(function () {
      if (lsGet(ONB_KEY) || lsGet('plus_token')) { boot.classList.add('gone'); setTimeout(function () { boot.remove(); }, 800); }
      else { show(onb); }
    });
  });
})();
