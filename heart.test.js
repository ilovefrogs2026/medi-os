'use strict';
// Heart edition: odds, fund number → file lookup → answer, rewards only on success,
// Noob → Minecraft world, George → Planet George. Run: node test/heart.test.js
process.env.PORT = process.env.PORT || '3931';
process.env.GEORGE_TALK_MS = '1200';
process.env.TEST_HOOKS = '1';
const assert = require('assert');
const H = require('../shared/heart');
const { server, _rollCall } = require('../server.js');

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ✓', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(`ws://localhost:${process.env.PORT}/ws`);
  const c = { ws, n: 0, acks: new Map(), calls: [], me: null, waiters: [] };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'ack') { const r = c.acks.get(m.rid); c.acks.delete(m.rid); return r && r(m.d); }
    if (m.t === 'me') c.me = m.d;
    if (m.t === 'call' && m.d) { c.calls.push(m.d); c.waiters = c.waiters.filter((w) => (w.p(m.d) ? (w.r(m.d), false) : true)); }
  };
  c.open = new Promise((r) => (ws.onopen = r));
  c.req = (t, d) => new Promise((r) => { const rid = String(++c.n); c.acks.set(rid, r); ws.send(JSON.stringify({ t, d, rid })); });
  c.waitCall = (p, ms = 9000) => new Promise((r, j) => {
    const hit = c.calls.find(p); if (hit) { c.calls = []; return r(hit); }
    c.waiters.push({ p, r: (x) => { c.calls = []; r(x); } }); setTimeout(() => j(new Error('timeout waiting for call')), ms);
  });
  return c;
}

(async () => {
  await new Promise((r) => (server.listening ? r() : server.on('listening', r)));

  console.log('Odds (heart mode, 20,000 rolls)');
  const counts = {}; const p = {};
  for (let i = 0; i < 20000; i++) { p.hist = null; const c = _rollCall(p, { mode: 'heart' }); counts[c.charId] = (counts[c.charId] || 0) + 1; }
  for (const ch of H.CAST) {
    const pct = (counts[ch.id] || 0) / 200;
    ok(Math.abs(pct - ch.weight) < 1.5, `${ch.name.en}: ${pct.toFixed(1)}% (target ${ch.weight}%)`);
  }
  const classicLeak = Object.keys(counts).some((id) => !id.startsWith('h_'));
  ok(!classicLeak, 'heart mode never sends classic callers');

  console.log('Answer keys stay on the server');
  const pub = await (await fetch(`http://localhost:${process.env.PORT}/shared/heart.js`)).text();
  ok(!pub.includes('"scenarios"') && !pub.includes('"a":'), 'browser copy of heart.js has no questions or answers');

  console.log('Call flow');
  const t = client(); await t.open;
  const cr = await t.req('room:create', { name: 'Teacher', duration: 5, mode: 'heart', origin: 'http://localhost' });
  ok(cr.code, 'teacher created a heart-mode game');
  await t.req('game:start', {});

  // force a regular heart patient
  await t.req('test:force', { charId: 'h_gadi' });
  let call = await t.waitCall((c) => c.charId === 'h_gadi' && c.status === 'ringing');
  await t.req('call:pickup', { callId: call.id });
  call = await t.waitCall((c) => c.status === 'active');
  ok(call.stage === 'talk' && !call.fund && !call.q && call.talk.length === 0, 'player writes first: no patient text, number or question yet');
  await t.req('call:say', { callId: call.id, text: 'שלום, איך אני יכול לעזור לך?' });
  call = await t.waitCall((c) => c.talk.length >= 2);
  ok(call.tasks.greet && !call.tasks.fund, 'task 1 (greeting) gets a green V');
  ok(call.talk[1].who === 'patient' && /היצרות עורקים/.test(call.talk[1].he) && !call.talk[1].he.includes('?'), 'patient states the problem plainly, no odd questions');
  await t.req('call:say', { callId: call.id, presetId: 'fund1' });
  call = await t.waitCall((c) => c.stage === 'fund');
  ok(call.tasks.fund, 'task 2 (health-fund number) gets a green V');
  ok(/^\d{7}$/.test(call.fund), `patient gives a health-fund number (${call.fund})`);
  ok((await t.req('mda:lookup', { number: '1234567' })).error === 'no_file', 'wrong number finds no file');
  const look = await t.req('mda:lookup', { number: call.fund.slice(0, 3) + '-' + call.fund.slice(3) });
  ok(look.ok && look.file.text.he, 'MDA lookup with the number opens the medical file');
  ok(look.file.card.age.he === '60' && look.file.card.job.he === 'מכונאי רכב' && /עישון כבד/.test(look.file.card.history.he), 'medical card shows age, job and history');
  call = await t.waitCall((c) => c.stage === 'file');
  ok(call.choices.length === 4 && call.q.he, 'question and 4 choices appear after the lookup');
  ok(!('a' in call) && !JSON.stringify(call).includes('"a":'), 'correct answer is not sent to the player');

  // wrong then wrong → no reward
  const sc = H.CAST.find((c) => c.id === 'h_gadi').scenarios;
  const scen = sc.find((s) => s.q.he === call.q.he);
  const wrong = call.choices.map((c) => c.i).filter((i) => i !== scen.a);
  const before = t.me.money;
  await t.req('call:choose', { callId: call.id, option: wrong[0] });
  call = await t.waitCall((c) => c.tries === 1);
  ok(call.reply && call.removed.includes(wrong[0]), 'wrong answer: patient reacts and that choice is removed');
  ok(!JSON.stringify(call.reply).includes(scen.o[scen.a].he), 'patient does not reveal the answer');
  await t.req('call:choose', { callId: call.id, option: wrong[1] });
  call = await t.waitCall((c) => c.status === 'done');
  await sleep(80);
  ok(!call.result.correct && call.result.delta === 0 && t.me.money === before, 'two wrong answers: patient gives up, no money');

  // correct → reward
  await sleep(5200);
  await t.req('test:force', { charId: 'h_rosa' });
  call = await t.waitCall((c) => c.charId === 'h_rosa' && c.status === 'ringing');
  await t.req('call:pickup', { callId: call.id });
  await t.req('call:say', { callId: call.id, text: 'what is your health fund number?' });
  call = await t.waitCall((c) => c.stage === 'fund');
  ok(!call.tasks.greet && call.tasks.fund, 'asking for the number without greeting: only task 2 is ticked');
  await t.req('mda:lookup', { number: call.fund });
  call = await t.waitCall((c) => c.stage === 'file');
  const rs = H.CAST.find((c) => c.id === 'h_rosa').scenarios.find((s) => s.q.he === call.q.he);
  await t.req('call:choose', { callId: call.id, option: rs.a });
  call = await t.waitCall((c) => c.status === 'done');
  await sleep(80);
  ok(call.result.correct && call.result.delta === 120 && t.me.money === before + 120, 'correct guidance: success summary and $120');
  ok((await t.req('call:reply', { callId: call.id, text: 'x' })).error, 'free-text answers are off without an AI key');

  // Noob → Minecraft
  await sleep(5200);
  await t.req('test:force', { charId: 'h_noob' });
  call = await t.waitCall((c) => c.charId === 'h_noob' && c.status === 'ringing');
  await t.req('call:pickup', { callId: call.id });
  ok((await t.req('call:george', { callId: call.id, yes: true })).error === 'too_early', 'Noob: answer locked while he talks');
  await sleep(1300);
  const go = await t.req('call:george', { callId: call.id, yes: true });
  ok(go.launch && go.world === 'minecraft', 'YES sends the player to the Minecraft world');
  call = await t.waitCall((c) => c.world === 'minecraft');
  ok(['h_ducky', 'h_shaked'].includes(call.charId) && call.stage === 'talk', `Minecraft patient: ${call.charId}`);
  await t.req('call:say', { callId: call.id, presetId: 'fund1' });
  call = await t.waitCall((c) => c.stage === 'fund');
  const mcLook = await t.req('mda:lookup', { number: call.fund });
  ok(mcLook.file.card.age.he === '3' && mcLook.file.card.job.he === 'להיות נוב' && mcLook.file.card.history.he === 'יותר מדי נוב', 'Minecraft card: age 3, being a noob, too much noob');
  await t.req('call:hangup', { callId: call.id });
  call = await t.waitCall((c) => c.status === 'done');
  ok(call.result.hungUp && call.result.delta === 0, 'hanging up gives no reward');

  console.log('End of game');
  const s2 = client(); await s2.open; const j2 = await s2.req('room:join', { code: cr.code, name: 'Student' });
  const s3 = client(); await s3.open; await s3.req('room:join', { code: cr.code, name: 'Student2' });
  await sleep(200);
  ok((await s2.req('end:next', {})).error === 'not_allowed', 'only the host can move between stages');
  await t.req('game:end', {});
  await sleep(150);
  ok(!s2.me.call, 'calls stop when the timer ends');
  ok((await s2.req('call:pickup', { callId: 'x' })).error, 'calls are locked after the end');
  ok((await s2.req('end:feedback', { rating: 11, text: '' })).error, 'rating must be 1-10');
  ok((await s2.req('end:feedback', { rating: 9, text: 'משחק מעולה, למדתי הרבה על הלב' })).ok, 'student sends feedback + rating');
  await t.req('end:feedback', { rating: 7, text: 'טוב' });
  await t.req('end:next', {}); // poll1
  ok((await s2.req('end:vote', { choice: 'george' })).ok, 'student votes GEORGE');
  ok((await s2.req('end:vote', { choice: 'ducky' })).error === 'double_vote', 'second vote is flagged as a bot');
  ok((await s2.req('end:vote', { choice: 'ducky' })).error === 'vote_blocked', 'that student is blocked from voting');
  ok((await s3.req('end:vote', { choice: 'skip' })).ok, 'another student skips');
  await sleep(120);
  const rsEnd = await new Promise((r) => { const ws = s3.ws; const h = (e) => { const m = JSON.parse(e.data); if (m.t === 'room') { ws.removeEventListener('message', h); r(m.d); } }; ws.addEventListener('message', h); s3.req('player:lang', { lang: 'he' }); t.req('admin:adjust', { targetId: j2.playerId, amount: 50 }); });
  ok(rsEnd.end.poll1.george === 0 && rsEnd.end.poll1.skip === 1 && rsEnd.end.poll1.blocked === 1, 'blocked vote is not counted; exact counts shown');
  await t.req('end:next', {}); // poll2
  await sleep(120);
  await t.req('end:next', {}); // poll3
  await sleep(120);
  await t.req('end:next', {}); // board
  const steps = [];
  for (let i = 0; i < 3; i++) steps.push(await t.req('end:next', {}));
  ok(steps.every((x) => x.revealed), 'each Space press moves one player into the main table');
  const pod = await t.req('end:next', {});
  ok(pod.stage === 'podium', 'after the last player: the podium');
  const hist = await t.req('admin:history', { targetId: j2.playerId });
  ok(hist.ok && hist.log.some((l) => l.tag === 'admin'), 'managers see the player history, including money changes');
  ok((await s2.req('admin:adjust', { targetId: j2.playerId, amount: 999 })).error === 'not_allowed', 'only the host can change money');

  console.log(`\nAll ${passed} checks passed.`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
