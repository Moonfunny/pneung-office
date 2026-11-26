/* P'Neung Office — ธีม: เรียก PNO_THEME(['gaming','xmas']) หลัง PNO_START */
window.PNO_THEME = function (names) {
  'use strict';
  var app = document.getElementById('pno-app'); if (!app) return;
  names = (names || []).filter(Boolean);
  app.className = app.className.replace(/\bth-\S+/g, '').trim();
  app.querySelectorAll('.th-deco').forEach(function (e) { e.remove(); });
  app.querySelectorAll('.th-deco-room').forEach(function (r) { r.className = r.className.replace(/\bb-\S+/g, '').replace('th-deco-room', '').trim(); });
  names.forEach(function (n) { app.classList.add('th-' + n); });
  function add(cls, parent, style) { var e = document.createElement('div'); e.className = cls + ' th-deco'; for (var k in (style || {})) e.style[k] = style[k]; parent.appendChild(e); return e; }
  var rooms = [].slice.call(app.querySelectorAll('.room'));
  rooms.forEach(function (r) { var c = r.style.borderTopColor || '#58a6ff'; r.style.setProperty('--c', c); });
  var H = function (r) { return r.offsetHeight || parseInt(r.style.height, 10) || 230; };

  if (names.indexOf('gaming') >= 0) {
    rooms.forEach(function (r) {
      add('neon', r); add('neonL', r);
      if (r.classList.contains('meeting')) return;
      r.querySelectorAll('.desk').forEach(function (d) {
        add('chair', r, { left: (parseInt(d.style.left, 10) + 14) + 'px', top: (parseInt(d.style.top, 10) + 44) + 'px', width: '30px' });
      });
    });
  }
  if (names.indexOf('brand') >= 0) {
    var SIGN = {  // ป้ายไฟชื่อแบรนด์ [ข้อความ, สีเส้น, สีตัวอักษร]
      nubwo: ['NUBWO', '#ff3b3b', '#ffb3b3'], egazone: ['EGA ZONE', '#59d600', '#b6ff6a'],
      saruspace: ['SARU SPACE', '#e6e6e6', '#ffffff'], glink: ['GLINK', '#3b82f6', '#a5c8ff'],
      lumirathailand: ['LUMIRA', '#ffc83d', '#fff0b3'], ceflar: ['CEFLAR', '#ff6b9a', '#ffd0df'],
      gms: ['GMS', '#a371f7', '#e2d1ff'], katzuni: ['KATZUNI', '#f2c200', '#fff2a8']
    };
    var PROPS = {
      nubwo: [['pc', 352, 40], ['headset', 360, 124]],
      egazone: [['gdesk', 344, 70]],
      saruspace: [['keyshelf', 348, 40], ['keycap', 352, 116], ['keycap', 372, 116]],
      glink: [['rack', 352, 34, '', 6], ['cctv', 354, 124], ['spool', 356, 146]],
      lumirathailand: [['solar', 344, 58], ['bulb', 365, 130]],
      ceflar: [['counter', 342, 50], ['cooker', 356, 36], ['speaker', 360, 98]],
      gms: [['showcase', 348, 36]],
      katzuni: [['pegboard', 344, 34, '', 0, 'tools'], ['ups', 352, 110]]
    };
    rooms.forEach(function (r) {
      if (r.classList.contains('meeting')) return;
      var lab = r.querySelector('.label'), dom = lab ? lab.textContent.trim().toLowerCase() : '';
      var id = dom.replace(/^www\./, '').split('.')[0];
      if (!PROPS[id]) return;
      r.classList.add('b-' + id, 'th-deco-room');
      var sg = SIGN[id];
      if (sg) { var n = add('prop neonsign', r, { left: '14px', top: '160px' }); n.textContent = sg[0]; n.style.setProperty('--n', sg[1]); n.style.setProperty('--t', sg[2]); }
      PROPS[id].forEach(function (p) {
        var e = add('prop ' + p[0], r, { left: p[1] + 'px', top: p[2] + 'px' });
        if (p[3]) e.textContent = p[3];
        for (var k = 0; k < (p[4] || 0); k++) { var led = document.createElement('i'); led.style.top = (10 + k * 9) + 'px'; led.style.animationDelay = (-k * .27) + 's'; e.appendChild(led); }
        if (p[5] === 'tools') [[6, 8, 4, 22], [16, 6, 18, 4], [30, 10, 4, 18], [8, 36, 20, 4], [32, 34, 6, 14]].forEach(function (q) { var i = document.createElement('i'); i.style.left = q[0] + 'px'; i.style.top = q[1] + 'px'; i.style.width = q[2] + 'px'; i.style.height = q[3] + 'px'; e.appendChild(i); });
      });
    });
  }
  if (names.indexOf('cozy') >= 0) {
    rooms.forEach(function (r) { if (!r.classList.contains('meeting')) add('lamp', r, { left: '24px', top: (H(r) - 44) + 'px' }); });
  }
  if (names.indexOf('xmas') >= 0) {
    rooms.forEach(function (r) { add('lights', r); });
    app.querySelectorAll('.window').forEach(function (w) { if (!w.classList.contains('seaview')) add('snow', w); });
    var SC = window.PNO_SCENE, mp = app.querySelector('.map.scene-on');
    if (mp && SC && SC.view === 'sea') {  // คริสต์มาสริมทะเล: ไฟประดับต้นมะพร้าว + ซานต้ากางเกงขาสั้น
      (SC.palms || []).forEach(function (p, i) { var l = add('palmlights', mp, { left: (p.x - p.w / 2) + 'px', top: p.y + 'px', width: p.w + 'px' }); l.style.animationDelay = (-(i % 5) * .3) + 's'; });
      if (SC.santa) {
        var SANTA = ['.....hw...', '....hhh...', '...hhhhh..', '..wwwwwww.', '..sSsSsss.', '..wwwwwww.', '...wwwww..', '.rrrwwwrr.', 'srrrrrrrrs', 's.kkykkk.s', '..oPooPo..', '..oo..oo..', '..ss..ss..', '.ff...ff..'];
        var SC_C = { h: '#d62828', w: '#ffffff', s: '#ffcfa0', S: '#1f2328', r: '#d62828', k: '#1f2328', y: '#ffd33d', o: '#39c5cf', P: '#ff7bb0', f: '#ff7b72' }, svg = '';
        SANTA.forEach(function (row, y) { row.split('').forEach(function (ch, x) { if (SC_C[ch]) svg += '<rect x="' + x + '" y="' + y + '" width="1.03" height="1.03" fill="' + SC_C[ch] + '"/>'; }); });
        var st = add('beach-santa', mp, { left: SC.santa.x + 'px', top: SC.santa.y + 'px' });
        st.title = 'โฮ่ โฮ่ โฮ่! Merry Christmas';
        st.innerHTML = '<svg viewBox="0 0 10 14" width="30" height="42" shape-rendering="crispEdges">' + svg + '</svg><i class="sack"></i><span>โฮ่ โฮ่ โฮ่ 🌴</span>';
      }
    }
    var m = app.querySelector('.room.meeting');
    if (m) {
      var t = add('xtree', m, { left: '40px', top: (H(m) - 110) + 'px' });
      ['#ffd33d', '#ff5f5f', '#58a6ff', '#fff'].forEach(function (c, i) { var b = document.createElement('i'); b.style.background = c; b.style.left = (-14 + i * 8) + 'px'; b.style.top = (18 + (i % 2) * 18) + 'px'; t.appendChild(b); });
      add('gift', m, { left: '20px', top: (H(m) - 30) + 'px' });
      add('gift', m, { left: '86px', top: (H(m) - 30) + 'px', '--g': '#3fb950' }).style.setProperty('--g', '#3fb950');
    }
  }
};

/* ธีมอัตโนมัติ: ห้องตามแบรนด์ตลอด + คริสต์มาส 1–31 ธ.ค. (เวลาไทย) */
window.PNO_THEME_AUTO = function () {
  var m = +new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date());
  var list = ['brand'];
  if (m === 12) list.push('xmas');
  window.PNO_THEME(list);
};
