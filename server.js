'use strict';
/*
 * MEDI-OS — realtime multiplayer retro medical-dispatch game.
 * Zero-dependency Node.js server (Node 18+): static files + WebSocket game protocol.
 *   node server.js            → http://localhost:3000
 *   PORT=8080 node server.js
 *   ANTHROPIC_API_KEY=...     → AI answers in Help / Leaderboards come from Claude (optional)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { attachWebSocketServer } = require('./server/ws');
const { qrSvg } = require('./server/qr');
const AI = require('./server/ai');
const C = require('./shared/content');
const H = require('./shared/heart');

const PORT = Number(process.env.PORT) || 3000;
if (process.env.GEORGE_TALK_MS) C.ECON.georgeTalkMs = Number(process.env.GEORGE_TALK_MS); // test hook
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_DIR = path.join(__dirname, 'shared');

// ───────────────────────── helpers ─────────────────────────
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const pickWeighted = (list) => {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x.weight; if (r < 0) return x; }
  return list[list.length - 1];
};
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cleanText = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
const L = (lang, he, en) => (lang === 'en' ? en : he);

// Pick the address phones on the same Wi-Fi can reach. Skips virtual adapters
// (Hyper-V, WSL, VirtualBox, VMware, VPNs) and prefers home-network ranges.
function lanAddresses() {
  const bad = /(vEthernet|virtual|vmware|vbox|hyper-v|wsl|loopback|docker|tailscale|zerotier|hamachi|bluetooth)/i;
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      let score = 0;
      if (/^192\.168\./.test(a.address)) score += 3;
      else if (/^10\./.test(a.address)) score += 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 1;
      if (/(wi-?fi|wlan|wireless|ethernet|en\d|eth\d)/i.test(name)) score += 2;
      if (bad.test(name)) score -= 10;
      out.push({ name, address: a.address, score });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
function lanAddress() { const l = lanAddresses(); return l.length ? l[0].address : null; }

// ───────────────────────── state ─────────────────────────
/** @type {Map<string, any>} */
const rooms = new Map();
const CALLER_POOL = [...C.REGULARS.map((r) => ({ ...r, kind: 'regular' })), ...C.SPECIALS];
const HEART_POOL = H.CAST;
const byId = Object.fromEntries([...C.REGULARS, ...C.SPECIALS, ...C.PLANET, ...H.CAST, ...H.MINECRAFT, ...H.PLANET].map((c) => [c.id, c]));
const talkMs = (ch) => (process.env.GEORGE_TALK_MS ? C.ECON.georgeTalkMs : (ch && ch.talkMs) || C.ECON.georgeTalkMs);
const MAX_TRIES_CHOICE = 2; // wrong picks allowed before the patient gives up
const MAX_TRIES_TEXT = 5;   // free-text attempts (AI mode)

function newRoomCode() {
  for (let i = 0; i < 1000; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(code)) return code;
  }
  throw new Error('no codes');
}

function validName(room, name, selfId) {
  const n = cleanText(name, 16).replace(/\s+/g, ' ');
  if (n.length < 2) return { error: 'name_short' };
  for (const p of room.players.values()) {
    if (p.id !== selfId && p.name.toLowerCase() === n.toLowerCase()) return { error: 'name_taken' };
  }
  if (room.reportedNames.has(n.toLowerCase())) return { error: 'name_reported' };
  return { name: n };
}

function makePlayer(name, lang, isHost) {
  return {
    id: rid(6), token: rid(16), name, lang: lang === 'en' ? 'en' : 'he',
    isHost, isAdmin: isHost, conns: new Set(), lastSeen: now(),
    flagged: false, mutedUntil: 0, money: 0, stats: { answered: 0, correct: 0, rare: [] },
    call: null, callTimer: null, lastChatAt: 0, joinedAt: now()
  };
}

// ───────────────────────── messaging ─────────────────────────
function sendTo(conn, t, d) { conn.send(JSON.stringify({ t, d })); }
function emitPlayer(p, t, d) { for (const c of p.conns) sendTo(c, t, d); }
function emitRoom(room, t, d) { for (const p of room.players.values()) emitPlayer(p, t, d); }
function emitAdmins(room, t, d) { for (const p of room.players.values()) if (p.isAdmin) emitPlayer(p, t, d); }

function publicPlayer(p) {
  return {
    id: p.id, name: p.name, isHost: p.isHost, isAdmin: p.isAdmin, connected: p.conns.size > 0,
    flagged: p.flagged, muted: p.mutedUntil > now(), money: p.money, correct: p.stats.correct, answered: p.stats.answered
  };
}

function board(room) {
  return [...room.players.values()].map(publicPlayer).sort((a, b) => b.money - a.money || a.name.localeCompare(b.name));
}

function roomState(room) {
  return {
    code: room.code, mode: room.mode, phase: room.phase, durationMin: room.durationMin, endsAt: room.endsAt, now: now(),
    hostId: room.hostId, joinUrl: room.joinUrl, end: publicEnd(room), qr: room.phase === 'lobby' ? room.qr : null,
    players: board(room), aiEnabled: AI.aiEnabled()
  };
}

function broadcastState(room) {
  if (room.stateTimer) return;
  room.stateTimer = setTimeout(() => {
    room.stateTimer = null;
    emitRoom(room, 'room', roomState(room));
  }, 60);
}

function meState(p) {
  return {
    id: p.id, name: p.name, isHost: p.isHost, isAdmin: p.isAdmin, money: p.money,
    flagged: p.flagged, mutedUntil: p.mutedUntil, call: publicCall(p.call), stats: p.stats,
    endVote: p.endVote || null, voteBlocked: !!p.voteBlocked, endFeedback: p.endFeedback || null
  };
}
function syncMe(p) { emitPlayer(p, 'me', meState(p)); }

function sysMsg(text) { return { id: rid(5), ts: now(), from: { id: 'system', name: 'SYSTEM', role: 'system' }, text }; }
function botMsg(text) { return { id: rid(5), ts: now(), from: { id: 'bot', name: 'MEDI-AI', role: 'bot' }, text }; }
function userMsg(p, text) { return { id: rid(5), ts: now(), from: { id: p.id, name: p.name, role: p.isHost ? 'host' : p.isAdmin ? 'admin' : 'player' }, text }; }

// ───────────────────────── calls ─────────────────────────
function publicCall(call) {
  if (!call) return null;
  const { id, kind, charId, scenario, options, status, pickedAt, result, createdAt } = call;
  const out = { id, kind, charId, scenario, options, status, pickedAt, result, createdAt };
  if (kind === 'george' || kind === 'launch') out.talkMs = talkMs(byId[charId]);
  if (kind === 'heart') {
    const sc = byId[charId].scenarios[call.sIdx];
    Object.assign(out, {
      stage: call.stage, world: call.world || null, tries: call.tries, removed: call.removed, reply: call.reply,
      chat: call.chat, aiOn: AI.aiEnabled(), maxTries: MAX_TRIES_CHOICE,
      fund: call.stage === 'talk' ? null : call.fund,
      tasks: call.tasks, talk: call.talk,
      file: call.stage === 'file' || status === 'done' ? sc.file : null,
      q: call.stage === 'file' || status === 'done' ? sc.q : null,
      choices: call.stage === 'file' || status === 'done' ? call.order.map((i) => ({ i, t: sc.o[i] })) : null
    });
  }
  return out;
}

function fundNumber() { return String(Math.floor(1000000 + Math.random() * 9000000)); }

// Build a heart-edition call (patient asks, player looks up the file, then answers)
function heartCall(call, ch, h) {
  let idxs = ch.scenarios.map((_, i) => i);
  if (h) {
    const used = h.used[ch.id] || (h.used[ch.id] = []);
    if (used.length >= idxs.length) used.length = 0;
    idxs = idxs.filter((i) => !used.includes(i));
  }
  call.sIdx = idxs[Math.floor(Math.random() * idxs.length)];
  if (h) h.used[ch.id].push(call.sIdx);
  call.stage = 'talk';
  call.tasks = { greet: false, fund: false };
  call.talk = [];
  call.fund = fundNumber();
  call.order = shuffle(ch.scenarios[call.sIdx].o.map((_, i) => i));
  call.tries = 0; call.removed = []; call.reply = null; call.chat = [];
  return call;
}

function scheduleCall(room, p, delayMs) {
  clearTimeout(p.callTimer);
  if (room.phase !== 'playing') return;
  p.callTimer = setTimeout(() => {
    if (room.phase !== 'playing' || !room.players.has(p.id) || p.call) return;
    p.call = rollCall(p, room);
    emitPlayer(p, 'call', publicCall(p.call));
  }, delayMs);
}

// No repeats: skip the last few callers this player heard, and use every
// scenario of a caller before any of them comes back.
const RECENT_CALLERS = 5;
function deckFor(mode) {
  if (mode === 'classic') return CALLER_POOL;
  if (mode === 'heart') return HEART_POOL;
  return Math.random() < 0.5 ? HEART_POOL : CALLER_POOL; // mixed: half and half
}
function rollCall(p, room) {
  const h = p.hist || (p.hist = { recent: [], used: {} });
  const deck = deckFor(room ? room.mode : 'mixed');
  let pool = deck.filter((c) => !h.recent.includes(c.id));
  if (!pool.length) pool = deck;
  const ch = pickWeighted(pool);
  h.recent.push(ch.id);
  if (h.recent.length > RECENT_CALLERS) h.recent.shift();
  return rollCallFor(ch, h);
}

function rollCallFor(ch, h) {
  const call = { id: rid(5), charId: ch.id, kind: ch.kind, status: 'ringing', createdAt: now(), pickedAt: 0, result: null };
  if (ch.kind === 'heart') return heartCall(call, ch, h);
  if (ch.kind === 'regular') {
    let idxs = ch.scenarios.map((_, i) => i);
    if (h) {
      const used = h.used[ch.id] || (h.used[ch.id] = []);
      if (used.length >= idxs.length) used.length = 0;
      idxs = idxs.filter((i) => !used.includes(i));
    }
    const pick = idxs[Math.floor(Math.random() * idxs.length)];
    if (h) h.used[ch.id].push(pick);
    const sc = ch.scenarios[pick];
    const others = shuffle(C.PROTOCOLS.map((x) => x.id).filter((x) => x !== sc.p)).slice(0, 3);
    call.scenario = { he: sc.he, en: sc.en };
    call.answer = sc.p;
    call.options = shuffle([sc.p, ...others]);
  }
  return call;
}

function finishCall(room, p, result) {
  p.call.status = 'done';
  p.call.result = result;
  emitPlayer(p, 'call', publicCall(p.call));
  const done = p.call;
  setTimeout(() => {
    if (p.call === done) { p.call = null; scheduleCall(room, p, rand(1800, 3800)); }
  }, result.kind === 'planet' ? 600 : result.kind === 'heart' ? 5000 : 2600);
  syncMe(p);
  broadcastState(room);
}

function addMoney(room, p, amount) {
  p.money = Math.max(0, p.money + amount);
}

// Per-player game history (shown to managers, used for the podium)
function logEvent(p, he, en, delta = 0, tag = '') {
  (p.log || (p.log = [])).push({ ts: now(), he, en, delta, tag });
  if (p.log.length > 120) p.log.shift();
}
const nm = (ch) => ch.name;

// ───────────────────────── game lifecycle ─────────────────────────
function startGame(room) {
  room.phase = 'playing';
  room.startedAt = now();
  room.endsAt = room.startedAt + room.durationMin * 60000;
  for (const p of room.players.values()) {
    p.money = 0; p.call = null; p.hist = null; p.log = []; p.stats = { answered: 0, correct: 0, rare: [] };
    scheduleCall(room, p, rand(2500, 5000)); // after boot animation
    syncMe(p);
  }
  const sm = sysMsg(''); sm.event = { type: 'start' };
  room.global.push(sm); emitRoom(room, 'chat', { channel: 'global', msg: sm });
  clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => endGame(room), room.endsAt - now());
  emitRoom(room, 'room', roomState(room));
}

const END_STAGES = ['feedback', 'poll1', 'poll2', 'poll3', 'board', 'podium'];
function realPlayers(room) { return [...room.players.values()].filter((p) => !p.bot); }

function endGame(room) {
  if (room.phase !== 'playing') return;
  room.phase = 'over';
  room.end = { stage: 'feedback', poll2: null, poll3: null, order: [], revealed: [], podium: null };
  for (const p of room.players.values()) {
    clearTimeout(p.callTimer); p.call = null;
    p.endVote = null; p.voteBlocked = false; p.endFeedback = null;
    syncMe(p);
  }
  // Calls and MDA lock; the global chat gets a link to Polls & Feedback
  const m = sysMsg(''); m.event = { type: 'polls' };
  room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
  emitRoom(room, 'room', roomState(room));
}

// Someone "failing on purpose": several answers, none right, and either rushed wrong picks or repeated hang-ups
function looksDeliberate(p) {
  const st = p.stats || {};
  return (st.answered || 0) >= 3 && (st.correct || 0) === 0 && ((st.quickWrong || 0) >= 2 || (st.hangups || 0) >= 2);
}

function computePoll2(room) {
  const real = realPlayers(room);
  const filtered = real.filter(looksDeliberate);
  const pool = real.filter((p) => !filtered.includes(p));
  const success = pool.filter((p) => (p.stats.correct || 0) >= 1);
  const ans = pool.reduce((a, p) => a + (p.stats.answered || 0), 0);
  const cor = pool.reduce((a, p) => a + (p.stats.correct || 0), 0);
  return { pct: pool.length ? Math.round((100 * success.length) / pool.length) : 0, success: success.length, total: pool.length, filtered: filtered.length, accuracy: ans ? Math.round((100 * cor) / ans) : 0 };
}

function computePoll3(room) {
  const all = realPlayers(room).filter((p) => p.endFeedback).map((p) => ({ name: p.name, rating: p.endFeedback.rating, text: p.endFeedback.text }));
  const pick = [...all].sort((a, b) => b.text.length - a.text.length).slice(0, 8);
  let wsum = 0, sum = 0;
  for (const r of all) { const w = 1 + Math.min(1, r.text.length / 80); wsum += w; sum += r.rating * w; }
  const score = wsum ? Math.round((sum / wsum) * 10) / 10 : 0;
  const summary = score >= 8 ? { he: 'רוב השחקנים נהנו מאוד מהמשחק ומצאו אותו מלמד.', en: 'Most players really enjoyed the game and found it educational.' }
    : score >= 6 ? { he: 'השחקנים נהנו ברובם, והשאירו כמה הצעות לשיפור.', en: 'Players mostly enjoyed it and left a few ideas for improvement.' }
    : all.length ? { he: 'המשוב מעורב — כדאי לקרוא את ההערות ולשפר.', en: 'Feedback is mixed — worth reading the comments and improving.' }
    : { he: 'עדיין לא התקבל משוב.', en: 'No feedback yet.' };
  return { reviews: pick, count: all.length, score, summary, byAI: false, _all: all };
}

function playerScore(p) {
  const st = p.stats; const acc = st.answered ? st.correct / st.answered : 0;
  return Math.min(100, Math.round(acc * 50 + Math.min(30, st.correct * 6) + Math.min(20, p.money / 250)));
}

function achievementsOf(p) {
  const st = p.stats; const out = [];
  out.push({ he: `עזר/ה ל-${st.correct} מטופלים`, en: `Helped ${st.correct} patients` });
  if (st.answered) out.push({ he: `דיוק ${Math.round((100 * st.correct) / st.answered)}%`, en: `${Math.round((100 * st.correct) / st.answered)}% accuracy` });
  out.push({ he: `${p.money.toLocaleString('en-US')} מטבעות`, en: `${p.money.toLocaleString('en-US')} coins` });
  const tags = (p.log || []).map((l) => l.he);
  if (tags.some((t) => t.includes('כוכב ג\'ורג\''))) out.push({ he: 'ביקר/ה בכוכב ג\'ורג\' 🪐', en: 'Visited Planet George 🪐' });
  if (tags.some((t) => t.includes('מיינקראפט'))) out.push({ he: 'ביקר/ה בעולם המיינקראפט ▦', en: 'Visited the Minecraft world ▦' });
  const legend = (st.rare || []).find((id) => byId[id] && byId[id].rarity === 'legendary');
  if (legend) out.push({ he: `פגש/ה את ${byId[legend].name.he} ✨`, en: `Met ${byId[legend].name.en} ✨` });
  return out;
}

function enterStage(room, stage) {
  const E = room.end; E.stage = stage;
  if (stage === 'poll2') E.poll2 = computePoll2(room);
  if (stage === 'poll3') {
    E.poll3 = computePoll3(room);
    AI.summarizeFeedback(E.poll3._all).then((r) => {
      if (!r || !room.end || !room.end.poll3) return;
      Object.assign(room.end.poll3, { score: r.score, summary: { he: r.he, en: r.en || r.he }, byAI: true });
      broadcastState(room);
    });
  }
  if (stage === 'board') { E.order = shuffle(realPlayers(room).map((p) => p.id)); E.revealed = []; }
  if (stage === 'podium') {
    const top = realPlayers(room).sort((a, b) => b.money - a.money).slice(0, 3);
    E.podium = {
      startedAt: now(),
      top: top.map((p) => ({ id: p.id, name: p.name, money: p.money, score: playerScore(p), achievements: achievementsOf(p), history: (p.log || []).slice(-4).map(({ he, en }) => ({ he, en })), note: null }))
    };
    AI.podiumNotes(top.map((p) => ({ name: p.name, lines: (p.log || []).slice(-6).map((l) => l.en) }))).then((notes) => {
      if (!notes || !room.end || !room.end.podium) return;
      room.end.podium.top.forEach((t, i) => { if (notes[i]) t.note = notes[i]; });
      broadcastState(room);
    });
  }
  broadcastState(room);
}

function publicEnd(room) {
  const E = room.end; if (!E) return null;
  const real = realPlayers(room);
  const votes = { george: 0, ducky: 0, skip: 0 };
  let blocked = 0;
  for (const p of real) { if (p.voteBlocked) blocked++; else if (p.endVote) votes[p.endVote]++; }
  const out = {
    stage: E.stage, stages: END_STAGES, playerCount: real.length,
    feedbackCount: real.filter((p) => p.endFeedback).length,
    poll1: { ...votes, total: votes.george + votes.ducky + votes.skip, blocked },
    poll2: E.poll2,
    poll3: E.poll3 ? { reviews: E.poll3.reviews, count: E.poll3.count, score: E.poll3.score, summary: E.poll3.summary, byAI: E.poll3.byAI } : null,
    podium: E.podium, aiOn: AI.aiEnabled()
  };
  if (E.stage === 'board' || E.stage === 'podium') {
    const shown = E.revealed.map((id) => room.players.get(id)).filter(Boolean).sort((a, b) => b.money - a.money);
    out.board = {
      revealed: shown.map((p) => ({ id: p.id, name: p.name, money: p.money })),
      hidden: E.order.filter((id) => !E.revealed.includes(id) && room.players.has(id)).map((id) => ({ id, name: room.players.get(id).name })),
      last: E.revealed[E.revealed.length - 1] || null
    };
  }
  return out;
}

function backToLobby(room) {
  clearTimeout(room.endTimer);
  room.phase = 'lobby';
  room.end = null;
  room.endsAt = null;
  for (const p of room.players.values()) {
    clearTimeout(p.callTimer); p.call = null; p.money = 0; p.stats = { answered: 0, correct: 0, rare: [] };
    syncMe(p);
  }
  emitRoom(room, 'room', roomState(room));
}

function removePlayer(room, target, reason) {
  clearTimeout(target.callTimer);
  room.players.delete(target.id);
  room.banned.add(target.id);
  emitPlayer(target, 'kicked', { reason });
  for (const c of target.conns) { c.meta = null; setTimeout(() => c.close(4000), 200); }
  const t = room.tickets.get(target.id);
  if (t) { t.open = false; }
  emitAdmins(room, 'tickets', ticketList(room));
  broadcastState(room);
}

// ───────────────────────── help tickets ─────────────────────────
function ticketList(room) {
  return [...room.tickets.values()].filter((t) => t.open).sort((a, b) => b.updatedAt - a.updatedAt).map((t) => ({
    id: t.id, playerName: room.players.get(t.id)?.name || t.playerName, summary: t.summary, aiAnswer: t.aiAnswer,
    category: t.category, howTo: t.howTo, adminId: t.adminId, adminName: t.adminName,
    updatedAt: t.updatedAt, count: t.messages.length, unread: t.unread
  }));
}

function pushTicketMsg(room, ticket, msg) {
  ticket.messages.push(msg);
  if (ticket.messages.length > 200) ticket.messages.shift();
  ticket.updatedAt = now();
  const owner = room.players.get(ticket.id);
  if (owner) emitPlayer(owner, 'help', { ticketId: ticket.id, msg });
  for (const p of room.players.values()) if (p.isAdmin && p !== owner) emitPlayer(p, 'help', { ticketId: ticket.id, msg });
  emitAdmins(room, 'tickets', ticketList(room));
}

// ───────────────────────── request handlers ─────────────────────────
const handlers = {
  'room:create'(conn, d) {
    const duration = Math.round(Number(d.duration));
    if (!(duration >= 1 && duration <= 120)) return { error: 'bad_duration' };
    const name = cleanText(d.name, 16);
    if (name.length < 2) return { error: 'name_short' };
    const code = newRoomCode();
    let origin = /^https?:\/\/[^\s/]+$/.test(String(d.origin || '')) ? d.origin : `http://localhost:${PORT}`;
    try {
      const u = new URL(origin);
      if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(u.hostname)) {
        if (publicOrigin) origin = publicOrigin;
        else { const ip = lanAddress(); if (ip) { u.hostname = ip; origin = u.origin; } }
      }
    } catch (_) { /* keep */ }
    const joinUrl = `${origin}/?room=${code}`;
    const mode = H.MODES.includes(d.mode) ? d.mode : 'mixed';
    const room = {
      code, mode, phase: 'lobby', durationMin: duration, endsAt: null, createdAt: now(), hostId: null,
      joinUrl, qr: qrSvg(joinUrl), players: new Map(), banned: new Set(), reportedNames: new Set(),
      global: [], tickets: new Map(), lb: new Map(), stateTimer: null, endTimer: null
    };
    const host = makePlayer(name, d.lang, true);
    room.hostId = host.id;
    room.players.set(host.id, host);
    rooms.set(code, room);
    attach(conn, room, host);
    return { code, playerId: host.id, token: host.token };
  },

  'room:join'(conn, d) {
    const room = rooms.get(String(d.code || '').trim());
    if (!room) return { error: 'room_not_found' };
    if (room.phase === 'over') return { error: 'game_over' };
    if (room.players.size >= 60) return { error: 'room_full' };
    const v = validName(room, d.name, null);
    if (v.error) return v;
    const p = makePlayer(v.name, d.lang, false);
    room.players.set(p.id, p);
    attach(conn, room, p);
    if (room.phase === 'playing') scheduleCall(room, p, rand(2500, 4500));
    const m = sysMsg(''); m.event = { type: 'join', name: p.name };
    room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
    return { code: room.code, playerId: p.id, token: p.token };
  },

  'session:resume'(conn, d) {
    const room = rooms.get(String(d.code || ''));
    if (!room) return { error: 'room_not_found' };
    if (room.banned.has(d.playerId)) return { error: 'kicked' };
    const p = room.players.get(d.playerId);
    if (!p || p.token !== d.token) return { error: 'bad_session' };
    attach(conn, room, p);
    return { code: room.code, playerId: p.id, token: p.token };
  },

  'player:lang'(conn, d, room, me) { me.lang = d.lang === 'en' ? 'en' : 'he'; return { ok: true }; },

  'player:rename'(conn, d, room, me) {
    const v = validName(room, d.name, me.id);
    if (v.error) return v;
    if (me.flagged && v.name.toLowerCase() === me.name.toLowerCase()) return { error: 'name_reported' };
    me.name = v.name; me.flagged = false;
    syncMe(me); broadcastState(room);
    return { ok: true };
  },

  'lobby:kick'(conn, d, room, me) {
    const t = room.players.get(d.targetId);
    if (!t || t.isHost) return { error: 'not_allowed' };
    if (!me.isHost && !(me.isAdmin && !t.isAdmin)) return { error: 'not_allowed' };
    removePlayer(room, t, 'kicked');
    const m = sysMsg(''); m.event = { type: 'kicked', name: t.name, by: me.name };
    room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
    return { ok: true };
  },

  'lobby:report'(conn, d, room, me) {
    if (!me.isAdmin) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    if (!t || t.isHost) return { error: 'not_allowed' };
    room.reportedNames.add(t.name.toLowerCase());
    t.flagged = true;
    syncMe(t); broadcastState(room);
    return { ok: true };
  },

  'lobby:promote'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    if (!t || t.isHost) return { error: 'not_allowed' };
    t.isAdmin = !t.isAdmin;
    syncMe(t); broadcastState(room);
    emitPlayer(t, 'history', historyFor(room, t));
    return { ok: true, isAdmin: t.isAdmin };
  },

  'game:start'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    if (room.phase !== 'lobby') return { error: 'bad_phase' };
    startGame(room);
    return { ok: true };
  },

  'game:lobby'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    if (room.phase === 'lobby') return { ok: true };
    backToLobby(room);
    return { ok: true };
  },

  'game:end'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    endGame(room);
    return { ok: true };
  },

  // ─── calls ───
  'call:pickup'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId) return { error: 'no_call' };
    if (me.flagged) return { error: 'flagged' };
    if (c.status === 'ringing') { c.status = 'active'; c.pickedAt = now(); }
    emitPlayer(me, 'call', publicCall(c));
    return { ok: true };
  },

  'call:answer'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.kind !== 'regular' || c.status !== 'active') return { error: 'no_call' };
    const ch = byId[c.charId];
    const correct = d.protocolId === c.answer;
    const delta = correct ? ch.reward : -C.ECON.wrongPenalty;
    addMoney(room, me, delta);
    me.stats.answered++; if (correct) me.stats.correct++;
    logEvent(me, correct ? `טיפל/ה נכון ב${ch.name.he}` : `טעה/תה בטיפול ב${ch.name.he}`, correct ? `Treated ${ch.name.en} correctly` : `Wrong treatment for ${ch.name.en}`, delta, correct ? 'success' : 'fail');
    finishCall(room, me, { kind: 'regular', correct, delta, answer: c.answer, chose: d.protocolId });
    return { ok: true };
  },

  'call:collect'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.status !== 'active') return { error: 'no_call' };
    if (c.kind !== 'boost' && c.kind !== 'planet') return { error: 'bad_kind' };
    const ch = byId[c.charId];
    addMoney(room, me, ch.boost);
    me.stats.rare.push(ch.id);
    logEvent(me, `קיבל/ה בוסט מ${ch.name.he}`, `Got a boost from ${ch.name.en}`, ch.boost, 'boost');
    finishCall(room, me, { kind: c.kind, delta: ch.boost });
    if (['legendary', 'epic'].includes(ch.rarity) || c.kind === 'planet') {
      const m = sysMsg(''); m.event = { type: 'rare', player: me.name, charId: ch.id, delta: ch.boost };
      room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
    }
    return { ok: true };
  },

  'call:george'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || !['george', 'launch'].includes(c.kind) || c.status !== 'active') return { error: 'no_call' };
    const T = talkMs(byId[c.charId]);
    if (now() - c.pickedAt < T - Math.min(1500, T * 0.1)) return { error: 'too_early' };
    if (!d.yes) {
      finishCall(room, me, { kind: 'george', yes: false, delta: 0, world: byId[c.charId].world || 'planet' });
      return { ok: true };
    }
    if (c.kind === 'launch') {
      const ch = byId[c.charId];
      const list = ch.world === 'minecraft' ? H.MINECRAFT : H.PLANET;
      const dest = pickWeighted(list);
      const nc = heartCall({ id: rid(5), charId: dest.id, kind: 'heart', status: 'active', createdAt: now(), pickedAt: now(), result: null }, dest, me.hist);
      nc.world = ch.world;
      me.call = nc;
      logEvent(me, ch.world === 'minecraft' ? 'שוגר/ה לעולם המיינקראפט' : 'שוגר/ה לכוכב ג\'ורג\'', ch.world === 'minecraft' ? 'Launched to the Minecraft world' : 'Launched to Planet George', 0, 'launch');
      emitPlayer(me, 'call', publicCall(nc));
      return { ok: true, launch: true, world: ch.world };
    }
    // Launch to Planet George — one unique call
    const pc = pickWeighted(C.PLANET);
    me.call = { id: rid(5), kind: 'planet', charId: pc.id, status: 'active', createdAt: now(), pickedAt: now(), result: null };
    emitPlayer(me, 'call', publicCall(me.call));
    return { ok: true, launch: true };
  },

  // ─── heart edition: fund number → medical file → answer ───
  // The player writes first: own text or a ready-made message
  'call:say'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.kind !== 'heart' || c.status !== 'active') return { error: 'no_call' };
    if (c.stage === 'file') return { error: 'bad_phase' };
    let text = cleanText(d.text, 300);
    if (d.presetId) { const pr = H.PRESETS.find((x) => x.id === d.presetId); if (!pr) return { error: 'bad_preset' }; text = L(me.lang, pr.he, pr.en); }
    if (!text) return { error: 'empty' };
    if (c.talk.length > 40) return { error: 'slow_down' };
    const low = ' ' + text.toLowerCase() + ' ';
    const greet = H.GREET_WORDS.some((w) => low.includes(w));
    const fund = H.FUND_WORDS.some((w) => low.includes(w)) || (/מספר|number/.test(low) && /תיק|file|חולים/.test(low));
    const ch = byId[c.charId];
    c.talk.push({ who: 'player', text });
    if (greet && !c.tasks.greet) c.tasks.greet = true;
    // Patient answers plainly: first the problem, then the number when asked
    const lines = [];
    if (!c.problemSaid) { lines.push(ch.hello); c.problemSaid = true; }
    if (fund && c.stage === 'talk') {
      c.tasks.fund = true; c.stage = 'fund';
      const f = H.PATIENT_LINES.fund; lines.push({ he: f.he.replace('{n}', c.fund), en: f.en.replace('{n}', c.fund) });
    } else if (fund && c.stage === 'fund') {
      const f = H.PATIENT_LINES.fund; lines.push({ he: f.he.replace('{n}', c.fund), en: f.en.replace('{n}', c.fund) });
    } else if (!lines.length) {
      lines.push(c.stage === 'fund' ? H.PATIENT_LINES.waiting : H.PATIENT_LINES.offer);
    }
    for (const l of lines) c.talk.push({ who: 'patient', he: l.he, en: l.en });
    emitPlayer(me, 'call', publicCall(c));
    return { ok: true, greet, fund };
  },

  'mda:lookup'(conn, d, room, me) {
    const num = String(d.number || '').replace(/\D/g, '');
    const c = me.call;
    if (!num) return { error: 'no_file' };
    if (room.phase !== 'playing' || !c || c.kind !== 'heart' || c.status !== 'active' || c.stage === 'talk' || num !== c.fund) return { error: 'no_file' };
    if (c.stage !== 'file') c.fileAt = now();
    c.stage = 'file';
    emitPlayer(me, 'call', publicCall(c));
    const ch = byId[c.charId];
    return { ok: true, file: { name: ch.name, avatar: ch.avatar, fund: c.fund, card: ch.card || null, text: ch.scenarios[c.sIdx].file, q: ch.scenarios[c.sIdx].q } };
  },

  'call:choose'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.kind !== 'heart' || c.status !== 'active' || c.stage !== 'file') return { error: 'no_call' };
    const i = Number(d.option);
    const ch = byId[c.charId]; const sc = ch.scenarios[c.sIdx];
    if (!Number.isInteger(i) || i < 0 || i >= sc.o.length || c.removed.includes(i)) return { error: 'bad_option' };
    if (i === sc.a) return heartSuccess(room, me, c, ch, sc);
    if (c.fileAt && now() - c.fileAt < 2500) me.stats.quickWrong = (me.stats.quickWrong || 0) + 1;
    c.tries++; c.removed.push(i); c.reply = sc.fail;
    if (c.tries >= MAX_TRIES_CHOICE) return heartFail(room, me, c);
    emitPlayer(me, 'call', publicCall(c));
    return { ok: true, correct: false };
  },

  async 'call:reply'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.kind !== 'heart' || c.status !== 'active' || c.stage !== 'file') return { error: 'no_call' };
    if (!AI.aiEnabled()) return { error: 'ai_off' };
    if (c.busy) return { error: 'slow_down' };
    const text = cleanText(d.text, 400);
    if (!text) return { error: 'empty' };
    const ch = byId[c.charId]; const sc = ch.scenarios[c.sIdx]; const lang = me.lang;
    c.busy = true;
    c.chat.push({ who: 'player', text });
    emitPlayer(me, 'call', publicCall(c));
    const r = await AI.judgePatient({
      rules: H.AI_RULES, character: L(lang, ch.name.he, ch.name.en), bio: L(lang, ch.bio.he, ch.bio.en),
      file: L(lang, sc.file.he, sc.file.en), question: L(lang, sc.q.he, sc.q.en), correct: L(lang, sc.o[sc.a].he, sc.o[sc.a].en),
      history: c.chat.slice(0, -1), text, lang
    });
    c.busy = false;
    if (me.call !== c || c.status !== 'active') return { ok: true };
    if (!r) { c.chat.pop(); emitPlayer(me, 'call', publicCall(c)); return { error: 'ai_failed' }; }
    c.chat.push({ who: 'patient', text: r.reply });
    if (r.success) return heartSuccess(room, me, c, ch, sc, r.reply);
    c.tries++;
    if (c.tries >= MAX_TRIES_TEXT) return heartFail(room, me, c);
    emitPlayer(me, 'call', publicCall(c));
    return { ok: true, correct: false };
  },

  'call:hangup'(conn, d, room, me) {
    const c = me.call;
    if (room.phase !== 'playing' || !c || c.id !== d.callId || c.kind !== 'heart' || c.status !== 'active') return { error: 'no_call' };
    return heartFail(room, me, c, true);
  },

  // ─── end of game: Polls & Feedback ───
  'end:feedback'(conn, d, room, me) {
    if (room.phase !== 'over' || !room.end || !['feedback', 'poll1', 'poll2'].includes(room.end.stage)) return { error: 'bad_phase' };
    const rating = Math.round(Number(d.rating));
    if (!(rating >= 1 && rating <= 10)) return { error: 'bad_rating' };
    me.endFeedback = { rating, text: cleanText(d.text, 300) };
    syncMe(me); broadcastState(room);
    return { ok: true };
  },

  'end:vote'(conn, d, room, me) {
    if (room.phase !== 'over' || !room.end || room.end.stage !== 'poll1') return { error: 'bad_phase' };
    if (!['george', 'ducky', 'skip'].includes(d.choice)) return { error: 'bad_option' };
    if (me.voteBlocked) return { error: 'vote_blocked' };
    if (me.endVote) { me.voteBlocked = true; me.endVote = null; syncMe(me); broadcastState(room); return { error: 'double_vote' }; } // second vote = bot
    me.endVote = d.choice;
    syncMe(me); broadcastState(room);
    return { ok: true };
  },

  'end:next'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    if (room.phase !== 'over' || !room.end) return { error: 'bad_phase' };
    const E = room.end;
    if (E.stage === 'board') {
      const left = E.order.filter((id) => !E.revealed.includes(id) && room.players.has(id));
      if (left.length) { E.revealed.push(left[0]); broadcastState(room); return { ok: true, revealed: left[0] }; }
    }
    const i = END_STAGES.indexOf(E.stage);
    if (i < END_STAGES.length - 1) enterStage(room, END_STAGES[i + 1]);
    return { ok: true, stage: room.end.stage };
  },

  // ─── managers: money, history, suggestions ───
  'admin:adjust'(conn, d, room, me) {
    if (!me.isHost) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    const amount = Math.round(Number(d.amount));
    if (!t || !amount || Math.abs(amount) > 10000) return { error: 'bad_amount' };
    addMoney(room, t, amount);
    logEvent(t, `${me.name} ${amount > 0 ? 'הוסיף/ה' : 'הוריד/ה'} ${Math.abs(amount)} מטבעות${d.reason ? ` (${cleanText(d.reason, 60)})` : ''}`,
      `${me.name} ${amount > 0 ? 'added' : 'removed'} ${Math.abs(amount)} coins${d.reason ? ` (${cleanText(d.reason, 60)})` : ''}`, amount, 'admin');
    syncMe(t); broadcastState(room);
    if (d.suggestedBy) { const s2 = room.players.get(d.suggestedBy); if (s2) emitPlayer(s2, 'suggest:done', { targetName: t.name, amount }); }
    return { ok: true, money: t.money };
  },

  async 'admin:history'(conn, d, room, me) {
    if (!me.isAdmin) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    if (!t) return { error: 'not_found' };
    const st = t.stats || { answered: 0, correct: 0 };
    const auto = {
      he: `ענה/תה על ${st.answered} שיחות, ${st.correct} מהן בהצלחה (${st.answered ? Math.round((100 * st.correct) / st.answered) : 0}%).${st.hangups ? ` ניתק/ה ${st.hangups} שיחות.` : ''}${looksDeliberate(t) ? ' ייתכן שנכשל/ה בכוונה.' : ''}`,
      en: `Answered ${st.answered} calls, ${st.correct} successfully (${st.answered ? Math.round((100 * st.correct) / st.answered) : 0}%).${st.hangups ? ` Hung up ${st.hangups} calls.` : ''}${looksDeliberate(t) ? ' May have failed on purpose.' : ''}`
    };
    const ai = d.ai ? await AI.historySummary(t.name, (t.log || []).map((l) => l.en)) : null;
    return { ok: true, name: t.name, money: t.money, stats: st, log: t.log || [], summary: ai || auto, byAI: !!ai };
  },

  'admin:suggest'(conn, d, room, me) {
    if (!me.isAdmin || me.isHost) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    const amount = Math.round(Number(d.amount));
    if (!t || !amount || Math.abs(amount) > 10000) return { error: 'bad_amount' };
    const host = room.players.get(room.hostId);
    if (host) emitPlayer(host, 'suggest', { from: me.name, fromId: me.id, targetId: t.id, targetName: t.name, amount, reason: cleanText(d.reason, 60) });
    return { ok: true };
  },

  // ─── chat ───
  async 'chat:send'(conn, d, room, me) {
    const text = cleanText(d.text, 300);
    const channel = d.channel;
    if (!text && !d.presetId) return { error: 'empty' };
    if (me.flagged) return { error: 'flagged' };
    if (channel === 'global' && me.mutedUntil > now()) return { error: 'muted', until: me.mutedUntil };
    if (now() - me.lastChatAt < 500) return { error: 'slow_down' };
    me.lastChatAt = now();

    if (channel === 'global') {
      if (me.mutedUntil > now()) return { error: 'muted', until: me.mutedUntil };
      const m = userMsg(me, text);
      room.global.push(m); if (room.global.length > 150) room.global.shift();
      emitRoom(room, 'chat', { channel: 'global', msg: m });
      return { ok: true };
    }

    if (channel === 'lb') {
      const list = room.lb.get(me.id) || []; room.lb.set(me.id, list);
      let qText = text;
      if (d.presetId) {
        const pr = C.LB_PRESETS.find((x) => x.id === d.presetId);
        if (!pr) return { error: 'bad_preset' };
        qText = L(me.lang, pr.he, pr.en);
      }
      const q = userMsg(me, qText);
      list.push(q); emitPlayer(me, 'lb', q);
      const b = board(room);
      const reply = await AI.lbReply({ text: qText, presetId: d.presetId, board: b, me: b.find((x) => x.id === me.id) || publicPlayer(me), lang: me.lang });
      const a = botMsg(reply);
      list.push(a); if (list.length > 100) list.splice(0, list.length - 100);
      emitPlayer(me, 'lb', a);
      return { ok: true };
    }

    if (channel === 'help') {
      // Admin replying to a ticket
      if (d.ticketId && me.isAdmin && d.ticketId !== me.id) {
        const t = room.tickets.get(d.ticketId);
        if (!t || !t.open) return { error: 'no_ticket' };
        if (t.adminId && t.adminId !== me.id) return { error: 'claimed', by: t.adminName };
        if (!t.adminId) claimTicket(room, t, me);
        pushTicketMsg(room, t, userMsg(me, text));
        return { ok: true };
      }
      // Player writing in their own help thread
      let t = room.tickets.get(me.id);
      if (!t || !t.open) {
        const brief = AI.helpBrief(text, 'he');
        const briefEn = AI.helpBrief(text, 'en');
        t = {
          id: me.id, playerName: me.name, messages: t ? t.messages : [], open: true, adminId: null, adminName: null,
          summary: text.slice(0, 160), aiAnswer: null, category: { he: brief.category, en: briefEn.category },
          howTo: { he: brief.howTo, en: briefEn.howTo }, botReplies: 0, updatedAt: now(), unread: 0
        };
        room.tickets.set(me.id, t);
      }
      pushTicketMsg(room, t, userMsg(me, text));
      if (!t.adminId) {
        const reply = await AI.helpReply({ text, lang: me.lang, firstReply: t.botReplies === 0, playerName: me.name });
        t.botReplies++;
        if (!t.aiAnswer) t.aiAnswer = reply;
        if (t.open) pushTicketMsg(room, t, botMsg(reply));
      }
      return { ok: true };
    }
    return { error: 'bad_channel' };
  },

  'help:claim'(conn, d, room, me) {
    if (!me.isAdmin) return { error: 'not_allowed' };
    const t = room.tickets.get(d.ticketId);
    if (!t || !t.open) return { error: 'no_ticket' };
    if (t.adminId && t.adminId !== me.id) return { error: 'claimed', by: t.adminName };
    if (!t.adminId) claimTicket(room, t, me);
    return { ok: true };
  },

  'help:release'(conn, d, room, me) {
    const t = room.tickets.get(d.ticketId);
    if (!t || t.adminId !== me.id) return { error: 'not_allowed' };
    t.adminId = null; t.adminName = null;
    const m = sysMsg(''); m.event = { type: 'admin_left', name: me.name };
    pushTicketMsg(room, t, m);
    return { ok: true };
  },

  'help:close'(conn, d, room, me) {
    const t = room.tickets.get(d.ticketId);
    if (!t || !(me.isAdmin || t.id === me.id)) return { error: 'not_allowed' };
    const m = sysMsg(''); m.event = { type: 'closed', name: me.name };
    pushTicketMsg(room, t, m);
    t.open = false; t.adminId = null;
    emitAdmins(room, 'tickets', ticketList(room));
    return { ok: true };
  },

  // ─── moderation ───
  'mod:mute'(conn, d, room, me) {
    if (!me.isAdmin) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    if (!t || t.isHost || (t.isAdmin && !me.isHost)) return { error: 'not_allowed' };
    const minutes = Math.max(0, Math.min(60, Number(d.minutes) || 0));
    t.mutedUntil = minutes ? now() + minutes * 60000 : 0;
    syncMe(t); broadcastState(room);
    const m = sysMsg(''); m.event = { type: minutes ? 'muted' : 'unmuted', name: t.name, minutes, by: me.name };
    room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
    return { ok: true };
  },

  'mod:kick'(conn, d, room, me) {
    if (!me.isAdmin) return { error: 'not_allowed' };
    const t = room.players.get(d.targetId);
    if (!t || t.isHost || (t.isAdmin && !me.isHost)) return { error: 'not_allowed' };
    removePlayer(room, t, 'kicked');
    const m = sysMsg(''); m.event = { type: 'kicked', name: t.name, by: me.name };
    room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
    return { ok: true };
  }
};

// Test-only: force the next caller (enabled with TEST_HOOKS=1)
if (process.env.TEST_HOOKS) {
  handlers['test:force'] = (conn, d, room, me) => {
    const ch = [...CALLER_POOL, ...HEART_POOL].find((x) => x.id === d.charId); if (!ch) return { error: 'bad' };
    clearTimeout(me.callTimer);
    const call = rollCallFor(ch); me.call = call; emitPlayer(me, 'call', publicCall(call));
    return { ok: true };
  };
}

function heartSuccess(room, me, c, ch, sc, aiReply) {
  addMoney(room, me, ch.reward);
  logEvent(me, `עזר/ה ל${ch.name.he}${c.world === 'planet' ? ' בכוכב ג\'ורג\'' : c.world === 'minecraft' ? ' בעולם המיינקראפט' : ''} — ${(c.tasks && c.tasks.greet) ? 'בירך/ה, ' : ''}ביקש/ה מספר קופה, בדק/ה תיק וענה/תה נכון`,
    `Helped ${ch.name.en}${c.world === 'planet' ? ' on Planet George' : c.world === 'minecraft' ? ' in the Minecraft world' : ''} — ${(c.tasks && c.tasks.greet) ? 'greeted, ' : ''}asked for the fund number, checked the file and answered correctly`, ch.reward, 'success');
  me.stats.answered++; me.stats.correct++;
  if (ch.booster || c.world || ['epic', 'legendary'].includes(ch.rarity)) me.stats.rare.push(ch.id);
  finishCall(room, me, { kind: 'heart', correct: true, delta: ch.reward, ok: sc.ok, aiReply: aiReply || null, booster: !!ch.booster, world: c.world || null });
  if (ch.booster || c.world) {
    const m = sysMsg(''); m.event = { type: 'rare', player: me.name, charId: ch.id, delta: ch.reward };
    room.global.push(m); emitRoom(room, 'chat', { channel: 'global', msg: m });
  }
  return { ok: true, correct: true };
}

function heartFail(room, me, c, hungUp) {
  me.stats.answered++;
  if (hungUp) me.stats.hangups = (me.stats.hangups || 0) + 1;
  const ch = byId[c.charId];
  logEvent(me, hungUp ? `ניתק/ה את השיחה עם ${ch.name.he}` : `לא הצליח/ה לעזור ל${ch.name.he} (${c.tries} תשובות שגויות)`,
    hungUp ? `Hung up on ${ch.name.en}` : `Couldn't help ${ch.name.en} (${c.tries} wrong answers)`, 0, hungUp ? 'hangup' : 'fail');
  finishCall(room, me, { kind: 'heart', correct: false, delta: 0, hungUp: !!hungUp, world: c.world || null });
  return { ok: true, correct: false };
}

function claimTicket(room, t, admin) {
  t.adminId = admin.id; t.adminName = admin.name;
  const m = sysMsg(''); m.event = { type: 'admin_joined', name: admin.name };
  pushTicketMsg(room, t, m);
}

function attach(conn, room, p) {
  if (conn.meta) detach(conn);
  conn.meta = { code: room.code, playerId: p.id };
  p.conns.add(conn);
  p.lastSeen = now();
  // Full snapshot for this connection
  sendTo(conn, 'room', roomState(room));
  sendTo(conn, 'me', meState(p));
  sendTo(conn, 'history', historyFor(room, p));
  broadcastState(room);
}

function historyFor(room, p) {
  return {
    global: room.global.slice(-80),
    lb: room.lb.get(p.id) || [],
    help: room.tickets.get(p.id)?.messages || [],
    tickets: p.isAdmin ? ticketList(room) : null,
    ticketMsgs: p.isAdmin ? Object.fromEntries([...room.tickets.values()].filter((t) => t.open).map((t) => [t.id, t.messages])) : null
  };
}

function detach(conn) {
  const m = conn.meta; if (!m) return;
  const room = rooms.get(m.code);
  const p = room?.players.get(m.playerId);
  if (p) { p.conns.delete(conn); p.lastSeen = now(); broadcastState(room); }
  conn.meta = null;
}

// ───────────────────────── Internet link (Cloudflare quick tunnel) ─────────────────────────
// If cloudflared(.exe) sits next to server.js, start a free quick tunnel (no account)
// so players anywhere can join through a public https link.
let publicOrigin = null;
function setPublicOrigin(origin) {
  publicOrigin = origin;
  for (const room of rooms.values()) {
    room.joinUrl = `${origin}/?room=${room.code}`;
    room.qr = qrSvg(room.joinUrl);
    broadcastState(room);
  }
  const line = '  ' + '='.repeat(58);
  console.log(`\n${line}\n   INTERNET LINK READY - send this to players anywhere:\n\n     ${origin}\n\n   (it also appears under the QR code in the waiting room)\n${line}\n`);
}
function startTunnel() {
  const bin = process.env.CLOUDFLARED || path.join(__dirname, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (process.env.NO_TUNNEL || !fs.existsSync(bin)) return;
  console.log('   Creating an internet link for players outside your Wi-Fi...');
  const { spawn } = require('child_process');
  const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { windowsHide: true });
  const scan = (buf) => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== publicOrigin) setPublicOrigin(m[0]);
  };
  child.stdout.on('data', scan); child.stderr.on('data', scan);
  child.on('error', () => console.log('   Could not start the internet link. Same-Wi-Fi play still works.'));
  child.on('exit', () => { if (publicOrigin) console.log('   The internet link stopped.'); publicOrigin = null; });
  const stop = () => { try { child.kill(); } catch (_) {} };
  process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(0); });
}

// ───────────────────────── HTTP ─────────────────────────
// Browser copy of the heart edition: names, bios and lines only — no questions or answers.
const HEART_PUBLIC_JS = 'window.HEART=' + JSON.stringify({
  CAST: H.CAST.map(({ scenarios, ...c }) => c),
  MINECRAFT: H.MINECRAFT.map(({ scenarios, ...c }) => c),
  PLANET: H.PLANET.map(({ scenarios, ...c }) => c),
  INFO: H.INFO, MODES: H.MODES, PRESETS: H.PRESETS, TASKS: H.TASKS
}) + ';';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
  let base = PUBLIC_DIR; let rel = url.pathname;
  if (rel === '/shared/heart.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-cache' }); return res.end(HEART_PUBLIC_JS); }
  if (rel.startsWith('/shared/')) { base = SHARED_DIR; rel = rel.slice('/shared'.length); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(base, decodeURIComponent(rel)));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

attachWebSocketServer(server, '/ws', (conn) => {
  conn.meta = null;
  conn.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch (_) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') return sendTo(conn, 'pong', { now: now(), c: msg.d?.c });
    const h = handlers[msg.t];
    let result;
    try {
      if (!h) result = { error: 'unknown' };
      else if (['room:create', 'room:join', 'session:resume'].includes(msg.t)) result = await h(conn, msg.d || {});
      else {
        const room = conn.meta && rooms.get(conn.meta.code);
        const me = room && room.players.get(conn.meta.playerId);
        result = me ? await h(conn, msg.d || {}, room, me) : { error: 'no_session' };
      }
    } catch (e) {
      console.error('handler error', msg.t, e);
      result = { error: 'server_error' };
    }
    if (msg.rid) conn.send(JSON.stringify({ t: 'ack', rid: msg.rid, d: result }));
  });
  conn.on('close', () => detach(conn));
});

// Clean up abandoned rooms (nobody connected for 20 min)
setInterval(() => {
  for (const [code, room] of rooms) {
    const anyone = [...room.players.values()].some((p) => p.conns.size > 0 || now() - p.lastSeen < 20 * 60000);
    if (!anyone) {
      clearTimeout(room.endTimer);
      for (const p of room.players.values()) clearTimeout(p.callTimer);
      rooms.delete(code);
    }
  }
}, 60000).unref();

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  The game is already running in another window (port ${PORT} is busy).`);
    console.log('  Close the other black window first, then start again.\n');
  } else console.error(e);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const all = lanAddresses();
  const ip = all.length ? all[0].address : null;
  const line = '  ' + '='.repeat(58);
  console.log(`\n${line}`);
  console.log('   MEDI-OS is running!  Keep this window open while you play.');
  console.log(line);
  console.log(`   On THIS computer open:   http://localhost:${PORT}`);
  if (ip) {
    console.log(`   On PHONES (same Wi-Fi):  http://${ip}:${PORT}`);
    const rest = all.slice(1).filter((a) => a.score > -5);
    if (rest.length) console.log(`   (if that one fails try:  ${rest.map((a) => `http://${a.address}:${PORT}`).join('  or  ')})`);
  } else {
    console.log('   No Wi-Fi network found - phones cannot join until this computer is on Wi-Fi.');
  }
  console.log('   Or just scan the QR code in the waiting room.');
  console.log(`${line}\n`);
  if (AI.aiEnabled()) console.log('   AI: Claude API\n');
  startTunnel();
});

module.exports = { server, rooms, _rollCall: rollCall };
