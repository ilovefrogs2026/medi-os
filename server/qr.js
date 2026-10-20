'use strict';
// Render a QR code as an SVG string, using the vendored MIT QR encoder (Kazuhiko Arase).
const QRCode = require('./vendor/QRCode');
const ECL = require('./vendor/QRCode/QRErrorCorrectLevel');

function qrSvg(text, { dark = '#021a0d', light = '#c9ffe0', margin = 2 } = {}) {
  const qr = new QRCode(-1, ECL.M);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + margin * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}

module.exports = { qrSvg };
