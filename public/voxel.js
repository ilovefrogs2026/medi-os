/* Voxel characters: original blocky 3D figures built from CSS cubes, with idle motion,
 * blinking and facial expressions (idle, talk, happy, sad, worried, ring).
 * Voxel.html(charId, { mood, size }) → HTML string. */
window.Voxel = (() => {
  'use strict';
  // palette + features per character (all original designs)
  const LOOK = {
    h_rosa:     { skin: '#f1c9a0', hair: '#d8d8d8', shirt: '#8e5bbd', pants: '#5b3d7a', feat: ['bun', 'glasses'], age: 'old' },
    h_shimon:   { skin: '#e0ac69', hair: '#5a3b22', shirt: '#2f5fb3', pants: '#24324f', feat: ['cap'], hat: '#2f5fb3' },
    h_yankel:   { skin: '#c68642', hair: '#9a9a9a', shirt: '#f2c200', pants: '#3a4a5a', feat: ['beard', 'rainhat'], hat: '#e0b000' },
    h_gadi:     { skin: '#d8a06b', hair: '#1f1a17', shirt: '#29435c', pants: '#1d2f40', feat: ['mustache', 'wrench'] },
    h_betty:    { skin: '#f5d0a9', hair: '#b5482b', shirt: '#f2f2f2', pants: '#7d6b5d', feat: ['chefhat'] },
    h_noob:     { skin: '#3a3f47', hair: '#23272d', shirt: '#2d3238', pants: '#1e2126', feat: ['hood', 'glow'], eyes: '#7cf2ff' },
    h_george:   { skin: '#11131c', hair: '#0a0b12', shirt: '#12141e', pants: '#0b0c13', feat: ['glow', 'shadow'], eyes: '#8a96ff' },
    h_ant:      { skin: '#4a2f28', hair: '#3a2420', shirt: '#5a3a30', pants: '#3a2420', feat: ['antennae'], eyes: '#111', big: true },
    h_whale:    { skin: '#3f7cc6', hair: '#3f7cc6', shirt: '#cfe6ff', pants: '#2f5f9a', feat: ['spout'], eyes: '#0d1b2a' },
    h_ducky:    { skin: '#ffd23f', hair: '#ffd23f', shirt: '#ffd23f', pants: '#e8a317', feat: ['beak', 'tophat'], hat: '#1d1d1d' },
    h_shaked:   { skin: '#b07a45', hair: '#7a4f28', shirt: '#b07a45', pants: '#8a5c32', feat: ['ears', 'snout'] },
    h_tzvi:     { skin: '#7fb24f', hair: '#7fb24f', shirt: '#6a9a3c', pants: '#4f7a2a', feat: ['shell', 'glasses'], age: 'old' },
    h_elephant: { skin: '#d9a3b8', hair: '#d9a3b8', shirt: '#ff8fb8', pants: '#c27a98', feat: ['trunk', 'bigears'] },
    h_legend:   { skin: '#f1c27d', hair: '#3a2a18', shirt: '#b3122e', pants: '#2a1a40', feat: ['crown', 'cape'], eyes: '#1b1b1b' }
  };
  const GENERIC = { skin: '#e8b98a', hair: '#4a3020', shirt: '#2f9e6a', pants: '#2b4a3c', feat: [] };

  function cube(cls, w, h, d, color, extra = '') {
    const f = (n, ww, hh, l, tp, tr) => `<i class="vf ${n}" style="width:${ww}px;height:${hh}px;left:${l}px;top:${tp}px;transform:${tr}"></i>`;
    return `<div class="vc ${cls}" style="width:${w}px;height:${h}px;--c:${color}">` +
      f('fr', w, h, 0, 0, `translateZ(${d / 2}px)`) +
      f('bk', w, h, 0, 0, `rotateY(180deg) translateZ(${d / 2}px)`) +
      f('rt', d, h, (w - d) / 2, 0, `rotateY(90deg) translateZ(${w / 2}px)`) +
      f('lt', d, h, (w - d) / 2, 0, `rotateY(-90deg) translateZ(${w / 2}px)`) +
      f('tp', w, d, 0, (h - d) / 2, `rotateX(90deg) translateZ(${h / 2}px)`) +
      f('bt', w, d, 0, (h - d) / 2, `rotateX(-90deg) translateZ(${h / 2}px)`) +
      extra + '</div>';
  }

  function face(L) {
    const has = (x) => L.feat.includes(x);
    const eyes = L.eyes || '#1b1b1b';
    let h = `<div class="vface" style="--eye:${eyes}">`;
    h += `<b class="brow l"></b><b class="brow r"></b><b class="eye l"><s></s></b><b class="eye r"><s></s></b>`;
    if (!has('beak') && !has('trunk') && !has('snout')) h += `<b class="mouth"></b>`;
    if (has('glasses')) h += `<b class="glasses"></b>`;
    if (has('mustache')) h += `<b class="mustache"></b>`;
    if (has('beard')) h += `<b class="beard" style="background:${L.hair}"></b>`;
    if (has('beak')) h += `<b class="beak"><b class="mouth"></b></b>`;
    if (has('snout')) h += `<b class="snout"><b class="mouth"></b></b>`;
    if (has('trunk')) h += `<b class="mouth small"></b>`;
    return h + '</div>';
  }

  function html(id, opts = {}) {
    const L = LOOK[id] || GENERIC; const has = (x) => L.feat.includes(x);
    const mood = opts.mood || 'idle'; const size = opts.size || 112;
    const k = size / 112;
    // head (with face on the front), hair cap, body, arms, legs
    const head = cube('head', 34, 34, 34, L.skin, `<div class="vfront">${face(L)}</div>`);
    const hair = has('hood') ? cube('hair hood', 38, 16, 38, L.hair) : (L.hair !== L.skin && !has('chefhat') ? cube('hair', 36, 9, 36, L.hair) : '');
    const parts = [
      `<div class="vp p-head">${head}${hair}` +
        (has('bun') ? cube('bun', 14, 12, 12, L.hair) : '') +
        (has('cap') ? cube('cap', 38, 8, 38, L.hat) + cube('visor', 20, 3, 12, L.hat) : '') +
        (has('rainhat') ? cube('rainhat', 44, 7, 44, L.hat) : '') +
        (has('chefhat') ? cube('chefhat', 30, 20, 30, '#ffffff') : '') +
        (has('tophat') ? cube('tophat', 24, 18, 24, L.hat) + cube('brim', 34, 3, 34, L.hat) : '') +
        (has('crown') ? `<div class="crown3d">${cube('cr', 34, 8, 34, '#ffd23f')}<i class="spk s1"></i><i class="spk s2"></i><i class="spk s3"></i></div>` : '') +
        (has('antennae') ? `<i class="ant a1"></i><i class="ant a2"></i>` : '') +
        (has('ears') ? cube('ear el', 8, 18, 6, L.hair) + cube('ear er', 8, 18, 6, L.hair) : '') +
        (has('bigears') ? cube('bear el', 6, 26, 20, L.skin) + cube('bear er', 6, 26, 20, L.skin) : '') +
        (has('trunk') ? cube('trunk', 10, 22, 10, L.skin) : '') +
        (has('spout') ? `<i class="spout"></i>` : '') +
      `</div>`,
      `<div class="vp p-body">${cube('body', 34, 38, 18, L.shirt)}${has('shell') ? cube('shell', 30, 32, 10, '#8a6a2e') : ''}${has('cape') ? cube('cape', 36, 44, 4, '#7a0d20') : ''}</div>`,
      `<div class="vp p-arm al">${cube('arm', 12, 36, 12, L.shirt, `<i class="hand" style="background:${L.skin}"></i>`)}</div>`,
      `<div class="vp p-arm ar">${cube('arm', 12, 36, 12, L.shirt, `<i class="hand" style="background:${L.skin}"></i>`)}${has('wrench') ? '<i class="wrench"></i>' : ''}</div>`,
      `<div class="vp p-leg ll">${cube('leg', 15, 28, 14, L.pants)}</div>`,
      `<div class="vp p-leg lr">${cube('leg', 15, 28, 14, L.pants)}</div>`
    ].join('');
    return `<div class="vox mood-${mood} ${has('glow') ? 'glowy' : ''} ${has('shadow') ? 'shadowy' : ''} ${L.age === 'old' ? 'old' : ''}" style="--k:${k};width:${size}px;height:${size}px" aria-hidden="true">
      <div class="vrig">${parts}</div></div>`;
  }

  return { html, has: (id) => !!LOOK[id] };
})();
