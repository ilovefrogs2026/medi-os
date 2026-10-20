/* Realtime connection: WebSocket with auto-reconnect, request/ack, and server clock sync. */
window.Net = (() => {
  const listeners = {};
  const pending = new Map();
  let ws = null, n = 0, backoff = 500, offset = 0, bestRtt = Infinity, onlineCb = () => {};
  let session = null;

  try { session = JSON.parse(sessionStorage.getItem('medios.session') || 'null'); } catch (_) { session = null; }

  function saveSession(s) {
    session = s;
    try { s ? sessionStorage.setItem('medios.session', JSON.stringify(s)) : sessionStorage.removeItem('medios.session'); } catch (_) {}
  }

  function emit(t, d) { (listeners[t] || []).forEach((f) => f(d)); }
  function on(t, f) { (listeners[t] = listeners[t] || []).push(f); }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = async () => {
      backoff = 500;
      onlineCb(true);
      ping();
      if (session) {
        const r = await request('session:resume', session);
        if (r.error) { saveSession(null); emit('session:lost', r); }
        else emit('session:ok', r);
      } else emit('ready');
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.t === 'ack') { const p = pending.get(m.rid); if (p) { pending.delete(m.rid); clearTimeout(p.timer); p.res(m.d || {}); } return; }
      if (m.t === 'pong') {
        const rtt = Date.now() - m.d.c;
        if (rtt <= bestRtt * 1.5) { bestRtt = Math.min(bestRtt, rtt); offset = m.d.now + rtt / 2 - Date.now(); }
        return;
      }
      if (m.t === 'room' && bestRtt === Infinity) offset = m.d.now - Date.now();
      emit(m.t, m.d);
    };
    ws.onclose = () => {
      onlineCb(false);
      for (const [, p] of pending) { clearTimeout(p.timer); p.res({ error: 'offline' }); }
      pending.clear();
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 1.7, 6000);
    };
  }

  function ping() { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', d: { c: Date.now() } })); }
  setInterval(ping, 8000);

  function request(t, d) {
    return new Promise((res) => {
      if (!ws || ws.readyState !== 1) return res({ error: 'offline' });
      const rid = String(++n);
      const timer = setTimeout(() => { pending.delete(rid); res({ error: 'offline' }); }, 12000);
      pending.set(rid, { res, timer });
      ws.send(JSON.stringify({ t, d, rid }));
    });
  }

  return {
    connect, on, request, saveSession,
    get session() { return session; },
    serverNow: () => Date.now() + offset,
    onOnline: (f) => { onlineCb = f; }
  };
})();
