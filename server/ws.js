'use strict';
// Minimal RFC 6455 WebSocket server (text frames, ping/pong, close).
// Zero dependencies — enough for a JSON realtime game protocol.
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 256 * 1024;

class WSConnection extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.alive = true;
    this.closed = false;
    socket.setNoDelay(true);
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._finish());
    socket.on('error', () => this._finish());
  }

  _finish() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = this._parseFrame();
      if (!frame) break;
      this._handleFrame(frame);
      if (this.closed) break;
    }
  }

  _parseFrame() {
    const b = this.buffer;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (b.length < 4) return null;
      len = b.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (b.length < 10) return null;
      const hi = b.readUInt32BE(2);
      if (hi !== 0) { this.close(1009); return null; }
      len = b.readUInt32BE(6);
      offset = 10;
    }
    if (len > MAX_PAYLOAD) { this.close(1009); return null; }
    const maskLen = masked ? 4 : 0;
    if (b.length < offset + maskLen + len) return null;
    let payload = b.subarray(offset + maskLen, offset + maskLen + len);
    if (masked) {
      const mask = b.subarray(offset, offset + 4);
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    } else {
      payload = Buffer.from(payload);
    }
    this.buffer = b.subarray(offset + maskLen + len);
    return { fin, opcode, payload };
  }

  _handleFrame({ fin, opcode, payload }) {
    switch (opcode) {
      case 0x0: // continuation
      case 0x1: // text
      case 0x2: { // binary
        this.fragments.push(payload);
        const total = this.fragments.reduce((n, f) => n + f.length, 0);
        if (total > MAX_PAYLOAD) { this.close(1009); return; }
        if (fin) {
          const data = Buffer.concat(this.fragments).toString('utf8');
          this.fragments = [];
          this.emit('message', data);
        }
        break;
      }
      case 0x8: // close
        this.close(1000);
        break;
      case 0x9: // ping
        this._sendFrame(0xA, payload);
        break;
      case 0xA: // pong
        this.alive = true;
        break;
      default:
        this.close(1002);
    }
  }

  _sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 127;
      header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6);
    }
    try { this.socket.write(Buffer.concat([header, payload])); } catch (_) { /* ignore */ }
  }

  send(text) { this._sendFrame(0x1, Buffer.from(text, 'utf8')); }
  ping() { this._sendFrame(0x9, Buffer.alloc(0)); }

  close(code = 1000) {
    if (this.closed) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(code, 0);
    this._sendFrame(0x8, p);
    try { this.socket.end(); } catch (_) { /* ignore */ }
    setTimeout(() => { try { this.socket.destroy(); } catch (_) {} }, 500);
    this._finish();
  }
}

function attachWebSocketServer(httpServer, path, onConnection) {
  const conns = new Set();
  httpServer.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    const conn = new WSConnection(socket, req);
    conns.add(conn);
    conn.on('close', () => conns.delete(conn));
    onConnection(conn, req);
  });
  // Heartbeat: drop dead connections (e.g. phone went to sleep)
  const hb = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.close(1001); continue; }
      c.alive = false;
      c.ping();
    }
  }, 25000);
  hb.unref();
  return conns;
}

module.exports = { attachWebSocketServer };
