/* P'Neung Office — ฉากชายหาดรอบออฟฟิศ (วาดครั้งเดียวลง canvas ไม่กินเครื่อง)
   office.js เรียก PNO_SCENE(map, B) ก่อนสร้างตัวอาคาร
   B = { x, y, w, h } ตำแหน่งตัวอาคารในแผนที่ · W, H ขนาดแผนที่ทั้งหมด */
window.PNO_SCENE = function (map, B) {
  'use strict';
  var W = B.W, H = B.H;
  var cv = document.createElement('canvas');
  cv.className = 'scene'; cv.width = W; cv.height = H;
  map.appendChild(cv);
  var veil = document.createElement('div'); veil.className = 'veil'; map.appendChild(veil);   // ม่านสีกลางคืน/เย็น
  var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  var seed = 20261126;
  var R = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  var rect = function (c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  var snap = function (v) { return Math.round(v / 3) * 3; };

  /* ---------- ตำแหน่งหลัก ---------- */
  var bx0 = B.x - 22, by0 = B.y - 22, bx1 = B.x + B.w + 22, by1 = B.y + B.h + 30;
  var doorX = B.x + B.w / 2;
  var shoreY = function (x) { return by1 + 100 + Math.sin(x / 190) * 14 + Math.sin(x / 61) * 5; };
  var inBldg = function (x, y, m) { return x > bx0 - m && x < bx1 + m && y > by0 - m && y < by1 + m; };
  var onWalk = function (x, y, m) { return y > by1 - 10 && Math.abs(x - doorX) < 30 + m; };
  var inSea = function (x, y, m) { return y > shoreY(x) - m; };

  /* ---------- หาดทราย ---------- */
  rect('#f0d9a0', 0, 0, W, H);
  for (var i = 0; i < W * H / 700; i++) {
    rect(R() < .5 ? '#e6cb8a' : '#f8e7bd', Math.floor(R() * W / 3) * 3, Math.floor(R() * H / 3) * 3, 3 * (1 + Math.floor(R() * 2)), 3);
  }
  // เนินทรายมีหญ้าทะเลด้านบนและด้านข้างอาคาร
  for (i = 0; i < 170; i++) {
    var gx = R() * W, gy = R() * (by1 - 20);
    if (inBldg(gx, gy, 14)) continue;
    gx = snap(gx); gy = snap(gy);
    rect('#9fb65a', gx, gy, 3, 6); rect('#7f9b45', gx + 3, gy - 3, 3, 9); rect('#9fb65a', gx + 6, gy + 3, 3, 3);
  }

  /* ---------- ทะเล ---------- */
  for (var x = 0; x < W; x += 3) {
    var sy = snap(shoreY(x));
    rect('#d9bd7f', x, sy - 12, 3, 12);                                    // ทรายเปียก
    for (var y = sy; y < H; y += 3) {
      var d = y - sy + (R() - .5) * 10;
      rect(d < 6 ? '#ffffff' : d < 34 ? '#7fdbe4' : d < 90 ? '#45b6d9' : d < 170 ? '#2f95cb' : '#2479b5', x, y, 3, 3);
    }
  }
  for (i = 0; i < W / 9; i++) {                                              // แสงระยิบบนผิวน้ำ
    var wx = R() * W, wy = shoreY(wx) + 40 + R() * (H - shoreY(wx) - 40);
    rect('rgba(255,255,255,.55)', snap(wx), snap(wy), 9, 3);
  }

  /* ---------- สไปรต์ ---------- */
  function spr(rows, pal, x, y, u, flip, shadow) {
    var w = rows[0].length * u, h = rows.length * u;
    if (shadow) rect('rgba(90,60,20,.18)', x - w / 2 + u * 2, y - u, w - u * 2, u * 2);
    rows.forEach(function (row, ry) {
      row.split('').forEach(function (ch, rx) { if (pal[ch]) rect(pal[ch], x - w / 2 + (flip ? rows[0].length - 1 - rx : rx) * u, y - h + ry * u, u, u); });
    });
  }
  var PALM = ['...gg...gg...', '.gGGgg.gGGgg.', 'gGg..gcgg..Gg', 'g...gctcg...g', '.....ttc.....', '.....t.......', '.....tt......', '......t......', '......t......', '.....tt......', '.....t.......', '.....t.......'];
  var PALM_C = { g: '#2f9a46', G: '#55c25e', t: '#8a5a2b', c: '#6b4423' };
  var UMB = ['...rwr...', '.rwrwrw..', 'rwrwrwrwr', '....p....', '....p....', '....p....', '....p....'];
  var BOAT = ['....s....', '....ss...', '....sss..', '....ssss.', '....p....', 'hhhhhhhhh', '.hhhhhhh.'];
  var TOWER = ['rrrrrrr', 'rwwwwwr', 'rrrrrrr', '.p...p.', '.p.p.p.', 'p.....p', 'p.....p'];

  /* ---------- ทางเดินไม้ + ท่าเรือ ---------- */
  var pierEnd = H - 34;
  rect('rgba(90,60,20,.2)', doorX - 24, by1 - 4, 54, pierEnd - by1 + 12);
  rect('#8a5f36', doorX - 27, by1 - 8, 54, pierEnd - by1 + 8);
  for (y = by1 - 6; y < pierEnd; y += 6) rect(y > shoreY(doorX) ? '#b07d4a' : '#c39462', doorX - 24, y, 48, 4);
  rect('#8a5f36', doorX - 60, pierEnd - 40, 120, 44);
  for (y = pierEnd - 38; y < pierEnd + 2; y += 6) rect('#b07d4a', doorX - 57, y, 114, 4);
  [[-60, -42], [56, -42], [-60, 0], [56, 0], [-27, shoreY(doorX) - pierEnd + 40], [24, shoreY(doorX) - pierEnd + 40]].forEach(function (p) { rect('#5c3d22', doorX + p[0], pierEnd + p[1], 6, 9); });

  /* ---------- ของบนหาด (ช่วงระหว่างอาคารกับทะเล + สองข้าง) ---------- */
  var props = [];
  var spots = [];
  for (x = 60; x < W - 40; x += 92 + R() * 40) spots.push([x, by1 + 26 + R() * 44]);
  for (y = by0 + 120; y < by1; y += 140 + R() * 60) { spots.push([bx0 - 70 - R() * 50, y]); spots.push([bx1 + 70 + R() * 50, y]); }
  var UMB_C = [{ r: '#e5534b', w: '#fff', p: '#6e6e6e' }, { r: '#1f8fd6', w: '#fff', p: '#6e6e6e' }, { r: '#f2b30a', w: '#fff', p: '#6e6e6e' }, { r: '#2fae7f', w: '#fff', p: '#6e6e6e' }];
  spots.forEach(function (s, k) {
    if (onWalk(s[0], s[1], 40) || inSea(s[0], s[1], 26) || inBldg(s[0], s[1], 20) || s[0] < 30 || s[0] > W - 30) return;
    props.push({ y: s[1], f: function () {
      var tw = ['#ff7b72', '#79c0ff', '#ffd33d', '#d2a8ff'][k % 4];
      rect(tw, s[0] + 6, s[1] - 6, 18, 30); rect('rgba(255,255,255,.6)', s[0] + 6, s[1] + 3, 18, 3);   // ผ้าเช็ดตัว
      spr(UMB, UMB_C[k % 4], s[0], s[1] + 6, 3, false, true);
    } });
  });
  // ปราสาททราย ลูกบอล กระดานโต้คลื่น ดาวทะเล
  var extra = function (x0, y0, f) { if (!onWalk(x0, y0, 30) && !inSea(x0, y0, 20) && !inBldg(x0, y0, 16)) props.push({ y: y0, f: f }); };
  for (i = 0; i < 6; i++) { (function (x0, y0) { extra(x0, y0, function () { rect('#d8b46e', x0, y0 - 9, 24, 12); rect('#d8b46e', x0 + 3, y0 - 18, 6, 9); rect('#d8b46e', x0 + 15, y0 - 18, 6, 9); rect('#e5534b', x0 + 6, y0 - 27, 3, 9); }); })(snap(R() * W), snap(by1 + 50 + R() * 40)); }
  for (i = 0; i < 5; i++) { (function (x0, y0) { extra(x0, y0, function () { rect('#fff', x0, y0 - 9, 9, 9); rect('#e5534b', x0, y0 - 9, 9, 3); rect('#1f8fd6', x0, y0 - 3, 9, 3); }); })(snap(R() * W), snap(by1 + 40 + R() * 50)); }
  for (i = 0; i < 4; i++) { (function (x0, y0, c) { extra(x0, y0, function () { rect(c, x0, y0 - 36, 9, 36); rect('#fff', x0 + 3, y0 - 33, 3, 30); }); })(snap(R() * W), snap(by1 + 40 + R() * 40), ['#ff7b72', '#39c5cf', '#ffd33d', '#a371f7'][i]); }
  for (i = 0; i < 40; i++) { var sx = R() * W, ssy = shoreY(sx) - 6 - R() * 30; if (!onWalk(sx, ssy, 4)) rect(['#ff8a5c', '#fff3e0', '#f4a7c4'][i % 3], snap(sx), snap(ssy), 3, 3); }
  // ป้อมไลฟ์การ์ด
  var tX = Math.min(W - 60, bx1 + 110), tY = shoreY(tX) - 18;
  props.push({ y: tY, f: function () { spr(TOWER, { r: '#e5534b', w: '#fff', p: '#8a5f36' }, tX, tY, 4, false, true); } });

  /* ---------- ต้นมะพร้าว ---------- */
  var palms = [];
  for (var ty = 4; ty < by1 + 80; ty += 46) for (var tx = 0; tx < W + 20; tx += 64) {
    var px_ = tx + (R() - .5) * 40, py = ty + (R() - .5) * 26;
    if (inBldg(px_, py, 24) || inBldg(px_, py - 40, 10) || onWalk(px_, py, 30) || inSea(px_, py, 34)) continue;
    var dist = Math.hypot(Math.max(bx0 - px_, 0, px_ - bx1), Math.max(by0 - py, 0, py - by1));
    if (R() > (dist < 40 ? .35 : .72)) continue;
    (function (x0, y0, u, fl) {
      props.push({ y: y0, f: function () { spr(PALM, PALM_C, x0, y0, u, fl, true); } });
      palms.push({ x: x0, y: y0 - PALM.length * u + u * 2, w: 13 * u });   // ยอดมะพร้าว (ธีมคริสต์มาสแขวนไฟตรงนี้)
    })(px_, py, R() < .35 ? 4 : 3, R() < .5);
  }
  props.sort(function (a, b) { return a.y - b.y; }).forEach(function (p) { p.f(); });

  /* ---------- เรือ ห่วงยาง ---------- */
  var seaTop = shoreY(W * .2);
  spr(BOAT, { s: '#ffffff', p: '#5c3d22', h: '#c0392b' }, W * .2, seaTop + 140, 4, false, false);
  spr(BOAT, { s: '#ffd33d', p: '#5c3d22', h: '#1f6feb' }, W * .82, shoreY(W * .82) + 170, 3, true, false);
  [[W * .36, 60], [W * .66, 80]].forEach(function (p) { var rx = snap(p[0]), ry = snap(shoreY(p[0]) + p[1]); rect('#ff5f5f', rx, ry, 15, 6); rect('#fff', rx + 3, ry, 3, 6); rect('#fff', rx + 9, ry, 3, 6); });

  /* ---------- DOM: โคมไฟ คลื่น นก ป้าย ---------- */
  for (y = by1 + 26; y < pierEnd - 30; y += 62) {
    [doorX - 40, doorX + 34].forEach(function (lx) { var l = document.createElement('div'); l.className = 'lamp-post'; l.style.left = lx + 'px'; l.style.top = y + 'px'; map.appendChild(l); });
  }
  for (x = 0; x < W; x += 120) {   // ฟองคลื่นวิ่งเข้าฝั่ง
    var fm = document.createElement('i'); fm.className = 'foam';
    fm.style.left = (x + R() * 40) + 'px'; fm.style.top = (shoreY(x) + 2) + 'px'; fm.style.animationDelay = (-R() * 5) + 's'; map.appendChild(fm);
  }
  for (i = 0; i < 18; i++) {
    var rx_ = 30 + R() * (W - 60), rp = document.createElement('i');
    rp.className = 'ripple'; rp.style.left = rx_ + 'px'; rp.style.top = (shoreY(rx_) + 50 + R() * (H - shoreY(rx_) - 70)) + 'px'; rp.style.animationDelay = (-R() * 4) + 's';
    map.appendChild(rp);
  }
  [[0.1, 30, 0], [0.55, 70, -6], [0.7, 50, -11]].forEach(function (b) {
    var gl = document.createElement('i'); gl.className = 'gull'; gl.style.left = (W * b[0]) + 'px'; gl.style.top = b[1] + 'px'; gl.style.animationDelay = b[2] + 's'; map.appendChild(gl);
  });
  var sg = document.createElement('div'); sg.className = 'scene-sign';
  sg.style.left = (doorX + 52) + 'px'; sg.style.top = (by1 + 6) + 'px';
  sg.innerHTML = '<b>ออฟฟิศดูแลเว็บ</b><span>WEB P\'NEUNG BEACH</span>';
  map.appendChild(sg);
  window.PNO_SCENE.palms = palms;
  window.PNO_SCENE.santa = { x: doorX - 130, y: by1 + 46 };
};
/* หน้าต่างบนผนังมองเห็นทะเล (office.js อ่านค่านี้) */
window.PNO_SCENE.view = 'sea';
