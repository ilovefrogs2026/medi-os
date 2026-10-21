/* Voxel characters: original blocky 3D figures built from CSS cubes, with idle motion,
 * blinking and facial expressions (idle, talk, happy, sad, worried, ring).
 * Voxel.html(charId, { mood, size }) → HTML string. */
window.Voxel = (() => {
  'use strict';
  // palette + features per character (all original designs)
  const LOOK = {
    // Grandma Rosa — heart-healthy cook: apron, glasses, bun, a bowl of salad
    h_rosa:     { skin: '#f1c9a0', hair: '#d8d8d8', shirt: '#8e5bbd', pants: '#5b3d7a', feat: ['bun', 'glasses', 'apron', 'bowl'], apron: '#f4efe6', age: 'old' },
    // Shimon the postman — post cap and mail bag
    h_shimon:   { skin: '#e0ac69', hair: '#5a3b22', shirt: '#2f5fb3', pants: '#24324f', feat: ['cap', 'mailbag'], hat: '#e2312b' },
    // Yankel the fisherman — yellow raincoat, rain hat, beard, fishing rod
    h_yankel:   { skin: '#c68642', hair: '#9a9a9a', shirt: '#f2c200', pants: '#3a4a5a', feat: ['beard', 'rainhat', 'rod'], hat: '#e0b000' },
    // Gadi the mechanic — blue overalls, mustache, wrench
    h_gadi:     { skin: '#d8a06b', hair: '#1f1a17', shirt: '#7b8591', pants: '#29435c', feat: ['mustache', 'wrench', 'overalls'], over: '#29435c' },
    // Betty the baker — chef hat, red apron, rolling pin
    h_betty:    { skin: '#f5d0a9', hair: '#b5482b', shirt: '#f2f2f2', pants: '#7d6b5d', feat: ['chefhat', 'apron', 'pin'], apron: '#d9534f' },
    // The mysterious Noob — dark hood, glowing eyes, a floating "?"
    h_noob:     { skin: '#3a3f47', hair: '#23272d', shirt: '#2d3238', pants: '#1e2126', feat: ['hood', 'glow', 'qmark'], eyes: '#7cf2ff' },
    // Mysterious George — shadow figure with a galaxy cape
    h_george:   { skin: '#11131c', hair: '#0a0b12', shirt: '#12141e', pants: '#0b0c13', feat: ['glow', 'shadow', 'cape', 'stars'], eyes: '#8a96ff', cape: '#3b2a7a' },
    // Daddy Ant — healthy-lifestyle booster: sport headband and a dumbbell
    h_ant:      { skin: '#4a2f28', hair: '#3a2420', shirt: '#5a3a30', pants: '#3a2420', feat: ['antennae', 'headband', 'dumbbell'], eyes: '#111', big: true },
    // Mama Whale — heart-attack symptoms booster: heart badge, fins, spout
    h_whale:    { skin: '#3f7cc6', hair: '#3f7cc6', shirt: '#cfe6ff', pants: '#2f5f9a', feat: ['spout', 'fins', 'heartbadge'], eyes: '#0d1b2a' },
    // Mr_Ducky — village mayor: top hat and bow tie
    h_ducky:    { skin: '#ffd23f', hair: '#ffd23f', shirt: '#ffd23f', pants: '#e8a317', feat: ['beak', 'tophat', 'bowtie'], hat: '#1d1d1d' },
    // Shaked the puppy — lives by the mine: miner helmet with a lamp
    h_shaked:   { skin: '#b07a45', hair: '#7a4f28', shirt: '#b07a45', pants: '#8a5c32', feat: ['ears', 'snout', 'minerhat'] },
    // Uncle Tzvi — turtle researcher: lab coat, glasses, clipboard
    h_tzvi:     { skin: '#7fb24f', hair: '#7fb24f', shirt: '#f4f4f4', pants: '#4f7a2a', feat: ['shell', 'glasses', 'clipboard'], age: 'old' },
    // Brother Strawberry Elephant — lab scientist: goggles and a test tube
    h_elephant: { skin: '#d9a3b8', hair: '#d9a3b8', shirt: '#f4f4f4', pants: '#c27a98', feat: ['trunk', 'bigears', 'goggles', 'tube'] },
    // Legendary George — crown, royal cape and a stethoscope
    h_legend:   { skin: '#f1c27d', hair: '#3a2a18', shirt: '#b3122e', pants: '#2a1a40', feat: ['crown', 'cape', 'stetho'], eyes: '#1b1b1b', cape: '#7a0d20' }
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
    if (has('goggles')) h += `<b class="goggles"></b>`;
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
        (has('headband') ? `<i class="headband"></i>` : '') +
        (has('minerhat') ? cube('mhelm', 38, 10, 38, '#f2c200') + `<i class="lamp"></i>` : '') +
        (has('qmark') ? `<i class="qmark">?</i>` : '') +
        (has('stars') ? `<i class="vstars">✦ ✧ ✦</i>` : '') +
      `</div>`,
      `<div class="vp p-body">${cube('body', 34, 38, 18, L.shirt)}${has('shell') ? cube('shell', 30, 32, 10, '#8a6a2e') : ''}${has('cape') ? cube('cape', 36, 44, 4, L.cape || '#7a0d20') : ''}${has('apron') ? `<i class="apron" style="--ap:${L.apron}"></i>` : ''}${has('overalls') ? `<i class="overalls" style="--ov:${L.over}"></i>` : ''}${has('mailbag') ? '<i class="mailbag"></i>' : ''}${has('heartbadge') ? '<i class="hbadge">♥</i>' : ''}${has('bowtie') ? '<i class="bowtie"></i>' : ''}${has('stetho') ? '<i class="stetho"></i>' : ''}${has('bowl') ? '<i class="bowl"></i>' : ''}${has('fins') ? '<i class="fin fl"></i><i class="fin fr"></i>' : ''}</div>`,
      `<div class="vp p-arm al">${cube('arm', 12, 36, 12, L.shirt, `<i class="hand" style="background:${L.skin}"></i>`)}${has('clipboard') ? '<i class="clipboard"></i>' : ''}</div>`,
      `<div class="vp p-arm ar">${cube('arm', 12, 36, 12, L.shirt, `<i class="hand" style="background:${L.skin}"></i>`)}${has('wrench') ? '<i class="wrench"></i>' : ''}${has('rod') ? '<i class="rod"></i>' : ''}${has('pin') ? '<i class="rpin"></i>' : ''}${has('dumbbell') ? '<i class="dumbbell"></i>' : ''}${has('tube') ? '<i class="ttube"></i>' : ''}</div>`,
      `<div class="vp p-leg ll">${cube('leg', 15, 28, 14, L.pants)}</div>`,
      `<div class="vp p-leg lr">${cube('leg', 15, 28, 14, L.pants)}</div>`
    ].join('');
    return `<div class="vox mood-${mood} ${has('glow') ? 'glowy' : ''} ${has('shadow') ? 'shadowy' : ''} ${L.age === 'old' ? 'old' : ''}" style="--k:${k};width:${size}px;height:${size}px" aria-hidden="true">
      <div class="vrig">${parts}</div></div>`;
  }

  return { html, has: (id) => !!LOOK[id] };
})();
