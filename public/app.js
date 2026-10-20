/* MEDI-OS client */
(() => {
  'use strict';
  const CT = window.CONTENT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  const HT = window.HEART || { CAST: [], MINECRAFT: [], PLANET: [], INFO: [], MODES: ['classic'] };
  const ALL_CHARS = Object.fromEntries([...CT.REGULARS, ...CT.SPECIALS, ...CT.PLANET, ...HT.CAST, ...HT.MINECRAFT, ...HT.PLANET].map((c) => [c.id, c]));
  const PROTO = Object.fromEntries(CT.PROTOCOLS.map((p) => [p.id, p]));

  // ───────────────────────── state ─────────────────────────
  const settings = Object.assign({ lang: 'he', sfx: true, sfxVol: 0.6, music: false, musicVol: 0.35, crt: true }, store.get('medios.settings', {}));
  const S = {
    view: null, homeMode: null, homeErr: '', online: false, room: null, me: null, prevPhase: null,
    chat: { global: [], help: [], lb: [] }, tickets: [], ticketMsgs: {}, chan: 'global', ticketOpen: null,
    unread: { global: 0, help: 0, lb: 0 }, showMembers: false,
    call: null, callsTab: 'call', mdaTab: 'file', mdaFile: null, launching: false, typedFor: null, renderedKey: '',
    wins: {}, z: 10, gameover: null, kicked: false, booting: false,
    discovered: new Set(store.get('medios.discovered', [])), lastMoney: 0
  };

  const t = (key, vars) => {
    const dict = window.I18N[settings.lang];
    let s = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
    if (s == null) s = key;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  };
  const tc = (obj) => (obj ? obj[settings.lang] || obj.he : '');
  const errText = (code) => t('err.' + code) !== 'err.' + code ? t('err.' + code) : t('err.default');

  function saveSettings() { store.set('medios.settings', settings); }
  function applySettings() {
    document.documentElement.lang = settings.lang;
    document.documentElement.dir = t('dir');
    $('#crt').classList.toggle('crt-on', !!settings.crt);
    Audio8.set({ sfx: settings.sfx, sfxVol: settings.sfxVol, music: settings.music, musicVol: settings.musicVol });
  }
  function setLang(l) {
    settings.lang = l; saveSettings(); applySettings();
    if (Net.session) Net.request('player:lang', { lang: l });
    S.view = null; route(true);
  }

  const sfx = (n) => Audio8.play(n);
  document.addEventListener('pointerdown', () => Audio8.unlock(), { once: true });

  // ───────────────────────── toasts ─────────────────────────
  function toast(html, { cls = '', ms = 3500, onClick } = {}) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls; el.innerHTML = html;
    if (onClick) el.addEventListener('click', () => { onClick(); el.remove(); });
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
    return el;
  }
  const toastErr = (code) => { sfx('error'); toast(`<span class="ta">⚠</span><span class="tt">${esc(errText(code))}</span>`, { cls: 'err' }); };

  // ───────────────────────── routing ─────────────────────────
  function route(force) {
    if (S.kicked) return showKicked();
    if (!Net.session || !S.room) return renderHome();
    const phase = S.room.phase;
    if (phase === 'lobby') renderLobby(force);
    else renderDesktop(force);
    renderOverlays();
  }

  // ───────────────────────── HOME ─────────────────────────
  const qsRoom = new URLSearchParams(location.search).get('room');
  if (qsRoom && /^\d{4,8}$/.test(qsRoom)) S.homeMode = 'join';
  const homeDraft = { name: store.get('medios.name', ''), duration: 8, custom: '', code: qsRoom || '', mode: 'mixed' };

  function langSwitch() {
    return `<button class="btn small ${settings.lang === 'he' ? 'primary' : ''}" data-lang="he">עברית</button>
            <button class="btn small ${settings.lang === 'en' ? 'primary' : ''}" data-lang="en">English</button>`;
  }

  function renderHome() {
    syncDraft();
    const still = S.view === 'home';
    S.view = 'home';
    const ekg = `<svg class="ekg" viewBox="0 0 520 46" preserveAspectRatio="none"><path d="M0 26 H150 l10 -4 l8 4 H200 l8 -22 l10 40 l8 -26 l6 8 H330 l10 -6 l10 6 H520"/></svg>`;
    let body;
    if (!S.homeMode) {
      body = `<div class="home-cards">
        <button class="home-card" data-mode="create"><div class="ico">⊕</div><h2>${t('create_group')}</h2><p>${t('create_desc')}</p></button>
        <button class="home-card" data-mode="join"><div class="ico">⇥</div><h2>${t('join_room')}</h2><p>${t('join_desc')}</p></button>
      </div>`;
    } else if (S.homeMode === 'create') {
      const durs = [5, 8, 12, 15];
      body = `<form class="home-form" id="f-create" autocomplete="off"><div class="home-card">
        <h2>${t('create_group')}</h2>
        <div class="field"><label for="c-name">${t('your_name')}</label><input class="input" id="c-name" maxlength="16" value="${esc(homeDraft.name)}" required></div>
        <div class="field"><label>${t('game_time')}</label><div class="chips" role="radiogroup">
          ${durs.map((d) => `<button type="button" role="radio" aria-checked="${homeDraft.duration === d}" class="chip ${homeDraft.duration === d ? 'on' : ''}" data-dur="${d}"><span class="mono">${d}</span> ${t('minutes')}</button>`).join('')}
          <button type="button" role="radio" aria-checked="${homeDraft.duration === 'custom'}" class="chip ${homeDraft.duration === 'custom' ? 'on' : ''}" data-dur="custom">${t('custom')}</button>
        </div></div>
        ${HT.CAST.length ? `<div class="field"><label>${t('game_mode')}</label><div class="chips" role="radiogroup">
          ${HT.MODES.map((m) => `<button type="button" role="radio" aria-checked="${homeDraft.mode === m}" class="chip ${homeDraft.mode === m ? 'on' : ''}" data-gmode="${m}">${t('mode_' + m)}</button>`).join('')}
        </div><div class="dim" style="font-size:.8rem">${t('mode_' + homeDraft.mode + '_d')}</div></div>` : ''}
        <div class="field ${homeDraft.duration === 'custom' ? '' : 'hidden'}" id="custom-wrap"><input class="input" id="c-custom" type="number" min="1" max="120" inputmode="numeric" placeholder="${t('custom_ph')}" value="${esc(homeDraft.custom)}"></div>
        <div class="err" id="h-err">${esc(S.homeErr)}</div>
        <div style="display:flex;gap:.5rem;justify-content:space-between"><button type="button" class="btn ghost" data-mode="">${t('back')}</button><button class="btn primary big" type="submit">${t('create_btn')}</button></div>
      </div></form>`;
    } else {
      body = `<form class="home-form" id="f-join" autocomplete="off"><div class="home-card">
        <h2>${t('join_room')}</h2>
        <div class="field"><label for="j-code">${t('room_code')}</label><input class="input code" id="j-code" inputmode="numeric" maxlength="6" placeholder="000000" value="${esc(homeDraft.code)}" required></div>
        <div class="field"><label for="j-name">${t('your_name')}</label><input class="input" id="j-name" maxlength="16" value="${esc(homeDraft.name)}" required></div>
        <div class="err" id="h-err">${esc(S.homeErr)}</div>
        <div style="display:flex;gap:.5rem;justify-content:space-between"><button type="button" class="btn ghost" data-mode="">${t('back')}</button><button class="btn primary big" type="submit">${t('join_btn')}</button></div>
      </div></form>`;
    }
    $('#app').innerHTML = `<section class="screen home ${still ? 'still' : ''}">
      <div class="home-top">${langSwitch()}</div>
      <div class="logo"><div class="logo-mark">MEDI<span class="cross">✚</span>OS</div><div class="logo-sub">${t('os_sub')}</div>${ekg}</div>
      ${body}
    </section>`;
    const app = $('#app');
    $$('[data-lang]', app).forEach((b) => b.onclick = () => { sfx('click'); setLang(b.dataset.lang); });
    $$('[data-mode]', app).forEach((b) => b.onclick = () => { sfx('open'); S.homeMode = b.dataset.mode || null; S.homeErr = ''; renderHome(); });
    $$('[data-gmode]', app).forEach((b) => b.onclick = () => { sfx('click'); syncDraft(); homeDraft.mode = b.dataset.gmode; renderHome(); });
    $$('[data-dur]', app).forEach((b) => b.onclick = () => {
      sfx('click'); syncDraft(); homeDraft.duration = b.dataset.dur === 'custom' ? 'custom' : Number(b.dataset.dur); renderHome();
      if (homeDraft.duration === 'custom') $('#c-custom').focus();
    });
    const fc = $('#f-create');
    if (fc) fc.onsubmit = async (e) => {
      e.preventDefault(); syncDraft();
      const duration = homeDraft.duration === 'custom' ? Number(homeDraft.custom) : homeDraft.duration;
      const r = await Net.request('room:create', { name: homeDraft.name, duration, mode: homeDraft.mode, lang: settings.lang, origin: location.origin });
      handleJoinResult(r);
    };
    const fj = $('#f-join');
    if (fj) {
      const codeEl = $('#j-code');
      codeEl.oninput = () => { codeEl.value = codeEl.value.replace(/\D/g, '').slice(0, 6); };
      (homeDraft.code ? $('#j-name') : codeEl).focus();
      fj.onsubmit = async (e) => {
        e.preventDefault(); syncDraft();
        const r = await Net.request('room:join', { code: homeDraft.code, name: homeDraft.name, lang: settings.lang });
        handleJoinResult(r);
      };
    }
  }
  function syncDraft() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    if (v('c-name') != null) homeDraft.name = v('c-name').trim();
    if (v('j-name') != null) homeDraft.name = v('j-name').trim();
    if (v('c-custom') != null) homeDraft.custom = v('c-custom');
    if (v('j-code') != null) homeDraft.code = v('j-code').trim();
  }
  function handleJoinResult(r) {
    if (r.error) { S.homeErr = errText(r.error); sfx('error'); const e = $('#h-err'); if (e) e.textContent = S.homeErr; return; }
    store.set('medios.name', homeDraft.name);
    Net.saveSession({ code: r.code, playerId: r.playerId, token: r.token });
    S.homeErr = ''; sfx('success');
    if (qsRoom) history.replaceState(null, '', '/');
  }

  // ───────────────────────── LOBBY ─────────────────────────
  function renderLobby(force) {
    const R = S.room;
    if (S.view !== 'lobby' || force) {
      S.view = 'lobby';
      $('#app').innerHTML = `<section class="screen lobby">
        <header class="lobby-head"><h1>▣ ${t('lobby')}</h1><div style="display:flex;gap:.4rem">${langSwitch()}<button class="btn small danger" id="lb-leave">${t('leave')}</button></div></header>
        <div class="lobby-grid">
          <div class="panel">
            <div class="dim" style="text-align:center">${t('room_code')}</div>
            <div class="room-code" id="lb-code"></div>
            <div class="qr-box" id="lb-qr" aria-label="QR"></div>
            <div class="dim" style="text-align:center;font-size:.85rem">${t('scan_to_join')} · ${t('or_enter')}</div>
            <div class="join-url" id="lb-url"></div>
            <div style="text-align:center;margin-top:.5rem"><button class="btn small" id="lb-copy">${t('copy')}</button></div>
            <div class="meta-row"><span>${t('duration_label')}</span><b id="lb-dur"></b></div>
            <div class="meta-row" style="border:none;margin-top:0"><span>${t('game_mode')}</span><b id="lb-mode" style="font-family:var(--font-ui);font-size:1rem"></b></div>
          </div>
          <div class="panel">
            <div class="plist-head"><h2>${t('players')}</h2><span class="count" id="lb-count">0</span></div>
            <ul class="plist" id="lb-plist"></ul>
          </div>
        </div>
        <footer class="lobby-foot" id="lb-foot"></footer>
      </section>`;
      $$('[data-lang]').forEach((b) => b.onclick = () => setLang(b.dataset.lang));
      $('#lb-leave').onclick = leaveRoom;
      $('#lb-copy').onclick = () => { navigator.clipboard?.writeText(S.room.joinUrl).then(() => toast(`<span class="tt">${t('copied')}</span>`, { ms: 1500 })); };
    }
    $('#lb-code').textContent = R.code;
    if (R.qr && $('#lb-qr').dataset.code !== R.code) { $('#lb-qr').innerHTML = R.qr; $('#lb-qr').dataset.code = R.code; }
    $('#lb-url').textContent = R.joinUrl.replace(/^https?:\/\//, '');
    $('#lb-dur').textContent = `${R.durationMin} ${t('minutes')}`;
    $('#lb-mode').textContent = t('mode_' + (R.mode || 'classic'));
    $('#lb-count').textContent = R.players.length;
    const me = S.me || {};
    $('#lb-plist').innerHTML = R.players.map((p) => `<li class="prow ${p.flagged ? 'flagged' : ''}">
      <span class="dot ${p.connected ? '' : 'off'}"></span>
      <span class="pname">${esc(p.name)}</span>
      ${p.isHost ? `<span class="badge host">${t('host')}</span>` : p.isAdmin ? `<span class="badge admin">${t('admin')}</span>` : ''}
      ${p.flagged ? `<span class="badge flag">${t('flagged')}</span>` : ''}
      ${p.id === me.id ? `<span class="badge you">${t('you')}</span>` : ''}
      ${me.isHost && !p.isHost ? `<span class="pactions">
        <button class="btn small warn" data-act="report" data-id="${p.id}" ${p.flagged ? 'disabled' : ''}>${t('report')}</button>
        <button class="btn small info" data-act="promote" data-id="${p.id}">${p.isAdmin ? t('remove_admin') : t('make_admin')}</button>
        <button class="btn small danger" data-act="kick" data-id="${p.id}">${t('kick')}</button></span>` : ''}
    </li>`).join('');
    $$('#lb-plist [data-act]').forEach((b) => b.onclick = async () => {
      sfx('click');
      const map = { report: 'lobby:report', promote: 'lobby:promote', kick: 'lobby:kick' };
      const r = await Net.request(map[b.dataset.act], { targetId: b.dataset.id });
      if (r.error) toastErr(r.error);
    });
    $('#lb-foot').innerHTML = me.isHost
      ? `<button class="btn primary big" id="lb-start">${t('start_game')}</button><div class="dim" style="font-size:.85rem">${t('min_players_hint')}</div>`
      : `<div class="waiting">${t('waiting_host')}</div>`;
    const st = $('#lb-start');
    if (st) st.onclick = async () => { st.disabled = true; const r = await Net.request('game:start', {}); if (r.error) { st.disabled = false; toastErr(r.error); } };
  }

  function leaveRoom() { Net.saveSession(null); location.href = '/'; }

  // ───────────────────────── DESKTOP ─────────────────────────
  const APPS = {
    mda: { icon: '✚', cls: 'mda', title: () => t('app_mda'), w: 460, h: 580, render: renderMda },
    calls: { icon: '☎', cls: 'calls', title: () => t('app_calls'), w: 560, h: 620, render: renderCalls },
    chat: { icon: '✉', cls: 'chat', title: () => t('app_chat'), w: 820, h: 560, render: renderChat },
    settings: { icon: '⚙', cls: 'settings', title: () => t('app_settings'), w: 440, h: 560, render: renderSettings }
  };

  function renderDesktop(force) {
    if (S.view === 'desktop' && !force) { updateTopbar(); updateIcons(); return; }
    const geo = {};
    for (const [id, w] of Object.entries(S.wins)) {
      if (w.el && w.el.isConnected) geo[id] = { open: true, x: w.el.offsetLeft, y: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight };
      else if (w.open) geo[id] = { open: true };
    }
    S.view = 'desktop';
    $('#app').innerHTML = `<section class="screen desktop">
      <header class="topbar">
        <span class="brand">MEDI<span class="cross">✚</span>OS</span>
        <div class="tb-stat timer" id="tb-timer"><small>${t('time_left')}</small><b>--:--</b></div>
        <div class="tb-stat money"><small>${t('money')}</small><b id="tb-money">$0</b></div>
        <div class="tb-stat"><small>${t('rank')}</small><b id="tb-rank">#-</b></div>
        <div class="tb-spacer"></div>
        <button class="btn small" id="tb-lang">${settings.lang === 'he' ? 'EN' : 'עב'}</button>
        <div class="tb-user"><span id="tb-name"></span><span id="tb-badge"></span><i class="net-dot" id="tb-net" title=""></i></div>
      </header>
      <div class="workspace" id="ws">
        <div class="wallpaper"></div><div class="wall-logo">MEDI✚OS</div>
        <nav class="icons" aria-label="apps">
          ${Object.entries(APPS).map(([id, a]) => `<button class="dicon ${a.cls}" data-app="${id}"><span class="gly">${a.icon}</span><span class="lbl">${a.title()}</span><span class="pip hidden"></span></button>`).join('')}
        </nav>
      </div>
      <footer class="taskbar" id="taskbar"><span class="clock" id="tb-clock"></span></footer>
    </section>`;
    $$('.dicon').forEach((b) => b.onclick = () => openWin(b.dataset.app));
    $('#tb-lang').onclick = () => setLang(settings.lang === 'he' ? 'en' : 'he');
    // restore windows
    S.wins = {};
    const toOpen = Object.keys(geo);
    if (!toOpen.length && !force) toOpen.push('calls');
    for (const id of toOpen) openWin(id, geo[id], true);
    updateTopbar(); updateIcons();
  }

  function openWin(id, geo, silent) {
    const ws = $('#ws'); if (!ws) return;
    const a = APPS[id];
    let w = S.wins[id];
    if (w && w.el) { w.el.classList.remove('min'); focusWin(id); if (!silent) sfx('open'); a.render(w.body); renderTaskbar(); return; }
    const W = ws.clientWidth, H = ws.clientHeight;
    const idx = Object.keys(APPS).indexOf(id);
    const ww = Math.min(geo?.w || a.w, W - 20), hh = Math.min(geo?.h || a.h, H - 20);
    const rtl = settings.lang === 'he';
    let x = geo?.x ?? (rtl ? W - ww - 130 - idx * 30 : 130 + idx * 30);
    let y = geo?.y ?? 16 + idx * 26;
    x = Math.max(4, Math.min(x, W - ww - 4)); y = Math.max(4, Math.min(y, H - hh - 4));
    const el = document.createElement('div');
    el.className = 'win'; el.dataset.app = id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', a.title());
    el.style.cssText = `left:${x}px;top:${y}px;width:${ww}px;height:${hh}px`;
    el.innerHTML = `<div class="wbar"><span class="wt">${a.icon} ${esc(a.title())}</span>
      <button class="wbtn" data-w="min" aria-label="minimize">_</button><button class="wbtn x" data-w="close" aria-label="close">×</button></div>
      <div class="wbody"></div>`;
    ws.appendChild(el);
    w = S.wins[id] = { el, body: $('.wbody', el), open: true };
    el.addEventListener('pointerdown', () => focusWin(id));
    $('[data-w=close]', el).onclick = (e) => { e.stopPropagation(); closeWin(id); };
    $('[data-w=min]', el).onclick = (e) => { e.stopPropagation(); el.classList.add('min'); sfx('close'); renderTaskbar(); };
    dragify(el, $('.wbar', el));
    focusWin(id);
    if (!silent) sfx('open');
    a.render(w.body);
    renderTaskbar();
  }

  function closeWin(id) {
    const w = S.wins[id]; if (!w) return;
    w.el.remove(); S.wins[id] = { open: false }; sfx('close'); renderTaskbar();
  }
  function focusWin(id) {
    for (const [k, w] of Object.entries(S.wins)) if (w.el) w.el.classList.toggle('focused', k === id);
    const w = S.wins[id]; if (w?.el) w.el.style.zIndex = ++S.z;
    S.focused = id;
    if (id === 'chat') { S.unread[S.chan] = 0; updateIcons(); }
    renderTaskbar();
  }
  function isOpen(id) { const w = S.wins[id]; return !!(w && w.el && !w.el.classList.contains('min')); }

  function dragify(el, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || window.innerWidth <= 760) return;
      dragging = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const ws = $('#ws');
      const nx = Math.max(-el.offsetWidth + 80, Math.min(ws.clientWidth - 80, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(ws.clientHeight - 40, oy + e.clientY - sy));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }

  function renderTaskbar() {
    const tb = $('#taskbar'); if (!tb) return;
    $$('.task', tb).forEach((x) => x.remove());
    const clock = $('#tb-clock');
    for (const id of Object.keys(APPS)) {
      const w = S.wins[id];
      const open = !!(w && w.el);
      const b = document.createElement('button');
      b.className = 'task' + (open ? ' open' : '') + (open && S.focused === id && !w.el.classList.contains('min') ? ' active' : '');
      b.dataset.task = id;
      b.innerHTML = `<span class="tico">${APPS[id].icon}</span><span class="tlbl">${esc(APPS[id].title())}</span><span class="tpip hidden"></span>`;
      b.onclick = () => {
        const w2 = S.wins[id];
        if (!w2 || !w2.el) return openWin(id);
        if (w2.el.classList.contains('min')) { w2.el.classList.remove('min'); focusWin(id); }
        else if (S.focused === id) { w2.el.classList.add('min'); renderTaskbar(); }
        else focusWin(id);
      };
      tb.insertBefore(b, clock);
    }
    updateIcons();
  }

  function myRank() {
    const ps = S.room?.players || [];
    const i = ps.findIndex((p) => p.id === S.me?.id);
    return i < 0 ? '-' : `${i + 1}/${ps.length}`;
  }

  function updateTopbar() {
    if (S.view !== 'desktop' || !S.me) return;
    const mEl = $('#tb-money');
    const m = S.me.money || 0;
    if (mEl.textContent !== money(m)) {
      mEl.textContent = money(m);
      if (m > S.lastMoney) { mEl.classList.remove('bump'); void mEl.offsetWidth; mEl.classList.add('bump'); }
      S.lastMoney = m;
    }
    $('#tb-rank').textContent = '#' + myRank();
    $('#tb-name').textContent = S.me.name;
    $('#tb-badge').innerHTML = S.me.isHost ? `<span class="badge host">${t('host')}</span>` : S.me.isAdmin ? `<span class="badge admin">${t('admin')}</span>` : '';
    const net = $('#tb-net'); net.classList.toggle('off', !S.online); net.title = S.online ? t('online') : t('offline');
    tickTimer();
  }

  function tickTimer() {
    const el = $('#tb-timer'); if (!el || !S.room) return;
    let ms = S.room.endsAt ? Math.max(0, S.room.endsAt - Net.serverNow()) : 0;
    if (S.room.phase === 'over') ms = 0;
    const s = Math.ceil(ms / 1000);
    $('b', el).textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('low', s <= 30);
  }

  function updateIcons() {
    if (S.view !== 'desktop') return;
    const ringing = S.call && S.call.status === 'ringing';
    $$('.dicon[data-app=calls], .task[data-task=calls]').forEach((el) => el.classList.toggle('ringing', !!ringing));
    let n = S.unread.global + S.unread.help + S.unread.lb;
    if (S.me?.isAdmin) n += S.tickets.filter((x) => !x.adminId).length;
    $$('.dicon[data-app=chat] .pip, .task[data-task=chat] .tpip').forEach((pip) => { pip.textContent = n > 99 ? '99+' : n; pip.classList.toggle('hidden', !n); });
  }

  // ───────────────────────── MDA app ─────────────────────────
  function protoList(list, openFirst) {
    return list.map((p, i) => `<details class="proto" ${openFirst && i === 0 ? 'open' : ''}>
        <summary><span class="pi">${p.icon}</span><span class="pt">${esc(tc(p.title))}<br><span class="pa">${esc(tc(p.action))}</span></span></summary>
        <div class="pb"><h4>${t('signs')}</h4><div>${esc(tc(p.signs))}</div>
        <h4>${t('steps')}</h4><ol>${p.steps[settings.lang].map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      </details>`).join('');
  }

  function renderMda(body) {
    if (!body) { const w = S.wins.mda; if (!w || !w.el) return; body = w.body; }
    const tabs = [['file', t('mda_tab_file')], ['heart', t('mda_tab_heart')], ['first', t('mda_tab_first')]];
    if (!HT.CAST.length) S.mdaTab = 'first';
    let inner = '';
    if (S.mdaTab === 'file') {
      const c = S.call; const ch = charOf(c);
      const live = c && c.kind === 'heart' && c.status === 'active';
      const hint = !live ? t('file_no_patient') : c.stage === 'greet' ? t('file_ask_first', { name: tc(ch.name) }) : c.stage === 'fund' ? t('file_type_number', { name: tc(ch.name) }) : t('file_opened');
      const f = S.mdaFile;
      inner = `<form class="file-search" id="file-form" autocomplete="off">
          <label for="file-num">${t('fund_number')}</label>
          <div class="file-row"><input class="input code" id="file-num" inputmode="numeric" maxlength="9" placeholder="0000000"><button class="btn primary">${t('file_search')}</button></div>
          <div class="dim" style="font-size:.85rem">${esc(hint)}</div><div class="err" id="file-err"></div>
        </form>
        ${f ? `<article class="file-card">
          <header><span class="fa">${f.avatar}</span><div><b>${esc(tc(f.name))}</b><div class="mono dim">${t('fund_number')}: ${esc(f.fund)}</div></div><span class="badge admin">${t('file_badge')}</span></header>
          <h4>${t('file_complaint')}</h4><p>${esc(tc(f.text))}</p>
          <h4>${t('file_question')}</h4><p class="file-q">${esc(tc(f.q))}</p>
          ${live && c.stage === 'file' ? `<button class="btn info" data-back-call>☎ ${t('back_to_call')}</button>` : ''}
        </article>` : ''}`;
    } else if (S.mdaTab === 'heart') {
      inner = protoList(HT.INFO, true);
    } else {
      inner = `<div class="mda-banner"><span class="n101">101</span><p><b>${t('mda_title')}</b><br>${t('mda_hint')}</p></div>${protoList(CT.PROTOCOLS, true)}`;
    }
    body.innerHTML = `<div class="mda-wrap">${HT.CAST.length ? `<div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button class="tab ${S.mdaTab === id ? 'on' : ''}" data-mtab="${id}" role="tab">${l}</button>`).join('')}</div>` : ''}<div class="mda">${inner}</div></div>`;
    $$('[data-mtab]', body).forEach((b) => b.onclick = () => { S.mdaTab = b.dataset.mtab; sfx('click'); renderMda(body); });
    const form = $('#file-form', body);
    if (form) {
      const inp = $('#file-num', body);
      inp.oninput = () => { inp.value = inp.value.replace(/[^\d-]/g, ''); };
      if (S.call && S.call.kind === 'heart' && S.call.stage === 'fund') setTimeout(() => inp.focus(), 50);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const r = await Net.request('mda:lookup', { number: inp.value });
        if (r.error) { sfx('error'); $('#file-err', body).textContent = errText(r.error); return; }
        sfx('success'); S.mdaFile = r.file; renderMda(body);
      };
    }
    const back = $('[data-back-call]', body); if (back) back.onclick = () => openWin('calls');
  }

  // ───────────────────────── Settings app ─────────────────────────
  function renderSettings(body) {
    const tog = (key, label) => `<button class="toggle" role="switch" aria-checked="${!!settings[key]}" data-tog="${key}" aria-label="${label}"></button>`;
    const sl = (key) => `<div class="slider"><span>🔈</span><input type="range" min="0" max="100" value="${Math.round(settings[key] * 100)}" data-sl="${key}" aria-label="${t('volume')}"><output>${Math.round(settings[key] * 100)}</output></div>`;
    body.innerHTML = `<div class="settings">
      <div class="set-row"><h3>🔊 ${t('sound_fx')} ${tog('sfx', t('sound_fx'))}</h3>${sl('sfxVol')}
        <div style="margin-top:.5rem"><button class="btn small" data-test>${t('test_sound')}</button></div></div>
      <div class="set-row"><h3>♫ ${t('music')} ${tog('music', t('music'))}</h3>${sl('musicVol')}</div>
      <div class="set-row"><h3>🌐 ${t('language')}</h3><div class="lang-btns">${langSwitch()}</div></div>
      <div class="set-row"><h3>▤ ${t('crt_fx')} ${tog('crt', t('crt_fx'))}</h3><div class="hint">${t('crt_hint')}</div></div>
      ${S.me?.isHost ? `<div class="set-row"><h3>👑 ${t('host')}</h3><button class="btn danger" data-end>${t('end_now')}</button></div>` : ''}
      <div class="set-row"><button class="btn danger" data-leave>${t('leave')}</button> <span class="dim mono" style="margin-inline-start:.6rem">ROOM ${esc(S.room?.code)}</span></div>
    </div>`;
    $$('[data-tog]', body).forEach((b) => b.onclick = () => {
      const k = b.dataset.tog; settings[k] = !settings[k]; saveSettings(); applySettings(); b.setAttribute('aria-checked', settings[k]); sfx('click');
    });
    $$('[data-sl]', body).forEach((inp) => inp.oninput = () => {
      settings[inp.dataset.sl] = inp.value / 100; inp.nextElementSibling.textContent = inp.value; saveSettings(); applySettings();
    });
    $$('[data-sl=sfxVol]', body).forEach((inp) => inp.onchange = () => sfx('coin'));
    $('[data-test]', body).onclick = () => sfx('success');
    $$('[data-lang]', body).forEach((b) => b.onclick = () => setLang(b.dataset.lang));
    const end = $('[data-end]', body); if (end) end.onclick = async () => { const r = await Net.request('game:end', {}); if (r.error) toastErr(r.error); };
    $('[data-leave]', body).onclick = leaveRoom;
  }

  // ───────────────────────── Calls app ─────────────────────────
  const GEORGE_SVG = `<svg viewBox="0 0 130 150"><defs><radialGradient id="gs" cx="50%" cy="35%"><stop offset="0" stop-color="#2a3050"/><stop offset="1" stop-color="#05060d"/></radialGradient></defs>
    <circle cx="65" cy="45" r="30" fill="url(#gs)" stroke="#6a7bff" stroke-opacity=".5"/>
    <path d="M10 150 C10 100 35 82 65 82 C95 82 120 100 120 150Z" fill="url(#gs)" stroke="#6a7bff" stroke-opacity=".5"/>
    <text x="65" y="56" text-anchor="middle" font-size="30" fill="#8a96ff" opacity=".6" font-family="VT323">?</text></svg>`;

  function charOf(call) { return call ? ALL_CHARS[call.charId] : null; }
  function rc(ch) { return (CT.RARITY[ch.rarity] || CT.RARITY.common).color; }
  function rarityTag(ch) { const r = CT.RARITY[ch.rarity]; return `<span class="rarity">${esc(tc(r))}</span>`; }
  function elapsed(call) { return call && call.pickedAt ? Net.serverNow() - call.pickedAt : 0; }

  function renderCalls(body) {
    if (!body) { const w = S.wins.calls; if (!w || !w.el) return; body = w.body; }
    if (!$('.calls', body)) {
      body.innerHTML = `<div class="calls"><div class="tabs" role="tablist">
        <button class="tab" data-tab="call" role="tab">${t('tab_call')}</button><button class="tab" data-tab="index" role="tab">${t('tab_index')}</button></div>
        <div class="call-stage" id="call-stage"></div></div>`;
      $$('[data-tab]', body).forEach((b) => b.onclick = () => { S.callsTab = b.dataset.tab; S.renderedKey = ''; sfx('click'); renderCalls(body); });
    }
    $$('[data-tab]', body).forEach((b) => b.classList.toggle('on', b.dataset.tab === S.callsTab));
    const stage = $('#call-stage', body);
    if (S.callsTab === 'index') { stage.className = 'call-stage'; stage.innerHTML = renderIndex(); S.renderedKey = 'index'; return; }
    renderStage(stage, true);
  }

  // Line count to show for scripted (boost/george/planet) calls
  const talkOf = (call) => (call && call.talkMs) || CT.ECON.georgeTalkMs;
  const isTalker = (call) => call && (call.kind === 'george' || call.kind === 'launch');
  const talkReady = (call) => elapsed(call) >= talkOf(call) - Math.min(1500, talkOf(call) * 0.1);
  function linesShown(call, ch) {
    const lines = ch.lines[settings.lang];
    if (isTalker(call)) return Math.min(lines.length, Math.floor(elapsed(call) / (talkOf(call) / lines.length)) + 1);
    return Math.min(lines.length, Math.floor(elapsed(call) / 1500) + 1);
  }

  function stageKey() {
    const c = S.call; if (!c) return 'idle';
    const ch = charOf(c);
    let k = `${c.id}|${c.status}|${settings.lang}`;
    if (c.kind === 'heart') k += `|${c.stage}|${c.tries}|${(c.chat || []).length}|${c.result ? 1 : 0}`;
    else if (c.status === 'active' && c.kind !== 'regular') k += '|' + linesShown(c, ch) + '|' + (isTalker(c) && talkReady(c));
    return k;
  }

  function renderStage(stage, force) {
    stage = stage || $('#call-stage');
    if (!stage || S.callsTab !== 'call' || S.launching) return;
    const key = stageKey();
    if (!force && key === S.renderedKey) return;
    S.renderedKey = key;
    const c = S.call; const ch = charOf(c);
    if (!c) {
      stage.className = 'call-stage';
      const st = S.me?.stats || { answered: 0, correct: 0 };
      stage.innerHTML = `<div class="radar"></div><div class="stage-title">${t('waiting_call')}</div><div class="dim mono">${t('scanning')} ▸▸▸</div>
        <div class="stats-line"><div><b>${st.answered}</b>${t('answered')}</div><div><b>${st.answered ? Math.round((st.correct / st.answered) * 100) : 0}%</b>${t('stats')}</div><div><b>${myRank()}</b>${t('rank')}</div></div>`;
      return;
    }
    const isNoob = c.kind === 'launch' && ch.world === 'minecraft';
    const isG = c.kind === 'george' || (c.kind === 'launch' && !isNoob);
    const isP = c.kind === 'planet' || c.world === 'planet';
    const isMC = isNoob || c.world === 'minecraft';
    stage.className = 'call-stage' + (isG ? ' george-stage' : '') + (isP ? ' planet-stage' : '') + (isMC ? ' mc-stage' : '');
    const avatar = (ring) => {
      if (isG && ring) return `<div class="avatar ring" style="--rc:#6a7bff;background:#05060d"><div class="silhouette" style="width:70px;height:82px">${GEORGE_SVG}</div></div>`;
      if (isG) return `<div class="silhouette">${GEORGE_SVG}</div>`;
      const crown = ch.id === 'legendary_george' || ch.id === 'h_legend';
      return `<div class="avatar ${ring ? 'ring' : ''} ${crown ? 'crowned' : ''}" style="--rc:${rc(ch)}">${crown ? '<span class="legend-rays"></span><span class="crown">👑</span>' : ''}${ch.id === 'strawberry_elephant' || ch.id === 'h_elephant' ? '🐘<span style="position:absolute;bottom:4px;inset-inline-end:2px;font-size:1.6rem">🍓</span>' : ch.avatar}</div>`;
    };
    const head = (ring) => `<div class="caller" style="--rc:${isG ? '#8a96ff' : rc(ch)}">
      ${isP ? `<div class="planet-tag">🪐 ${t('planet')}</div>` : ''}${c.world === 'minecraft' ? `<div class="planet-tag mc-tag">▦ ${t('mc_world')}</div>` : ''}
      ${avatar(ring)}
      <div class="cname">${(isG || isNoob) && c.status === 'ringing' ? t('unknown_caller') : esc(tc(ch.name))}</div>
      ${isG || isNoob ? `<span class="rarity" style="--rc:#8a96ff">???</span>` : rarityTag(ch)}
      ${!isG && c.status !== 'ringing' && c.kind !== 'heart' ? `<div class="bio">${esc(tc(ch.bio))}</div>` : ''}
    </div>`;

    const stars = isP ? '<div class="stars"></div>' : isMC ? '<div class="mc-blocks"></div>' : '';

    if (c.status === 'ringing') {
      stage.innerHTML = `${stars}${head(true)}<div class="stage-title">${t('ringing')}</div><button class="btn primary big" id="c-answer">${t('answer')}</button>`;
      $('#c-answer').onclick = async (e) => { e.target.disabled = true; Audio8.ring(false); sfx('click'); const r = await Net.request('call:pickup', { callId: c.id }); if (r.error) { e.target.disabled = false; toastErr(r.error); } };
      return;
    }

    if (c.kind === 'regular') {
      const done = c.status === 'done';
      const res = c.result;
      const opts = c.options.map((pid) => {
        const p = PROTO[pid];
        let cls = '';
        if (done) { if (pid === res.answer) cls = 'good'; else if (pid === res.chose) cls = 'bad'; }
        return `<button class="opt ${cls}" data-p="${pid}" ${done ? 'disabled' : ''}><span class="oi">${p.icon}</span><span>${esc(tc(p.action))}</span></button>`;
      }).join('');
      stage.innerHTML = `${head(false)}
        <div class="bubble" id="c-bubble"></div>
        ${done ? `<div class="result ${res.correct ? 'good' : 'bad'}">${res.correct ? t('correct') : t('wrong')}</div>
          <div class="delta ${res.delta >= 0 ? 'plus' : 'minus'}">${res.delta >= 0 ? '+' : '−'}${money(Math.abs(res.delta))}</div>
          ${res.correct ? '' : `<div class="dim">${t('correct_was')} <b style="color:var(--green)">${esc(tc(PROTO[res.answer].title))}</b></div>`}`
        : `<div class="dim" style="margin-bottom:6px">${t('choose_treatment')}</div><div class="options">${opts}</div><div class="reward-tag">${t('reward')}: ${money(ch.reward)}</div>`}
        ${done ? `<div class="options" style="margin-top:10px">${opts}</div>` : ''}`;
      typeInto($('#c-bubble'), tc(c.scenario), c.id);
      if (!done) $$('.opt', stage).forEach((b) => b.onclick = async () => {
        $$('.opt', stage).forEach((x) => (x.disabled = true));
        b.classList.add('good');
        const r = await Net.request('call:answer', { callId: c.id, protocolId: b.dataset.p });
        if (r.error) { toastErr(r.error); $$('.opt', stage).forEach((x) => (x.disabled = false)); b.classList.remove('good'); }
      });
      return;
    }

    if (c.kind === 'heart') return renderHeart(stage, c, ch, head, stars);

    // scripted calls: boost / george / planet
    const lines = ch.lines[settings.lang];
    if (c.status === 'done') {
      const res = c.result;
      if (isTalker(c)) {
        stage.innerHTML = `${stars}${head(false)}<div class="stage-title" style="color:#aab3ff">${isNoob ? t('stay_noob') : t('stay_earth')}</div><div class="dim">${t('next_call_soon')}</div>`;
      } else {
        stage.innerHTML = `${stars}${head(false)}<div class="delta plus">+${money(res.delta)}</div>
          <div class="stage-title">${isP ? t('back_earth') : t('next_call_soon')}</div>`;
      }
      return;
    }
    const shown = linesShown(c, ch);
    const allShown = shown >= lines.length;
    let foot = '';
    if (isTalker(c)) {
      const left = Math.max(0, Math.ceil((talkOf(c) - elapsed(c)) / 1000));
      const ready = talkReady(c);
      foot = ready
        ? `<div class="g-question">${c.kind === 'launch' ? esc(tc(ch.question)) : t('george_q')}</div><div class="yesno"><button class="btn yes" id="g-yes">${t('yes')}</button><button class="btn no" id="g-no">${t('no')}</button></div>`
        : `<div class="g-progress"><i id="g-bar" style="width:${Math.min(100, (elapsed(c) / talkOf(c)) * 100)}%"></i></div><div class="g-count" id="g-count">${t('listen')} ${left}s</div>`;
    } else if (allShown) {
      foot = `<button class="btn primary big" id="c-collect">🎁 ${t('collect')} +${money(ch.boost)}</button>`;
    }
    stage.innerHTML = `${stars}${head(false)}
      <div class="lines">${lines.slice(0, shown).map((l) => `<div class="line">${esc(l)}</div>`).join('')}</div>${foot}`;
    stage.scrollTop = stage.scrollHeight;
    if (shown > (S.lastLines || 0) || S.lastLinesFor !== c.id) { if (S.lastLinesFor === c.id) sfx('msg'); }
    S.lastLines = shown; S.lastLinesFor = c.id;
    const col = $('#c-collect');
    if (col) col.onclick = async () => { col.disabled = true; const r = await Net.request('call:collect', { callId: c.id }); if (r.error) { col.disabled = false; toastErr(r.error); } };
    const y = $('#g-yes'), n = $('#g-no');
    if (y) y.onclick = async () => {
      y.disabled = n.disabled = true; S.launching = true;
      const r = await Net.request('call:george', { callId: c.id, yes: true });
      if (r.error) { S.launching = false; y.disabled = n.disabled = false; return toastErr(r.error); }
      await playLaunch(r.world || 'planet');
    };
    if (n) n.onclick = async () => {
      y.disabled = n.disabled = true; sfx('close');
      const r = await Net.request('call:george', { callId: c.id, yes: false });
      if (r.error) { y.disabled = n.disabled = false; toastErr(r.error); }
    };
  }

  function renderHeart(stage, c, ch, head, stars) {
    const done = c.status === 'done';
    const res = c.result;
    const tag = (n, boost) => `<div class="reward-chip">[${t('reward_tag')}: ${n.toLocaleString('en-US')} ${t('coins')}${boost ? ' / ' + t('bonus') : ''}]</div>`;
    let html = `${stars}${head(false)}<div class="bubble" id="c-bubble"></div>`;
    if (done) {
      if (res.correct) {
        html += `<div class="result good">${t('heart_saved')}</div><div class="delta plus">+${money(res.delta)}</div>
          <div class="line ok-line">${esc(res.aiReply || tc(byIdOk(c)) || '')}</div>${tag(res.delta, res.booster)}`;
      } else {
        html += `<div class="result bad">${res.hungUp ? t('heart_hung') : t('heart_failed')}</div><div class="dim">${t('heart_no_reward')}</div>`;
      }
      html += `<div class="stage-title" style="font-size:1.2rem">${res.world === 'planet' ? t('back_earth') : res.world === 'minecraft' ? t('back_earth_mc') : t('next_call_soon')}</div>`;
      stage.innerHTML = html;
      $('#c-bubble').textContent = tc(ch.hello);
      return;
    }
    if (c.stage === 'greet') {
      html += `<button class="btn primary big" id="h-fund">📋 ${t('ask_fund')}</button>`;
    } else if (c.stage === 'fund') {
      html += `<div class="line fund-line">${esc(t('fund_says'))} <b class="mono fund-no">${esc(c.fund)}</b></div>
        <div class="step-hint">① ${t('step_open_mda')}<br>② ${t('step_type_number')}</div>
        <button class="btn info big" id="h-mda">✚ ${t('open_mda_file')}</button>`;
    } else {
      html += `<div class="file-mini"><b>📁 ${t('file_complaint')}:</b> ${esc(tc(c.file))}</div>
        <div class="file-q">${esc(tc(c.q))}</div>
        ${c.reply ? `<div class="line patient-reply">💬 ${esc(tc(c.reply))}</div>` : ''}
        <div class="options">${c.choices.map((o) => `<button class="opt ${c.removed.includes(o.i) ? 'bad' : ''}" data-o="${o.i}" ${c.removed.includes(o.i) ? 'disabled' : ''}><span>${esc(tc(o.t))}</span></button>`).join('')}</div>
        <div class="dim" style="font-size:.8rem;margin-top:6px">${t('tries_left', { n: Math.max(0, c.maxTries - c.tries) })} · ${t('reward')}: ${money(ch.reward)}</div>
        ${c.aiOn ? `<div class="ai-chat">${(c.chat || []).map((m) => `<div class="line ${m.who === 'player' ? 'me-line' : 'patient-reply'}">${m.who === 'player' ? '🧑‍⚕️' : '💬'} ${esc(m.text)}</div>`).join('')}
          <form class="composer" id="h-free" style="border:none;padding:6px 0 0"><input class="input" id="h-text" maxlength="400" placeholder="${t('free_ph')}" autocomplete="off"><button class="btn primary">${t('send')}</button></form></div>` : ''}`;
    }
    html += `<button class="btn small danger" id="h-hang" style="margin-top:10px">☎ ${t('hang_up')}</button>`;
    stage.innerHTML = html;
    typeInto($('#c-bubble'), tc(ch.hello), c.id + ':hello');
    const fund = $('#h-fund'); if (fund) fund.onclick = async () => { fund.disabled = true; sfx('click'); const r = await Net.request('call:fund', { callId: c.id }); if (r.error) { fund.disabled = false; toastErr(r.error); } };
    const mda = $('#h-mda'); if (mda) mda.onclick = () => { S.mdaTab = 'file'; S.mdaFile = null; openWin('mda'); renderMda(); };
    $$('[data-o]', stage).forEach((b) => b.onclick = async () => {
      $$('[data-o]', stage).forEach((x) => (x.disabled = true));
      const r = await Net.request('call:choose', { callId: c.id, option: Number(b.dataset.o) });
      if (r.error) { toastErr(r.error); renderStage(null, true); }
      else if (!r.correct) sfx('fail');
    });
    const free = $('#h-free');
    if (free) free.onsubmit = async (e) => {
      e.preventDefault();
      const inp = $('#h-text'); const text = inp.value.trim(); if (!text) return;
      inp.disabled = true;
      const r = await Net.request('call:reply', { callId: c.id, text });
      if (r.error) { inp.disabled = false; toastErr(r.error); }
    };
    const hang = $('#h-hang'); if (hang) hang.onclick = async () => { hang.disabled = true; await Net.request('call:hangup', { callId: c.id }); };
    stage.scrollTop = c.stage === 'file' ? stage.scrollTop : 0;
  }
  function byIdOk(c) { return c.result && c.result.ok; }

  function typeInto(el, text, id) {
    if (!el) return;
    if (S.typedFor === id) { el.textContent = text; return; }
    S.typedFor = id;
    el.classList.add('typing');
    let i = 0;
    const step = () => {
      if (!el.isConnected) return;
      i = Math.min(text.length, i + 2);
      el.textContent = text.slice(0, i);
      if (i % 6 === 0) sfx('type');
      if (i < text.length) setTimeout(step, 22); else el.classList.remove('typing');
    };
    step();
  }

  function renderIndex() {
    const card = (ch, odds) => {
      const known = S.discovered.has(ch.id);
      return `<div class="icard ${known ? '' : 'locked'}" style="--rc:${ch.rarity === 'mystery' ? '#8a96ff' : rc(ch)}">
        <span class="ia">${ch.avatar}</span><span class="in">${esc(tc(ch.name))}</span>
        <span class="ib">${known ? esc(tc(ch.bio)) : t('locked')}</span>
        <span class="ic">${t('chance')} ${odds}% · ${ch.reward ? money(ch.reward) : ch.boost ? '+' + money(ch.boost) : ch.world === 'minecraft' ? '▦' : '🪐'}</span></div>`;
    };
    return `<div class="index" style="width:100%">
      <h3>${t('regular_callers')}</h3><div class="igrid">${CT.REGULARS.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('special_callers')}</h3><div class="igrid">${CT.SPECIALS.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('planet_callers')}</h3><div class="igrid">${CT.PLANET.map((c) => card(c, c.weight)).join('')}</div>
      ${HT.CAST.length ? `<h3>${t('heart_callers')}</h3><div class="igrid">${HT.CAST.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('mc_callers')}</h3><div class="igrid">${HT.MINECRAFT.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('planet_callers')} · ${t('research')}</h3><div class="igrid">${HT.PLANET.map((c) => card(c, c.weight)).join('')}</div>` : ''}</div>`;
  }

  function onCall(call) {
    const prev = S.call;
    S.call = call;
    if (call && (!prev || prev.id !== call.id) && call.status === 'ringing') {
      Audio8.ring(true);
      if (isTalker(call)) sfx('mystery');
      if (!isOpen('calls') || S.focused !== 'calls') {
        const ch = charOf(call);
        toast(`<span class="ta">${isTalker(call) ? '👤' : ch.avatar}</span><span class="tt"><b>${t('incoming')}</b><br>${isTalker(call) ? t('unknown_caller') : esc(tc(ch.name))}</span><span class="btn small info">${t('open')}</span>`,
          { cls: 'call', ms: 6000, onClick: () => openWin('calls') });
      }
    }
    if (!call || call.status !== 'ringing') Audio8.ring(false);
    if (call && call.status === 'active') { S.discovered.add(call.charId); store.set('medios.discovered', [...S.discovered]); }
    if (call && call.status === 'done' && (!prev || prev.status !== 'done' || prev.id !== call.id)) {
      const r = call.result;
      if (r.kind === 'regular') sfx(r.correct ? 'success' : 'fail');
      else if (r.kind === 'planet') sfx('jackpot');
      else if (r.kind === 'boost') sfx('coin');
      else if (r.kind === 'heart') sfx(r.correct ? (r.booster || r.world ? 'jackpot' : 'success') : 'fail');
    }
    if (call && (!prev || prev.id !== call.id)) S.mdaFile = null;
    if (isOpen('mda') && S.mdaTab === 'file' && (!prev || !call || prev.stage !== call.stage || prev.id !== call.id || prev.status !== call.status)) renderMda();
    if (call && call.kind === 'planet' && call.status === 'active' && !S.launching && !(prev && prev.kind === 'planet')) {
      // resumed mid-planet (e.g. refresh) — no animation needed
    }
    if (S.callsTab === 'call') renderStage(null, true);
    updateIcons();
  }

  async function playLaunch(world) {
    sfx('launch');
    const ov = document.createElement('div');
    const mc = world === 'minecraft';
    ov.className = 'ov launch' + (mc ? ' launch-mc' : '');
    ov.innerHTML = mc
      ? `<div class="mc-fall">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 9) * 0.15}s;--c:${['#5d9b3a', '#7a5230', '#8c8c8c', '#4f8b2e', '#6b4423'][i % 5]}"></i>`).join('')}</div><div class="launch-title">▦ ${t('launch_mc')}</div><div class="countdown" id="cd">3</div><div class="whiteflash"></div>`
      : `<div class="starfield"></div><div class="launch-title">🚀 ${t('launch_t')}</div><div class="countdown" id="cd">3</div><div class="flame"></div><div class="rocket">🚀</div><div class="whiteflash"></div>`;
    $('#overlay').appendChild(ov);
    for (const n of ['3', '2', '1', mc ? '▦' : '🪐']) { const cd = $('#cd', ov); if (cd) cd.textContent = n; await sleep(900); }
    ov.remove();
    S.launching = false;
    openWin('calls'); S.callsTab = 'call'; renderCalls();
  }

  // ───────────────────────── DisChat ─────────────────────────
  const CHANNELS = [
    { id: 'help', icon: '?', name: () => t('ch_help'), desc: () => t('ch_help_d') },
    { id: 'lb', icon: '#', name: () => t('ch_lb'), desc: () => t('ch_lb_d') },
    { id: 'global', icon: '#', name: () => t('ch_global'), desc: () => t('ch_global_d') }
  ];

  function renderChat(body) {
    if (!body) { const w = S.wins.chat; if (!w || !w.el) return; body = w.body; }
    body.innerHTML = `<div class="dchat ${S.showMembers ? 'with-members' : ''}" id="dchat">
      <aside class="dside"><h4>DisChat · ${esc(S.room?.code)}</h4><div id="chans" style="display:contents"></div></aside>
      <section class="dmain" id="dmain"></section>
      ${S.showMembers ? '<aside class="dmembers" id="dmembers"></aside>' : ''}
    </div>`;
    renderChans(); renderChatMain(); renderMembers();
  }

  function renderChans() {
    const el = $('#chans'); if (!el) return;
    el.innerHTML = CHANNELS.map((c) => {
      let n = S.unread[c.id];
      if (c.id === 'help' && S.me?.isAdmin) n = S.tickets.filter((x) => !x.adminId).length;
      return `<button class="chan ${S.chan === c.id ? 'on' : ''}" data-ch="${c.id}"><span class="hash">${c.icon}</span><span class="cn">${esc(c.name())}</span>${n ? `<span class="unread">${n}</span>` : ''}</button>`;
    }).join('') + `<button class="chan" data-members style="margin-top:auto"><span class="hash">☺</span><span class="cn">${t('members')} (${S.room?.players.length || 0})</span></button>`;
    $$('[data-ch]', el).forEach((b) => b.onclick = () => { S.chan = b.dataset.ch; S.unread[S.chan] = 0; S.ticketOpen = null; sfx('click'); renderChans(); renderChatMain(); updateIcons(); });
    $('[data-members]', el).onclick = () => { S.showMembers = !S.showMembers; sfx('click'); renderChat(); };
  }

  function roleColor(from) {
    if (from.role === 'bot') return 'var(--magenta)';
    if (from.role === 'host') return 'var(--amber)';
    if (from.role === 'admin') return 'var(--cyan)';
    let h = 0; for (const c of from.name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 80% 65%)`;
  }

  function evText(ev) {
    switch (ev.type) {
      case 'admin_joined': return t('ev_admin_joined', ev);
      case 'admin_left': return t('ev_admin_left', ev);
      case 'closed': return t('ev_closed', ev);
      case 'join': return t('ev_join', ev);
      case 'start': return t('ev_start');
      case 'muted': return t('ev_muted', ev);
      case 'unmuted': return t('ev_unmuted', ev);
      case 'kicked': return t('ev_kicked', ev);
      case 'rare': { const ch = ALL_CHARS[ev.charId]; return t('ev_rare', { player: ev.player, char: `${ch.avatar} ${tc(ch.name)}`, delta: money(ev.delta) }); }
      default: return '';
    }
  }

  function msgHtml(m) {
    if (m.from.role === 'system') {
      const txt = m.event ? evText(m.event) : m.text;
      return `<div class="msg sys ${m.event?.type === 'rare' ? 'rare' : ''}">${esc(txt)}</div>`;
    }
    const time = new Date(m.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const badge = m.from.role === 'bot' ? `<span class="badge ai">AI</span>` : m.from.role === 'host' ? `<span class="badge host">${t('host')}</span>` : m.from.role === 'admin' ? `<span class="badge admin">${t('admin')}</span>` : '';
    const mine = m.from.id === S.me?.id;
    return `<div class="msg ${m.from.role === 'bot' ? 'bot' : ''} ${mine ? 'mine' : ''}">
      <span class="mav" style="background:${roleColor(m.from)}">${m.from.role === 'bot' ? '🤖' : esc(m.from.name.slice(0, 1).toUpperCase())}</span>
      <div><div class="mh"><span class="mn" style="color:${mine ? '' : roleColor(m.from)}">${esc(m.from.name)}</span>${badge}<span class="mt">${time}</span></div>
      <div class="mb">${esc(m.text)}</div></div></div>`;
  }

  function renderChatMain() {
    const main = $('#dmain'); if (!main) return;
    const ch = CHANNELS.find((c) => c.id === S.chan);
    const admin = S.me?.isAdmin;
    let html = `<div class="dhead"><span class="ttl">${ch.icon === '?' ? '❓' : '#'} ${esc(ch.name())}</span><span class="sub">${esc(ch.desc())}</span></div>`;

    if (S.chan === 'help' && admin && !S.ticketOpen) {
      html += `<div class="tq">${S.tickets.length ? S.tickets.map((tk) => `<button class="ticket ${tk.adminId ? 'claimed' : ''}" data-tk="${tk.id}">
          <div class="th"><b>${esc(tk.playerName)}</b><span class="badge ${tk.adminId ? 'admin' : 'flag'}">${tk.adminId ? `${t('handled_by')} ${esc(tk.adminName)}` : 'NEW'}</span></div>
          <div class="tsum">“${esc(tk.summary)}”</div>
          <div class="dim" style="font-size:.78rem">${t('category')}: ${esc(tc(tk.category))}</div></button>`).join('') : `<div class="welcome">${t('no_tickets')}</div>`}</div>`;
      main.innerHTML = html;
      $$('[data-tk]', main).forEach((b) => b.onclick = () => { S.ticketOpen = b.dataset.tk; sfx('open'); renderChatMain(); });
      return;
    }

    let list = []; let welcome = '';
    if (S.chan === 'global') list = S.chat.global;
    if (S.chan === 'lb') { list = S.chat.lb; welcome = t('lb_welcome'); }
    if (S.chan === 'help') {
      if (admin) {
        const tk = S.tickets.find((x) => x.id === S.ticketOpen);
        if (!tk) { S.ticketOpen = null; return renderChatMain(); }
        list = S.ticketMsgs[tk.id] || [];
        const mine = tk.adminId === S.me.id;
        html += `<details class="tinfo" ${mine ? '' : 'open'}><summary>ℹ ${t('ticket_summary')} · ${esc(tk.playerName)}</summary><dl><dt>${t('ticket_summary')}</dt><dd>${esc(tk.summary)}</dd>
          <dt>${t('ai_answered')}</dt><dd>${esc(tk.aiAnswer || '…')}</dd>
          <dt>${t('how_handle')} · ${esc(tc(tk.category))}</dt><dd>${esc(tc(tk.howTo))}</dd></dl></details>
          <div class="tactions"><button class="btn small ghost" data-tq>${t('back_queue')}</button>
          ${!tk.adminId ? `<button class="btn small primary" data-claim>${t('join_chat')}</button>` : mine ? `<button class="btn small warn" data-release>${t('leave_chat')}</button>` : `<span class="badge admin">${t('handled_by')} ${esc(tk.adminName)}</span>`}
          <button class="btn small danger" data-close>${t('close_ticket')}</button></div>`;
      } else { list = S.chat.help; welcome = t('help_welcome'); }
    }
    html += `<div class="msgs" id="msgs">${welcome ? `<div class="welcome">${welcome}</div>` : ''}${list.map(msgHtml).join('')}</div>`;
    if (S.chan === 'lb') html += `<div class="presets">${CT.LB_PRESETS.map((p) => `<button class="preset" data-preset="${p.id}">${esc(tc(p))}</button>`).join('')}</div>`;
    const muted = S.chan === 'global' && S.me && S.me.mutedUntil > Net.serverNow();
    const tk = S.chan === 'help' && admin ? S.tickets.find((x) => x.id === S.ticketOpen) : null;
    const blocked = tk && tk.adminId && tk.adminId !== S.me.id;
    if (muted) html += `<div class="muted-note">🔇 ${t('you_muted')} ${new Date(S.me.mutedUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>`;
    else html += `<form class="composer" id="composer"><input class="input" id="c-input" maxlength="300" placeholder="${t('type_msg')}" autocomplete="off" ${blocked ? 'disabled' : ''}><button class="btn primary" ${blocked ? 'disabled' : ''}>${t('send')}</button></form>`;
    main.innerHTML = html;
    const msgs = $('#msgs'); msgs.scrollTop = msgs.scrollHeight;

    const send = async (payload) => {
      const r = await Net.request('chat:send', payload);
      if (r.error) toastErr(r.error); else sfx('click');
      return r;
    };
    const comp = $('#composer');
    if (comp) comp.onsubmit = async (e) => {
      e.preventDefault();
      const inp = $('#c-input'); const text = inp.value.trim(); if (!text) return;
      const payload = { channel: S.chan, text };
      if (tk) payload.ticketId = tk.id;
      inp.value = '';
      const r = await send(payload);
      if (r.error) inp.value = text;
      inp.focus();
    };
    $$('[data-preset]', main).forEach((b) => b.onclick = () => send({ channel: 'lb', presetId: b.dataset.preset }));
    const bq = $('[data-tq]', main); if (bq) bq.onclick = () => { S.ticketOpen = null; renderChatMain(); };
    const cl = $('[data-claim]', main); if (cl) cl.onclick = async () => { const r = await Net.request('help:claim', { ticketId: tk.id }); if (r.error) toastErr(r.error); };
    const rl = $('[data-release]', main); if (rl) rl.onclick = async () => { const r = await Net.request('help:release', { ticketId: tk.id }); if (r.error) toastErr(r.error); else { S.ticketOpen = null; renderChatMain(); } };
    const cs = $('[data-close]', main); if (cs) cs.onclick = async () => { const r = await Net.request('help:close', { ticketId: tk.id }); if (r.error) toastErr(r.error); else { S.ticketOpen = null; } };
  }

  function renderMembers() {
    const el = $('#dmembers'); if (!el || !S.room) return;
    const me = S.me || {};
    el.innerHTML = `<div class="dhead" style="padding:.2rem .3rem .6rem;border:none"><span class="ttl">${t('members')}</span><button class="btn small ghost" data-x style="margin-inline-start:auto">×</button></div>` +
      S.room.players.map((p) => {
        const canMod = me.isAdmin && p.id !== me.id && !p.isHost && (!p.isAdmin || me.isHost);
        return `<div class="mem"><div class="mrow"><i class="net-dot ${p.connected ? '' : 'off'}" style="width:8px;height:8px;animation:none"></i><span class="mname">${esc(p.name)}</span>
          ${p.isHost ? `<span class="badge host">${t('host')}</span>` : p.isAdmin ? `<span class="badge admin">${t('admin')}</span>` : ''}${p.muted ? `<span class="badge mute">${t('muted')}</span>` : ''}</div>
          ${canMod ? `<div class="macts">
            <button class="btn small warn" data-mute="${p.id}" data-min="${p.muted ? 0 : 5}">${p.muted ? t('unmute') : t('mute_5')}</button>
            <button class="btn small danger" data-kick="${p.id}">${t('kick')}</button>
            ${me.isHost ? `<button class="btn small info" data-promote="${p.id}">${p.isAdmin ? t('remove_admin') : t('make_admin')}</button>` : ''}</div>` : ''}</div>`;
      }).join('');
    $('[data-x]', el).onclick = () => { S.showMembers = false; renderChat(); };
    $$('[data-mute]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('mod:mute', { targetId: b.dataset.mute, minutes: Number(b.dataset.min) }); if (r.error) toastErr(r.error); });
    $$('[data-kick]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('mod:kick', { targetId: b.dataset.kick }); if (r.error) toastErr(r.error); });
    $$('[data-promote]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('lobby:promote', { targetId: b.dataset.promote }); if (r.error) toastErr(r.error); });
  }

  function chatVisible(chan) { return isOpen('chat') && S.chan === chan; }

  function pushChat(chan, msg) {
    const list = S.chat[chan]; list.push(msg); if (list.length > 200) list.shift();
    if (chatVisible(chan) && !(chan === 'help' && S.me?.isAdmin)) {
      const box = $('#msgs');
      if (box) { const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80; box.insertAdjacentHTML('beforeend', msgHtml(msg)); if (near || msg.from.id === S.me?.id) box.scrollTop = box.scrollHeight; }
    } else if (msg.from.id !== S.me?.id && msg.from.role !== 'system') {
      S.unread[chan]++; renderChans();
    }
    if (msg.from.id !== S.me?.id && msg.from.role !== 'system') sfx('msg');
    updateIcons();
  }

  // ───────────────────────── overlays ─────────────────────────
  function renderOverlays() {
    const root = $('#overlay');
    // rename
    let rn = $('#ov-rename');
    if (S.me?.flagged) {
      if (!rn) {
        root.insertAdjacentHTML('beforeend', `<div class="ov" id="ov-rename"><form class="modal alert" id="f-rename">
          <h2>⚠ ${t('rename_t')}</h2><p>${t('rename_d')}</p>
          <div class="field"><label for="rn-in">${t('your_name')}</label><input class="input" id="rn-in" maxlength="16" required></div>
          <div class="err" id="rn-err"></div><button class="btn primary big" style="width:100%">${t('rename_btn')}</button></form></div>`);
        sfx('error');
        $('#rn-in').focus();
        $('#f-rename').onsubmit = async (e) => {
          e.preventDefault();
          const name = $('#rn-in').value.trim();
          const r = await Net.request('player:rename', { name });
          if (r.error) { const e2 = $('#rn-err'); if (e2) e2.textContent = errText(r.error); sfx('error'); }
          else { store.set('medios.name', name); sfx('success'); }
        };
      }
    } else if (rn) rn.remove();

    // game over
    let go = $('#ov-over');
    if (S.room?.phase === 'over' && S.gameover) {
      const b = S.gameover.board;
      const html = `<div class="modal"><h2 style="text-align:center">🏁 ${t('over_t')}</h2><p style="text-align:center">${t('over_d')}</p>
        <div class="podium">${[1, 0, 2].map((i) => b[i] ? `<div class="pod p${i + 1}"><span style="font-size:1.8rem">${['🥇', '🥈', '🥉'][i]}</span><span class="pn">${esc(b[i].name)}</span><span class="pm">${money(b[i].money)}</span><div class="block">${i + 1}</div></div>` : '').join('')}</div>
        <div style="max-height:28vh;overflow:auto"><table class="final-table">${b.map((p, i) => `<tr class="${p.id === S.me?.id ? 'me' : ''}"><td class="r">${i + 1}</td><td>${esc(p.name)} <span class="dim" style="font-size:.78rem">· ${p.correct}/${p.answered} ${t('answered')}</span></td><td class="m">${money(p.money)}</td></tr>`).join('')}</table></div>
        <div class="over-actions">${S.me?.isHost ? `<button class="btn primary big" data-lobby>${t('back_lobby')}</button>` : `<div class="waiting" style="font-size:1.2rem">${t('waiting_host')}</div>`}<button class="btn danger" data-leave>${t('leave')}</button></div></div>`;
      if (!go) { root.insertAdjacentHTML('beforeend', `<div class="ov over" id="ov-over"></div>`); go = $('#ov-over'); sfx('jackpot'); Audio8.ring(false); }
      go.innerHTML = html;
      const bl = $('[data-lobby]', go); if (bl) bl.onclick = () => Net.request('game:lobby', {});
      $('[data-leave]', go).onclick = leaveRoom;
    } else if (go) go.remove();
  }

  function showKicked() {
    S.view = 'kicked';
    Audio8.ring(false);
    $('#app').innerHTML = '';
    $('#overlay').innerHTML = `<div class="ov"><div class="modal alert" style="text-align:center"><h2>⛔ ${t('kicked_t')}</h2><p>${t('kicked_d')}</p>
      <button class="btn primary" id="k-home">${t('home')}</button></div></div>`;
    $('#k-home').onclick = () => { location.href = '/'; };
  }

  async function bootSequence() {
    S.booting = true;
    sfx('boot');
    const ov = document.createElement('div');
    ov.className = 'ov boot'; $('#overlay').appendChild(ov);
    for (const line of t('boot')) {
      const d = document.createElement('div'); d.className = 'bl'; d.textContent = line; ov.appendChild(d);
      sfx('type'); await sleep(340);
    }
    await sleep(300);
    ov.remove(); S.booting = false;
  }

  // ───────────────────────── network events ─────────────────────────
  Net.onOnline((on) => { S.online = on; updateTopbar(); });

  Net.on('room', (room) => {
    const prevPhase = S.room?.phase;
    S.room = room;
    if (room.phase !== 'over') S.gameover = null;
    if (prevPhase === 'lobby' && room.phase === 'playing') {
      S.wins = {}; S.call = null; S.chat.lb = []; S.chat.help = [];
      bootSequence();
    }
    if (prevPhase && prevPhase !== 'lobby' && room.phase === 'lobby') { $('#overlay').innerHTML = ''; S.call = null; }
    route();
    if (S.view === 'desktop') {
      if (isOpen('chat')) { renderChans(); renderMembers(); }
      if (S.callsTab === 'call' && !S.call) renderStage(null, true);
    }
  });

  Net.on('me', (me) => {
    const prev = S.me;
    S.me = me;
    if (prev && prev.isAdmin !== me.isAdmin && isOpen('chat')) renderChat();
    if (prev && prev.mutedUntil !== me.mutedUntil && isOpen('chat') && S.chan === 'global') renderChatMain();
    if (!S.call || !me.call || S.call.id !== me.call.id || S.call.status !== me.call.status) {
      if (me.call || (S.call && S.call.status !== 'done')) onCall(me.call);
    }
    if (S.room) route();
  });

  Net.on('call', (call) => onCall(call));

  Net.on('history', (h) => {
    S.chat.global = h.global || []; S.chat.lb = h.lb || []; S.chat.help = h.help || [];
    if (h.tickets) S.tickets = h.tickets;
    if (h.ticketMsgs) S.ticketMsgs = h.ticketMsgs;
    if (isOpen('chat')) renderChat();
  });

  Net.on('chat', ({ channel, msg }) => pushChat(channel, msg));
  Net.on('lb', (msg) => pushChat('lb', msg));
  Net.on('help', ({ ticketId, msg }) => {
    if (ticketId === S.me?.id && !S.me.isAdmin) return pushChat('help', msg);
    if (S.me?.isAdmin) {
      (S.ticketMsgs[ticketId] = S.ticketMsgs[ticketId] || []).push(msg);
      if (isOpen('chat') && S.chan === 'help' && S.ticketOpen === ticketId) {
        const box = $('#msgs'); if (box) { box.insertAdjacentHTML('beforeend', msgHtml(msg)); box.scrollTop = box.scrollHeight; }
      }
      if (msg.from.role === 'player') {
        sfx('msg');
        if (!(isOpen('chat') && S.chan === 'help')) toast(`<span class="ta">🆘</span><span class="tt"><b>${esc(msg.from.name)}</b><br>${esc(msg.text.slice(0, 80))}</span>`, { onClick: () => { openWin('chat'); S.chan = 'help'; S.ticketOpen = ticketId; renderChat(); } });
      }
    }
  });
  Net.on('tickets', (list) => {
    const prevOpen = S.ticketOpen && S.tickets.find((x) => x.id === S.ticketOpen);
    S.tickets = list;
    if (isOpen('chat') && S.chan === 'help') {
      const now = list.find((x) => x.id === S.ticketOpen);
      // Re-render ticket header when its claim state changes; queue whenever visible.
      if (!S.ticketOpen || !now || !prevOpen || prevOpen.adminId !== now.adminId || prevOpen.aiAnswer !== now.aiAnswer) renderChatMain();
    }
    if (isOpen('chat')) renderChans();
    updateIcons();
  });
  Net.on('gameover', (d) => { S.gameover = d; renderOverlays(); });
  Net.on('kicked', () => { Net.saveSession(null); S.kicked = true; route(); });
  Net.on('session:lost', (r) => {
    S.room = null; S.me = null;
    if (r.error === 'kicked') { S.kicked = true; return route(); }
    S.homeErr = errText(r.error === 'bad_session' ? 'room_not_found' : r.error);
    route();
  });
  Net.on('ready', () => { if (!S.room) route(); });

  // ───────────────────────── ticking ─────────────────────────
  setInterval(() => {
    if (S.view !== 'desktop') return;
    tickTimer();
    const c = S.call;
    if (c && c.status === 'active' && c.kind !== 'regular' && c.kind !== 'heart') {
      renderStage();
      const bar = $('#g-bar'); const cnt = $('#g-count');
      if (bar) bar.style.width = Math.min(100, (elapsed(c) / talkOf(c)) * 100) + '%';
      if (cnt) cnt.textContent = `${t('listen')} ${Math.max(0, Math.ceil((talkOf(c) - elapsed(c)) / 1000))}s`;
    }
    const clk = $('#tb-clock'); if (clk) clk.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (S.me?.mutedUntil && S.me.mutedUntil < Net.serverNow() && S.chan === 'global' && $('.muted-note')) renderChatMain();
  }, 250);

  window.addEventListener('resize', () => {
    const ws = $('#ws'); if (!ws) return;
    for (const w of Object.values(S.wins)) {
      if (!w.el) continue;
      const maxX = ws.clientWidth - 80, maxY = ws.clientHeight - 40;
      if (w.el.offsetLeft > maxX) w.el.style.left = Math.max(0, maxX) + 'px';
      if (w.el.offsetTop > maxY) w.el.style.top = Math.max(0, maxY) + 'px';
    }
  });

  // debug hook for automated tests
  window.__medios = { S, openWin };

  applySettings();
  renderHome();
  Net.connect();
})();
