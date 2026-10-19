/* =========================================================================
   EnactusNG Plus – the app. Plain JavaScript, talks only to the JSON API
   (api/index.php?r=…), so the same files can be wrapped with Capacitor.
   ========================================================================= */
(function () {
  'use strict';
  var CFG = Object.assign({ api: 'api/index.php' }, window.PLUS_CONFIG || {});
  var root = document.getElementById('app');
  var S = { token: '', user: null, pub: null, counts: { messages: 0, notifications: 0, requests: 0, mail: 0, announcements: 0, projects: 0, jobs: 0, resources: 0, events: 0 }, timers: [], poll: null };
  try { S.token = localStorage.getItem('plus_token') || ''; } catch (e) { /* private mode */ }

  /* ---------------------------------------------------------------- helpers */
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }
  var ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10', people: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 4-6 8-6s8 2 8 6',
    group: 'M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M10 11a4 4 0 100-8 4 4 0 000 8zM21 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
    chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z', mail: 'M3 6h18v12H3zM3 7l9 7 9-7', download: 'M12 3v12M7 11l5 5 5-5M5 21h14', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5', gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z', megaphone: 'M3 11v3a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15 9a4 4 0 010 6M18 6a8 8 0 010 12', bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    brief: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18', folder: 'M3 6h6l2 2h10v11H3z', cal: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
    project: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5', image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01', file: 'M7 3h8l4 4v14H7zM15 3v4h4M10 13h6M10 17h6',
    heart: 'M12 21s-8-5.3-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.7-8 11-8 11z', comment: 'M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3z',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    plus: 'M12 5v14M5 12h14', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', hub: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6'
  };
  function icon(name) {
    var i = document.createElement('i');
    i.className = 'ic';
    i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICONS[name] || '') + '"/></svg>';
    return i;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; if (stopConf) { stopConf(); stopConf = null; } }
  function every(ms, fn) { S.timers.push(setInterval(function () { if (!document.hidden) fn(); }, ms)); }

  function toast(msg, type) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = h('div', { class: 'toast-wrap', 'aria-live': 'polite' }); document.body.appendChild(wrap); }
    var t = h('div', { class: 'toast ' + (type || ''), text: msg });
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }
  function ago(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago'; if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  function linkify(text) {
    var out = [];
    String(text || '').split(/(https?:\/\/[^\s<]+)/g).forEach(function (part, i) {
      if (i % 2 === 1) out.push(h('a', { href: part, target: '_blank', rel: 'noopener noreferrer nofollow', text: part }));
      else if (part) out.push(part);
    });
    return out;
  }
  function bytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function avatar(p, cls) {
    var a = h('span', { class: 'avatar ' + (cls || '') + (p && p.photo ? ' has-img' : '') });
    if (p && p.photo) a.appendChild(h('img', { src: p.photo, alt: '', loading: 'lazy' }));
    else a.textContent = ((p && p.name) || '?').charAt(0).toUpperCase();
    return a;
  }
  function busy(btn, on) { if (!btn) return; btn.classList.toggle('is-loading', on); btn.disabled = !!on; }

  /* ---------------------------------------------------------------- api */
  function api(route, opt) {
    opt = opt || {};
    var url = CFG.api + '?r=' + route;
    if (opt.params) Object.keys(opt.params).forEach(function (k) { var v = opt.params[k]; if (v !== undefined && v !== null && v !== '') url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v); });
    var headers = { 'Accept': 'application/json' };
    if (S.token) { headers['X-Plus-Token'] = S.token; headers.Authorization = 'Bearer ' + S.token; }
    var init = { method: opt.method || (opt.data || opt.form ? 'POST' : 'GET'), headers: headers };
    if (opt.form) init.body = opt.form;
    else if (opt.data) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opt.data); }
    return fetch(url, init)
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Unexpected response from the server.' }; }).then(function (d) { d.status = r.status; return d; }); })
      .then(function (d) {
        if (d.status === 401 && S.token && route !== 'auth/login') { signOutLocal(); }
        else if (d.code === 'password_change' && location.hash.indexOf('#/welcome') !== 0) { location.hash = '#/welcome'; }
        return d;
      })
      .catch(function () { return { ok: false, error: 'Network problem. Check your connection and try again.', status: 0 }; });
  }
  function setToken(t) { S.token = t || ''; try { if (t) localStorage.setItem('plus_token', t); else localStorage.removeItem('plus_token'); } catch (e) { /* ignore */ } }
  function signOutLocal() { setToken(''); S.user = null; clearInterval(S.poll); S.poll = null; location.hash = '#/login'; }
  function openHub(to) {
    api('auth/handoff', { data: { to: to || 'p=t_dashboard' } }).then(function (d) {
      if (d.ok) { if (window.PlusNative) { window.PlusNative.openExternal(d.url); } else { window.location.href = d.url; } } else { toast(d.error || 'Could not open the Team hub.', 'error'); }
    });
  }

  /* ---------------------------------------------------------------- sign-in (segmented page) */
  var DEFAULT_SLIDES = [
    { title: 'Showcase your impact', text: 'Register your projects, log volunteer hours and let judges, partners and the whole network see the difference your team makes.' },
    { title: 'Connect across Nigeria', text: 'Find teams, alumni and advisors working on similar ideas. Send a request, start a conversation and build together.' },
    { title: 'Grow your career', text: 'Discover internships, mentorship and jobs from partners who are looking for impact-driven talent.' }
  ];
  function authShell(box) {
    var pub = S.pub || {};
    var slides = (pub.slides || []).filter(function (s) { return s && (s.title || s.text || s.image); });
    if (!slides.length) slides = DEFAULT_SLIDES;
    var els = slides.map(function (s, i) {
      return h('div', { class: 'auth-slide' + (i === 0 ? ' on' : '') },
        s.image ? h('img', { src: s.image, alt: '' }) : null,
        h('div', { class: 'auth-caption' }, h('span', { class: 'chip', text: (pub.app && pub.app.name) || 'EnactusNG Plus' }), h('h2', { text: s.title || '' }), h('p', { text: s.text || '' })));
    });
    var dots = slides.map(function (s, i) { return h('button', { type: 'button', class: i === 0 ? 'on' : '', 'aria-label': 'Show slide ' + (i + 1), onclick: function () { go(i); } }); });
    var cur = 0;
    function go(n) { els[cur].classList.remove('on'); dots[cur].classList.remove('on'); cur = (n + els.length) % els.length; els[cur].classList.add('on'); dots[cur].classList.add('on'); }
    if (els.length > 1) every(6500, function () { go(cur + 1); });
    var hero = h('section', { class: 'auth-hero', 'aria-label': 'About EnactusNG Plus' }, els, h('div', { class: 'auth-shade' }), h('div', { class: 'auth-orb a' }), h('div', { class: 'auth-orb b' }),
      h('div', { class: 'auth-brand' }, (pub.logo_light || pub.logo) ? h('img', { class: 'brand-logo', src: pub.logo_light || pub.logo, alt: pub.app && pub.app.name || 'EnactusNG Plus' }) : h('span', { text: 'EnactusNG Plus' })),
      els.length > 1 ? h('div', { class: 'auth-dots' }, dots) : null);
    clear(root);
    root.appendChild(h('div', { class: 'auth-split' }, hero, h('main', { class: 'auth-panel' }, box)));
  }
  function field(label, input, help) { return h('div', { class: 'field' }, h('label', { text: label }), input, help ? h('p', { class: 'help', text: help }) : null); }
  function pwField(id, label, autocomplete) {
    var inp = h('input', { id: id, type: 'password', autocomplete: autocomplete || 'current-password', required: true });
    var tg = h('button', { type: 'button', class: 'pw-toggle', text: 'Show', onclick: function () { var s = inp.type === 'password'; inp.type = s ? 'text' : 'password'; tg.textContent = s ? 'Hide' : 'Show'; } });
    var f = h('div', { class: 'field' }, h('label', { for: id, text: label }), h('div', { class: 'pw-wrap' }, inp, tg));
    return { el: f, input: inp };
  }
  function msgBox() { return h('div', { class: 'notice', hidden: true, role: 'alert' }); }
  function showMsg(box, text, type) { box.hidden = !text; box.className = 'notice notice-' + (type || 'error'); box.textContent = text || ''; }

  /* "Download the app" block: icon + store links (set in the admin dashboard → Site settings → EnactusNG Plus) */
  var DL_SVG = {
    windows: '<path d="M3 5.5l7.5-1v7H3zM11.5 4.35L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.35z"/>',
    mac: '<path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.9zM14.1 5.9c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"/>',
    ios: '<path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.9zM14.1 5.9c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"/>',
    android: '<path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.98 5.98 0 006 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>'
  };
  function dlIcon(kind) { var sp = h('span', { class: 'dl-os', 'aria-hidden': 'true' }); sp.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor">' + (DL_SVG[kind] || '') + '</svg>'; return sp; }
  /* phones see the Android/iPhone links, computers see Windows/macOS */
  function dlList() {
    var a = (S.pub && S.pub.app) || null, mob = window.matchMedia && window.matchMedia('(max-width:860px)').matches;
    return ((a && a.downloads) || []).filter(function (d) { return mob ? d.group === 'mobile' : d.group === 'desktop'; });
  }
  function appDownload(compact) {
    var a = (S.pub && S.pub.app) || null;
    var list = dlList();
    if (!list.length) return null;
    var btns = list.map(function (d, i) { return h('a', { class: 'btn btn-sm dl-' + d.group + ' ' + (i === 0 ? 'btn-primary' : 'btn-ghost'), href: d.url, target: '_blank', rel: 'noopener noreferrer' }, dlIcon(d.kind), ' ' + d.label); });
    return h('div', { class: 'app-dl' },
      h('div', null, h('strong', { text: 'Get the ' + (a.name || 'mobile') + ' app' }), compact ? null : h('small', { text: 'Install it on your computer or phone for the best experience.' }), h('div', { class: 'dl-btns' }, btns)));
  }
  /* header button: a small menu with Windows, macOS and Android (and iPhone when set) */
  function appMenuButton() {
    var list = dlList();
    if (!list.length) return null;
    var pop = h('div', { class: 'app-pop', hidden: true, role: 'menu' }, h('strong', { class: 'app-pop-h', text: 'Get the app' }), list.map(function (d) {
      return h('a', { class: 'app-pop-i dl-' + d.group, role: 'menuitem', href: d.url, target: '_blank', rel: 'noopener noreferrer' }, dlIcon(d.kind), h('span', null, h('b', { text: d.label }), h('small', { text: d.note || '' })));
    }));
    var btn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Get the app', title: 'Get the app', 'aria-haspopup': 'true' }, icon('download'));
    var box = h('div', { class: 'app-menu' }, btn, pop);
    function close() { pop.hidden = true; document.removeEventListener('click', away, true); }
    function away(e) { if (!box.contains(e.target)) close(); }
    btn.addEventListener('click', function () { if (pop.hidden) { pop.hidden = false; setTimeout(function () { document.addEventListener('click', away, true); }, 0); } else { close(); } });
    return box;
  }
  function brandMark() {
    var pub = S.pub || {};
    return pub.logo ? h('img', { class: 'brand-logo', src: pub.logo, alt: (pub.app && pub.app.name) || 'EnactusNG Plus' }) : h('span', null, 'EnactusNG ', h('b', { text: 'Plus' }));
  }

  function viewLogin() {
    var err = msgBox();
    var email = h('input', { id: 'l-email', type: 'text', autocomplete: 'username', required: true, autofocus: true, placeholder: 'Enactus ID or email', autocapitalize: 'none', spellcheck: 'false' });
    var pw = pwField('l-pw', 'Password');
    var btn = h('button', { class: 'btn btn-primary block', type: 'submit', text: 'Sign in' });
    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault(); showMsg(err, '');
      var v = email.value.trim();
      if (!v || !pw.input.value) { showMsg(err, 'Enter your Enactus ID or email, and your password.'); return; }
      busy(btn, true);
      api('auth/login', { data: { login: v.indexOf('@') > -1 ? v : v.replace(/\s+/g, '').toUpperCase(), password: pw.input.value, device: navigator.userAgent.slice(0, 100) } }).then(function (d) {
        busy(btn, false);
        if (!d.ok) { showMsg(err, d.error || 'Could not sign in.'); return; }
        setToken(d.token); S.user = d.user; startPolling();
        location.hash = d.user.must_change_password ? '#/welcome' : '#/';
      });
    } }, err, h('div', { class: 'field' }, h('label', { for: 'l-email', text: 'Enactus ID or email' }), email, h('p', { class: 'help', text: 'Use your Enactus ID. Team representatives, partners, BAB members and faculty advisors sign in with their email.' })), pw.el, btn);
    var pub = S.pub || {};
    authShell(h('div', { class: 'auth-box' }, pub.logo ? h('img', { class: 'logo', src: pub.logo, alt: (pub.app && pub.app.name) || pub.name || '' }) : null,
      h('h1', { text: 'Welcome back' }), h('p', { text: pub.tagline || 'Sign in to the Enactus Nigeria network.' }), form,
      h('div', { class: 'auth-links' }, h('a', { href: '#/forgot', text: 'Forgot your password?' }), pub.website ? h('a', { href: pub.website, text: 'Visit the website' }) : null),
      appDownload(false)
    ));
  }
  function viewForgot() {
    var msg = msgBox(); var email = h('input', { id: 'f-email', type: 'text', required: true, autocomplete: 'username', placeholder: 'Enactus ID or email' });
    var btn = h('button', { class: 'btn btn-primary block', type: 'submit', text: 'Send reset link' });
    authShell(h('div', { class: 'auth-box' }, h('h1', { text: 'Reset your password' }), h('p', { text: 'Enter your Enactus ID or email and we will send you a reset link.' }),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault(); busy(btn, true);
        api('auth/forgot', { data: { login: email.value.trim().indexOf('@') > -1 ? email.value.trim() : email.value.trim().replace(/\s+/g, '').toUpperCase() } }).then(function (d) { busy(btn, false); showMsg(msg, d.message || d.error, d.ok ? 'success' : 'error'); });
      } }, msg, h('div', { class: 'field' }, h('label', { for: 'f-email', text: 'Enactus ID or email' }), email), btn),
      h('div', { class: 'auth-links' }, h('a', { href: '#/login', text: '← Back to sign in' }))));
  }
  function viewReset(token) {
    var msg = msgBox(); var p1 = pwField('r1', 'New password', 'new-password'); var p2 = pwField('r2', 'Confirm password', 'new-password');
    var btn = h('button', { class: 'btn btn-primary block', type: 'submit', text: 'Update password' });
    authShell(h('div', { class: 'auth-box' }, h('h1', { text: 'Choose a new password' }), h('p', { text: 'At least 10 characters with upper and lower case letters and a number.' }),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        if (p1.input.value !== p2.input.value) { showMsg(msg, 'The two passwords do not match.'); return; }
        busy(btn, true);
        api('auth/reset', { data: { token: token, password: p1.input.value } }).then(function (d) {
          busy(btn, false);
          if (d.ok) { toast('Password updated – you can sign in now.', 'ok'); location.hash = '#/login'; } else { showMsg(msg, d.error); }
        });
      } }, msg, p1.el, p2.el, btn)));
  }
  function viewWelcome() {
    var msg = msgBox(); var cur = pwField('w0', 'Temporary password (from your email)'); var p1 = pwField('w1', 'New password', 'new-password'); var p2 = pwField('w2', 'Confirm new password', 'new-password');
    var btn = h('button', { class: 'btn btn-primary block', type: 'submit', text: 'Save and continue' });
    authShell(h('div', { class: 'auth-box' }, h('h1', { text: 'Set your own password' }), h('p', { text: 'For your security, replace the temporary password before you continue.' }),
      h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        if (p1.input.value !== p2.input.value) { showMsg(msg, 'The two new passwords do not match.'); return; }
        busy(btn, true);
        api('auth/password', { data: { current: cur.input.value, password: p1.input.value } }).then(function (d) {
          busy(btn, false);
          if (!d.ok) { showMsg(msg, d.error); return; }
          S.user.must_change_password = false; toast('Welcome aboard! 🎉', 'ok'); location.hash = '#/';
        });
      } }, msg, cur.el, p1.el, p2.el, btn),
      h('div', { class: 'auth-links' }, h('a', { href: '#/login', onclick: function () { api('auth/logout', { method: 'POST', data: {} }); setToken(''); S.user = null; }, text: 'Sign out' }))));
  }

  /* ---------------------------------------------------------------- app shell */
  var MAIL_LINK = ['/mail', 'mail', 'Mail', 'mail'];
  var LINKS = [['/', 'home', 'Home', 'home'], ['/projects', 'project', 'Projects', 'projects'], ['/jobs', 'brief', 'Opportunities', 'jobs'], ['/connect', 'people', 'Connect', 'connect'],
    ['/announcements', 'megaphone', 'Announcements', 'announcements'], ['/messages', 'chat', 'Messages', 'messages'], ['/resources', 'folder', 'Resources', 'resources'], ['/events', 'cal', 'Events', 'events'], ['/notifications', 'bell', 'Notifications', 'notifications']];
  function menuLinks() { return S.user && S.user.mail_enabled ? LINKS.slice(0, 6).concat([MAIL_LINK], LINKS.slice(6)) : LINKS; }
  function countEl(key) { return h('em', { class: 'count', 'data-c': key, hidden: true }); }
  function paintCounts() {
    var map = { connect: S.counts.requests, messages: S.counts.messages, notifications: S.counts.notifications, mail: S.counts.mail, announcements: S.counts.announcements, projects: S.counts.projects, jobs: S.counts.jobs, resources: S.counts.resources, events: S.counts.events, more: (S.counts.announcements || 0) + (S.counts.projects || 0) + (S.counts.jobs || 0) + (S.counts.resources || 0) + (S.counts.events || 0) };
    document.querySelectorAll('[data-c]').forEach(function (el) { var n = map[el.getAttribute('data-c')] || 0; el.textContent = n > 99 ? '99+' : n; el.hidden = !n; });
  }
  function refreshCounts() {
    if (!S.token) return;
    api('unread').then(function (d) { if (d.ok) { S.counts = { messages: d.messages, notifications: d.notifications, requests: d.requests, mail: d.mail || 0, announcements: d.announcements || 0, projects: (d.fresh || {}).projects || 0, jobs: (d.fresh || {}).jobs || 0, resources: (d.fresh || {}).resources || 0, events: (d.fresh || {}).events || 0 }; paintCounts(); } });
  }
  function markSeen(sec) { S.counts[sec] = 0; paintCounts(); api('seen', { data: { section: sec } }); }
  function startPolling() { clearInterval(S.poll); S.poll = setInterval(function () { if (!document.hidden) refreshCounts(); }, 20000); refreshCounts(); }

  function shell(active, widgets) {
    var u = S.user, pub = S.pub || {};
    var nav = [['/', 'home', 'Home', 'home', null], ['/announcements', 'megaphone', 'Announcements', 'announcements', 'announcements'], ['/projects', 'project', 'Projects', 'projects', 'projects'], ['/jobs', 'brief', 'Opportunities', 'jobs', 'jobs'], ['/connect', 'people', 'Connect', 'connect', 'connect'], ['/messages', 'chat', 'Messages', 'messages', 'messages']];
    if (u.mail_enabled) nav.push(['/mail', 'mail', 'Mail', 'mail', 'mail']);
    var top = h('header', { class: 'app-top' }, h('div', { class: 'app-top-in' },
      h('a', { class: 'app-brand', href: '#/', 'aria-label': 'EnactusNG Plus home' }, brandMark()),
      h('nav', { class: 'app-nav', 'aria-label': 'Main' }, nav.map(function (n) { return h('a', { class: 'nav-btn' + (active === n[3] ? ' on' : ''), href: '#' + n[0], 'aria-label': n[2], title: n[2] }, icon(n[1]), n[4] ? countEl(n[4]) : null); })),
      h('div', { class: 'app-right' }, appMenuButton(), h('a', { class: 'icon-btn', href: '#/notifications', 'aria-label': 'Notifications' }, icon('bell'), countEl('notifications')), h('a', { href: '#/me', 'aria-label': 'My profile' }, avatar(u)))));
    var side = h('aside', { class: 'side-col' },
      h('div', { class: 'side-card' }, h('a', { class: 'side-me', href: '#/me' }, avatar(u), h('span', null, h('strong', { text: u.name }), h('small', { text: u.kind_label + (u.team ? ' · ' + u.team : '') })))),
      h('nav', { class: 'side-card', 'aria-label': 'Menu' }, menuLinks().map(function (l) { return h('a', { class: 'side-link' + (active === l[3] ? ' on' : ''), href: '#' + l[0] }, icon(l[1]), h('span', { text: l[2] }), ['connect', 'messages', 'notifications', 'mail', 'announcements', 'projects', 'jobs', 'resources', 'events'].indexOf(l[3]) > -1 ? countEl(l[3]) : null); }),
        (u.is_team || u.is_staff) ? h('a', { class: 'side-link', href: '#/me', onclick: function (e) { e.preventDefault(); openHub(u.is_team ? 'p=t_dashboard' : 'p=plus_resources'); } }, icon('hub'), h('span', { text: u.is_team ? 'Team hub' : 'Staff area' })) : null),
      appDownload(true));
    var main = h('main', { class: 'main-col', id: 'main' });
    var right = widgets ? h('aside', { class: 'right-col' }) : null;
    var bn = [['/', 'home', 'Home', 'home', null], ['/connect', 'people', 'Connect', 'connect', 'connect'], ['/messages', 'chat', 'Chats', 'messages', 'messages'], ['/more', 'folder', 'More', 'more', 'more']];
    if (u.mail_enabled) bn.splice(3, 0, ['/mail', 'mail', 'Mail', 'mail', 'mail']);
    var bottom = h('nav', { class: 'bottom-nav', 'aria-label': 'Main' }, bn.map(function (n) { return h('a', { class: 'bn' + (active === n[3] ? ' on' : ''), href: '#' + n[0] }, icon(n[1]), h('span', { text: n[2] }), n[4] ? countEl(n[4]) : null); }));
    clear(root);
    root.appendChild(top); root.appendChild(h('div', { class: 'app-body' + (right ? '' : ' no-right') }, side, main, right)); root.appendChild(bottom);
    paintCounts();
    window.scrollTo(0, 0);
    if (right) fillWidgets(right);
    return main;
  }
  function fillWidgets(right) {
    var evBox = h('div', { class: 'widget' }, h('h3', { text: 'Upcoming events' }), h('p', { class: 'muted small', text: 'Loading…' }));
    var pBox = h('div', { class: 'widget' }, h('h3', { text: 'People you may know' }), h('p', { class: 'muted small', text: 'Loading…' }));
    right.appendChild(evBox); right.appendChild(pBox);
    api('events').then(function (d) {
      var up = (d.events || []).filter(function (e) { return !e.past; }).slice(0, 3);
      evBox.lastChild.remove();
      if (!up.length) { evBox.appendChild(h('p', { class: 'muted small', text: 'Nothing scheduled yet.' })); }
      up.forEach(function (e) { var dt = new Date(e.starts_at); evBox.appendChild(h('div', { class: 'mini' }, h('div', { class: 'ev-chip' }, h('span', { text: dt.getDate() }), h('small', { text: dt.toLocaleString(undefined, { month: 'short' }) })), h('div', { class: 'who' }, h('strong', { text: e.title }), h('small', { text: e.location || when(e.starts_at) })))); });
      evBox.appendChild(h('a', { class: 'small', href: '#/events', text: 'All events →' }));
    });
    api('people', { params: { page: 1 } }).then(function (d) {
      pBox.lastChild.remove();
      var list = (d.people || []).filter(function (p) { return p.relation === 'none'; }).slice(0, 5);
      if (!list.length) { pBox.appendChild(h('p', { class: 'muted small', text: 'You are connected with everyone here 🎉' })); }
      list.forEach(function (p) {
        var b = h('button', { class: 'btn btn-soft btn-sm', text: 'Connect', onclick: function () { connectTo(p, b); } });
        pBox.appendChild(h('div', { class: 'mini' }, avatar(p, 'sm'), h('div', { class: 'who' }, h('strong', { text: p.name }), h('small', { text: p.headline || p.team || p.kind_label })), b));
      });
      pBox.appendChild(h('a', { class: 'small', href: '#/connect', text: 'Find more people →' }));
    });
  }
  function viewMore() {
    var main = shell('more', false);
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'More' })));
    main.appendChild(h('div', { class: 'side-card' }, menuLinks().concat([['/me', 'user', 'My profile', 'me']]).map(function (l) { return h('a', { class: 'side-link', href: '#' + l[0] }, icon(l[1]), h('span', { text: l[2] })); }),
      (S.user.is_team || S.user.is_staff) ? h('a', { class: 'side-link', href: '#/more', onclick: function (e) { e.preventDefault(); openHub(S.user.is_team ? 'p=t_dashboard' : 'p=plus_resources'); } }, icon('hub'), h('span', { text: S.user.is_team ? 'Team hub' : 'Staff area' })) : null));
    var dl = appDownload(false); if (dl) main.appendChild(dl);
  }
  function lightbox(src) {
    var box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Photo', onclick: function () { box.remove(); } }, h('button', { type: 'button', 'aria-label': 'Close', text: '×' }), h('img', { src: src, alt: '' }));
    document.body.appendChild(box);
  }

  /* ---------------------------------------------------------------- timeline */
  function connectTo(p, btn) {
    busy(btn, true);
    api('connect', { data: { user: p.id } }).then(function (d) {
      busy(btn, false);
      if (!d.ok) { toast(d.error || 'Could not send the request.', 'error'); return; }
      btn.textContent = d.relation === 'connected' ? 'Connected' : 'Request sent'; btn.disabled = true; btn.className = 'btn btn-ghost btn-sm';
      refreshCounts();
    });
  }
  function messageUser(id) {
    api('dm', { data: { user: id } }).then(function (d) { if (d.ok) { location.hash = '#/messages/' + d.room_id; } else { toast(d.error || 'Could not open the conversation.', 'error'); } });
  }
  function commentNode(c, onDelete) {
    var n = h('div', { class: 'comment' }, avatar(c.author, 'sm'),
      h('div', { class: 'bubble' }, h('strong', null, c.author.name, h('small', { text: ago(c.at) })), h('p', null, linkify(c.body)),
        c.can_delete ? h('button', { class: 'linklike small', type: 'button', text: 'Delete', onclick: function () { api('comment/delete', { data: { id: c.id } }).then(function () { n.remove(); onDelete(); }); } }) : null));
    return n;
  }
  function commentsBox(it, setCount) {
    var listEl = h('div'); var count = it.comments;
    var inp = h('input', { type: 'text', maxlength: '1000', placeholder: 'Write a comment…', 'aria-label': 'Write a comment' });
    var btn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit', text: 'Send' });
    var form = h('form', { class: 'comment-form', onsubmit: function (e) {
      e.preventDefault(); if (!inp.value.trim()) return;
      busy(btn, true);
      api('comment', { data: { type: it.type, id: it.id, body: inp.value } }).then(function (d) {
        busy(btn, false);
        if (!d.ok) { toast(d.error || 'Could not post the comment.', 'error'); return; }
        listEl.appendChild(commentNode(d.comment, function () { count--; setCount(count); })); inp.value = ''; count++; setCount(count);
      });
    } }, inp, btn);
    api('comments', { params: { type: it.type, id: it.id } }).then(function (d) { (d.comments || []).forEach(function (c) { listEl.appendChild(commentNode(c, function () { count--; setCount(count); })); }); });
    return h('div', { class: 'comments' }, listEl, form);
  }
  function socialFooter(card, it, extraActions) {
    var stats = h('div', { class: 'post-stats' }, h('span'), h('span'));
    var likeBtn = h('button', { type: 'button', class: it.liked ? 'liked' : '' }, icon('heart'), h('span', { text: 'Like' }));
    var comBtn = h('button', { type: 'button' }, icon('comment'), h('span', { text: 'Comment' }));
    var box = null;
    function paint() { stats.firstChild.textContent = it.likes ? it.likes + (it.likes === 1 ? ' like' : ' likes') : ''; stats.lastChild.textContent = it.comments ? it.comments + (it.comments === 1 ? ' comment' : ' comments') : ''; likeBtn.className = it.liked ? 'liked' : ''; }
    paint();
    likeBtn.addEventListener('click', function () {
      api('react', { data: { type: it.type, id: it.id } }).then(function (d) { if (d.ok) { it.liked = d.liked; it.likes = d.likes; paint(); } });
    });
    comBtn.addEventListener('click', function () {
      if (box) { box.remove(); box = null; return; }
      box = commentsBox(it, function (n) { it.comments = n; paint(); }); card.appendChild(box);
    });
    card.appendChild(stats);
    card.appendChild(h('div', { class: 'post-actions' }, likeBtn, comBtn, extraActions || null));
  }
  function authorHead(a, at, tag) {
    return h('div', { class: 'post-head' }, avatar(a), h('div', { class: 'who' }, h('strong', { text: a.name }),
      h('small', { text: [a.kind_label, a.team || a.organisation].filter(Boolean).join(' · ') + ' · ' + ago(at) })), tag || null);
  }
  function renderItem(it, onRemove) {
    var u = S.user, card = h('article', { class: 'post', 'data-key': it.key });
    if (it.type === 'post') {
      card.appendChild(authorHead(it.author, it.at, it.kind === 'announcement' ? h('a', { class: 'tag ann', href: '#/announcements', text: 'Announcement' }) : (it.pending ? h('span', { class: 'tag', text: 'Awaiting approval' }) : null)));
      if (it.body) card.appendChild(h('div', { class: 'post-body' }, linkify(it.body)));
      var imgs = it.media.filter(function (m) { return m.kind === 'image'; }), docs = it.media.filter(function (m) { return m.kind === 'file'; });
      if (imgs.length) card.appendChild(h('div', { class: 'media-grid' + (imgs.length === 1 ? ' one' : '') }, imgs.map(function (m) { return h('button', { type: 'button', 'aria-label': 'View photo', onclick: function () { lightbox(m.url); } }, h('img', { src: m.url, alt: '', loading: 'lazy' })); })));
      if (docs.length) card.appendChild(h('div', { class: 'docs' }, docs.map(function (m) { return h('a', { class: 'doc', href: m.url, target: '_blank', rel: 'noopener', title: 'Download', onclick: function (e) { e.preventDefault(); withDl(e.currentTarget, function () { return fileDownload(m.url, m.name); }); } }, icon('file'), h('span', { class: 'doc-t' }, h('strong', { text: m.name || 'Document' }), h('small', { text: 'Download · ' + bytes(m.size) })), dlTail()); })));
      var del = (it.author.id === u.id || u.is_staff) ? h('button', { type: 'button', 'aria-label': 'Delete post', onclick: function () {
        if (!confirm('Delete this post?')) return;
        api('post/delete', { data: { id: it.id } }).then(function (d) { if (d.ok) { card.remove(); if (onRemove) onRemove(); } else { toast(d.error, 'error'); } });
      } }, icon('trash')) : null;
      socialFooter(card, it, del);
    } else if (it.type === 'project') {
      card.appendChild(h('div', { class: 'post-head' }, h('div', { class: 'who' }, h('strong', { text: it.team.name || 'A team' }), h('small', { text: 'shared a project · ' + ago(it.at) })), h('span', { class: 'tag proj', text: 'Project' })));
      if (it.image) card.appendChild(h('a', { href: '#/projects/' + it.id }, h('img', { class: 'feat-img', src: it.image, alt: '', loading: 'lazy' })));
      card.appendChild(h('div', { class: 'feat-body' }, h('h3', null, h('a', { href: '#/projects/' + it.id, text: it.title })), it.category ? h('span', { class: 'badge badge-green', text: it.category }) : null, h('p', { text: it.summary }),
        h('div', { class: 'metrics' }, h('span', null, h('b', { text: it.hours }), ' volunteer hours'), h('span', null, h('b', { text: it.people.toLocaleString() }), ' people reached'))));
      socialFooter(card, it, h('a', { href: '#/projects/' + it.id }, icon('project'), h('span', { text: 'Open' })));
    } else {
      card.appendChild(h('div', { class: 'post-head' }, h('div', { class: 'who' }, h('strong', { text: it.company || it.by || 'Partner' }), h('small', { text: 'posted an opportunity · ' + ago(it.at) })), h('span', { class: 'tag job', text: it.kind_label })));
      card.appendChild(h('div', { class: 'feat-body' }, h('h3', { text: it.title }), h('p', { text: it.description }), it.deadline ? h('div', { class: 'metrics' }, h('span', null, 'Closes ', h('b', { text: new Date(it.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }))) : null));
      socialFooter(card, it, it.apply_url ? h('a', { href: it.apply_url, target: '_blank', rel: 'noopener noreferrer' }, icon('brief'), h('span', { text: 'Apply' })) : null);
    }
    return card;
  }

  function composer(onPosted) {
    var u = S.user, imgs = [], docs = [];
    var ta = h('textarea', { rows: '2', maxlength: '3000', placeholder: 'Share an update, ' + u.name.split(' ')[0] + '…', 'aria-label': 'Write a post' });
    var chosen = h('div', { class: 'chosen' });
    var btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Post' });
    var ann = u.is_staff ? h('input', { type: 'checkbox', id: 'ann' }) : null;
    function paintChosen() { clear(chosen); imgs.concat(docs).forEach(function (f) { chosen.appendChild(h('span', { text: f.name })); }); chosen.hidden = !(imgs.length + docs.length); }
    function picker(label, ic, accept, store, short) {
      var inp = h('input', { type: 'file', accept: accept, multiple: true, onchange: function () { store.length = 0; Array.prototype.forEach.call(inp.files, function (f) { store.push(f); }); paintChosen(); } });
      return h('label', { class: 'attach-btn', title: label, 'aria-label': label }, icon(ic), h('span', { class: 'lbl', text: label }), h('span', { class: 'lbl-s', text: short || label }), inp);
    }
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; });
    btn.addEventListener('click', function () {
      if (!ta.value.trim() && !imgs.length && !docs.length) { toast('Write something or attach a file.', 'error'); return; }
      var fd = new FormData(); fd.append('body', ta.value);
      if (ann && ann.checked) fd.append('kind', 'announcement');
      imgs.forEach(function (f) { fd.append('images[]', f); }); docs.forEach(function (f) { fd.append('docs[]', f); });
      busy(btn, true);
      api('post/create', { form: fd }).then(function (d) {
        busy(btn, false);
        if (!d.ok) { toast(d.error || 'Could not post.', 'error'); return; }
        ta.value = ''; ta.style.height = ''; imgs.length = 0; docs.length = 0; paintChosen(); if (ann) ann.checked = false;
        onPosted(d.item); toast(d.message || 'Posted!', 'ok');
      });
    });
    paintChosen();
    return h('div', { class: 'composer' }, h('div', { class: 'composer-top' }, avatar(u), ta), chosen,
      h('div', { class: 'composer-bar' }, u.can_attach ? [picker('Photos', 'image', 'image/*', imgs), picker('Documents', 'file', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv', docs, 'Files')] : h('span', { class: 'muted small', text: 'Photos and documents are not enabled for your account.' }),
        ann ? h('label', { class: 'attach-btn', title: 'Post as an announcement' }, ann, icon('megaphone'), h('span', { class: 'lbl', text: 'Announcement' }), h('span', { class: 'lbl-s', text: 'Notice' })) : null, h('span', { class: 'spacer' }), btn));
  }

  var startTabOverride = null;
  function viewFeed(startTab) {
    var main = shell(startTab === 'announcements' ? 'announcements' : 'home', true);
    var tab = startTab || 'all', next = null, seen = {}, loading = false;
    if (startTab === 'all' && startTabOverride) { tab = startTabOverride; } startTabOverride = null;
    var list = h('div'), more = h('div', { class: 'load-more' });
    var tabs = [['all', 'For you'], ['announcements', 'Announcements'], ['posts', 'Posts'], ['projects', 'Projects'], ['jobs', 'Opportunities']];
    var tabBar = h('div', { class: 'pill-tabs', role: 'tablist' }, tabs.map(function (t) {
      return h('button', { type: 'button', role: 'tab', class: t[0] === tab ? 'on' : '', 'data-t': t[0], text: t[1], onclick: function () {
        if (t[0] === 'announcements' && location.hash !== '#/announcements') { location.hash = '#/announcements'; return; }
        if (t[0] !== 'announcements' && location.hash === '#/announcements') { startTabOverride = t[0]; location.hash = '#/'; return; }
        tab = t[0]; tabBar.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); }); load(true); } });
    }));
    main.appendChild(composer(function (item) { if (!item) return; if (tab === 'all' || tab === 'posts') { seen[item.key] = 1; list.insertBefore(renderItem(item), list.firstChild); } }));
    main.appendChild(tabBar); main.appendChild(list); main.appendChild(more);
    function load(reset) {
      if (loading) return; loading = true;
      if (reset) { clear(list); seen = {}; next = null; }
      clear(more); more.appendChild(h('div', { class: 'spinner sm' }));
      api('feed', { params: { tab: tab, before: reset ? '' : next } }).then(function (d) {
        loading = false; clear(more);
        if (!d.ok) { toast(d.error || 'Could not load the timeline.', 'error'); return; }
        d.items.forEach(function (it) { if (seen[it.key]) return; seen[it.key] = 1; list.appendChild(renderItem(it)); });
        next = d.next;
        if (!list.children.length) { list.appendChild(h('div', { class: 'card center' }, h('h2', { text: 'Nothing here yet' }), h('p', { class: 'muted', text: 'Be the first to share something, or connect with more people.' }))); }
        if (next && d.items.length) more.appendChild(h('button', { class: 'btn btn-ghost', type: 'button', text: 'Load more', onclick: function () { load(false); } }));
      });
    }
    load(true);
    every(60000, refreshCounts);
  }

  /* ---------------------------------------------------------------- connect */
  function personCard(p, onChange) {
    var btns = h('div', { class: 'btns' });
    if (p.relation === 'none') { var b = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Connect' }); b.addEventListener('click', function () { connectTo(p, b); }); btns.appendChild(b); }
    else if (p.relation === 'sent') btns.appendChild(h('button', { class: 'btn btn-ghost btn-sm', disabled: true, text: 'Request sent' }));
    else if (p.relation === 'received') { var a = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Accept' }); a.addEventListener('click', function () { busy(a, true); api('connection/respond', { data: { id: p.connection_id, action: 'accept' } }).then(function (d) { busy(a, false); if (d.ok) { a.textContent = 'Connected'; a.disabled = true; refreshCounts(); } }); }); btns.appendChild(a); }
    else btns.appendChild(h('span', { class: 'badge badge-green', text: 'Connected' }));
    btns.appendChild(h('button', { class: 'btn btn-ghost btn-sm msg-btn', type: 'button', text: 'Message', onclick: function () { messageUser(p.id); } }));
    if (p.kind === 'team') {
      return h('article', { class: 'person is-team' }, h('div', { class: 'team-band' + (p.cover ? ' has-cover' : ''), style: p.cover ? 'background-image:url("' + String(p.cover).replace(/"/g, '%22') + '")' : '' }, h('span', { class: 'team-tag', text: 'TEAM' })),
        h('div', { class: 'team-logo' }, avatar(p, 'lg')), h('div', { class: 'pbody' }, h('h3', { text: p.name }), p.headline ? h('span', { class: 'headline', text: p.headline }) : null, h('small', { class: 'muted', text: 'Enactus campus team' })), btns);
    }
    return h('article', { class: 'person' }, avatar(p, 'lg'), h('div', { class: 'pbody' }, h('h3', { text: p.name }), h('small', { class: 'muted', text: p.kind_label }), p.headline ? h('span', { class: 'headline', text: p.headline }) : null, (p.team || p.organisation) ? h('small', { class: 'muted pteam', text: p.team || p.organisation }) : null), btns);
  }
  function connectTabs(active) {
    return h('div', { class: 'pill-tabs' }, [['', 'Discover'], ['requests', 'Requests'], ['friends', 'My connections']].map(function (t) {
      return h('a', { href: '#/connect' + (t[0] ? '/' + t[0] : ''), class: active === t[0] ? 'on' : '' }, t[1], t[0] === 'requests' ? countEl('connect') : null);
    }));
  }
  function viewConnect(sub) {
    var main = shell('connect', false); sub = sub || '';
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Connect' })));
    main.appendChild(connectTabs(sub)); paintCounts();
    if (sub === '') {
      var q = h('input', { type: 'search', placeholder: 'Search people by name or headline…', 'aria-label': 'Search people' });
      var kind = h('select', { 'aria-label': 'Type' }, h('option', { value: '', text: 'Everyone' }), ['team:Team representatives', 'member:Members', 'alumni:Alumni', 'advisor:Academic advisors', 'partner:Partners', 'staff:Staff'].map(function (k) { var p = k.split(':'); return h('option', { value: p[0], text: p[1] }); }));
      var team = h('select', { 'aria-label': 'Team' }, h('option', { value: '', text: 'All teams' }));
      var grid = h('div', { class: 'people-grid' }), more = h('div', { class: 'load-more' }); var page = 1, tmr = null, filled = false;
      main.appendChild(h('div', { class: 'search-row' }, q, kind, team)); main.appendChild(grid); main.appendChild(more);
      var load = function (reset) {
        if (reset) { page = 1; clear(grid); }
        clear(more); more.appendChild(h('div', { class: 'spinner sm' }));
        api('people', { params: { q: q.value.trim(), kind: kind.value, team: team.value, page: page } }).then(function (d) {
          clear(more);
          if (!d.ok) { toast(d.error, 'error'); return; }
          if (!filled && d.teams) { d.teams.forEach(function (t) { team.appendChild(h('option', { value: t.id, text: t.name })); }); filled = true; }
          d.people.forEach(function (p) { grid.appendChild(personCard(p)); });
          if (!grid.children.length) grid.appendChild(h('div', { class: 'card center', text: 'Nobody matches your search.' }));
          if (d.more) more.appendChild(h('button', { class: 'btn btn-ghost', type: 'button', text: 'Show more', onclick: function () { page++; load(false); } }));
        });
      };
      q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { load(true); }, 350); });
      kind.addEventListener('change', function () { load(true); }); team.addEventListener('change', function () { load(true); });
      load(true);
    } else {
      var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
      var render = function () {
        api('connections').then(function (d) {
          clear(box);
          var rows = function (list, btnsFn) { return list.map(function (p) { return h('div', { class: 'row-card' }, avatar(p), h('div', { class: 'who' }, h('strong', { text: p.name }), h('small', { text: p.headline || p.team || p.kind_label })), h('div', { class: 'btns' }, btnsFn(p))); }); };
          var respond = function (p, action, btn) { busy(btn, true); api('connection/respond', { data: { id: p.connection_id, action: action } }).then(function (r) { busy(btn, false); if (r.ok) { refreshCounts(); render(); } else { toast(r.error, 'error'); } }); };
          if (sub === 'requests') {
            box.appendChild(h('h2', { class: 'sect-h', text: 'Requests for you' }));
            if (!d.incoming.length && !(d.invites && d.invites.length)) box.appendChild(h('p', { class: 'muted', text: 'No new requests.' }));
            rows(d.incoming, function (p) { var a = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Accept' }), x = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Decline' }); a.addEventListener('click', function () { respond(p, 'accept', a); }); x.addEventListener('click', function () { respond(p, 'decline', x); }); return [a, x]; }).forEach(function (n) { box.appendChild(n); });
            if (d.invites && d.invites.length) {
              box.appendChild(h('h2', { class: 'sect-h', text: 'Group invitations' }));
              d.invites.forEach(function (i) {
                var a = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Join' }), x = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Decline' });
                function resp(action, b) { busy(b, true); api('invite/respond', { data: { id: i.id, action: action } }).then(function (r) { busy(b, false); if (r.ok) { refreshCounts(); if (action === 'accept') { location.hash = '#/messages/' + r.room_id; } else { render(); } } else { toast(r.error, 'error'); } }); }
                a.addEventListener('click', function () { resp('accept', a); }); x.addEventListener('click', function () { resp('decline', x); });
                box.appendChild(h('div', { class: 'row-card' }, h('span', { class: 'avatar hash', text: '#' }), h('div', { class: 'who' }, h('strong', { text: i.name }), h('small', { text: i.from + ' invited you · ' + ago(i.at) })), h('div', { class: 'btns' }, a, x)));
              });
            }
            box.appendChild(h('h2', { class: 'sect-h', text: 'Requests you sent' }));
            if (!d.outgoing.length) box.appendChild(h('p', { class: 'muted', text: 'None waiting.' }));
            rows(d.outgoing, function (p) { var c = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Cancel' }); c.addEventListener('click', function () { respond(p, 'cancel', c); }); return [c]; }).forEach(function (n) { box.appendChild(n); });
          } else {
            if (!d.friends.length) box.appendChild(h('div', { class: 'card center' }, h('h2', { text: 'No connections yet' }), h('p', { class: 'muted', text: 'Find people in Discover and send a request.' })));
            rows(d.friends, function (p) { var m = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Message', onclick: function () { messageUser(p.id); } }), r = h('button', { class: 'btn btn-quiet btn-sm', type: 'button', text: 'Remove' }); r.addEventListener('click', function () { if (confirm('Remove ' + p.name + ' from your connections?')) respond(p, 'remove', r); }); return [m, r]; }).forEach(function (n) { box.appendChild(n); });
          }
        });
      };
      render();
    }
  }

  /* ---------------------------------------------------------------- groups you form with other students */
  function viewGroups() {
    var main = shell('messages', false);
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Groups' }), h('a', { class: 'btn btn-primary btn-sm only-desktop', href: '#/groups/new', text: '+ New group' })));
    main.appendChild(h('p', { class: 'muted only-desktop', style: 'margin-bottom:14px', text: 'Form a team or study group with other students: create a group, send people a request to join, and chat together.' }));
    main.appendChild(h('a', { class: 'fab', href: '#/groups/new', 'aria-label': 'Create a group', title: 'Create a group' }, icon('plus')));
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    function render() {
      api('groups').then(function (d) {
        clear(box);
        if (d.invites && d.invites.length) {
          box.appendChild(h('h2', { class: 'sect-h', text: 'Invitations' }));
          d.invites.forEach(function (i) {
            var a = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Join' }), x = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Decline' });
            function resp(action, b) { busy(b, true); api('invite/respond', { data: { id: i.id, action: action } }).then(function (r) { busy(b, false); if (r.ok) { refreshCounts(); if (action === 'accept') { location.hash = '#/messages/' + r.room_id; } else { render(); } } else { toast(r.error, 'error'); } }); }
            a.addEventListener('click', function () { resp('accept', a); }); x.addEventListener('click', function () { resp('decline', x); });
            box.appendChild(h('div', { class: 'row-card' }, h('span', { class: 'avatar hash', text: '#' }), h('div', { class: 'who' }, h('strong', { text: i.name }), h('small', { text: i.from + ' invited you · ' + ago(i.at) })), h('div', { class: 'btns' }, a, x)));
          });
        }
        box.appendChild(h('h2', { class: 'sect-h', text: 'My groups' }));
        if (!d.groups || !d.groups.length) box.appendChild(h('div', { class: 'card center', text: 'You are not in any group yet.' }));
        (d.groups || []).forEach(function (g) {
          box.appendChild(h('div', { class: 'wa-row' }, h('a', { class: 'wa-main', href: '#/messages/' + g.id }, avatar({ name: g.name, photo: g.photo }, 'md'),
            h('span', { class: 'wa-txt' }, h('strong', { text: g.name }), h('small', { text: (g.description ? g.description + ' · ' : '') + g.members + (g.members === 1 ? ' member' : ' members') + (g.is_admin ? ' · admin' : '') }))),
            h('a', { class: 'btn btn-ghost btn-sm', href: '#/groups/' + g.id, text: 'Members' })));
        });
      });
    }
    render();
  }
  function viewNewGroup() {
    clear(root);
    var name = h('input', { type: 'text', maxlength: '80', placeholder: 'Group name', required: true, autofocus: true });
    var desc = h('textarea', { rows: '3', maxlength: '255', placeholder: 'What is this group about? (optional)' });
    var photo = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif' });
    var btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Create group' });
    root.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'screen-head' }, h('a', { class: 'chat-back', href: '#/messages', 'aria-label': 'Back', text: '←' }), h('h2', { text: 'New group' })),
      h('form', { class: 'screen-body', onsubmit: function (e) {
        e.preventDefault(); busy(btn, true);
        api('group/create', { data: { name: name.value, description: desc.value } }).then(function (d) {
          if (!d.ok) { busy(btn, false); toast(d.error || 'Could not create the group.', 'error'); return; }
          function done() { busy(btn, false); toast('Group created – now invite people.', 'ok'); location.hash = '#/groups/' + d.id; }
          if (photo.files && photo.files[0]) { var fd = new FormData(); fd.append('photo', photo.files[0]); fd.append('room', d.id); api('group/photo', { form: fd }).then(done); } else { done(); }
        });
      } }, field('Group name', name), field('Description', desc), field('Group picture (optional)', photo, 'JPG, PNG or WEBP.'), btn)));
    window.scrollTo(0, 0);
  }
  function reportSheet(roomId, title) {
    var reasons = [['illegal', 'Illegal activity'], ['harassment', 'Harassment or bullying'], ['scam', 'Scam or fraud'], ['explicit', 'Sexual or violent content'], ['hate', 'Hate speech'], ['other', 'Something else']];
    var sel = h('select', null, reasons.map(function (x) { return h('option', { value: x[0], text: x[1] }); }));
    var det = h('textarea', { rows: '3', maxlength: '600', placeholder: 'Tell us what is happening (optional)' });
    var go = h('button', { class: 'btn btn-danger', type: 'button', text: 'Send report' });
    var ov = h('div', { class: 'sheet-ov', onclick: function (e) { if (e.target === ov) ov.remove(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('h3', { text: 'Report “' + title + '”' }), h('p', { class: 'muted small', text: 'An administrator will review this group. The group will not be told who reported it.' }),
        field('What is wrong?', sel), field('Details', det), h('div', { class: 'btns', style: 'display:flex;gap:8px;justify-content:flex-end' }, h('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel', onclick: function () { ov.remove(); } }), go)));
    go.addEventListener('click', function () {
      busy(go, true);
      api('group/report', { data: { room: roomId, reason: sel.value, details: det.value } }).then(function (d) { busy(go, false); if (d.ok) { ov.remove(); toast(d.message || 'Report sent.', 'ok'); } else { toast(d.error || 'Could not send the report.', 'error'); } });
    });
    document.body.appendChild(ov);
  }
  function viewGroup(id) {
    var main = shell('messages', false);
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    function render() {
      api('group', { params: { id: id } }).then(function (d) {
        clear(box);
        if (!d.ok) { box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Group not found' }), h('a', { href: '#/messages', text: '← Back to messages' }))); return; }
        var g = d.group, members = {};
        d.members.forEach(function (m) { members[m.id] = true; });
        box.appendChild(h('a', { href: '#/messages', class: 'small', text: '← Back to messages' }));
        box.appendChild(h('div', { class: 'page-h', style: 'margin-top:8px' }, h('div', { class: 'gp-head' }, avatar({ name: g.name, photo: g.photo }, 'xl'), h('div', null, h('h1', { text: g.name }), g.description ? h('p', { class: 'muted', text: g.description }) : null, g.is_admin ? groupPhotoControl(g, render) : null)),
          h('div', { class: 'btns', style: 'display:flex;gap:8px' }, h('a', { class: 'btn btn-primary btn-sm', href: '#/messages/' + g.id, text: 'Open chat' }),
            (g.staff_made || g.is_creator) ? null : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '⚑ Report', onclick: function () { reportSheet(g.id, g.name); } }),
            h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Leave', onclick: function () { if (confirm('Leave “' + g.name + '”?')) { api('group/leave', { data: { room: g.id } }).then(function () { location.hash = '#/groups'; }); } } }))));
        // invite
        var q = h('input', { type: 'search', class: 'search-input', placeholder: 'Search people to invite…', 'aria-label': 'Search people' }); var res = h('div'); var tmr = null;
        q.addEventListener('input', function () {
          clearTimeout(tmr);
          tmr = setTimeout(function () {
            clear(res); if (q.value.trim().length < 2) return;
            api('people', { params: { q: q.value.trim() } }).then(function (r) {
              clear(res);
              (r.people || []).filter(function (p) { return !members[p.id]; }).slice(0, 8).forEach(function (p) {
                var b = h('button', { class: 'btn btn-soft btn-sm', type: 'button', text: 'Invite' });
                b.addEventListener('click', function () { busy(b, true); api('group/invite', { data: { room: g.id, user: p.id } }).then(function (x) { busy(b, false); if (x.ok) { b.textContent = 'Invited'; b.disabled = true; toast('Invitation sent to ' + p.name, 'ok'); } else { toast(x.error, 'error'); } }); });
                res.appendChild(h('div', { class: 'row-card' }, avatar(p), h('div', { class: 'who' }, h('strong', { text: p.name }), h('small', { text: p.headline || p.team || p.kind_label })), b));
              });
              if (!res.children.length) res.appendChild(h('p', { class: 'muted small', text: 'No one found.' }));
            });
          }, 350);
        });
        box.appendChild(h('div', { class: 'form-card' }, h('h2', { text: 'Invite people' }), h('p', { class: 'muted small', style: 'margin-bottom:10px', text: 'They will get a request and can join or decline.' }), q, res));
        box.appendChild(h('h2', { class: 'sect-h', text: 'Members (' + d.members.length + ')' }));
        d.members.forEach(function (m) {
          var rm = (g.is_admin && m.id !== S.user.id && !m.is_admin) ? h('button', { class: 'btn btn-quiet btn-sm', type: 'button', text: 'Remove', onclick: function () { if (confirm('Remove ' + m.name + ' from the group?')) { api('group/remove', { data: { room: g.id, user: m.id } }).then(render); } } }) : null;
          box.appendChild(h('div', { class: 'row-card' }, avatar(m), h('div', { class: 'who' }, h('strong', { text: m.name }), h('small', { text: (m.is_admin ? 'Admin · ' : '') + (m.headline || m.team || m.kind_label) })), rm));
        });
        if (d.pending && d.pending.length) {
          box.appendChild(h('h2', { class: 'sect-h', text: 'Waiting for a reply' }));
          d.pending.forEach(function (m) { box.appendChild(h('div', { class: 'row-card' }, avatar(m), h('div', { class: 'who' }, h('strong', { text: m.name }), h('small', { text: 'Invitation sent' })))); });
        }
      });
    }
    render();
  }

  /* ---------------------------------------------------------------- messages */
  function msgNode(m) {
    if (m.card && m.card.type === 'birthday') { return birthdayCard(m); }
    return h('div', { class: 'msg' + (m.mine ? ' mine' : ''), 'data-id': m.id }, avatar({ name: m.name }, 'sm'),
      h('div', { class: 'bubble' }, h('div', { class: 'meta' }, h('strong', { text: m.name }), h('small', { text: m.time })), h('div', { class: 'text', html: null })));
  }
  function fillMsg(node, m) { var t = node.querySelector('.text'); if (t) t.innerHTML = m.html; return node; } // html is escaped + linkified by the server

  /* ---- group picture (group admins) ---- */
  function groupPhotoControl(g, done) {
    var f = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', hidden: true });
    var lab = h('button', { class: 'linklike small', type: 'button', text: g.photo ? 'Change picture' : 'Add a group picture', onclick: function () { f.click(); } });
    f.addEventListener('change', function () {
      if (!f.files || !f.files[0]) return; var fd = new FormData(); fd.append('room', g.id); fd.append('photo', f.files[0]);
      lab.textContent = 'Uploading…';
      api('group/photo', { form: fd }).then(function (d) { if (d.ok) { toast('Picture updated.', 'ok'); done(); } else { toast(d.error || 'Could not save the picture.', 'error'); lab.textContent = 'Change picture'; } });
    });
    var rm = g.photo ? h('button', { class: 'linklike small', type: 'button', text: 'Remove', onclick: function () { var fd = new FormData(); fd.append('room', g.id); fd.append('remove', '1'); api('group/photo', { form: fd }).then(function () { done(); }); } }) : null;
    return h('p', { class: 'small' }, lab, rm ? document.createTextNode(' · ') : null, rm, f);
  }

  /* ---- birthdays: confetti, celebration card in the chat, Birthdays page, full-screen greeting ---- */
  function confetti(host, ms) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
    var c = h('canvas', { class: 'confetti', 'aria-hidden': 'true' }); host.appendChild(c);
    var ctx = c.getContext('2d'), W = c.width = host.clientWidth || window.innerWidth, H = c.height = host.clientHeight || window.innerHeight;
    var cols = ['#FFC11F', '#ED341C', '#14110A', '#FFE082', '#FF8A65', '#FFFFFF'], P = [], t0 = Date.now(), stop = false;
    for (var i = 0; i < 140; i++) P.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, v: 1.6 + Math.random() * 3, s: (Math.random() - 0.5) * 2.4, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, c: cols[i % cols.length] });
    (function tick() {
      if (stop || Date.now() - t0 > (ms || 6500)) { if (c.parentNode) c.parentNode.removeChild(c); return; }
      ctx.clearRect(0, 0, W, H);
      P.forEach(function (p) { p.y += p.v; p.x += p.s + Math.sin(p.y / 30) * 0.8; p.r += p.vr; if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      requestAnimationFrame(tick);
    })();
    return function () { stop = true; if (c.parentNode) c.parentNode.removeChild(c); };
  }
  function birthdayCard(m) {
    var c = m.card, mine = S.user && c.uid && Number(c.uid) === Number(S.user.id), wish = null;
    if (!mine && c.uid) {
      wish = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Send wishes 🎈' });
      wish.addEventListener('click', function () {
        busy(wish, true);
        api('dm', { data: { user: c.uid } }).then(function (d) { busy(wish, false); if (d.ok) { location.hash = '#/messages/' + d.room_id; } else { toast(d.error || 'Could not open the chat.', 'error'); } });
      });
    }
    var anv = Number(c.anniv) || 0, nth = anv + (([11, 12, 13].indexOf(anv % 100) > -1) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[anv % 10] || 'th'));
    if (anv) {
      return h('div', { class: 'bday-msg', 'data-id': m.id },
        h('div', { class: 'bday-card' }, h('div', { class: 'bday-balloons', 'aria-hidden': 'true', text: '🎊 🏆 🎉 🏆 🎊' }),
          h('div', { class: 'bday-ring' }, avatar({ name: c.name, photo: c.photo }, 'xl')),
          h('small', { class: 'bday-kicker', text: 'Happy ' + nth + ' anniversary' }), h('h3', { text: c.name + ' 🏆' }),
          h('p', { class: 'small', text: mine ? 'Your team is ' + anv + ' year' + (anv === 1 ? '' : 's') + ' old today! 🥳' : 'The team marks ' + anv + ' year' + (anv === 1 ? '' : 's') + ' on campus today! 🥳' }), wish),
        h('small', { class: 'bday-time', text: m.time }));
    }
    return h('div', { class: 'bday-msg', 'data-id': m.id },
      h('div', { class: 'bday-card' }, h('div', { class: 'bday-balloons', 'aria-hidden': 'true', text: '🎈 🎉 🎂 🎉 🎈' }),
        h('div', { class: 'bday-ring' }, avatar({ name: c.name, photo: c.photo }, 'xl')),
        h('small', { class: 'bday-kicker', text: 'Happy birthday' }), h('h3', { text: (mine ? 'Happy birthday, ' + (c.first || c.name) + '! ' : c.name + ' ') + '🎂' }), c.sub ? h('p', { class: 'muted small', text: c.sub }) : null,
        mine ? h('p', { class: 'small', text: 'The whole Enactus Nigeria family is celebrating you today! 🥳' }) : h('p', { class: 'small', text: 'It is ' + (c.first || 'their') + (c.first ? '’s' : '') + ' birthday today! 🥳' }), wish),
      h('small', { class: 'bday-time', text: m.time }));
  }
  function birthdayGreeting() {
    var u = S.user; if (!u || !u.birthday_today) return;
    var key = 'enng_bday_' + new Date().toISOString().slice(0, 10) + '_' + u.id;
    try { if (localStorage.getItem(key)) return; } catch (e) { /* private mode */ }
    var first = (u.name || '').replace(/^(prof|dr|engr|mr|mrs|ms|barr|pastor|chief|hon)\.?\s+/i, '').split(/\s+/)[0] || u.name;
    var ov = h('div', { class: 'bday-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Happy birthday' });
    var stop = null;
    function close() { if (stop) stop(); try { localStorage.setItem(key, '1'); } catch (e) { /* ignore */ } if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.appendChild(h('div', { class: 'bday-big' }, h('div', { class: 'bday-balloons', 'aria-hidden': 'true', text: '🎈 🎉 🎂 🎉 🎈' }), h('div', { class: 'bday-ring lg' }, avatar(u, 'xxl')),
      h('small', { class: 'bday-kicker', text: 'Happy birthday' }), h('h2', { text: first + '! 🎉' }),
      h('p', { text: 'The whole Enactus Nigeria family is celebrating you today. Thank you for everything you bring to our community.' }),
      h('div', { class: 'btns', style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap' }, h('a', { class: 'btn btn-primary', href: '#/messages', text: 'See my wishes 🎈', onclick: close }), h('button', { class: 'btn btn-ghost', type: 'button', text: 'Thank you!', onclick: close }))));
    document.body.appendChild(ov); stop = confetti(ov, 9000);
  }
  var stopConf = null;

  function viewMessages(roomId) {
    roomId = roomId ? parseInt(roomId, 10) : 0;
    var main = shell('messages', false);
    var wrap = h('div', { class: 'chat-shell' + (roomId ? ' has-room' : '') });
    var roomsEl = h('aside', { class: 'chat-rooms', 'aria-label': 'Conversations' }), pane = h('section', { class: 'chat-main' });
    wrap.appendChild(roomsEl); wrap.appendChild(pane); main.appendChild(wrap);

    function loadRooms() {
      api('rooms').then(function (d) {
        if (!d.ok) return;
        clear(roomsEl);
        roomsEl.appendChild(h('div', { class: 'chat-rooms-head' }, h('strong', { text: 'Messages' }), h('div', { class: 'rooms-add' }, h('a', { class: 'btn btn-primary btn-sm', href: '#/groups/new', text: '+ Group' }), S.user.is_staff ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Channel', onclick: channelForm }) : null)));
        var groups = d.rooms.filter(function (r) { return r.kind !== 'dm'; }), dms = d.rooms.filter(function (r) { return r.kind === 'dm'; });
        function sect(label, list) {
          if (!list.length) return;
          roomsEl.appendChild(h('p', { class: 'chat-sec', text: label }));
          list.forEach(function (r) {
            roomsEl.appendChild(h('a', { class: 'chat-room' + (r.id === roomId ? ' on' : ''), href: '#/messages/' + r.id }, r.kind === 'dm' || r.photo ? avatar({ name: r.title, photo: r.photo }, 'sm') : h('span', { class: 'avatar sm hash', text: '#' }), h('span', { class: 'nm', text: r.title }), r.unread && r.id !== roomId ? h('em', { class: 'count', text: r.unread }) : null));
          });
        }
        sect('Channels & groups', groups); sect('Direct messages', dms);
        if (!d.rooms.length) roomsEl.appendChild(h('p', { class: 'muted small', style: 'padding:14px', text: 'No conversations yet. Open People in Connect and press Message.' }));
        S.counts.messages = d.unread; paintCounts();
      });
    }
    function channelForm() {
      clear(pane); wrap.classList.add('has-room');
      var name = h('input', { type: 'text', maxlength: '120', required: true, placeholder: 'e.g. Team Leaders Group' }), desc = h('input', { type: 'text', maxlength: '255' });
      var posting = h('select', null, h('option', { value: 'everyone', text: 'Everyone in the channel' }), h('option', { value: 'admins', text: 'Admins only (announcements)' }));
      var kinds = [['team', 'Team representatives'], ['member', 'Members'], ['alumni', 'Alumni'], ['advisor', 'Academic advisors'], ['partner', 'Partners'], ['staff', 'Staff']];
      var boxes = kinds.map(function (k) { return h('label', { class: 'check-inline', style: 'display:flex' }, h('input', { type: 'checkbox', value: k[0] }), ' ' + k[1]); });
      var chImg = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif' });
      var btn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Create channel' });
      pane.appendChild(h('div', { class: 'chat-head' }, h('a', { class: 'chat-back', href: '#/messages', text: '←' }), h('div', { class: 't' }, h('h2', { text: 'New channel' }))));
      pane.appendChild(h('form', { class: 'form-card', style: 'margin:16px', onsubmit: function (e) {
        e.preventDefault(); busy(btn, true);
        var fd = new FormData(); fd.append('name', name.value); fd.append('description', desc.value); fd.append('posting', posting.value); fd.append('audience', boxes.filter(function (b) { return b.firstChild.checked; }).map(function (b) { return b.firstChild.value; }).join(',')); if (chImg.files && chImg.files[0]) fd.append('photo', chImg.files[0]);
        api('channel/create', { form: fd }).then(function (d) {
          busy(btn, false);
          if (d.ok) { toast('Channel created. Use “Manage” to add specific people.', 'ok'); location.hash = '#/messages/' + d.id; } else { toast(d.error, 'error'); }
        });
      } }, field('Channel picture (optional)', chImg, 'Cropped to a square automatically.'), field('Name', name), field('Description (optional)', desc), h('div', { class: 'field' }, h('label', { text: 'Add whole categories of users' }), h('div', { class: 'check-grid' }, boxes), h('p', { class: 'help', text: 'Everyone in a ticked category, including people who join later, can see the channel.' })), field('Who can post?', posting), btn));
    }
    function openRoom(id) {
      clear(pane);
      var log = h('div', { class: 'chat-log', 'aria-live': 'polite' }), last = 0;
      var head = h('div', { class: 'chat-head' }, h('div', { class: 't' }, h('h2', { text: 'Loading…' })), h('a', { class: 'chat-back', href: '#/messages', 'aria-label': 'Back', text: '✕' }));
      pane.appendChild(head); pane.appendChild(log);
      function add(m, stick) { if (log.querySelector('[data-id="' + m.id + '"]')) return; var n = fillMsg(msgNode(m), m); log.appendChild(n); if (m.id > last) last = m.id; if (stick) log.scrollTop = log.scrollHeight; }
      api('room', { params: { id: id } }).then(function (d) {
        if (!d.ok) { clear(pane); pane.appendChild(h('div', { class: 'chat-empty' }, h('h2', { text: 'Conversation not found' }), h('a', { href: '#/messages', text: '← Back' }))); return; }
        var r = d.room; clear(head);
        head.appendChild(r.kind === 'dm' || r.photo ? avatar({ name: r.title, photo: r.photo }, 'sm') : h('span', { class: 'avatar sm hash', text: '#' }));
        head.appendChild(h('div', { class: 't' }, h('h2', { text: r.title }), r.description ? h('small', { class: 'muted', text: r.description }) : null));
        var acts = h('div', { class: 'chat-acts' });
        if (r.kind === 'circle') acts.appendChild(h('a', { class: 'btn btn-ghost btn-sm', href: '#/groups/' + r.id, text: 'Members' }));
        if (r.kind !== 'dm' && !r.staff_made && !r.is_creator) acts.appendChild(h('button', { class: 'btn btn-quiet report-btn', type: 'button', title: 'Report this group', 'aria-label': 'Report this group', text: '⚑ Report', onclick: function () { reportSheet(r.id, r.title); } }));
        if (r.kind === 'group' && r.is_admin) acts.appendChild(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Manage', onclick: function () { openHub('p=chat&a=manage&room=' + r.id); } }));
        acts.appendChild(h('a', { class: 'chat-back', href: '#/messages', 'aria-label': 'Back to chats', title: 'Back to chats', text: '✕' }));
        head.appendChild(acts);
        if (!d.messages.length) log.appendChild(h('p', { class: 'muted small', style: 'margin:auto', text: 'No messages yet – say hello 👋' }));
        d.messages.forEach(function (m) { add(m, false); }); log.scrollTop = log.scrollHeight; last = Math.max(last, d.last); setTimeout(function () { log.scrollTop = log.scrollHeight; }, 250);
        if (r.can_post) {
          var ta = h('textarea', { rows: '1', maxlength: '2000', placeholder: 'Write a message…', 'aria-label': 'Message' }), sb = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Send' });
          var sending = false;
          var form = h('form', { class: 'chat-form', onsubmit: function (e) {
            e.preventDefault(); var t = ta.value.trim(); if (!t || sending) return; sending = true; busy(sb, true);
            api('room/send', { data: { room: id, body: t } }).then(function (x) {
              sending = false; busy(sb, false);
              if (x.ok) { var ph = log.querySelector('p.muted'); if (ph) ph.remove(); add(x.message, true); ta.value = ''; ta.style.height = ''; } else { toast(x.error || 'Could not send.', 'error'); }
              ta.focus();
            });
          } }, ta, sb);
          ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : sb.click(); } });
          ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; });
          pane.appendChild(form);
        } else { pane.appendChild(h('div', { class: 'chat-form muted small', text: '🔒 Only group admins can post in this channel.' })); }
        every(4000, function () {
          var stick = log.scrollHeight - log.scrollTop - log.clientHeight < 140;
          api('room', { params: { id: id, after: last } }).then(function (p) { if (p.ok && p.messages.length) { var ph = log.querySelector('p.muted'); if (ph) ph.remove(); p.messages.forEach(function (m) { add(m, stick); }); S.counts.messages = p.unread; paintCounts(); } });
        });
      });
    }
    loadRooms();
    every(15000, loadRooms);
    if (roomId) { openRoom(roomId); } else { pane.appendChild(h('div', { class: 'chat-empty' }, h('h2', { text: 'Your messages' }), h('p', { text: 'Choose a conversation on the left, or message someone from Connect.' }))); }
  }

  /* ---------------------------------------------------------------- projects */
  function viewProjects() {
    markSeen('projects');
    var main = shell('projects', false), u = S.user;
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Projects' }),
      u.is_team ? h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '+ Register a project', onclick: function () { openHub('p=t_project'); } }), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'My team’s projects', onclick: function () { openHub('p=t_projects'); } })) : null));
    main.appendChild(h('p', { class: 'muted', style: 'margin-bottom:12px', text: 'Find teams working on similar ideas – open a project and message the team to collaborate.' }));
    var q = h('input', { type: 'search', placeholder: 'Search projects, e.g. clean water…', 'aria-label': 'Search projects' });
    var cat = h('select', { 'aria-label': 'Category' }, h('option', { value: '', text: 'All categories' })), team = h('select', { 'aria-label': 'Team' }, h('option', { value: '', text: 'All teams' }));
    var grid = h('div', { class: 'pcards' }), more = h('div', { class: 'load-more' }); var page = 1, tmr = null, filled = false;
    main.appendChild(h('div', { class: 'search-row' }, q, cat, team)); main.appendChild(grid); main.appendChild(more);
    function load(reset) {
      if (reset) { page = 1; clear(grid); }
      clear(more); more.appendChild(h('div', { class: 'spinner sm' }));
      api('projects', { params: { q: q.value.trim(), cat: cat.value, team: team.value, page: page } }).then(function (d) {
        clear(more); if (!d.ok) { toast(d.error, 'error'); return; }
        if (!filled && d.categories) { d.categories.forEach(function (c) { cat.appendChild(h('option', { value: c, text: c })); }); d.teams.forEach(function (t) { team.appendChild(h('option', { value: t.id, text: t.name })); }); filled = true; }
        d.projects.forEach(function (p) {
          grid.appendChild(h('a', { class: 'pc', href: '#/projects/' + p.id }, h('div', { class: 'th' }, p.image ? h('img', { src: p.image, alt: '', loading: 'lazy' }) : p.title.charAt(0)),
            h('div', { class: 'bd' }, h('h3', { text: p.title }), h('small', { class: 'muted', text: p.team.name + (p.category ? ' · ' + p.category : '') }), h('p', { class: 'small', style: 'margin-top:6px', text: p.summary }),
              h('div', { class: 'metrics' }, h('span', null, h('b', { text: p.hours }), ' hrs'), h('span', null, h('b', { text: p.people.toLocaleString() }), ' people')))));
        });
        if (!grid.children.length) grid.appendChild(h('div', { class: 'card center', text: 'No projects found.' }));
        if (d.more) more.appendChild(h('button', { class: 'btn btn-ghost', type: 'button', text: 'Show more', onclick: function () { page++; load(false); } }));
      });
    }
    q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { load(true); }, 350); });
    cat.addEventListener('change', function () { load(true); }); team.addEventListener('change', function () { load(true); });
    load(true);
  }
  function viewProject(id) {
    var main = shell('projects', false); var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    api('project', { params: { id: id } }).then(function (d) {
      clear(box);
      if (!d.ok) { box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Project not found' }), h('a', { href: '#/projects', text: '← All projects' }))); return; }
      var p = d.project;
      box.appendChild(h('a', { href: '#/projects', class: 'small', text: '← All projects' }));
      var card = h('article', { class: 'post', style: 'margin-top:10px' });
      if (p.image) card.appendChild(h('img', { class: 'feat-img', src: p.image, alt: '' }));
      card.appendChild(h('div', { class: 'feat-body', style: 'padding:16px' }, h('h1', { style: 'font-size:1.5rem', text: p.title }),
        h('p', { class: 'muted', text: p.team.name + (p.category ? ' · ' + p.category : '') }), p.status !== 'approved' ? h('span', { class: 'badge badge-gold', text: 'Status: ' + p.status }) : null,
        p.summary ? h('p', { style: 'margin-top:10px;font-weight:600;color:var(--ink)', text: p.summary }) : null,
        (p.body || '').split(/\n+/).filter(Boolean).map(function (t) { return h('p', { style: 'margin-top:10px', text: t }); }),
        p.impact ? h('p', { style: 'margin-top:10px' }, h('b', { text: 'Impact: ' }), p.impact) : null,
        h('div', { class: 'stat-grid', style: 'margin:16px 0 0' }, [[p.hours, 'Volunteer hours'], [p.people.toLocaleString(), 'People reached'], ['₦' + Math.round(p.income).toLocaleString(), 'Income generated']].map(function (s) { return h('div', { class: 'stat' }, h('strong', { text: s[0] }), h('span', { text: s[1] })); })),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px' },
          p.contact_id ? h('button', { class: 'btn btn-primary', type: 'button', text: 'Message the team', onclick: function () { messageUser(p.contact_id); } }) : null,
          p.own && S.user.is_team ? h('button', { class: 'btn btn-ghost', type: 'button', text: 'Edit in Team hub', onclick: function () { openHub('p=t_project&id=' + p.id); } }) : null,
          p.own && S.user.is_team ? h('button', { class: 'btn btn-ghost', type: 'button', text: 'Add a progress report', onclick: function () { openHub('p=t_reports&project=' + p.id); } }) : null)));
      box.appendChild(card);
      box.appendChild(h('h2', { class: 'sect-h', text: 'Progress log' }));
      if (!p.reports_visible) box.appendChild(h('p', { class: 'muted', text: 'Detailed progress reports are visible to the team, staff, advisors and partners.' }));
      else if (!d.reports.length) box.appendChild(h('p', { class: 'muted', text: 'No reports logged yet.' }));
      d.reports.forEach(function (r) {
        box.appendChild(h('div', { class: 'group-card' }, h('h3', { text: r.title }), h('small', { class: 'muted', text: new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + (r.by ? ' · ' + r.by : '') }),
          r.body ? h('p', { style: 'margin-top:6px', text: r.body }) : null, h('div', { class: 'metrics' }, h('span', null, h('b', { text: r.hours }), ' hrs'), h('span', null, h('b', { text: r.people.toLocaleString() }), ' people'), h('span', null, h('b', { text: '₦' + Math.round(r.income).toLocaleString() })))));
      });
    });
  }

  /* ---------------------------------------------------------------- opportunities, resources, events */
  function viewJobs() {
    markSeen('jobs');
    var main = shell('jobs', false), tab = 'jobs', info = { can_post: false, can_talent: false };
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Opportunities' })));
    var tabs = h('div', { class: 'pill-tabs' }), body = h('div'); main.appendChild(tabs); main.appendChild(body);
    function paintTabs() {
      clear(tabs);
      [['jobs', 'Opportunities', true], ['talent', 'Talent', info.can_talent], ['post', 'Post an opportunity', info.can_post]].forEach(function (t) { if (t[2]) tabs.appendChild(h('button', { type: 'button', class: tab === t[0] ? 'on' : '', text: t[1], onclick: function () { tab = t[0]; paintTabs(); render(); } })); });
    }
    function render() {
      clear(body); body.appendChild(h('div', { class: 'spinner' }));
      if (tab === 'jobs') {
        api('opportunities').then(function (d) {
          clear(body); info = d; paintTabs();
          if (!d.opportunities.length) body.appendChild(h('div', { class: 'card center', text: 'No opportunities yet. Partners post internships, jobs and mentorship here.' }));
          d.opportunities.forEach(function (o) {
            body.appendChild(h('div', { class: 'job' }, h('div', { class: 'top' }, h('div', null, h('h3', { text: o.title }), h('small', { class: 'muted', text: o.company + ' · ' + o.kind_label + (o.deadline ? ' · closes ' + new Date(o.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '') })),
              o.status !== 'approved' ? h('span', { class: 'badge badge-gold', text: o.status === 'pending' ? 'Awaiting approval' : o.status }) : null),
              h('p', { style: 'margin-top:8px;white-space:pre-wrap', text: o.description }),
              h('div', { class: 'btns' }, o.apply_url ? h('a', { class: 'btn btn-primary btn-sm', href: o.apply_url, target: '_blank', rel: 'noopener noreferrer', text: 'Apply' }) : null,
                o.can_delete ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Remove', onclick: function () { if (confirm('Remove this opportunity?')) api('opportunity/delete', { data: { id: o.id } }).then(render); } }) : null)));
          });
        });
      } else if (tab === 'talent') {
        var q = h('input', { type: 'search', placeholder: 'Search skills or headline…', 'aria-label': 'Search talent' }), grid = h('div', { class: 'people-grid' }), tmr = null;
        function load() {
          clear(grid);
          api('talent', { params: { q: q.value.trim() } }).then(function (d) {
            clear(grid); if (!d.ok) { toast(d.error, 'error'); return; }
            if (!d.talent.length) grid.appendChild(h('div', { class: 'card center', text: 'No one is listed yet. Members and alumni can switch on “Open to opportunities” in their profile.' }));
            d.talent.forEach(function (p) { grid.appendChild(h('article', { class: 'person' }, avatar(p, 'lg'), h('h3', { text: p.name }), h('small', { class: 'muted', text: p.kind_label + (p.class_of ? ' · Class of ' + p.class_of : '') }), p.headline ? h('span', { class: 'headline', text: p.headline }) : null, h('small', { class: 'muted', text: p.team || '' }), p.bio ? h('small', { text: p.bio }) : null,
              h('div', { class: 'btns' }, h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Message', onclick: function () { messageUser(p.id); } }), p.linkedin ? h('a', { class: 'btn btn-ghost btn-sm', href: p.linkedin, target: '_blank', rel: 'noopener noreferrer', text: 'LinkedIn' }) : null))); });
          });
        }
        q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(load, 350); });
        clear(body); body.appendChild(h('div', { class: 'search-row' }, q)); body.appendChild(grid); load();
      } else {
        var f = { title: h('input', { type: 'text', maxlength: '190', required: true }), company: h('input', { type: 'text', maxlength: '160', value: S.user.organisation || '' }),
          kind: h('select', null, [['internship', 'Internship'], ['job', 'Full-time job'], ['volunteer', 'Volunteering'], ['mentorship', 'Mentorship'], ['other', 'Other']].map(function (k) { return h('option', { value: k[0], text: k[1] }); })),
          description: h('textarea', { rows: '5', maxlength: '3000' }), apply_url: h('input', { type: 'url', maxlength: '400', placeholder: 'https://' }), deadline: h('input', { type: 'date' }) };
        var btn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Submit' });
        clear(body);
        body.appendChild(h('form', { class: 'form-card', onsubmit: function (e) {
          e.preventDefault(); busy(btn, true);
          var data = {}; Object.keys(f).forEach(function (k) { data[k] = f[k].value; });
          api('opportunity/create', { data: data }).then(function (d) { busy(btn, false); if (d.ok) { toast(d.status === 'approved' ? 'Opportunity published.' : 'Thank you! It will appear after an administrator approves it.', 'ok'); tab = 'jobs'; paintTabs(); render(); } else { toast(d.error, 'error'); } });
        } }, h('h2', { text: 'Post an opportunity' }), field('Title', f.title), field('Company / organisation', f.company), field('Type', f.kind), field('Description', f.description), field('Apply link', f.apply_url), field('Closing date', f.deadline), btn));
      }
    }
    paintTabs(); render();
  }
  var RES_LABELS = { registration: 'Official registration links', guideline: 'Guidelines & challenges', training: 'Training materials', tool: 'Project-building tools', link: 'Useful links' };
  function viewResources() {
    markSeen('resources');
    var main = shell('resources', false);
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Resources' })));
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    api('resources').then(function (d) {
      clear(box);
      if (d.join_link) {
        var inp = h('input', { type: 'text', readonly: true, value: d.join_link, 'aria-label': 'Team application link', style: 'flex:1;min-height:42px;padding:0 14px;border:1.5px solid var(--line);border-radius:12px' });
        box.appendChild(h('div', { class: 'form-card' }, h('h2', { text: 'Your team’s membership form link' }), h('p', { class: 'muted small', text: 'Share this official link so new students can apply to join your team.' }),
          h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, inp, h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Copy', onclick: function () { inp.select(); if (navigator.clipboard) navigator.clipboard.writeText(d.join_link); else document.execCommand('copy'); toast('Link copied', 'ok'); } }))));
      }
      if (!d.resources.length) box.appendChild(h('div', { class: 'card center', text: 'Training materials, guidelines and tools will be shared here by the Enactus Nigeria team.' }));
      Object.keys(RES_LABELS).forEach(function (k) {
        var list = d.resources.filter(function (r) { return r.kind === k; }); if (!list.length) return;
        box.appendChild(h('h2', { class: 'sect-h', text: RES_LABELS[k] }));
        box.appendChild(h('div', { class: 'res-grid' }, list.map(function (r) { return h('div', { class: 'res' }, h('h3', { text: r.title }), r.description ? h('p', { text: r.description }) : null, r.url ? h('a', { class: 'btn btn-ghost btn-sm', href: r.url, target: '_blank', rel: 'noopener noreferrer', text: 'Open' }) : null); })));
      });
    });
  }
  function viewEvents() {
    markSeen('events');
    var main = shell('events', false);
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Events' })));
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    api('events').then(function (d) {
      clear(box);
      function card(e) { var dt = new Date(e.starts_at); return h('div', { class: 'event' + (e.past ? ' past' : '') }, h('div', { class: 'ev-chip' }, h('span', { text: dt.getDate() }), h('small', { text: dt.toLocaleString(undefined, { month: 'short' }) })),
        h('div', null, h('h3', { text: e.title }), h('small', { class: 'muted', text: when(e.starts_at) + (e.location ? ' · ' + e.location : '') }), e.description ? h('p', { style: 'margin-top:6px', text: e.description }) : null, e.link ? h('a', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', href: e.link, target: '_blank', rel: 'noopener noreferrer', text: 'Details / register' }) : null)); }
      var up = d.events.filter(function (e) { return !e.past; }), past = d.events.filter(function (e) { return e.past; }).reverse();
      box.appendChild(h('h2', { class: 'sect-h', text: 'Upcoming' }));
      if (!up.length) box.appendChild(h('div', { class: 'card center', text: 'No upcoming events right now.' }));
      up.forEach(function (e) { box.appendChild(card(e)); });
      if (past.length) { box.appendChild(h('h2', { class: 'sect-h', text: 'Recent' })); past.slice(0, 8).forEach(function (e) { box.appendChild(card(e)); }); }
    });
  }

  /* ---------------------------------------------------------------- notifications & profile */
  function viewNotifications() {
    var main = shell('notifications', false);
    var markAll = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Mark all as read' });
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Notifications' }), markAll));
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    function render() {
      api('notifications').then(function (d) {
        clear(box);
        if (!d.notifications.length) box.appendChild(h('div', { class: 'card center', text: 'You are all caught up 🎉' }));
        d.notifications.forEach(function (n) {
          box.appendChild(h('button', { type: 'button', class: 'notif' + (n.read ? '' : ' unread'), onclick: function () { api('notifications/read', { data: { ids: [n.id] } }).then(function () { refreshCounts(); if (n.link) location.hash = n.link; else render(); }); } },
            h('span', { class: 'icon-btn' }, icon(n.type === 'comment' ? 'comment' : (n.type === 'invite' ? 'group' : (n.type === 'project' ? 'project' : (n.type === 'birthday' ? 'gift' : (n.type === 'announcement' ? 'megaphone' : 'people')))))), h('span', null, h('strong', { text: n.title }), n.body ? h('small', { text: n.body }) : null, h('small', { text: ago(n.at) }))));
        });
      });
    }
    markAll.addEventListener('click', function () { api('notifications/read', { data: {} }).then(function () { refreshCounts(); render(); }); });
    render();
  }
  function viewTeamProfile(u, main) {
    var ti = u.team_info || {}, rows = [['Team', u.name], ['Type', ti.type ? ti.type.charAt(0).toUpperCase() + ti.type.slice(1) : ''], ['State', ti.state || ''], ['Established', ti.established_on ? new Date(ti.established_on + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], ['Sign-in email', u.email]];
    main.appendChild(h('div', { class: 'profile-top' }, avatar(u, 'xl'), h('div', null, h('h1', { text: u.name }), h('p', { class: 'muted', text: 'Team account' }))));
    main.appendChild(h('div', { class: 'form-card' }, h('h2', { text: 'Team details' }),
      h('dl', { class: 'kv' }, rows.filter(function (r) { return r[1]; }).map(function (r) { return h('div', { class: 'kv-row' }, h('dt', { text: r[0] }), h('dd', { text: r[1] })); })),
      ti.about ? h('p', { class: 'small', style: 'margin-top:10px', text: ti.about.length > 400 ? ti.about.slice(0, 400) + '…' : ti.about }) : null,
      h('p', { class: 'muted small', style: 'margin-top:10px', text: 'This profile comes from your team page. The name and picture are set by Enactus Nigeria staff; open the Team hub to edit the rest.' }),
      h('p', { style: 'margin-top:12px' }, h('button', { class: 'btn btn-soft', type: 'button', text: 'Open the Team hub', onclick: function () { openHub('p=t_profile'); } }))));
    var cur = pwField('pc', 'Current password'), p1 = pwField('pn', 'New password', 'new-password'), pbtn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Change password' });
    main.appendChild(h('form', { class: 'form-card', onsubmit: function (e) {
      e.preventDefault(); busy(pbtn, true);
      api('auth/password', { data: { current: cur.input.value, password: p1.input.value } }).then(function (d) { busy(pbtn, false); if (d.ok) { toast('Password changed.', 'ok'); cur.input.value = ''; p1.input.value = ''; } else { toast(d.error, 'error'); } });
    } }, h('h2', { text: 'Change password' }), cur.el, p1.el, h('p', { class: 'help', style: 'margin:-6px 0 12px', text: 'At least 10 characters with upper and lower case letters and a number.' }), pbtn));
    main.appendChild(h('div', { class: 'form-card' }, h('button', { class: 'btn btn-danger', type: 'button', text: 'Sign out', onclick: function () { api('auth/logout', { data: {} }).then(function () { signOutLocal(); }); } })));
  }
  function viewProfile() {
    var u = S.user, main = shell('me', false);
    if (u.is_team && u.kind === 'team') { return viewTeamProfile(u, main); }
    var f = { name: h('input', { type: 'text', maxlength: '150', value: u.name, required: true }), headline: h('input', { type: 'text', required: true, maxlength: '160', value: u.headline || '', placeholder: 'e.g. Agribusiness student · Team Lead' }),
      phone: h('input', { type: 'tel', required: true, maxlength: '40', value: u.phone || '' }), linkedin: h('input', { type: 'text', maxlength: '255', value: u.linkedin || '', placeholder: 'https://www.linkedin.com/in/…' }), bio: h('textarea', { rows: '4', required: true, maxlength: '1200' }), organisation: h('input', { type: 'text', maxlength: '160', value: u.organisation || '' }) };
    f.bio.value = u.bio || '';
    var open = h('input', { type: 'checkbox', checked: u.open_to_work });
    var dob = h('input', { type: 'date', value: u.date_of_birth || '', required: true, min: '1920-01-01', max: new Date(Date.now() - 10 * 31557600000).toISOString().slice(0, 10) });
    var photo = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', required: !u.photo });
    var first = u.profile_complete === false;
    var btn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Save profile' });
    if (first) main.appendChild(h('div', { class: 'card complete-banner' }, h('strong', { text: 'Welcome! Please complete your profile to continue.' }), h('p', { class: 'muted small', text: 'Fill in every field below and add a profile picture. You can change them later.' })));
    main.appendChild(h('div', { class: 'profile-top' }, avatar(u, 'xl'), h('div', null, h('h1', { text: u.name }), h('p', { class: 'muted', text: u.kind_label + (u.team ? ' · ' + u.team : '') + (u.member_code ? ' · ' + u.member_code : '') }))));
    main.appendChild(h('form', { class: 'form-card', onsubmit: function (e) {
      e.preventDefault(); busy(btn, true);
      var data = { name: f.name.value, headline: f.headline.value, phone: f.phone.value, linkedin: f.linkedin.value, bio: f.bio.value, organisation: f.organisation.value, date_of_birth: dob.value, open_to_work: open.checked ? 1 : 0 };
      function saveData() {
        api('me/update', { data: data }).then(function (d) {
          busy(btn, false);
          if (!d.ok) { toast(d.error, 'error'); return; }
          S.user = d.user;
          if (first && d.user.profile_complete) { toast('Profile complete – welcome in! 🎉', 'ok'); location.hash = '#/'; return; }
          if (first) { toast('Please fill in everything, including your profile photo.', 'error'); viewProfile(); return; }
          toast('Profile saved', 'ok'); viewProfile();
        });
      }
      if (photo.files && photo.files[0]) {
        var fd = new FormData(); fd.append('photo', photo.files[0]);
        api('me/photo', { form: fd }).then(function (p) { if (p.ok) { S.user = p.user; saveData(); } else { busy(btn, false); toast(p.error, 'error'); } });
      } else if (!S.user.photo) { busy(btn, false); toast('Please add a profile photo.', 'error'); }
      else { saveData(); }
    } }, h('h2', { text: 'Your profile' }), field('Full name', f.name), field('Headline', f.headline), u.kind === 'partner' ? field('Organisation', f.organisation) : null, field('Phone', f.phone), field('Date of birth', dob, 'Day, month and year. It is never displayed to the public.'), field('LinkedIn', f.linkedin), field('About you', f.bio), field(u.photo ? 'Profile photo' : 'Profile photo (required)', photo, 'JPG, PNG or WEBP up to 8 MB.'),
      ['member', 'alumni', 'advisor'].indexOf(u.kind) > -1 ? h('label', { class: 'switch', style: 'margin-bottom:14px' }, open, h('span', { text: 'Open to opportunities – let partners see me in the talent list' })) : null, btn,
      h('p', { class: 'muted small', style: 'margin-top:10px', text: 'Your email (' + u.email + ') and phone number are never shown to other people.' })));
    var cur = pwField('pc', 'Current password'), p1 = pwField('pn', 'New password', 'new-password'), pbtn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Change password' });
    main.appendChild(h('form', { class: 'form-card', onsubmit: function (e) {
      e.preventDefault(); busy(pbtn, true);
      api('auth/password', { data: { current: cur.input.value, password: p1.input.value } }).then(function (d) { busy(pbtn, false); if (d.ok) { toast('Password changed.', 'ok'); cur.input.value = ''; p1.input.value = ''; } else { toast(d.error, 'error'); } });
    } }, h('h2', { text: 'Change password' }), cur.el, p1.el, h('p', { class: 'help', style: 'margin:-6px 0 12px', text: 'At least 10 characters with upper and lower case letters and a number.' }), pbtn));
    main.appendChild(h('div', { class: 'form-card' }, (u.is_team || u.is_staff) ? h('p', { style: 'margin-bottom:12px' }, h('button', { class: 'btn btn-soft', type: 'button', text: u.is_team ? 'Open the Team hub' : 'Open the staff area (resources, events, opportunities, groups)', onclick: function () { openHub(u.is_team ? 'p=t_dashboard' : 'p=plus_resources'); } })) : null,
      h('button', { class: 'btn btn-danger', type: 'button', text: 'Sign out', onclick: function () { api('auth/logout', { data: {} }).then(function () { signOutLocal(); }); } })));
  }

  /* ---------------------------------------------------------------- mail (@enactus.org.ng accounts, Microsoft 365 sign-in) */
  function mailDownload(msgId, att) {
    return fetch(CFG.api + '?r=mail/attachment&id=' + encodeURIComponent(msgId) + '&att=' + encodeURIComponent(att.id), { headers: { 'X-Plus-Token': S.token, Authorization: 'Bearer ' + S.token } })
      .then(function (r) { if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Download failed.'); }); return r.blob(); })
      .then(function (b) { if (window.PlusNative) { return window.PlusNative.saveBlob(b, att.name); } var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = att.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); })
      .catch(function (e) { toast(e.message || 'Download failed.', 'error'); });
  }
  /* shows a spinner on the attachment while it downloads */
  function withDl(el, job) { if (el.classList.contains('dl-busy')) return; el.classList.add('dl-busy'); Promise.resolve(job()).then(function () { el.classList.remove('dl-busy'); }, function () { el.classList.remove('dl-busy'); }); }
  function dlTail() { return h('span', { class: 'dl-ic', 'aria-hidden': 'true' }, icon('download'), h('i', { class: 'mini-spin' })); }
  function fileDownload(url, name) {
    if (window.PlusNative) { return window.PlusNative.saveUrl(url, name); }
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); }).then(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name || 'file'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }).catch(function () { window.open(url, '_blank', 'noopener'); });
  }
  function addrText(a) { return a ? (a.name && a.name !== a.address ? a.name + ' <' + a.address + '>' : a.address) : ''; }
  function viewMail() {
    var main = shell('mail', false);
    if (!S.user.mail_enabled) { main.appendChild(h('div', { class: 'card center', text: 'Mail is available to accounts with an @enactus.org.ng email address.' })); return; }
    main.appendChild(h('div', { class: 'page-h' }, h('h1', { text: 'Mail' })));
    var box = h('div'); main.appendChild(box); box.appendChild(h('div', { class: 'spinner' }));
    api('mail/status').then(function (d) {
      clear(box);
      if (!d.ok) { box.appendChild(h('div', { class: 'card center', text: d.error || 'Mail is not available.' })); return; }
      if (!d.configured) { box.appendChild(h('div', { class: 'card center' }, h('h2', { text: 'Mail is not set up yet' }), h('p', { class: 'muted', text: 'The Enactus Nigeria office needs to finish connecting Microsoft 365 before team mail can be used here.' }))); return; }
      var back = S.mailReturn; S.mailReturn = null;
      if (back && back.ok) { toast('Mailbox connected.', 'ok'); }
      if (!d.connected) { mailConnect(box, d, back && !back.ok ? (back.msg || 'The Microsoft sign-in did not finish. Please try again.') : ''); } else { mailClient(box, d); }
    });
  }
  function mailConnect(box, st, note) {
    var err = msgBox(); if (note) showMsg(err, note, 'warning');
    var btn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Sign in with Microsoft' });
    btn.addEventListener('click', function () {
      showMsg(err, ''); busy(btn, true);
      api('mail/oauth/start', { data: {} }).then(function (d) {
        if (!d.ok || !d.url) { busy(btn, false); showMsg(err, d.error || 'Could not start the Microsoft sign-in.'); return; }
        if (window.PlusNative) { busy(btn, false); window.PlusNative.openExternal(d.url); } else { location.href = d.url; }
      });
    });
    box.appendChild(h('div', { class: 'form-card' }, h('h2', { text: 'Connect your Enactus email' }),
      h('p', { class: 'muted small', style: 'margin-bottom:12px', text: 'You will be taken to Microsoft’s own sign-in page for your @' + (st.domain || 'enactus.org.ng') + ' mailbox, where you can use your password and any two-step verification you have set up. EnactusNG Plus never sees your password. Once you approve, you can read and send email here, including attachments.' }),
      err, btn));
  }
  /* returning from Microsoft: /?mail=ok#/mail or /?mail=err&mail_msg=… */
  (function () {
    try {
      var q = new URLSearchParams(location.search), m = q.get('mail');
      if (!m) return;
      S.mailReturn = { ok: m === 'ok', msg: q.get('mail_msg') || '' };
      history.replaceState(null, '', location.pathname + '#/mail');
    } catch (e) { /* ignore */ }
  })();
  var MAIL_FRAME_CSS = 'html,body{margin:0;padding:0}body{font:14px/1.55 "Segoe UI",Arial,sans-serif;color:#202124;overflow:hidden;overflow-wrap:anywhere;word-break:break-word;padding:2px 2px 8px}img{max-width:100%;height:auto}table{max-width:100%}a{color:#8a5a00}blockquote{margin:8px 0 8px 4px;padding-left:12px;border-left:3px solid #e2dcc8;color:#555}.q-toggle{display:inline-block;margin:10px 0 6px;padding:0 10px;height:18px;line-height:12px;border:1px solid #d9d2bc;border-radius:6px;background:#f6f1e1;color:#555;cursor:pointer;font:700 15px/14px Arial,sans-serif;letter-spacing:1px}.q-toggle:hover{background:#ffe9a8}.q-box{display:none}.q-box.open{display:block}';
  /* an email body inside a locked-down frame: no scripts, grows to its content, folds away the quoted history like Gmail/Outlook */
  function mailFrame(html) {
    var fr = h('iframe', { class: 'mv-frame', title: 'Message', sandbox: 'allow-same-origin allow-popups allow-popups-to-escape-sandbox', scrolling: 'no' });
    fr.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + MAIL_FRAME_CSS + '</style></head><body>' + (html || '<p style="color:#888">(This message has no content.)</p>') + '</body></html>';
    function fit() { try { var d = fr.contentDocument; if (d && d.documentElement) { fr.style.height = '0px'; fr.style.height = Math.max(40, d.documentElement.scrollHeight + 4) + 'px'; } } catch (e) { /* ignore */ } }
    fr.addEventListener('load', function () {
      var d; try { d = fr.contentDocument; } catch (e) { return; }
      if (!d || !d.body) return;
      try { foldQuoted(d, fit); } catch (e) { /* show everything if folding fails */ }
      fit();
      Array.prototype.forEach.call(d.images, function (im) { if (!im.complete) { im.addEventListener('load', fit); im.addEventListener('error', fit); } });
      setTimeout(fit, 400); setTimeout(fit, 1500);
    });
    window.addEventListener('resize', fit);
    return fr;
  }
  function foldQuoted(d, fit) {
    var anchor = d.getElementById('appendonsend'), nodes = [], n;
    if (anchor) { for (n = anchor.nextSibling; n; n = n.nextSibling) nodes.push(n); }
    else {
      var r = d.getElementById('divRplyFwdMsg') || d.querySelector('.gmail_quote,blockquote[type=cite],.yahoo_quoted,.moz-cite-prefix,#mail-editor-reference-message-container');
      if (!r) return;
      anchor = r; var p = r.previousElementSibling;
      if (r.id === 'divRplyFwdMsg' && p && p.tagName === 'HR') anchor = p;
      for (n = anchor; n; n = n.nextSibling) nodes.push(n);
      anchor = null;
    }
    if (!nodes.length) return;
    var box = d.createElement('div'); box.className = 'q-box';
    var btn = d.createElement('span'); btn.className = 'q-toggle'; btn.textContent = '•••'; btn.title = 'Show earlier messages'; btn.setAttribute('role', 'button');
    var first = nodes[0]; first.parentNode.insertBefore(btn, first); first.parentNode.insertBefore(box, first);
    nodes.forEach(function (x) { box.appendChild(x); });
    var visible = (d.body.innerText || '').replace(/\s+/g, '').length > 0 || d.body.querySelector('img');
    if (!visible) { nodes.forEach(function (x) { box.parentNode.insertBefore(x, box); }); box.remove(); btn.remove(); return; }
    btn.addEventListener('click', function () { var o = box.classList.toggle('open'); btn.title = o ? 'Hide earlier messages' : 'Show earlier messages'; fit(); });
  }
  function mailClient(box, st) {
    var S2 = { folder: 'inbox', q: '', skip: 0, openId: null };
    var list = h('div', { class: 'mail-list' }), pane = h('div', { class: 'mail-pane' }), folders = h('nav', { class: 'mail-folders side-card', 'aria-label': 'Mail folders' });
    var main = h('div', { class: 'mail-main' }), wrap = h('div', { class: 'mail-wrap' }), titleEl = h('strong', { class: 'mail-title', text: st.folders.inbox || 'Inbox' });
    var compose = h('button', { class: 'btn btn-primary block', type: 'button', text: '✎ Write a message', onclick: function () { composer(); } });
    var search = h('input', { type: 'search', placeholder: 'Search mail…', 'aria-label': 'Search mail' }), tmr = null;
    search.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { S2.q = search.value.trim(); S2.skip = 0; load(); }, 400); });
    function emptyPane() { clear(pane); S2.openId = null; main.classList.remove('has-open'); wrap.classList.remove('is-open'); pane.appendChild(h('div', { class: 'mail-empty' }, h('div', { class: 'mail-empty-ic', text: '✉' }), h('p', { text: 'Select a message to read it' }))); }
    function showPane() { main.classList.add('has-open'); wrap.classList.add('is-open'); wrap.classList.remove('drawer-open'); }
    function paintFolders() {
      clear(folders);
      Object.keys(st.folders).forEach(function (k) { folders.appendChild(h('a', { href: '#/mail', class: S2.folder === k ? 'on' : '', text: st.folders[k], onclick: function (e) { e.preventDefault(); S2.folder = k; S2.q = ''; search.value = ''; S2.skip = 0; titleEl.textContent = st.folders[k]; wrap.classList.remove('drawer-open'); paintFolders(); emptyPane(); load(); } })); });
      folders.appendChild(h('div', { style: 'padding:10px 14px 4px;border-top:1px solid var(--line-soft);margin-top:8px' }, h('small', { class: 'muted', text: st.address }),
        h('div', null, h('button', { class: 'linklike small', type: 'button', text: 'Disconnect', onclick: function () { if (confirm('Disconnect ' + st.address + ' from EnactusNG Plus?')) api('mail/disconnect', { data: {} }).then(function () { viewMail(); }); } }))));
    }
    function fail(d) {
      if (d.code === 'mail_reconnect') { clear(box); mailConnect(box, st, d.error || 'Please sign in to your mailbox again.'); return true; }
      toast(d.error || 'Something went wrong.', 'error'); return false;
    }
    function load(append) {
      if (!append) { clear(list); list.appendChild(h('div', { class: 'spinner' })); }
      api('mail/list', { params: { folder: S2.folder, skip: S2.skip, q: S2.q } }).then(function (d) {
        if (!append) clear(list); else { var m = list.querySelector('.more'); if (m) m.remove(); }
        if (!d.ok) { if (!fail(d)) list.appendChild(h('p', { class: 'empty-state', text: d.error || 'Could not load mail.' })); return; }
        if (!d.items.length && !append) list.appendChild(h('p', { class: 'empty-state', text: S2.q ? 'No messages match your search.' : 'Nothing here yet.' }));
        d.items.forEach(function (m) {
          var who = (S2.folder === 'sentitems' || S2.folder === 'drafts') ? 'To: ' + (m.to.map(function (t) { return t.name || t.address; }).join(', ') || '(no recipient)') : (m.from.name || m.from.address || '(unknown)');
          var row = h('button', { type: 'button', class: 'mrow' + (m.read ? '' : ' unread') + (S2.openId === m.id ? ' on' : ''), 'data-id': m.id, onclick: function () { open(m, row); } },
            h('strong', { text: who }), h('small', { class: 'subj', text: (m.has_attachments ? '📎 ' : '') + m.subject }), h('small', { text: (m.at ? ago(m.at) + ' · ' : '') + m.preview }));
          list.appendChild(row);
        });
        if (d.next) list.appendChild(h('button', { class: 'btn btn-ghost btn-sm more', type: 'button', style: 'margin:12px', text: 'Load more', onclick: function () { S2.skip = d.next; load(true); } }));
      });
    }
    function chips(files) { return h('div', { class: 'mail-atts' }, files.map(function (a) { return h('span', { text: '📎 ' + a.name + (a.size ? ' (' + bytes(a.size) + ')' : '') }); })); }
    function open(m, row) {
      S2.openId = m.id;
      Array.prototype.forEach.call(list.querySelectorAll('.mrow.on'), function (r) { r.classList.remove('on'); });
      if (row) { row.classList.add('on'); row.classList.remove('unread'); }
      clear(pane); showPane(); pane.appendChild(h('div', { class: 'spinner' }));
      var isDraft = S2.folder === 'drafts';
      api('mail/message', { params: { id: m.id, edit: isDraft ? 1 : 0 } }).then(function (d) {
        refreshCounts();
        clear(pane);
        if (!d.ok) { if (!fail(d)) pane.appendChild(h('div', { class: 'card', text: d.error })); return; }
        var x = d.message; m.read = true;
        if (isDraft) { composer({ draft: x.id, to: x.to_raw, cc: x.cc_raw, subject: x.subject === '(no subject)' ? '' : x.subject, body: x.text, files: x.attachments }); return; }
        var back = h('button', { class: 'linklike small mail-back', type: 'button', text: '← Messages', onclick: emptyPane });
        var head = h('div', { class: 'mv-head' }, back, h('h2', { text: x.subject }),
          h('p', { class: 'small muted' }, h('b', { text: 'From: ' }), addrText(x.from), h('br'), h('b', { text: 'To: ' }), x.to.map(addrText).join(', ') || '—', x.cc.length ? [h('br'), h('b', { text: 'Cc: ' }), x.cc.map(addrText).join(', ')] : null, h('br'), x.at ? when(x.at) : ''));
        var atts = x.attachments.length ? h('div', { class: 'mail-atts' }, x.attachments.map(function (a) { return h('a', { href: '#/mail', class: 'att', title: 'Download', onclick: function (e) { e.preventDefault(); withDl(e.currentTarget, function () { return mailDownload(x.id, a); }); } }, h('span', { text: '📎 ' + a.name + ' (' + bytes(a.size) + ')' }), dlTail()); })) : null;
        var scroll = h('div', { class: 'mv-scroll' }, mailFrame(x.html), atts);
        var foot = h('div', { class: 'mv-foot' });
        function actions() {
          clear(foot);
          var all = (x.to.length + x.cc.length) > 1;
          foot.appendChild(h('div', { class: 'mv-actions' },
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '↩ Reply', onclick: function () { reply(false); } }),
            all ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '↩↩ Reply all', onclick: function () { reply(true); } }) : null,
            h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Delete', onclick: function () { if (confirm('Move this message to Deleted?')) api('mail/delete', { data: { id: x.id } }).then(function (r) { if (r.ok) { toast('Moved to Deleted.', 'ok'); emptyPane(); load(); } else toast(r.error, 'error'); }); } })));
        }
        function reply(all) {
          clear(foot);
          var ta = h('textarea', { rows: '4', placeholder: 'Write your reply…', 'aria-label': 'Reply' }), files = h('input', { type: 'file', multiple: true, hidden: true }), chosen = h('div', { class: 'chosen' });
          files.addEventListener('change', function () { clear(chosen); Array.prototype.forEach.call(files.files, function (f) { chosen.appendChild(h('span', { text: f.name + ' (' + bytes(f.size) + ')' })); }); });
          var send = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Send' });
          send.addEventListener('click', function () {
            var total = 0; Array.prototype.forEach.call(files.files, function (f) { total += f.size; });
            if (total > 25 * 1048576) { toast('Attachments can be 25 MB in total.', 'error'); return; }
            if (!ta.value.trim() && !files.files.length) { toast('Write your reply first.', 'error'); return; }
            var fd = new FormData(); fd.append('id', x.id); fd.append('body', ta.value); fd.append('all', all ? '1' : '0');
            Array.prototype.forEach.call(files.files, function (f) { fd.append('attachments[]', f); });
            busy(send, true);
            api('mail/reply', { form: fd }).then(function (r) { busy(send, false); if (!r.ok) { if (!fail(r)) toast(r.error || 'Could not send.', 'error'); return; } toast('Reply sent.', 'ok'); actions(); if (S2.folder === 'sentitems') load(); });
          });
          foot.appendChild(h('div', { class: 'mv-reply' }, h('p', { class: 'small muted', text: (all ? 'Reply all' : 'Reply') + ' to ' + (all ? x.to.concat(x.cc).concat([x.from]).map(function (t) { return t.name || t.address; }).join(', ') : (x.from.name || x.from.address)) }), ta, chosen,
            h('div', { class: 'mv-actions' }, send, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '📎 Attach', onclick: function () { files.click(); } }), files, h('button', { class: 'btn btn-quiet btn-sm', type: 'button', text: 'Discard', onclick: actions }))));
          ta.focus();
        }
        actions();
        pane.appendChild(h('div', { class: 'mail-view' }, head, scroll, foot));
      });
    }
    function composer(pre) {
      pre = pre || {}; showPane(); S2.openId = null;
      var draftId = pre.draft || '';
      var f = { to: h('input', { type: 'text', value: pre.to || '', placeholder: 'name@example.com, other@example.com', 'aria-label': 'To' }), cc: h('input', { type: 'text', value: pre.cc || '', placeholder: 'Cc (optional)', 'aria-label': 'Cc' }),
        subject: h('input', { type: 'text', maxlength: '250', value: pre.subject || '', placeholder: 'Subject', 'aria-label': 'Subject' }), body: h('textarea', { rows: '12', placeholder: 'Write your message…', 'aria-label': 'Message' }) };
      f.body.value = pre.body || '';
      var files = h('input', { type: 'file', multiple: true, 'aria-label': 'Attach files' }), chosen = h('div', { class: 'chosen' }), saved = h('div');
      if (pre.files && pre.files.length) saved.appendChild(chips(pre.files));
      files.addEventListener('change', function () { clear(chosen); Array.prototype.forEach.call(files.files, function (x) { chosen.appendChild(h('span', { text: x.name + ' (' + bytes(x.size) + ')' })); }); });
      var err = msgBox(), btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Send' }), dbtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '💾 Save draft' });
      var dirty = false; [f.to, f.cc, f.subject, f.body, files].forEach(function (i) { i.addEventListener('input', function () { dirty = true; }); i.addEventListener('change', function () { dirty = true; }); });
      function form() {
        var total = 0; Array.prototype.forEach.call(files.files, function (x) { total += x.size; });
        if (total > 25 * 1048576) { showMsg(err, 'Attachments can be 25 MB in total.'); return null; }
        var fd = new FormData(); fd.append('to', f.to.value); fd.append('cc', f.cc.value); fd.append('subject', f.subject.value); fd.append('body', f.body.value); if (draftId) fd.append('draft', draftId);
        Array.prototype.forEach.call(files.files, function (x) { fd.append('attachments[]', x); });
        return fd;
      }
      btn.addEventListener('click', function () {
        showMsg(err, ''); var fd = form(); if (!fd) return; busy(btn, true);
        api('mail/send', { form: fd }).then(function (d) {
          busy(btn, false);
          if (!d.ok) { if (!fail(d)) showMsg(err, d.error || 'Could not send.'); return; }
          toast('Message sent.', 'ok'); emptyPane(); if (S2.folder === 'sentitems' || S2.folder === 'drafts') load();
        });
      });
      dbtn.addEventListener('click', function () {
        showMsg(err, ''); var fd = form(); if (!fd) return; busy(dbtn, true);
        api('mail/draft', { form: fd }).then(function (d) {
          busy(dbtn, false);
          if (!d.ok) { if (!fail(d)) showMsg(err, d.error || 'Could not save the draft.'); return; }
          draftId = d.id; dirty = false;
          if (d.saved_files) { var names = []; Array.prototype.forEach.call(files.files, function (x) { names.push({ name: x.name, size: x.size }); }); saved.appendChild(chips(names)); files.value = ''; clear(chosen); }
          toast('Draft saved – find it in your Drafts folder.', 'ok'); if (S2.folder === 'drafts') load();
        });
      });
      clear(pane);
      pane.appendChild(h('div', { class: 'mail-view mail-compose' },
        h('div', { class: 'mv-head' }, h('button', { class: 'linklike small mail-back', type: 'button', text: '← Messages', onclick: emptyPane }), h('h2', { text: draftId ? 'Draft' : 'New message' })),
        h('div', { class: 'mv-scroll' }, err, h('div', { class: 'field' }, f.to), h('div', { class: 'field' }, f.cc), h('div', { class: 'field' }, f.subject), h('div', { class: 'field' }, f.body),
          saved, h('div', { class: 'field' }, h('label', { text: 'Attachments (up to 25 MB in total)' }), files, chosen)),
        h('div', { class: 'mv-foot' }, h('div', { class: 'mv-actions' }, btn, dbtn, h('button', { class: 'btn btn-quiet btn-sm', type: 'button', text: draftId ? 'Close' : 'Discard', onclick: function () { if (dirty && !confirm('Leave without saving this message?')) return; emptyPane(); } })))));
      (pre.to ? f.body : f.to).focus();
    }
    paintFolders(); emptyPane();
    var menuBtn = h('button', { class: 'mail-menu', type: 'button', 'aria-label': 'Mail folders', text: '☰', onclick: function () { wrap.classList.toggle('drawer-open'); } });
    var msInput = h('input', { type: 'search', placeholder: 'Search mail…', 'aria-label': 'Search mail', enterkeyhint: 'search' }), msWrap = h('div', { class: 'ms-wrap' });
    var msBtn = h('button', { class: 'ms-btn', type: 'button', 'aria-label': 'Search mail', title: 'Search mail' }, icon('search'));
    msInput.addEventListener('input', function () { search.value = msInput.value; search.dispatchEvent(new Event('input', { bubbles: true })); });
    function msOpen(on) { msWrap.classList.toggle('open', on); titleEl.classList.toggle('ms-shrunk', on); if (on) { setTimeout(function () { msInput.focus(); }, 60); } else if (msInput.value) { msInput.value = ''; msInput.dispatchEvent(new Event('input')); } }
    msBtn.addEventListener('click', function () { msOpen(!msWrap.classList.contains('open')); });
    msInput.addEventListener('keydown', function (e) { if (e.key === 'Escape') msOpen(false); });
    msWrap.appendChild(msInput); msWrap.appendChild(msBtn);
    main.appendChild(h('div', { class: 'mail-listcol' }, h('div', { class: 'mail-bar' }, menuBtn, titleEl, msWrap), h('div', { class: 'search-row mail-search' }, search), list));
    main.appendChild(pane);
    wrap.appendChild(h('div', { class: 'mail-side' }, compose, h('div', { style: 'height:12px' }), folders)); wrap.appendChild(main);
    wrap.appendChild(h('div', { class: 'mail-backdrop', onclick: function () { wrap.classList.remove('drawer-open'); } }));
    wrap.appendChild(h('button', { class: 'fab mail-fab', type: 'button', 'aria-label': 'Write a message', title: 'Write a message', onclick: function () { composer(); } }, icon('edit')));
    box.appendChild(wrap);
    load();
  }

  /* ---------------------------------------------------------------- router + start */
  var ROUTES = [
    [/^\/login$/, viewLogin, true], [/^\/forgot$/, viewForgot, true], [/^\/reset\/([a-f0-9]{64})$/, viewReset, true], [/^\/welcome$/, viewWelcome, false],
    [/^\/?$/, function () { viewFeed('all'); }], [/^\/announcements$/, function () { viewFeed('announcements'); }], [/^\/post\/\d+$/, function () { viewFeed('all'); }], [/^\/connect(?:\/(requests|friends))?$/, viewConnect], [/^\/groups$/, function () { location.replace('#/messages'); }], [/^\/groups\/new$/, viewNewGroup], [/^\/groups\/(\d+)$/, viewGroup], [/^\/messages(?:\/(\d+))?$/, viewMessages],
    [/^\/projects$/, viewProjects], [/^\/projects\/(\d+)$/, viewProject], [/^\/jobs$/, viewJobs], [/^\/resources$/, viewResources], [/^\/events$/, viewEvents],
    [/^\/notifications$/, viewNotifications], [/^\/mail$/, viewMail], [/^\/me$/, viewProfile], [/^\/more$/, viewMore]
  ];
  function ensureUser() {
    if (S.user) return Promise.resolve(true);
    return api('me').then(function (d) { if (d.ok) { S.user = d.user; startPolling(); return true; } if (d.status === 401 || d.status === 403) { return false; } S.user = null; return false; });
  }
  function navigate() {
    clearTimers();
    var path = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
    var hit = null, args = [];
    ROUTES.forEach(function (r) { if (hit) return; var m = path.match(r[0]); if (m) { hit = r; args = m.slice(1); } });
    if (!hit) { location.hash = '#/'; return; }
    if (!S.token) { if (hit[2]) { hit[1].apply(null, args); } else { location.hash = '#/login'; } return; }
    ensureUser().then(function (ok) {
      if (!ok) { if (S.token) { setToken(''); } if (!hit[2]) { location.hash = '#/login'; } else { hit[1].apply(null, args); } return; }
      if (S.user.must_change_password && path !== '/welcome') { location.hash = '#/welcome'; return; }
      if (S.user.profile_complete === false && !S.user.must_change_password && path !== '/me' && path !== '/welcome') { location.hash = '#/me'; return; }
      if (hit[2] === true) { location.hash = '#/'; return; }
      hit[1].apply(null, args);
      if (!S.greeted) { S.greeted = true; setTimeout(birthdayGreeting, 600); }
    });
  }
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('.search-row select')) t.classList.toggle('is-set', t.value !== ''); });
  window.addEventListener('hashchange', navigate);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.token) refreshCounts(); });
  api('public').then(function (d) {
    S.pub = d.ok ? d : {};
    if (S.pub.name) document.title = S.pub.name + ' Plus';
    if (S.pub.favicon) { var l = document.querySelector('link[rel="icon"]') || document.head.appendChild(h('link', { rel: 'icon' })); l.href = S.pub.favicon; }
    navigate();
  });
})();
