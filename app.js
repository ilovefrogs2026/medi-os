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
    unread: { global: 0, help: 0, lb: 0, dm: 0, notes: 0 }, showMembers: false,
    call: null, callsTab: 'call', mdaTab: 'file', mdaFile: null, launching: false, pollsOpen: false, endKey: '', ringing: false, tasksOpenedFor: null, notes: [], notesSeen: 0, dms: {}, dmOpen: null, helpStarting: false, typedFor: null, renderedKey: '',
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
    else if (phase === 'over' && S.room.end && (S.pollsOpen || S.room.end.stage !== 'feedback')) renderEnd(force);
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
        <div class="field"><label>${t('game_mode')}</label><div class="mode-fixed">❤ ${t('mode_heart')}</div><div class="dim" style="font-size:.8rem">${t('mode_heart_only_d')}</div></div>
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
    settings: { icon: '⚙', cls: 'settings', title: () => t('app_settings'), w: 440, h: 560, render: renderSettings },
    tasks: { icon: '☑', cls: 'tasks', title: () => t('app_tasks'), w: 360, h: 300, render: renderTasks }
  };
  const LOCKED_AFTER_END = ['calls', 'mda', 'tasks'];
  const appLocked = (id) => S.room && S.room.phase === 'over' && LOCKED_AFTER_END.includes(id);

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
    if (appLocked(id)) { sfx('error'); toast(`<span class="ta">🔒</span><span class="tt">${t('app_locked')}</span>`); return; }
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
    $('[data-w=min]', el).onclick = (e) => { e.stopPropagation(); el.classList.add('min'); sfx('close'); renderTaskbar(); updateRing(); };
    dragify(el, $('.wbar', el));
    focusWin(id);
    if (!silent) sfx('open');
    a.render(w.body);
    renderTaskbar();
  }

  function closeWin(id) {
    const w = S.wins[id]; if (!w) return;
    w.el.remove(); S.wins[id] = { open: false }; sfx('close'); renderTaskbar(); updateRing();
  }
  function updateRing() {
    const want = !!(S.view === 'desktop' && S.call && S.call.status === 'ringing' && isOpen('calls') && S.focused === 'calls');
    if (want !== S.ringing) { S.ringing = want; Audio8.ring(want); if (want && isTalker(S.call)) sfx('mystery'); }
  }
  function focusWin(id) {
    for (const [k, w] of Object.entries(S.wins)) if (w.el) w.el.classList.toggle('focused', k === id);
    const w = S.wins[id]; if (w?.el) w.el.style.zIndex = ++S.z;
    S.focused = id;
    if (id === 'chat') { S.unread[S.chan] = 0; updateIcons(); }
    renderTaskbar();
    updateRing();
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
    const limMap = { calls: 'calls', mda: 'mda', chat: 'chat' };
    $$('.dicon').forEach((el) => { const ab = limMap[el.dataset.app]; el.classList.toggle('limited', !!(ab && limitUntil(ab))); });
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
    if (S.mdaTab === 'file' && limitUntil('mda')) {
      inner = `<div class="muted-note" style="border-radius:10px">⛔ ${limitText(limitUntil('mda'))}</div>`;
    } else if (S.mdaTab === 'file') {
      const c = S.call; const ch = charOf(c);
      const live = c && c.kind === 'heart' && c.status === 'active';
      const hint = !live ? t('file_no_patient') : c.stage === 'talk' ? t('file_ask_first', { name: tc(ch.name) }) : c.stage === 'fund' ? t('file_type_number', { name: tc(ch.name) }) : t('file_opened');
      const f = S.mdaFile;
      inner = `<form class="file-search" id="file-form" autocomplete="off">
          <label for="file-num">${t('fund_number')}</label>
          <div class="file-row"><input class="input code" id="file-num" inputmode="numeric" maxlength="9" placeholder="0000000"><button class="btn primary">${t('file_search')}</button></div>
          <div class="dim" style="font-size:.85rem">${esc(hint)}</div><div class="err" id="file-err"></div>
        </form>
        ${f ? `<article class="file-card">
          <header><span class="fa">${Voxel.html(f.charId, { size: 56, mood: 'worried' })}</span><div><b>${esc(tc(f.name))}</b><div class="mono dim">${t('fund_number')}: ${esc(f.fund)}</div></div><span class="badge admin">${t('file_badge')}</span></header>
          ${f.card ? `<dl class="card-grid"><dt>${t('card_age')}</dt><dd>${esc(tc(f.card.age))}</dd><dt>${t('card_job')}</dt><dd>${esc(tc(f.card.job))}</dd><dt>${t('card_history')}</dt><dd>${esc(tc(f.card.history))}</dd></dl>` : ''}
          <h4>${t('file_problem')}</h4><p class="file-q">${esc(tc(f.text))}</p>
          ${f.goal ? `<h4>${t('file_task')}</h4><p>${esc(tc(f.goal))}</p>` : ''}
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
      if (S.call && S.call.kind === 'heart' && S.call.stage === 'fund') { inp.value = ''; setTimeout(() => inp.focus(), 50); }
      form.onsubmit = async (e) => {
        e.preventDefault();
        const r = await Net.request('mda:lookup', { number: inp.value });
        if (r.error) { sfx('error'); $('#file-err', body).textContent = errText(r.error); return; }
        sfx('success'); S.mdaFile = r.file; renderMda(body);
      };
    }
    const back = $('[data-back-call]', body); if (back) back.onclick = () => openWin('calls');
  }

  // ───────────────────────── Tasks app ─────────────────────────
  function tasksHtml(c) {
    return HT.TASKS.map((tk) => {
      const done = !!(c && c.tasks && c.tasks[tk.id]);
      const text = tk.id === 'goal' ? (c && c.goal ? tc(c.goal) : t('task_goal_wait')) : tc(tk);
      const prog = tk.id === 'goal' && c && c.need > 1 && !done ? `<span class="tprog">${Array.from({ length: c.need }, (_, i) => `<i class="${i < c.progress ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<li class="task-item ${done ? 'done' : ''} ${tk.id === 'file' ? 'tip' : ''} ${tk.id === 'goal' ? 'goal' : ''}"><span class="tbox">${done ? '✔' : ''}</span><span>${esc(text)}</span>${prog}</li>`;
    }).join('');
  }
  function renderTasks(body) {
    if (!body) { const w = S.wins.tasks; if (!w || !w.el) return; body = w.body; }
    const c = S.call; const live = c && c.kind === 'heart' && c.status !== 'ringing';
    body.innerHTML = `<div class="tasks-app"><div class="dim" style="font-size:.85rem;margin-bottom:8px">${live ? esc(tc(charOf(c).name)) : t('tasks_none')}</div>
      <ul class="task-list">${tasksHtml(live ? c : null)}</ul></div>`;
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
  // Facial expression for the caller: talking right after a new line, happy/sad at the end, worried while the problem is open
  function moodOf(c) {
    if (!c) return 'idle';
    if (c.status === 'done') return c.result && (c.result.correct || c.result.kind === 'boost' || c.result.kind === 'planet') ? 'happy' : 'sad';
    if (S.talkUntil && Date.now() < S.talkUntil && S.talkFor === c.id) return 'talk';
    if (isTalker(c)) return 'talk';
    if (c.kind === 'heart') return c.noProgressShown ? 'worried' : c.stage === 'file' ? 'worried' : 'idle';
    return 'idle';
  }
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
    if (c.kind === 'heart') k += `|${c.stage}|${c.tries}|${(c.chat || []).length}|${(c.talk || []).length}|${c.result ? 1 : 0}`;
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
      const vid = c.kind === 'george' ? 'h_george' : ch.id;
      const crown = ch.id === 'legendary_george' || ch.id === 'h_legend';
      return `<div class="avatar vox-holder ${ring ? 'ring' : ''} ${crown ? 'crowned' : ''}" style="--rc:${isG || isNoob ? '#6a7bff' : rc(ch)};${isG ? 'background:#05060d' : ''}">${crown ? '<span class="legend-rays"></span>' : ''}${Voxel.html(vid, { mood: ring ? 'ring' : moodOf(c), size: 112 })}</div>`;
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

  function talkLine(m) {
    return m.who === 'player' ? `<div class="line me-line">🧑‍⚕️ ${esc(m.text)}</div>` : `<div class="line patient-reply">💬 ${esc(tc(m))}</div>`;
  }
  function renderHeart(stage, c, ch, head, stars) {
    const done = c.status === 'done';
    const res = c.result;
    const tag = (n, boost) => `<div class="reward-chip">[${t('reward_tag')}: ${n.toLocaleString('en-US')} ${t('coins')}${boost ? ' / ' + t('bonus') : ''}]</div>`;
    let html = `${stars}${head(false)}`;
    if (done) {
      if (res.correct) {
        html += `<div class="result good">${t('heart_saved')}</div><div class="delta plus">+${money(res.delta)}</div>
          <div class="line ok-line">${esc(res.aiReply || tc(byIdOk(c)) || '')}</div>${tag(res.delta, res.booster)}`;
      } else {
        html += `<div class="result bad">${res.hungUp ? t('heart_hung') : t('heart_failed')}</div><div class="dim">${t('heart_no_reward')}</div>`;
      }
      html += `<div class="stage-title" style="font-size:1.2rem">${res.world === 'planet' ? t('back_earth') : res.world === 'minecraft' ? t('back_earth_mc') : t('next_call_soon')}</div>`;
      stage.innerHTML = html;
      return;
    }
    html += `<ul class="task-list inline">${tasksHtml(c)}</ul>`;
    const lim = limitUntil('calls');
    if (lim) { stage.innerHTML = html + `<div class="muted-note">⛔ ${limitText(lim)}</div>`; return; }
    html += `<div class="talk">${c.talk.length ? c.talk.map(talkLine).join('') : `<div class="dim talk-empty">${t('you_write_first')}</div>`}</div>`;
    if (c.stage === 'file') html += `<div class="file-mini"><b>📁 ${t('file_problem')}:</b> ${esc(tc(c.file))}</div>`;
    const presets = c.stage === 'file' ? [] : HT.PRESETS.filter((pr) => !c.tasks[pr.task]);
    html += `${presets.length ? `<div class="presets talk-presets">${presets.map((pr) => `<button class="preset" data-pr="${pr.id}">${esc(tc(pr))}</button>`).join('')}</div>` : ''}
      <form class="composer" id="h-say" style="border:none;padding:6px 0 0;width:100%;max-width:560px"><input class="input" id="h-say-in" maxlength="300" placeholder="${c.stage === 'file' ? t('guide_ph') : t('say_ph')}" autocomplete="off"><button class="btn primary">${t('send')}</button></form>`;
    if (c.stage === 'fund') html += `<div class="fund-box"><span>${t('fund_number')}:</span> <b class="mono fund-no">${esc(c.fund)}</b></div>
        <button class="btn info big" id="h-mda">✚ ${t('open_mda_file')}</button>`;
    if (c.stage === 'file') html += `<div class="dim" style="font-size:.8rem;margin-top:4px">${t('patience_left', { n: Math.max(0, c.patience) })} · ${t('reward')}: ${money(ch.reward)}</div>`;
    html += `<button class="btn small danger" id="h-hang" style="margin-top:10px">☎ ${t('hang_up')}</button>`;
    stage.innerHTML = html;
    const say = async (payload) => { const r = await Net.request('call:say', { callId: c.id, ...payload }); if (r.error) toastErr(r.error); else sfx('msg'); return r; };
    $$('[data-pr]', stage).forEach((b) => b.onclick = () => { $$('[data-pr]', stage).forEach((x) => (x.disabled = true)); say({ presetId: b.dataset.pr }); });
    const sf = $('#h-say'); if (sf) {
      const inp = $('#h-say-in'); if (window.innerWidth > 760) setTimeout(() => inp.focus(), 30);
      sf.onsubmit = async (e) => { e.preventDefault(); const text = inp.value.trim(); if (!text) return; inp.disabled = true; const r = await say({ text }); if (r.error) inp.disabled = false; };
    }
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
    const talk = $('.talk', stage); if (talk) talk.scrollTop = talk.scrollHeight;
    stage.scrollTop = stage.scrollHeight;
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
        <span class="ia vox-ia">${Voxel.html(ch.id, { size: 64, mood: known ? 'idle' : 'idle' })}</span><span class="in">${esc(tc(ch.name))}</span>
        <span class="ib">${known ? esc(tc(ch.bio)) : t('locked')}</span>${ch.card ? `<span class="ib">${esc(tc(ch.card.age))} · ${esc(tc(ch.card.job))}</span>` : ch.id === 'h_noob' ? `<span class="ib">3 · ${esc(t('noob_job'))}</span>` : ch.id === 'h_george' ? `<span class="ib">∞ · ${esc(t('george_job'))}</span>` : ''}
        <span class="ic">${t('chance')} ${odds}% · ${ch.reward ? money(ch.reward) : ch.boost ? '+' + money(ch.boost) : ch.world === 'minecraft' ? '▦' : '🪐'}</span></div>`;
    };
    return `<div class="index" style="width:100%">
      ${HT.CAST.length ? `<h3>${t('heart_callers')}</h3><div class="igrid">${HT.CAST.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('mc_callers')}</h3><div class="igrid">${HT.MINECRAFT.map((c) => card(c, c.weight)).join('')}</div>
      <h3>${t('planet_callers')} · ${t('research')}</h3><div class="igrid">${HT.PLANET.map((c) => card(c, c.weight)).join('')}</div>` : ''}</div>`;
  }

  function onCall(call) {
    const prev = S.call;
    S.call = call;
    if (call && call.kind === 'heart' && call.talk && (!prev || prev.id !== call.id || (prev.talk || []).length < call.talk.length) && call.talk.length && call.talk[call.talk.length - 1].who === 'patient') {
      S.talkUntil = Date.now() + 2400; S.talkFor = call.id;
      clearTimeout(S.talkTimer); S.talkTimer = setTimeout(() => { if (S.callsTab === 'call') renderStage(null, true); }, 2500);
    }
    if (call && (!prev || prev.id !== call.id) && call.status === 'ringing') {
      if (!isOpen('calls') || S.focused !== 'calls') { // silent outside the Calls app

        const ch = charOf(call);
        toast(`<span class="ta">${Voxel.html(call.kind === 'george' ? 'h_george' : call.charId, { size: 40, mood: 'ring' })}</span><span class="tt"><b>${t('incoming')}</b><br>${isTalker(call) ? t('unknown_caller') : esc(tc(ch.name))}</span><span class="btn small info">${t('open')}</span>`,
          { cls: 'call', ms: 6000, onClick: () => openWin('calls') });
      }
    }
    updateRing();
    // Tasks app comes up for heart calls (desktop); the call screen also shows the tasks
    if (call && call.kind === 'heart' && call.status === 'active' && S.tasksOpenedFor !== call.id) {
      S.tasksOpenedFor = call.id;
      if (window.innerWidth > 760 && !isOpen('tasks')) { openWin('tasks', null, true); focusWin('calls'); }
    }
    if (isOpen('tasks')) renderTasks();
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
  const CHANNELS_ALL = [
    { id: 'help', icon: '?', name: () => t('ch_help'), desc: () => t('ch_help_d') },
    { id: 'lb', icon: '#', name: () => t('ch_lb'), desc: () => t('ch_lb_d') },
    { id: 'global', icon: '#', name: () => t('ch_global'), desc: () => t('ch_global_d') },
    { id: 'dm', icon: '✉', name: () => t('ch_dm'), desc: () => (S.me?.isHost ? t('ch_dm_host_d') : t('ch_dm_d')), show: () => S.me?.isHost || Object.keys(S.dms).length > 0 },
    { id: 'notes', icon: '!', name: () => t('ch_notes'), desc: () => t('ch_notes_d'), show: () => !!S.me?.isAdmin }
  ];
  const channels = () => CHANNELS_ALL.filter((c) => !c.show || c.show());

  function renderChat(body) {
    if (!body) { const w = S.wins.chat; if (!w || !w.el) return; body = w.body; }
    if (!channels().some((c) => c.id === S.chan)) S.chan = 'global';
    body.innerHTML = `<div class="dchat ${S.showMembers ? 'with-members' : ''}" id="dchat">
      <aside class="dside"><h4>DisChat · ${esc(S.room?.code)}</h4><div id="chans" style="display:contents"></div></aside>
      <section class="dmain" id="dmain"></section>
      ${S.showMembers ? '<aside class="dmembers" id="dmembers"></aside>' : ''}
    </div>`;
    renderChans(); renderChatMain(); renderMembers();
  }

  function renderChans() {
    const el = $('#chans'); if (!el) return;
    el.innerHTML = channels().map((c) => {
      let n = S.unread[c.id] || 0;
      if (c.id === 'help' && S.me?.isAdmin) n = S.tickets.filter((x) => x.open && !x.adminId).length;
      const crit = c.id === 'notes' && S.notes.some((x) => x.severity === 'critical' && x.ts > (S.notesSeen || 0));
      return `<button class="chan ${S.chan === c.id ? 'on' : ''} ${crit ? 'crit' : ''}" data-ch="${c.id}"><span class="hash">${c.icon}</span><span class="cn">${esc(c.name())}</span>${n ? `<span class="unread">${n}</span>` : ''}</button>`;
    }).join('') + `<button class="chan" data-members style="margin-top:auto"><span class="hash">☺</span><span class="cn">${t('members')} (${S.room?.players.length || 0})</span></button>`;
    $$('[data-ch]', el).forEach((b) => b.onclick = () => { S.chan = b.dataset.ch; S.unread[S.chan] = 0; S.ticketOpen = null; if (S.chan === 'notes') S.notesSeen = Date.now(); sfx('click'); renderChans(); renderChatMain(); updateIcons(); });
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
      case 'resolved': return t('ev_resolved');
      case 'join': return t('ev_join', ev);
      case 'start': return t('ev_start');
      case 'polls': return t('ev_polls');
      case 'muted': return t('ev_muted', ev);
      case 'unmuted': return t('ev_unmuted', ev);
      case 'kicked': return t('ev_kicked', ev);
      case 'rare': { const ch = ALL_CHARS[ev.charId]; return t('ev_rare', { player: ev.player, char: ch ? tc(ch.name) : '', delta: money(ev.delta) }); }
      default: return '';
    }
  }

  function msgHtml(m) {
    if (m.from.role === 'system') {
      if (m.event && m.event.type === 'polls') return `<div class="msg sys rare">${esc(evText(m.event))}<br><button class="btn primary" data-open-polls style="margin-top:6px">📊 ${t('open_polls')}</button></div>`;
      const txt = m.event ? evText(m.event) : m.text;
      return `<div class="msg sys ${m.event?.type === 'rare' ? 'rare' : ''}">${esc(txt)}</div>`;
    }
    const time = new Date(m.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const badge = m.from.role === 'bot' ? `<span class="badge ai">AI</span>` : m.from.role === 'host' ? `<span class="badge host">${t('host')}</span>` : m.from.role === 'admin' ? `<span class="badge admin">${t('admin')}</span>` : '';
    const mine = m.from.id === S.me?.id;
    const av = m.from.id === 'botgeorge' ? Voxel.html('h_george', { size: 32, mood: 'idle' }) : m.from.role === 'bot' ? '🤖' : esc(m.from.name.slice(0, 1).toUpperCase());
    return `<div class="msg ${m.from.role === 'bot' ? 'bot' : ''} ${mine ? 'mine' : ''}">
      <span class="mav ${m.from.id === 'botgeorge' ? 'vmav' : ''}" style="background:${roleColor(m.from)}">${av}</span>
      <div><div class="mh"><span class="mn" style="color:${mine ? '' : roleColor(m.from)}">${esc(m.from.name)}</span>${badge}<span class="mt">${time}</span></div>
      <div class="mb">${esc(m.text)}</div></div></div>`;
  }

  // ── Notes (anti-cheat alerts) ──
  function noteHtml(n) {
    const s2 = n.snapshot || {}; const tm = new Date(n.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const idle = s2.idleSec >= 60 ? t('idle_min', { n: Math.round(s2.idleSec / 60) }) : t('idle_sec', { n: s2.idleSec || 0 });
    const lim = Object.entries(s2.limits || {}).filter(([, v]) => v > Net.serverNow()).map(([k]) => t('lim_' + k)).join(', ');
    const det = n.details ? Object.entries(n.details).map(([k, v]) => `<span class="mono">${esc(k)}: ${esc(v)}</span>`).join(' · ') : '';
    return `<article class="note sev-${n.severity}" data-note="${n.id}">
      <header><span class="nsev">${t('sev_' + n.severity)}</span><b>${esc(n.name)}</b>${n.count > 1 ? `<span class="badge flag">×${n.count}</span>` : ''}<span class="mono dim">${tm}</span></header>
      <p class="ntext">${esc(tc(n.text))}</p>${det ? `<p class="ndet">${det}</p>` : ''}
      <dl class="nsnap">
        <dt>${t('snap_now')}</dt><dd>${s2.call ? `☎ ${esc(tc(s2.call.char) || '')} · ${esc(s2.call.stage || s2.call.status)}` : s2.app ? esc(t('app_' + s2.app) || s2.app) : '—'}</dd>
        <dt>${t('snap_state')}</dt><dd>${money(s2.money)} · #${s2.rank}/${s2.of} · ${s2.stats ? `${s2.stats.correct}/${s2.stats.answered}` : ''}</dd>
        <dt>${t('snap_active')}</dt><dd>${s2.connected ? (s2.idleSec < 60 ? '🟢 ' + t('active') : '🟡 ' + t('not_active')) : '🔴 ' + t('offline_short')} · ${t('idle_for')} ${idle}</dd>
        ${lim ? `<dt>${t('snap_limits')}</dt><dd>${esc(lim)}</dd>` : ''}
      </dl>
      <div class="macts"><button class="btn small" data-hist="${n.playerId}">📜 ${t('history')}</button>${S.me?.isHost ? `<button class="btn small warn" data-limit="${n.playerId}">⛔ ${t('limit')}</button><button class="btn small info" data-dmto="${n.playerId}">✉ ${t('ch_dm')}</button>` : ''}<button class="btn small danger" data-kick="${n.playerId}">${t('kick')}</button></div>
    </article>`;
  }

  function renderChatMain() {
    const main = $('#dmain'); if (!main) return;
    const ch = channels().find((c) => c.id === S.chan) || CHANNELS_ALL[2];
    const admin = S.me?.isAdmin;
    let html = `<div class="dhead"><span class="ttl">${ch.icon === '?' ? '❓' : ch.icon === '!' ? '⚠' : ch.icon === '✉' ? '✉' : '#'} ${esc(ch.name())}</span><span class="sub">${esc(ch.desc())}</span></div>`;

    if (S.chan === 'notes') {
      const list = [...S.notes].sort((a, b) => (b.severity === 'critical') - (a.severity === 'critical') || b.ts - a.ts);
      main.innerHTML = html + `<div class="tq notes">${list.length ? list.map(noteHtml).join('') : `<div class="welcome">${t('no_notes')}</div>`}</div>`;
      bindAdminButtons(main); bindHostButtons(main);
      $$('[data-kick]', main).forEach((b) => b.onclick = async () => { const r = await Net.request('mod:kick', { targetId: b.dataset.kick }); if (r.error) toastErr(r.error); });
      return;
    }

    if (S.chan === 'dm' && S.me?.isHost && !S.dmOpen) {
      const others = (S.room?.players || []).filter((p) => p.id !== S.me.id && !p.bot);
      main.innerHTML = html + `<div class="tq">${others.map((p) => `<button class="ticket" data-dmopen="${p.id}"><div class="th"><b>${esc(p.name)}</b>${(S.dms[p.id] || []).length ? `<span class="badge admin">${(S.dms[p.id] || []).length}</span>` : ''}</div><div class="dim" style="font-size:.8rem">${(S.dms[p.id] || []).length ? esc((S.dms[p.id].slice(-1)[0] || {}).text || '') : t('dm_start')}</div></button>`).join('') || `<div class="welcome">${t('no_players')}</div>`}</div>`;
      $$('[data-dmopen]', main).forEach((b) => b.onclick = () => { S.dmOpen = b.dataset.dmopen; renderChatMain(); });
      return;
    }

    if (S.chan === 'help' && admin && !S.ticketOpen) {
      html += `<div class="tq">${S.tickets.length ? S.tickets.map((tk) => `<button class="ticket ${tk.adminId ? 'claimed' : ''} ${tk.priority && tk.open ? 'prio' : ''} ${!tk.open ? 'done' : ''}" data-tk="${tk.id}">
          <div class="th"><b>${esc(tk.playerName)}</b>${tk.priority && tk.open ? `<span class="badge flag">⬆ ${t('wants_manager')}</span>` : ''}<span class="badge ${!tk.open ? 'admin' : tk.adminId ? 'admin' : 'flag'}">${!tk.open ? (tk.resolved ? '✓ ' + t('resolved') : t('closed')) : tk.adminId ? `${t('handled_by')} ${esc(tk.adminName)}` : 'NEW'}</span></div>
          <div class="tsum">“${esc(tk.summary || '…')}”</div>
          ${tk.category ? `<div class="dim" style="font-size:.78rem">${t('category')}: ${esc(tc(tk.category))}</div>` : ''}</button>`).join('') : `<div class="welcome">${t('no_tickets')}</div>`}</div>`;
      main.innerHTML = html;
      $$('[data-tk]', main).forEach((b) => b.onclick = () => { S.ticketOpen = b.dataset.tk; sfx('open'); renderChatMain(); });
      return;
    }

    let list = []; let welcome = ''; let foot = ''; let canWrite = true;
    if (S.chan === 'global') list = S.chat.global;
    if (S.chan === 'lb') { list = S.chat.lb; welcome = t('lb_welcome'); }
    if (S.chan === 'dm') {
      const pid = S.me?.isHost ? S.dmOpen : S.me?.id;
      list = S.dms[pid] || [];
      if (S.me?.isHost) html += `<div class="tactions"><button class="btn small ghost" data-dmback>${t('back_queue')}</button><b>${esc(playerName(pid))}</b></div>`;
    }
    const tk = S.chan === 'help' && admin ? S.tickets.find((x) => x.id === S.ticketOpen) : null;
    if (S.chan === 'help') {
      if (admin) {
        if (!tk) { S.ticketOpen = null; return renderChatMain(); }
        list = S.ticketMsgs[tk.id] || [];
        const mine = tk.adminId === S.me.id;
        html += `<details class="tinfo" ${mine ? '' : 'open'}><summary>ℹ ${t('ticket_summary')} · ${esc(tk.playerName)}</summary><dl><dt>${t('ticket_summary')}</dt><dd>${esc(tk.summary || '…')}</dd>
          <dt>${t('ai_answered')}</dt><dd>${esc(tk.aiAnswer || '…')}</dd>
          ${tk.category ? `<dt>${t('how_handle')} · ${esc(tc(tk.category))}</dt><dd>${esc(tc(tk.howTo))}</dd>` : ''}</dl></details>
          <div class="tactions"><button class="btn small ghost" data-tq>${t('back_queue')}</button>
          ${!tk.open ? `<span class="badge admin">${tk.resolved ? '✓ ' + t('resolved') : t('closed')}</span>` : !tk.adminId ? `<button class="btn small primary" data-claim>${t('join_chat')}</button>` : mine ? `<button class="btn small warn" data-release>${t('leave_chat')}</button>` : `<span class="badge admin">${t('handled_by')} ${esc(tk.adminName)}</span>`}
          ${tk.open ? `<button class="btn small danger" data-close>${t('close_ticket')}</button>` : ''}</div>`;
        canWrite = tk.open && !(tk.adminId && tk.adminId !== S.me.id);
      } else {
        const H2 = S.me?.help;
        list = S.chat.help;
        if (!H2) { if (!S.helpStarting) { S.helpStarting = true; S.chat.help = []; Net.request('help:start', {}).then((r) => { S.helpStarting = false; if (r.error) toastErr(r.error); }); } canWrite = false; }
        else if (!H2.open) {
          canWrite = false;
          foot = `<div class="ticket-closed">✅ ${H2.resolved ? t('ticket_resolved') : t('ticket_closed')}<button class="btn primary small" data-newticket>${t('new_ticket')}</button></div>`;
        } else {
          const last = list[list.length - 1];
          if (last && last.from.id === 'botgeorge' && last.actions) foot = `<div class="bot-actions"><button class="btn small warn" data-hact="manager">🙋 ${t('act_manager')}</button><button class="btn small info" data-hact="continue">💬 ${t('act_continue')}</button><button class="btn small primary" data-hact="helped">✅ ${t('act_helped')}</button></div>`;
          if (H2.priority) foot += `<div class="dim" style="padding:2px 12px;font-size:.8rem;display:flex;align-items:center;gap:8px;justify-content:space-between">⬆ ${t('waiting_manager')}${foot ? '' : `<button class="btn small primary" data-hact="helped">✅ ${t('act_helped')}</button>`}</div>`;
        }
      }
    }
    const lim = (S.chan === 'global' || S.chan === 'lb') ? limitUntil('chat') : S.chan === 'help' ? limitUntil('help') : 0;
    html += `<div class="msgs" id="msgs">${welcome ? `<div class="welcome">${welcome}</div>` : ''}${list.map(msgHtml).join('')}</div>${foot}`;
    if (S.chan === 'lb') html += `<div class="presets">${CT.LB_PRESETS.map((p) => `<button class="preset" data-preset="${p.id}">${esc(tc(p))}</button>`).join('')}</div>`;
    const muted = S.chan === 'global' && S.me && S.me.mutedUntil > Net.serverNow();
    if (lim) html += `<div class="muted-note">⛔ ${limitText(lim)}</div>`;
    else if (muted) html += `<div class="muted-note">🔇 ${t('you_muted')} ${new Date(S.me.mutedUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>`;
    else html += `<form class="composer" id="composer"><input class="input" id="c-input" maxlength="300" placeholder="${t('type_msg')}" autocomplete="off" ${canWrite ? '' : 'disabled'}><button class="btn primary" ${canWrite ? '' : 'disabled'}>${t('send')}</button></form>`;
    main.innerHTML = html;
    const msgs = $('#msgs'); msgs.scrollTop = msgs.scrollHeight;

    const send = async (payload) => {
      const r = await Net.request(S.chan === 'dm' ? 'dm:send' : 'chat:send', payload);
      if (r.error) toastErr(r.error); else sfx('click');
      return r;
    };
    const comp = $('#composer');
    if (comp) comp.onsubmit = async (e) => {
      e.preventDefault();
      const inp = $('#c-input'); const text = inp.value.trim(); if (!text) return;
      const payload = S.chan === 'dm' ? { text, targetId: S.me?.isHost ? S.dmOpen : undefined } : { channel: S.chan, text };
      if (tk) payload.ticketId = tk.id;
      inp.value = '';
      const r = await send(payload);
      if (r.error) inp.value = text;
      inp.focus();
    };
    $$('[data-preset]', main).forEach((b) => b.onclick = () => send({ channel: 'lb', presetId: b.dataset.preset }));
    $$('[data-hact]', main).forEach((b) => b.onclick = async () => { $$('[data-hact]', main).forEach((x) => (x.disabled = true)); const r = await Net.request('help:action', { action: b.dataset.hact }); if (r.error) toastErr(r.error); else sfx(b.dataset.hact === 'helped' ? 'success' : 'click'); });
    const nt = $('[data-newticket]', main); if (nt) nt.onclick = async () => { S.chat.help = []; const r = await Net.request('help:start', {}); if (r.error) toastErr(r.error); renderChatMain(); };
    const db = $('[data-dmback]', main); if (db) db.onclick = () => { S.dmOpen = null; renderChatMain(); };
    const bq = $('[data-tq]', main); if (bq) bq.onclick = () => { S.ticketOpen = null; renderChatMain(); };
    const cl = $('[data-claim]', main); if (cl) cl.onclick = async () => { const r = await Net.request('help:claim', { ticketId: tk.id }); if (r.error) toastErr(r.error); };
    const rl = $('[data-release]', main); if (rl) rl.onclick = async () => { const r = await Net.request('help:release', { ticketId: tk.id }); if (r.error) toastErr(r.error); else { S.ticketOpen = null; renderChatMain(); } };
    const cs = $('[data-close]', main); if (cs) cs.onclick = async () => { const r = await Net.request('help:close', { ticketId: tk.id }); if (r.error) toastErr(r.error); else { S.ticketOpen = null; } };
  }

  // ── host restrictions ──
  function limitUntil(ab) { const l = S.me?.limits || {}; const n = Net.serverNow(); const v = Math.max(l[ab] || 0, l.all || 0); return v > n ? v : 0; }
  function limitText(until) { return until >= Number.MAX_SAFE_INTEGER - 1 ? t('limited_end') : t('limited_until', { time: new Date(until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }); }
  function showLimit(id) {
    const ov = openModal(`<h2>⛔ ${t('limit')} · ${esc(playerName(id))}</h2>
      <div class="field"><label>${t('limit_what')}</label><div class="chips">${['calls', 'chat', 'mda', 'help', 'all'].map((a, i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-lab="${a}">${t('lim_' + a)}</button>`).join('')}</div></div>
      <div class="field"><label>${t('limit_for')}</label><div class="chips">${[[2, '2 ' + t('minutes')], [5, '5 ' + t('minutes')], [15, '15 ' + t('minutes')], [-1, t('until_end')]].map(([m, l], i) => `<button type="button" class="chip ${i === 1 ? 'on' : ''}" data-lmin="${m}">${l}</button>`).join('')}</div></div>
      <div class="file-row"><button class="btn danger" data-lapply>⛔ ${t('limit_apply')}</button><button class="btn" data-lclear>${t('limit_remove')}</button></div>`);
    let ab = 'calls', min = 5;
    $$('[data-lab]', ov).forEach((b) => b.onclick = () => { ab = b.dataset.lab; $$('[data-lab]', ov).forEach((x) => x.classList.toggle('on', x === b)); });
    $$('[data-lmin]', ov).forEach((b) => b.onclick = () => { min = Number(b.dataset.lmin); $$('[data-lmin]', ov).forEach((x) => x.classList.toggle('on', x === b)); });
    const go = async (m) => { const r = await Net.request('admin:limit', { targetId: id, ability: ab, minutes: m }); if (r.error) return toastErr(r.error); sfx('click'); toast(`<span class="ta">⛔</span><span class="tt">${m === 0 ? t('limit_removed') : t('limit_done')}</span>`); closeModal(); };
    $('[data-lapply]', ov).onclick = () => go(min);
    $('[data-lclear]', ov).onclick = () => go(0);
  }
  function bindHostButtons(root) {
    $$('[data-limit]', root).forEach((b) => b.onclick = () => showLimit(b.dataset.limit));
    $$('[data-dmto]', root).forEach((b) => b.onclick = () => { S.chan = 'dm'; S.dmOpen = b.dataset.dmto; closeModal(); openWin('chat'); renderChat(); });
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
            ${me.isHost ? `<button class="btn small info" data-promote="${p.id}">${p.isAdmin ? t('remove_admin') : t('make_admin')}</button>` : ''}</div>` : ''}
          ${me.isAdmin && !p.bot ? `<div class="macts"><button class="btn small" data-hist="${p.id}">📜 ${t('history')}</button><button class="btn small warn" data-money="${p.id}">${me.isHost ? '± ' + t('money_adjust') : '💡 ' + t('suggest')}</button></div>` : ''}
          ${me.isHost && p.id !== me.id && !p.bot ? `<div class="macts"><button class="btn small info" data-dmto="${p.id}">✉ ${t('ch_dm')}</button><button class="btn small danger" data-limit="${p.id}">⛔ ${t('limit')}</button></div>` : ''}</div>`;
      }).join('');
    $('[data-x]', el).onclick = () => { S.showMembers = false; renderChat(); };
    $$('[data-mute]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('mod:mute', { targetId: b.dataset.mute, minutes: Number(b.dataset.min) }); if (r.error) toastErr(r.error); });
    $$('[data-kick]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('mod:kick', { targetId: b.dataset.kick }); if (r.error) toastErr(r.error); });
    $$('[data-promote]', el).forEach((b) => b.onclick = async () => { const r = await Net.request('lobby:promote', { targetId: b.dataset.promote }); if (r.error) toastErr(r.error); });
    bindAdminButtons(el); bindHostButtons(el);
  }

  // ───────────────────────── manager tools (modal) ─────────────────────────
  function closeModal() { const m = $('#ov-admin'); if (m) m.remove(); }
  function openModal(inner) {
    closeModal();
    $('#overlay').insertAdjacentHTML('beforeend', `<div class="ov" id="ov-admin"><div class="modal admin-modal">${inner}<div style="text-align:end;margin-top:12px"><button class="btn ghost" data-close-modal>${t('close')}</button></div></div></div>`);
    const ov = $('#ov-admin');
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close-modal]')) closeModal(); });
    return ov;
  }
  function playerName(id) { const p = (S.room?.players || []).find((x) => x.id === id); return p ? p.name : ''; }
  async function showHistory(id) {
    const ov = openModal(`<h2>📜 ${t('history')} · ${esc(playerName(id))}</h2><div class="dim">${t('loading')}</div>`);
    const r = await Net.request('admin:history', { targetId: id, ai: true });
    if (!$('#ov-admin')) return;
    if (r.error) { $('.modal', ov).innerHTML = `<p class="err">${esc(errText(r.error))}</p>`; return; }
    const tm = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('.modal', ov).innerHTML = `<h2>📜 ${t('history')} · ${esc(r.name)}</h2>
      <div class="hist-sum"><b>${r.byAI ? '🤖 ' + t('ai_summary') : t('auto_summary')}:</b> ${esc(tc(r.summary))}</div>
      <div class="dim" style="margin:6px 0">${money(r.money)} · ${r.stats.correct}/${r.stats.answered} ${t('answered')}</div>
      <ol class="hist-list">${r.log.length ? r.log.map((l) => `<li><span class="mono dim">${tm(l.ts)}</span> ${esc(tc(l))} ${l.delta ? `<b class="${l.delta > 0 ? 'pos' : 'neg'}">${l.delta > 0 ? '+' : '−'}${Math.abs(l.delta)}</b>` : ''}</li>`).join('') : `<li class="dim">${t('hist_empty')}</li>`}</ol>
      ${S.me?.isAdmin ? moneyForm(id) : ''}
      <div style="text-align:end;margin-top:12px"><button class="btn ghost" data-close-modal>${t('close')}</button></div>`;
    bindMoneyForm(ov, id);
  }
  function moneyForm(id) {
    return `<form class="money-form" data-mf="${id}"><b>${S.me.isHost ? t('money_adjust') : t('suggest_title')}</b>
      <div class="file-row"><input class="input" type="number" step="10" id="mf-amt" placeholder="${t('amount_ph')}" required><input class="input" id="mf-why" maxlength="60" placeholder="${t('reason_ph')}"></div>
      <div class="file-row"><button class="btn primary" data-sign="1">＋ ${S.me.isHost ? t('add_money') : t('suggest_bonus')}</button><button class="btn danger" data-sign="-1">− ${S.me.isHost ? t('remove_money') : t('suggest_fine')}</button></div></form>`;
  }
  function bindMoneyForm(root, id) {
    const f = $('[data-mf]', root); if (!f) return;
    $$('[data-sign]', f).forEach((b) => b.onclick = async (e) => {
      e.preventDefault();
      const amt = Math.abs(Number($('#mf-amt', f).value)); if (!amt) return toastErr('bad_amount');
      const amount = amt * Number(b.dataset.sign); const reason = $('#mf-why', f).value;
      const r = await Net.request(S.me.isHost ? 'admin:adjust' : 'admin:suggest', { targetId: id, amount, reason });
      if (r.error) return toastErr(r.error);
      sfx('coin'); toast(`<span class="ta">✓</span><span class="tt">${S.me.isHost ? t('money_done', { name: playerName(id), n: (amount > 0 ? '+' : '') + amount }) : t('suggest_sent')}</span>`);
      if (S.me.isHost) showHistory(id); else closeModal();
    });
  }
  function bindAdminButtons(root) {
    $$('[data-hist]', root).forEach((b) => b.onclick = () => showHistory(b.dataset.hist));
    $$('[data-money]', root).forEach((b) => b.onclick = () => { const ov = openModal(`<h2>${esc(playerName(b.dataset.money))}</h2>${moneyForm(b.dataset.money)}`); bindMoneyForm(ov, b.dataset.money); });
  }

  // ───────────────────────── end of game: Polls & Feedback ─────────────────────────
  const STAGE_LABEL = { feedback: 'st_feedback', poll1: 'st_poll1', poll2: 'st_poll2', poll3: 'st_poll3', board: 'st_board', podium: 'st_podium' };
  function renderEnd(force) {
    const E = S.room.end; const me = S.me || {};
    // personal bits are part of the key so votes/feedback re-render
    const key = JSON.stringify([E.stage, settings.lang, E.poll1, E.feedbackCount, E.poll2, E.poll3, E.board, E.podium && E.podium.startedAt, E.podium && E.podium.top.map((x) => x.note), me.endVote, me.voteBlocked, !!me.endFeedback, me.isHost, me.isAdmin]);
    if (S.view === 'end' && !force && key === S.endKey) return;
    const typing = document.activeElement && document.activeElement.id === 'fb-text';
    if (S.view === 'end' && E.stage === 'feedback' && typing && !force) { const c = $('#fb-count'); if (c) c.textContent = t('fb_count', { n: E.feedbackCount, m: E.playerCount }); return; }
    const firstPaint = S.view !== 'end';
    S.view = 'end'; S.endKey = key;
    Audio8.ring(false); S.ringing = false;
    const idx = E.stages.indexOf(E.stage);
    let body = '';
    if (E.stage === 'feedback') body = endFeedback(E, me);
    else if (E.stage === 'poll1') body = endPoll1(E, me);
    else if (E.stage === 'poll2') body = endPoll2(E);
    else if (E.stage === 'poll3') body = endPoll3(E);
    else if (E.stage === 'board') body = endBoard(E, me);
    else body = endPodium(E);
    const left = E.board ? E.board.hidden.length : 0;
    const flipFrom = E.stage === 'board' && !firstPaint ? captureBoard() : null;
    $('#app').innerHTML = `<section class="screen endscreen ${firstPaint ? '' : 'still'}">
      <header class="end-head"><span class="brand mono">📊 ${t('app_polls')}</span>
        <ol class="stage-dots">${E.stages.map((st, i) => `<li class="${i < idx ? 'past' : i === idx ? 'now' : ''}" title="${t(STAGE_LABEL[st])}">${i + 1}</li>`).join('')}</ol>
        <span class="end-stage">${t(STAGE_LABEL[E.stage])}</span></header>
      <div class="end-body">${body}</div>
      ${me.isHost ? `<footer class="host-bar"><span class="dim">${E.stage === 'board' && left ? t('host_reveal_hint', { n: left }) : E.stage === 'podium' ? t('host_podium_hint2') : t('host_space_hint')}</span>
        ${E.stage !== 'podium' ? `<button class="btn primary big" id="end-next">${E.stage === 'board' && left ? t('reveal_next') : t('next_stage')} <kbd>␣ Space</kbd></button>` : `<button class="btn primary big" data-lobby>${t('back_lobby')}</button>`}</footer>` : `<footer class="host-bar"><span class="dim">${t('wait_host_space')}</span></footer>`}
    </section>`;
    bindEnd(E, me);
    if (flipFrom) playFlip(flipFrom, E);
  }
  function endFeedback(E, me) {
    if (me.endFeedback) return `<div class="end-card"><h2>✓ ${t('fb_thanks')}</h2><p class="dim">${t('fb_yours', { n: me.endFeedback.rating })}</p><p id="fb-count" class="dim">${t('fb_count', { n: E.feedbackCount, m: E.playerCount })}</p></div>`;
    return `<form class="end-card" id="fb-form"><h2>${t('fb_title')}</h2>
      <label class="dim" for="fb-text">${t('fb_text_label')}</label>
      <textarea class="input" id="fb-text" maxlength="300" rows="3" placeholder="${t('fb_ph')}"></textarea>
      <div class="dim" style="margin-top:8px">${t('fb_rate')}</div>
      <div class="rate-row" role="radiogroup">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="rate" role="radio" aria-checked="false" data-rate="${i + 1}">${i + 1}</button>`).join('')}</div>
      <button class="btn primary big" id="fb-send" disabled>${t('send')}</button>
      <p id="fb-count" class="dim">${t('fb_count', { n: E.feedbackCount, m: E.playerCount })}</p></form>`;
  }
  function pctOf(n, tot) { return tot ? Math.round((100 * n) / tot) : 0; }
  function endPoll1(E, me) {
    const P = E.poll1; const voted = me.endVote || me.voteBlocked;
    const bar = (k, label, cls) => `<div class="vbar ${cls}"><div class="vlabel"><b>${label}</b><span class="mono">${pctOf(P[k], P.total)}% · ${P[k]} ${t('votes')}</span></div><div class="vtrack"><i style="width:${pctOf(P[k], P.total)}%"></i></div></div>`;
    return `<div class="end-card wide"><h2>${t('poll1_q')}</h2>
      ${me.voteBlocked ? `<p class="err">🤖 ${t('vote_bot')}</p>` : ''}
      ${!voted ? `<div class="vote-row"><button class="vote george" data-vote="george">GEORGE</button><button class="vote ducky" data-vote="ducky">Mr_Ducky</button></div><button class="btn ghost" data-vote="skip">${t('skip')}</button>` : `<p class="dim">${me.endVote === 'skip' ? t('you_skipped') : me.endVote ? t('you_voted', { x: me.endVote === 'george' ? 'GEORGE' : 'Mr_Ducky' }) : ''}</p>`}
      <div class="vbars">${bar('george', 'GEORGE', 'george')}${bar('ducky', 'Mr_Ducky', 'ducky')}${bar('skip', t('skip'), 'skip')}</div>
      <p class="dim mono">${t('votes_total', { n: P.total })}${P.blocked ? ' · ' + t('votes_blocked', { n: P.blocked }) : ''}</p></div>`;
  }
  function endPoll2(E) {
    const P = E.poll2 || { pct: 0, success: 0, total: 0, filtered: 0, accuracy: 0 };
    return `<div class="end-card wide"><h2>${t('poll2_title')}</h2>
      <div class="big-stat"><span class="mono">${P.pct}%</span><small>${t('poll2_sub', { a: P.success, b: P.total })}</small></div>
      <div class="vbar"><div class="vtrack"><i style="width:${P.pct}%"></i></div></div>
      <div class="stat-row"><div><b class="mono">${P.accuracy}%</b><span>${t('poll2_acc')}</span></div><div><b class="mono">${P.filtered}</b><span>${t('poll2_filtered')}</span></div></div>
      <p class="dim" style="font-size:.85rem">🤖 ${t('poll2_bot')}</p></div>`;
  }
  function endPoll3(E) {
    const P = E.poll3 || { reviews: [], score: 0, count: 0, summary: { he: '', en: '' } };
    return `<div class="end-card wide"><h2>${t('poll3_title')}</h2>
      <div class="score-hero"><span class="mono">${P.score.toFixed(1)}</span><small>/10 · ${t('poll3_weighted', { n: P.count })}</small></div>
      <p class="summary-line">${P.byAI ? '🤖 ' + t('ai_summary') : t('auto_summary')}: ${esc(tc(P.summary))}</p>
      <div class="reviews">${P.reviews.length ? P.reviews.map((r) => `<figure class="review"><div class="rscore mono">${r.rating}/10</div><blockquote>${r.text ? esc(r.text) : `<span class="dim">${t('no_text')}</span>`}</blockquote><figcaption>— ${esc(r.name)}</figcaption></figure>`).join('') : `<p class="dim">${t('no_reviews')}</p>`}</div></div>`;
  }
  function endBoard(E, me) {
    const B = E.board || { revealed: [], hidden: [] };
    const adminBtns = (id) => me.isAdmin ? `<span class="row-acts"><button class="btn small" data-hist="${id}" title="${t('history')}">📜</button><button class="btn small warn" data-money="${id}" title="${t('money_adjust')}">±</button></span>` : '';
    return `<div class="board-wrap">
      <div class="board-main"><h3>${t('board_main')}</h3><ol class="rank-table">${B.revealed.length ? B.revealed.map((p, i) => `<li data-row="${p.id}" class="${p.id === me.id ? 'me' : ''}"><span class="rk mono">${i + 1}</span><span class="rn">${esc(p.name)}</span><span class="mv"></span><span class="rm mono" data-money="${p.money}">${money(p.money)}</span>${adminBtns(p.id)}</li>`).join('') : `<li class="dim empty">${t('board_empty')}</li>`}</ol></div>
      <div class="board-names"><h3>${t('board_names')} (${B.hidden.length})</h3><ul>${B.hidden.map((p) => `<li data-nm="${p.id}">${esc(p.name)}</li>`).join('')}</ul></div></div>`;
  }
  // Smooth leaderboard: remember where every row and name was, then glide them to their new places
  function captureBoard() {
    const pos = {};
    $$('[data-row]').forEach((el) => { const r = el.getBoundingClientRect(); pos[el.dataset.row] = { x: r.left, y: r.top, rank: Number($('.rk', el).textContent) }; });
    $$('[data-nm]').forEach((el) => { const r = el.getBoundingClientRect(); pos['nm:' + el.dataset.nm] = { x: r.left, y: r.top }; });
    return pos;
  }
  function playFlip(from, E) {
    if (!from || !Element.prototype.animate) return;
    const last = E.board && E.board.last;
    $$('[data-row]').forEach((el) => {
      const id = el.dataset.row; const r = el.getBoundingClientRect();
      const old = from[id] || from['nm:' + id];
      const rank = Number($('.rk', el).textContent);
      if (!old) return;
      const dx = old.x - r.left, dy = old.y - r.top;
      const entering = !from[id];
      if (!dx && !dy && !entering) return;
      el.animate(entering
        ? [{ transform: `translate(${dx}px, ${dy}px) scale(.92)`, boxShadow: '0 0 0 2px #39ff88, 0 0 40px #39ff88', opacity: .85 },
           { transform: `translate(${dx * 0.35}px, ${dy * 0.5 - 24}px) scale(1.08)`, boxShadow: '0 0 0 2px #39ff88, 0 0 50px #39ff88', offset: 0.55 },
           { transform: 'none', boxShadow: '0 0 0 0 rgba(0,0,0,0)', opacity: 1 }]
        : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: entering ? 1400 : 1100, easing: 'cubic-bezier(.2,.8,.2,1)' });
      const mv = $('.mv', el);
      if (!entering && from[id].rank !== rank && mv) { mv.textContent = rank < from[id].rank ? '▲' : '▼'; mv.className = 'mv ' + (rank < from[id].rank ? 'up' : 'down'); setTimeout(() => { mv.textContent = ''; mv.className = 'mv'; }, 1800); }
      if (entering) {
        const m = $('.rm', el); const target = Number(m.dataset.money) || 0; const t0 = performance.now();
        const tick = (tt) => { const k = Math.min(1, (tt - t0) / 1300); m.textContent = money(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    });
    if (last) sfx('coin');
  }

  // ── Podium ceremony: 3rd (15 s) → 2nd (15 s) → winner celebration (15 s) → final podium ──
  const CER_STEP = 15000;
  function endPodium(E) { return E.podium ? `<div class="ceremony" id="cer"><canvas id="fw" aria-hidden="true"></canvas><div id="cer-in"></div></div>` : ''; }
  function cerPlaces(P) { return [2, 1, 0].filter((i) => P.top[i]); }
  function cerCard(p, place, winner) {
    const st = p.stats || {};
    const half = p.feedback ? Math.round(p.feedback.rating / 2) : 0;
    return `<div class="cer-card ${winner ? 'winner' : ''} p${place + 1}">
      <header><span class="cer-medal">${['🥇', '🥈', '🥉'][place]}</span><div><div class="cer-place">${t('place_n', { n: place + 1 })}</div><div class="cer-name">${esc(p.name)}</div></div>
        <div class="cer-score"><span class="mono" data-count="${p.score}">0</span><small>${t('player_score')}</small></div></header>
      <div class="cer-coins mono" data-countm="${p.money}">${money(0)}</div>
      ${winner ? `<div class="cer-slides">${p.achievements.map((a, i) => `<div class="cer-slide ${i === 0 ? 'on' : ''}">${esc(tc(a))}</div>`).join('')}</div>` : ''}
      <div class="cer-grid">
        <section><h4>🏅 ${t('cer_ach')}</h4><ul class="chips-list">${p.achievements.map((a) => `<li>${esc(tc(a))}</li>`).join('')}</ul></section>
        <section><h4>📊 ${t('cer_stats')}</h4><dl class="stat-dl">
          <dt>${t('cer_answered')}</dt><dd class="mono">${st.answered || 0}</dd><dt>${t('cer_helped')}</dt><dd class="mono">${st.correct || 0}</dd>
          <dt>${t('cer_acc')}</dt><dd class="mono">${st.accuracy || 0}%</dd>${st.avgSolveSec != null ? `<dt>${t('cer_avg')}</dt><dd class="mono">${st.avgSolveSec}s</dd>` : ''}
          <dt>${t('cer_hang')}</dt><dd class="mono">${st.hangups || 0}</dd><dt>${t('cer_worlds')}</dt><dd class="mono">${st.worlds || 0}</dd></dl></section>
        <section><h4>☎ ${t('cer_perf')}</h4><ul class="perf">${(p.performance || []).length ? p.performance.map((x) => `<li class="${x.delta > 0 ? 'ok' : 'no'}">${x.delta > 0 ? '✔' : '✖'} ${esc(tc(x))}</li>`).join('') : `<li class="dim">${t('hist_empty')}</li>`}</ul></section>
        <section><h4>💬 ${t('cer_feedback')}</h4>${p.feedback ? `<div class="cer-stars">${'★'.repeat(half)}${'☆'.repeat(5 - half)} <span class="mono">${p.feedback.rating}/10</span></div><blockquote>${p.feedback.text ? esc(p.feedback.text) : `<span class="dim">${t('no_text')}</span>`}</blockquote>` : `<p class="dim">${t('cer_no_fb')}</p>`}</section>
      </div>
      <p class="cer-summary">${p.byAI ? '🤖 ' + t('ai_summary') : t('auto_summary')}: ${esc(tc(p.summary))}</p>
      <div class="cer-bar"><i></i></div></div>`;
  }
  function cerFinal(P) {
    const b = (place) => P.top[place] ? `<div class="fin p${place + 1}"><div class="fin-medal">${['🥇', '🥈', '🥉'][place]}</div><div class="fin-name">${esc(P.top[place].name)}</div><div class="fin-score mono">${P.top[place].score}</div><div class="block mono">${place + 1}</div></div>` : '<div></div>';
    return `<div class="cer-final"><h2>🏆 ${t('cer_final')}</h2><div class="fin-row">${b(1)}${b(0)}${b(2)}</div></div>`;
  }
  function countUps(root) {
    $$('[data-count], [data-countm]', root).forEach((el) => {
      const isM = el.hasAttribute('data-countm');
      const target = Number(isM ? el.dataset.countm : el.dataset.count) || 0; const t0 = performance.now();
      const tick = (tt) => { const k = Math.min(1, (tt - t0) / 2200); const v = Math.round(target * (1 - Math.pow(1 - k, 3))); el.textContent = isM ? money(v) : v; if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  function fireworks(canvas) {
    if (!canvas) return () => {};
    const ctx = canvas.getContext('2d'); let parts = []; let alive = true; let lastBurst = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    const colors = ['#ffd23f', '#39ff88', '#ff3df2', '#33e6ff', '#ff4b5c', '#ffffff'];
    const burst = () => {
      const x = canvas.width * (0.15 + Math.random() * 0.7), y = canvas.height * (0.12 + Math.random() * 0.35); const c = colors[(Math.random() * colors.length) | 0];
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, v = (1.5 + Math.random() * 4) * dpr; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c }); }
      for (let i = 0; i < 18; i++) parts.push({ x: Math.random() * canvas.width, y: -10, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, life: 1.6, c: colors[i % colors.length], conf: true });
    };
    const loop = (tt) => {
      if (!alive || !canvas.isConnected) return;
      if (tt - lastBurst > 520) { burst(); lastBurst = tt; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts = parts.filter((q) => q.life > 0);
      for (const q of parts) {
        q.x += q.vx; q.y += q.vy; q.vy += q.conf ? 0.02 : 0.06 * dpr; q.vx *= 0.985; q.life -= q.conf ? 0.006 : 0.014;
        ctx.globalAlpha = Math.max(0, Math.min(1, q.life)); ctx.fillStyle = q.c;
        if (q.conf) ctx.fillRect(q.x, q.y, 6 * dpr, 3 * dpr); else { ctx.beginPath(); ctx.arc(q.x, q.y, 2.2 * dpr, 0, 7); ctx.fill(); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }
  function runCeremony() {
    const P = S.room.end && S.room.end.podium; const box = $('#cer-in'); if (!P || !box) return;
    const places = cerPlaces(P); const el = Math.max(0, Net.serverNow() - P.startedAt);
    const idx = Math.floor(el / CER_STEP); const phase = idx < places.length ? 'p' + places[idx] : 'final';
    const within = el - idx * CER_STEP;
    if (phase !== S.cerPhase || !box.firstChild) {
      const fresh = phase !== S.cerPhase;
      S.cerPhase = phase;
      const winner = phase === 'p0';
      box.innerHTML = phase === 'final' ? cerFinal(P) : cerCard(P.top[places[idx]], places[idx], winner);
      countUps(box);
      if (S.stopFw) { S.stopFw(); S.stopFw = null; }
      if (winner || phase === 'final') S.stopFw = fireworks($('#fw'));
      if (fresh) {
        if (winner) { sfx('fanfare'); [0, 900, 1800, 2700, 3600, 4500].forEach((d) => setTimeout(() => sfx('clap'), d)); }
        else if (phase === 'final') sfx('jackpot');
        else sfx('whoosh');
      }
    }
    const bar = $('.cer-bar i', box); if (bar) bar.style.width = Math.min(100, (within / CER_STEP) * 100) + '%';
    const slides = $$('.cer-slide', box); if (slides.length) { const k = Math.floor(within / (CER_STEP / slides.length)) % slides.length; slides.forEach((x, i) => x.classList.toggle('on', i === k)); }
  }
  function bindEnd(E, me) {
    const app = $('#app');
    const next = $('#end-next', app); if (next) next.onclick = advanceEnd;
    const bl = $('[data-lobby]', app); if (bl) bl.onclick = () => Net.request('game:lobby', {});
    const form = $('#fb-form', app);
    if (form) {
      let rating = 0;
      $$('[data-rate]', form).forEach((b) => b.onclick = () => { rating = Number(b.dataset.rate); $$('[data-rate]', form).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); $('#fb-send', form).disabled = false; sfx('click'); });
      form.onsubmit = async (e) => { e.preventDefault(); if (!rating) return; const r = await Net.request('end:feedback', { rating, text: $('#fb-text', form).value }); if (r.error) toastErr(r.error); else sfx('success'); };
    }
    bindAdminButtons(app);
    if (E.stage === 'podium') {
      S.cerPhase = null; runCeremony();
      if (!S.podiumTick) S.podiumTick = setInterval(() => {
        if (S.view !== 'end' || !S.room.end || S.room.end.stage !== 'podium') { clearInterval(S.podiumTick); S.podiumTick = null; if (S.stopFw) { S.stopFw(); S.stopFw = null; } return; }
        runCeremony();
      }, 200);
    }
  }
  async function advanceEnd() {
    if (!S.me?.isHost || S.view !== 'end') return;
    const b = $('#end-next'); if (b) b.disabled = true;
    const r = await Net.request('end:next', {});
    if (r.error) { toastErr(r.error); if (b) b.disabled = false; }
  }
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || S.view !== 'end' || !S.me?.isHost) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || $('#ov-admin')) return;
    e.preventDefault(); advanceEnd();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-polls]')) { S.pollsOpen = true; sfx('open'); route(true); }
  });

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
    if (prevPhase && prevPhase !== 'lobby' && room.phase === 'lobby') { $('#overlay').innerHTML = ''; S.call = null; S.pollsOpen = false; S.view = null; }
    if (prevPhase === 'playing' && room.phase === 'over') {
      // timer over: lock Calls/MDA/Tasks, open the global chat with the polls link
      for (const id of LOCKED_AFTER_END) if (S.wins[id] && S.wins[id].el) { S.wins[id].el.remove(); S.wins[id] = { open: false }; }
      S.call = null; Audio8.ring(false); S.ringing = false; sfx('jackpot');
      if (S.view === 'desktop') { S.chan = 'global'; openWin('chat'); renderChat(); renderTaskbar(); }
    }
    route();
    if (S.view === 'desktop') {
      $$('.dicon').forEach((b) => b.classList.toggle('locked', appLocked(b.dataset.app)));
      if (isOpen('chat')) { renderChans(); renderMembers(); }
      if (S.callsTab === 'call' && !S.call) renderStage(null, true);
    }
  });

  Net.on('me', (me) => {
    const prev = S.me;
    S.me = me;
    if (prev && prev.isAdmin !== me.isAdmin && isOpen('chat')) renderChat();
    if (prev && prev.mutedUntil !== me.mutedUntil && isOpen('chat') && S.chan === 'global') renderChatMain();
    const helpChanged = prev && JSON.stringify(prev.help) !== JSON.stringify(me.help);
    const limChanged = prev && JSON.stringify(prev.limits) !== JSON.stringify(me.limits);
    if ((helpChanged || limChanged) && isOpen('chat')) renderChatMain();
    if (limChanged) {
      if (S.callsTab === 'call') renderStage(null, true);
      if (isOpen('mda')) renderMda();
      const ab = Object.keys(me.limits || {}).find((k) => (me.limits[k] || 0) > Net.serverNow() && !((prev.limits || {})[k] > Net.serverNow()));
      if (ab) { sfx('error'); toast(`<span class="ta">⛔</span><span class="tt">${esc(t('you_limited', { what: t('lim_' + ab) }))}</span>`, { cls: 'err', ms: 6000 }); }
      updateIcons();
    }
    if (!S.call || !me.call || S.call.id !== me.call.id || S.call.status !== me.call.status) {
      if (me.call || (S.call && S.call.status !== 'done')) onCall(me.call);
    }
    if (S.room) route();
  });

  Net.on('call', (call) => onCall(call));

  Net.on('history', (h) => {
    S.chat.global = h.global || []; S.chat.lb = h.lb || []; S.chat.help = h.help || [];
    if (h.notes) S.notes = h.notes;
    if (h.dms) S.dms = h.dms;
    if (h.tickets) S.tickets = h.tickets;
    if (h.ticketMsgs) S.ticketMsgs = h.ticketMsgs;
    if (isOpen('chat')) renderChat();
  });

  Net.on('chat', ({ channel, msg }) => pushChat(channel, msg));
  Net.on('lb', (msg) => pushChat('lb', msg));
  Net.on('note', (n) => {
    const i = S.notes.findIndex((x) => x.id === n.id);
    if (i >= 0) S.notes[i] = n; else S.notes.push(n);
    if (S.notes.length > 150) S.notes.shift();
    if (n.severity === 'critical') {
      sfx('error');
      toast(`<span class="ta">🚨</span><span class="tt"><b>${esc(n.name)}</b><br>${esc(tc(n.text))}</span><span class="btn small danger">${t('ch_notes')}</span>`, { cls: 'err crit-toast', ms: 9000, onClick: () => { openWin('chat'); S.chan = 'notes'; S.notesSeen = Date.now(); renderChat(); } });
    }
    if (isOpen('chat')) { renderChans(); if (S.chan === 'notes') renderChatMain(); }
    updateIcons();
  });
  Net.on('dm', ({ playerId, msg }) => {
    (S.dms[playerId] = S.dms[playerId] || []).push(msg);
    const here = isOpen('chat') && S.chan === 'dm' && (!S.me?.isHost || S.dmOpen === playerId);
    if (here) renderChatMain();
    else if (msg.from.id !== S.me?.id) { S.unread.dm = (S.unread.dm || 0) + 1; sfx('msg'); toast(`<span class="ta">✉</span><span class="tt"><b>${esc(msg.from.name)}</b><br>${esc(msg.text.slice(0, 80))}</span>`, { onClick: () => { openWin('chat'); S.chan = 'dm'; if (S.me?.isHost) S.dmOpen = playerId; renderChat(); } }); }
    if (isOpen('chat')) renderChans();
    updateIcons();
  });
  Net.on('help:priority', ({ name }) => { sfx('msg'); toast(`<span class="ta">🙋</span><span class="tt">${esc(t('priority_toast', { name }))}</span>`, { onClick: () => { openWin('chat'); S.chan = 'help'; renderChat(); } }); });
  Net.on('help', ({ ticketId, msg }) => {
    const mineTicket = S.me?.help ? S.me.help.ticketId === ticketId : !S.me?.isAdmin;
    if (!S.me?.isAdmin || mineTicket && !S.tickets.some((x) => x.id === ticketId && x.ownerId !== S.me.id)) {
      if (!S.me?.isAdmin || S.me?.help?.ticketId === ticketId) { pushChat('help', msg); if (isOpen('chat') && S.chan === 'help') renderChatMain(); return; }
    }
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
  Net.on('suggest', (d) => {
    sfx('msg');
    const el = toast(`<span class="ta">💡</span><span class="tt"><b>${esc(d.from)}</b> ${esc(t('suggest_in', { name: d.targetName, n: (d.amount > 0 ? '+' : '') + d.amount }))}${d.reason ? `<br><span class="dim">${esc(d.reason)}</span>` : ''}</span><button class="btn small primary" data-ok>${t('approve')}</button>`, { ms: 15000 });
    $('[data-ok]', el).onclick = async () => { const r = await Net.request('admin:adjust', { targetId: d.targetId, amount: d.amount, reason: d.reason, suggestedBy: d.fromId }); if (r.error) toastErr(r.error); else { sfx('coin'); el.remove(); } };
  });
  Net.on('suggest:done', (d) => toast(`<span class="ta">✓</span><span class="tt">${esc(t('suggest_approved', { name: d.targetName, n: (d.amount > 0 ? '+' : '') + d.amount }))}</span>`));
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

  // heartbeat: tells the server which app is open and what money is shown on screen
  setInterval(() => {
    if (!S.room || S.room.phase === 'lobby' || !S.online) return;
    const mEl = $('#tb-money'); const shown = mEl ? Number(mEl.textContent.replace(/[^\d]/g, '')) : null;
    const app = S.view === 'end' ? 'polls' : (S.focused && isOpen(S.focused) ? S.focused : 'desktop');
    Net.request('client:beat', { app, money: Number.isFinite(shown) && mEl ? shown : undefined, visible: !document.hidden });
  }, 8000);

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
