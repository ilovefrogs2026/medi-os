'use strict';
// Heart edition: odds, fund number → file lookup → answer, rewards only on success,
// Noob → Minecraft world, George → Planet George. Run: node test/heart.test.js
process.env.PORT = process.env.PORT || '3931';
process.env.GEORGE_TALK_MS = '1200';
process.env.TEST_HOOKS = '1';
const assert = require('assert');
const H = require('../shared/heart');
const { server, _rollCall, rooms } = require('../server.js');

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

const s2req = (c, t, d) => c.req(t, d);
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
  ok(cr.code, 'teacher created a game');
  const x = client(); await x.open;
  const crx = await x.req('room:create', { name: 'Other', duration: 5, mode: 'classic', origin: 'http://localhost' });
  ok(rooms.get(crx.code).mode === 'heart', 'game is heart & vessels only (classic mode request ignored)');
  await t.req('game:start', {});

  // force a regular heart patient
  await t.req('test:force', { charId: 'h_gadi' });
  let call = await t.waitCall((c) => c.charId === 'h_gadi' && c.status === 'ringing');
  await t.req('call:pickup', { callId: call.id });
  call = await t.waitCall((c) => c.status === 'active');
  ok(call.stage === 'talk' && !call.fund && !call.file && call.talk.length === 0, 'player writes first: no patient text, number or file yet');
  ok(call.goal && call.goal.he && call.need >= 1, 'the case task is known for the Tasks app');
  await t.req('call:say', { callId: call.id, text: 'שלום, איך אני יכול לעזור לך?' });
  call = await t.waitCall((c) => c.talk.length >= 2);
  ok(call.tasks.greet && !call.tasks.fund, 'task 1 (greeting) gets a green V');
  ok(call.talk[1].who === 'patient' && /לא מרגיש טוב/.test(call.talk[1].he) && /רגליים|חזה/.test(call.talk[1].he), 'patient says he is not feeling well and gives brief symptoms');
  await t.req('call:say', { callId: call.id, text: 'מה מזג האוויר אצלך?' });
  call = await t.waitCall((c) => c.talk.length >= 4);
  ok(!call.tasks.fund && /לא הבנתי/.test(call.talk[3].he), 'an unrelated request: the patient does not understand and gives no number');
  await t.req('call:say', { callId: call.id, presetId: 'fund1' });
  call = await t.waitCall((c) => c.stage === 'fund');
  ok(call.tasks.fund, 'task 2 (health-fund number) gets a green V');
  ok(/^\d{7}$/.test(call.fund), `patient gives a health-fund number (${call.fund})`);
  ok((await t.req('mda:lookup', { number: '1234567' })).error === 'no_file', 'wrong number finds no file');
  const look = await t.req('mda:lookup', { number: call.fund.slice(0, 3) + '-' + call.fund.slice(3) });
  ok(look.ok && look.file.text.he, 'MDA lookup with the number opens the medical file');
  ok(look.file.card.age.he === '60' && look.file.card.job.he === 'מכונאי רכב' && /עישון כבד/.test(look.file.card.history.he), 'medical card shows age, job and history');
  call = await t.waitCall((c) => c.stage === 'file');
  ok(!call.choices && !call.q && call.file.he && call.goal.he, 'no multiple choice: the file shows the problem and the case task');
  ok(call.tasks.file && call.talk[call.talk.length - 1].who === 'patient', 'task 3 (look in MDA) ticked; patient asks what to do');
  ok(call.ask && /ממתי|מתי/.test(call.ask.he) && !call.tasks.ask, `tasks update to the case once the file is open: "${call.ask.he}"`);
  ok(!JSON.stringify(call).includes('"keys"'), 'the judging words are not sent to the player');
  const scen = H.CAST.find((c) => c.id === 'h_gadi').scenarios.find((x) => x.file.he === call.file.he);
  const words = (n) => scen.keys.slice(0, n).map((g) => g[0]).join(' ו');
  const before = t.me.money;
  // unhelpful messages → patient reacts, never gives the answer, then gives up
  for (let i = 0; i < 4; i++) { await t.req('call:say', { callId: call.id, text: 'אני לא יודע' }); await sleep(40); }
  call = t.calls[t.calls.length - 1]; t.calls = [];
  const lastPatient = call.talk.filter((m) => m.who === 'patient').pop();
  ok(lastPatient && lastPatient.he === 'אתה יכול להפסיק להתעסק בשטויות ולעזור לי כבר?', 'off-task messages: "stop messing around and help me already?"');
  await t.req('call:say', { callId: call.id, text: 'לא יודע' });
  call = await t.waitCall((c) => c.status === 'done');
  await sleep(80);
  ok(!call.result.correct && call.result.delta === 0 && t.me.money === before, 'after 5 unhelpful messages the patient gives up: no money');

  // free-text guidance in own words → reward
  await sleep(5200);
  await t.req('test:force', { charId: 'h_rosa' });
  call = await t.waitCall((c) => c.charId === 'h_rosa' && c.status === 'ringing');
  await t.req('call:pickup', { callId: call.id });
  await t.req('call:say', { callId: call.id, text: 'what is your health fund number?' });
  call = await t.waitCall((c) => c.stage === 'fund');
  ok(!call.tasks.greet && call.tasks.fund, 'asking for the number without greeting: only task 2 is ticked');
  await t.req('mda:lookup', { number: call.fund });
  call = await t.waitCall((c) => c.stage === 'file');
  const rs = H.CAST.find((c) => c.id === 'h_rosa').scenarios.find((x) => x.file.he === call.file.he);
  ok((await t.req('call:say', { callId: call.id, presetId: 'greet1' })).error === 'type_yourself', 'no ready-made messages after the file: the player types');
  await t.req('call:say', { callId: call.id, text: `כדאי לך ${rs.keys[0][0]} ו${rs.keys[1][0]}` });
  call = await t.waitCall((c) => c.progress >= 2);
  ok(call.status === 'active' && !call.tasks.goal && /עוד לא שאלת/.test(call.talk[call.talk.length - 1].he), 'right advice without asking the case question: no money yet');
  await t.req('call:say', { callId: call.id, text: 'מה את אוכלת ביום רגיל?' });
  call = await t.waitCall((c) => c.status === 'done');
  await sleep(80);
  const thanks = call.talk.filter((m) => m.who === 'patient').pop();
  ok(call.tasks.ask && thanks.he.startsWith('תודה על העזרה!') && /אוכל|ירקות|מלח/.test(thanks.he), `patient thanks and commits to a change: "${thanks.he}"`);
  ok(call.result.correct && call.result.delta === 120 && t.me.money === before + 120 && call.tasks.goal, 'only then: success and $120');

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

  console.log('BOTGEORGE');
  const hp = client(); await hp.open; const jh = await hp.req('room:join', { code: cr.code, name: 'Helper' });
  const helpMsgs = []; hp.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'help') helpMsgs.push(m.d.msg); });
  ok((await hp.req('chat:send', { channel: 'help', text: 'hi' })).error === 'ticket_closed', 'no ticket yet: the bot must open the chat first');
  const st = await hp.req('help:start', {}); await sleep(600);
  ok(st.created && helpMsgs[0].from.name === 'BOTGEORGE' && helpMsgs[0].text === 'היי, השם שלי הוא BOTGEORGE אני AI ואני יעזור לך עד שיצטרף מנהל לשיחה איך אפשר לעזור?', 'BOTGEORGE always sends the fixed first message');
  await hp.req('chat:send', { channel: 'help', text: 'איפה מקלידים את המספר של הקופה?' }); await sleep(600);
  const botAns = helpMsgs[helpMsgs.length - 1];
  ok(botAns.from.name === 'BOTGEORGE' && botAns.actions, 'bot answers from the second message, with the 3 action buttons');
  await hp.req('help:action', { action: 'continue' }); await sleep(60);
  ok(helpMsgs[helpMsgs.length - 1].text === 'תודה שבחרת להמשיך, מה לא הבנת?', '"continue chatting" reply');
  await hp.req('help:action', { action: 'manager' }); await sleep(60);
  ok(helpMsgs[helpMsgs.length - 1].text === 'קיבלנו את בחירתך, המנהל יצטרף בקרוב לשיחה', '"call a manager" reply');
  await sleep(600);
  const tl = await new Promise((r) => { const h = (e) => { const m = JSON.parse(e.data); if (m.t === 'tickets') { t.ws.removeEventListener('message', h); r(m.d); } }; t.ws.addEventListener('message', h); hp.req('chat:send', { channel: 'help', text: 'עדיין לא הבנתי' }); });
  ok(tl[0].priority && tl[0].ownerId === jh.playerId, 'called a manager: ticket jumps to the top of the managers\' list');
  await hp.req('help:action', { action: 'helped' }); await sleep(60);
  ok(helpMsgs.some((m) => m.text === 'תודה שכתבת לנו, אם תהיה לך עוד שאלה תפנה אלינו'), '"you helped me" reply, ticket resolved');
  await sleep(600);
  ok((await hp.req('chat:send', { channel: 'help', text: 'שוב' })).error === 'ticket_closed', 'a resolved ticket cannot be reopened');
  await sleep(600);
  const st3 = await hp.req('help:start', {});
  ok(st3.created && st3.ticketId !== st.ticketId, 'a new ticket can be opened instead');
  await hp.req('chat:send', { channel: 'help', text: 'איפה מקלידים את המספר של הקופה?' }); await sleep(600);
  ok(/קודם|before/.test(helpMsgs[helpMsgs.length - 1].text), 'BOTGEORGE remembers the earlier question and explains differently');

  console.log('Anti-cheat + Notes');
  const notes = []; t.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'note') notes.push(m.d); });
  await hp.req('admin:adjust', { targetId: jh.playerId, amount: 9999 });
  await hp.req('client:beat', { app: 'calls', money: 99999 });
  await hp.req('hack:money', { amount: 1 });
  await sleep(120);
  ok(notes.some((n) => n.kind === 'privilege' && n.severity === 'critical' && n.name === 'Helper'), 'unauthorized money attempt → critical note');
  ok(notes.some((n) => n.kind === 'money' && n.details.shown === 99999), 'money changed on screen → critical note with details');
  ok(notes.some((n) => n.kind === 'tamper'), 'unknown/tampered request → note');
  const nn = notes.find((n) => n.kind === 'money');
  ok(nn.snapshot && 'idleSec' in nn.snapshot && nn.snapshot.app === 'calls' && 'connected' in nn.snapshot && 'rank' in nn.snapshot, 'note shows what the player is doing, state, activity and idle time');

  console.log('Host powers');
  const dms = []; hp.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'dm') dms.push(m.d); });
  ok((await hp.req('dm:send', { text: 'hello host' })).error === 'not_allowed', 'players cannot start a direct chat');
  ok((await t.req('dm:send', { targetId: jh.playerId, text: 'שלום, הכל בסדר?' })).ok, 'host opens a direct chat with a player');
  ok((await hp.req('dm:send', { text: 'כן תודה' })).ok, 'player can reply to the host');
  await sleep(60); ok(dms.length === 2, 'both messages delivered');
  ok((await hp.req('admin:limit', { targetId: cr.playerId, ability: 'chat', minutes: 5 })).error === 'not_allowed', 'only the host can restrict');
  ok((await t.req('admin:limit', { targetId: jh.playerId, ability: 'chat', minutes: 5 })).ok, 'host restricts chat for 5 minutes');
  await sleep(600);
  ok((await hp.req('chat:send', { channel: 'global', text: 'hi all' })).error === 'limited', 'restricted player cannot use the chat');
  await t.req('admin:limit', { targetId: jh.playerId, ability: 'calls', minutes: -1 });
  ok((await hp.req('call:pickup', { callId: 'x' })).error, 'calls restricted until the end of the game');
  await t.req('admin:limit', { targetId: jh.playerId, ability: 'chat', minutes: 0 });
  await sleep(600);
  ok((await hp.req('chat:send', { channel: 'global', text: 'back' })).ok, 'host removes the restriction');

  console.log('End of game');
  const s2 = client(); await s2.open; const j2 = await s2.req('room:join', { code: cr.code, name: 'Student' });
  const s3 = client(); await s3.open; await s3.req('room:join', { code: cr.code, name: 'Student2' });
  await sleep(200);
  ok((await s2.req('end:next', {})).error === 'not_allowed', 'only the host can move between stages');
  await t.req('game:end', {});
  await sleep(150);
  ok(!s2.me.call, 'calls stop when the timer ends');
  ok((await s2.req('call:pickup', { callId: 'x' })).error, 'calls are locked after the end');
  ok(rooms.get(cr.code).end.stage === 'feedback', 'when calls stop the Feedback app opens');
  ok((await s2.req('end:feedback', { rating: 11, text: '' })).error, 'rating must be 1-10');
  ok((await s2.req('end:feedback', { rating: 9, text: 'משחק מעולה, למדתי הרבה על הלב' })).ok, 'student sends a rating + a sentence');
  await t.req('end:feedback', { rating: 6, text: 'טוב' });
  ok((await s2.req('end:vote', { choice: 'george' })).error === 'bad_phase', 'no character poll');
  const rsl = await t.req('end:next', {});
  const R = rooms.get(cr.code).end;
  ok(rsl.stage === 'results' && R.poll3.score === 7.5 && R.poll3.reviews.length <= 8 && typeof R.poll2.pct === 'number', `AI results: average ${R.poll3.score}/10, learning success ${R.poll2.pct}%, up to 8 random reviews`);
  ok((await s2.req('end:feedback', { rating: 3, text: 'late' })).error === 'bad_phase', 'feedback closes once the results are shown');
  await t.req('end:next', {}); // board
  const steps = [];
  const nPlayers = rooms.get(cr.code).players.size;
  for (let i = 0; i < nPlayers; i++) steps.push(await t.req('end:next', {}));
  ok(steps.every((x) => x.revealed), `each Space press moves one player into the main table (${nPlayers} presses)`);
  const pod = await t.req('end:next', {});
  ok(pod.stage === 'podium', 'after the last player: the podium');
  await t.req('admin:adjust', { targetId: j2.playerId, amount: 50, reason: 'בונוס' });
  const hist = await t.req('admin:history', { targetId: j2.playerId });
  ok(hist.ok && hist.log.some((l) => l.tag === 'admin'), 'managers see the player history, including money changes');
  ok((await s2.req('admin:adjust', { targetId: j2.playerId, amount: 999 })).error === 'not_allowed', 'only the host can change money');
  const P = rooms.get(cr.code).end.podium;
  ok(P.top.length >= 3 && P.top.every((x) => x.stats && x.summary && x.achievements.length && x.analysis && x.analysis.strengths.length && Array.isArray(x.performance)), 'podium cards: achievements, patient performance and AI analysis');

  console.log(`\nAll ${passed} checks passed.`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
