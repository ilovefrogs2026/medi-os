'use strict';
// End-to-end protocol test: spins up the server and drives several WebSocket clients.
// Run: node test/protocol.test.js
process.env.PORT = process.env.PORT || '3917';
process.env.GEORGE_TALK_MS = '1500';
process.env.TEST_HOOKS = '1';
const assert = require('assert');
const { server } = require('../server.js');
const URL = `ws://localhost:${process.env.PORT}/ws`;

function client(label) {
  const ws = new WebSocket(URL);
  const c = { label, ws, events: [], waiters: [], acks: new Map(), n: 0, state: null, me: null, call: null };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'ack') { const r = c.acks.get(m.rid); if (r) { c.acks.delete(m.rid); r(m.d); } return; }
    if (m.t === 'room') c.state = m.d;
    if (m.t === 'me') { c.me = m.d; if (process.env.DBG && label === 'alice') console.log('    [me]', m.d.money, m.d.call && m.d.call.charId, m.d.call && m.d.call.status); }
    if (m.t === 'call') c.call = m.d;
    const w = c.waiters.find((x) => x.pred(m));
    if (w) { c.waiters.splice(c.waiters.indexOf(w), 1); w.res(m.d); } else c.events.push(m);
  };
  c.open = new Promise((r) => (ws.onopen = r));
  c.req = (t, d) => new Promise((res) => { const rid = String(++c.n); c.acks.set(rid, res); ws.send(JSON.stringify({ t, d, rid })); });
  c.wait = (pred, ms = 8000) => new Promise((res, rej) => {
    const hit = c.events.find(pred); if (hit) { c.events.splice(c.events.indexOf(hit), 1); return res(hit.d); }
    const w = { pred: (m) => pred(m), res }; c.waiters.push(w);
    setTimeout(() => rej(new Error(`${label}: timeout waiting`)), ms);
  });
  c.clear = () => { c.events = []; };
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓', msg); };

(async () => {
  await new Promise((r) => server.listening ? r() : server.on('listening', r));
  const host = client('host'); const a = client('alice'); const b = client('bob');
  await Promise.all([host.open, a.open, b.open]);

  console.log('Lobby');
  const cr = await host.req('room:create', { name: 'HostDana', duration: 5, lang: 'he', mode: 'classic', origin: 'http://localhost:3917' });
  ok(/^\d{6}$/.test(cr.code), 'room created with 6-digit code');
  await sleep(100);
  ok(host.state.qr && host.state.qr.startsWith('<svg'), 'QR code SVG generated');
  ok(host.state.joinUrl.includes(`room=${cr.code}`), 'join URL contains room code');
  ok((await a.req('room:join', { code: '000000', name: 'x1' })).error === 'room_not_found', 'wrong code rejected');
  const ja = await a.req('room:join', { code: cr.code, name: 'Alice' });
  const jb = await b.req('room:join', { code: cr.code, name: 'Bob' });
  ok(ja.playerId && jb.playerId, 'two players joined');
  ok((await client('x').open.then(() => null)) === null, 'extra socket opens');
  await sleep(150);
  ok(host.state.players.length === 3, 'host sees 3 players live');
  ok((await b.req('room:join', { code: cr.code, name: 'alice' })).error === 'name_taken', 'duplicate name rejected');
  ok((await a.req('game:start', {})).error === 'not_allowed', 'non-host cannot start');

  // report name
  await host.req('lobby:report', { targetId: jb.playerId });
  await sleep(100);
  ok(b.me.flagged === true, 'reported player is flagged');
  ok((await b.req('player:rename', { name: 'Bob' })).error === 'name_reported', 'cannot keep reported name');
  ok((await b.req('player:rename', { name: 'Robert' })).ok, 'rename clears flag');
  await sleep(100);
  ok(!b.me.flagged && b.me.name === 'Robert', 'player unflagged with new name');

  // promote + kick
  await host.req('lobby:promote', { targetId: ja.playerId });
  await sleep(100);
  ok(a.me.isAdmin, 'host promoted Alice to manager');
  const c = client('carl'); await c.open;
  const jc = await c.req('room:join', { code: cr.code, name: 'Carl' });
  await host.req('lobby:kick', { targetId: jc.playerId });
  await c.wait((m) => m.t === 'kicked');
  ok(true, 'kicked player notified');
  ok((await c.req('session:resume', { code: cr.code, playerId: jc.playerId, token: jc.token })).error === 'kicked', 'kicked player cannot resume');

  console.log('Game');
  ok((await host.req('game:start', {})).ok, 'host starts the game');
  await sleep(100);
  ok(a.state.phase === 'playing' && a.state.endsAt - a.state.now > 4.9 * 60000, 'everyone gets synced end time');

  // play several calls with Alice
  let seen = { regular: 0, boost: 0, george: 0, planet: 0 };
  let moneyCheck = 0;
  const deadline = Date.now() + 45000;
  const forced = ['ant_dad', 'george', 'whale_mom'];
  while (Date.now() < deadline && (seen.regular < 4 || forced.length)) {
    if (seen.regular >= 2 && forced.length) {
      await sleep(3000); const id = forced.shift();
      await a.req('test:force', { charId: id });
      a.events = a.events.filter((m) => m.t !== 'call' || m.d.charId === id);
    }
    const call = await a.wait((m) => m.t === 'call' && m.d.status === 'ringing', 9000);
    await a.req('call:pickup', { callId: call.id });
    seen[call.kind]++;
    if (call.kind === 'regular') {
      ok(call.options.length === 4 && !('answer' in call), `regular call (${call.charId}) has 4 options, answer hidden`);
      const before = a.me.money;
      await a.req('call:answer', { callId: call.id, protocolId: call.options[0] });
      const done = await a.wait((m) => m.t === 'call' && m.d.status === 'done');
      await sleep(50);
      moneyCheck++;
      assert.strictEqual(a.me.money, Math.max(0, before + done.result.delta));
    } else if (call.kind === 'boost') {
      const before = a.me.money;
      await a.req('call:collect', { callId: call.id });
      await a.wait((m) => m.t === 'call' && m.d.status === 'done');
      await sleep(50);
      ok(a.me.money > before, `boost from ${call.charId} added money`);
    } else if (call.kind === 'george') {
      ok((await a.req('call:george', { callId: call.id, yes: true })).error === 'too_early', 'George decision locked during talk');
      await sleep(1600);
      const r = await a.req('call:george', { callId: call.id, yes: true });
      ok(r.launch, 'YES launches to Planet George');
      const pc = await a.wait((m) => m.t === 'call' && m.d.kind === 'planet');
      ok(['uncle_tzvi', 'strawberry_elephant', 'legendary_george'].includes(pc.charId), `planet caller: ${pc.charId}`);
      await a.req('call:collect', { callId: pc.id });
      await a.wait((m) => m.t === 'call' && m.d.status === 'done' && m.d.id === pc.id);
      seen.planet++;
    }
  }
  ok(moneyCheck >= 1, `money always matches server deltas (${moneyCheck} answered)`);
  console.log('   call mix seen:', seen);

  console.log('Chat');
  const g = await b.req('chat:send', { channel: 'global', text: 'שלום לכולם' });
  ok(g.ok, 'global message sent');
  await host.wait((m) => m.t === 'chat' && m.d.msg.text === 'שלום לכולם');
  ok(true, 'host received global message');
  await a.req('mod:mute', { targetId: jb.playerId, minutes: 2 });
  ok((await b.req('chat:send', { channel: 'global', text: 'hey' })).error === 'muted', 'muted player blocked from global chat');
  await a.req('mod:mute', { targetId: jb.playerId, minutes: 0 });
  await sleep(600);
  ok((await b.req('chat:send', { channel: 'global', text: 'back' })).ok, 'unmuted player can talk again');

  await sleep(600);
  await b.req('chat:send', { channel: 'help', text: 'איך עונים לשיחה?' });
  const botFirst = await b.wait((m) => m.t === 'help' && m.d.msg.from.role === 'bot');
  ok(/AI/.test(botFirst.msg.text), 'help bot declares itself AI in first reply');
  const tickets = await host.wait((m) => m.t === 'tickets' && m.d.length && m.d[0].aiAnswer);
  ok(tickets[0].summary && tickets[0].category && tickets[0].howTo, 'managers see summary, AI answer and handling tip');
  ok((await host.req('help:claim', { ticketId: jb.playerId })).ok, 'host claims ticket');
  ok((await a.req('chat:send', { channel: 'help', ticketId: jb.playerId, text: 'x' })).error === 'claimed', 'second manager blocked while claimed');
  await host.req('chat:send', { channel: 'help', ticketId: jb.playerId, text: 'אני כאן לעזור' });
  await b.wait((m) => m.t === 'help' && m.d.msg.text === 'אני כאן לעזור');
  ok(true, 'player received manager reply');
  await host.req('help:release', { ticketId: jb.playerId });
  await sleep(600);
  ok((await a.req('chat:send', { channel: 'help', ticketId: jb.playerId, text: 'Alice here' })).ok, 'another manager can take over after release');

  await sleep(600);
  await b.req('chat:send', { channel: 'lb', presetId: 'myrank' });
  const lb = await b.wait((m) => m.t === 'lb' && m.d.from.role === 'bot');
  ok(/#|מקום/.test(lb.text), 'leaderboard bot answers preset');
  await sleep(600);
  await b.req('chat:send', { channel: 'lb', text: 'מי בטופ 3?' });
  const lb2 = await b.wait((m) => m.t === 'lb' && m.d.from.role === 'bot');
  ok(/🥇/.test(lb2.text), 'leaderboard bot answers free text');

  console.log('Moderation + reconnect');
  b.ws.close(); await sleep(150);
  const b2 = client('bob2'); await b2.open;
  ok((await b2.req('session:resume', { code: cr.code, playerId: jb.playerId, token: jb.token })).playerId === jb.playerId, 'player resumes session after disconnect');
  await a.req('mod:kick', { targetId: jb.playerId });
  await b2.wait((m) => m.t === 'kicked');
  ok(true, 'manager kicked player mid-game');

  ok((await host.req('game:end', {})).ok, 'host ends game');
  const over = await a.wait((m) => m.t === 'room' && m.d.phase === 'over');
  ok(over.end && over.end.stage === 'feedback', 'everyone moves to Polls & Feedback');
  ok((await host.req('game:lobby', {})).ok, 'back to lobby');

  console.log(`\nAll ${passed} checks passed.`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
