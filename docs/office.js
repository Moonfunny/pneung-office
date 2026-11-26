/* P'Neung Office — หน้าออฟฟิศ pixel art (ข้อมูลจริงจาก PNO_BOOT / REST) */
window.PNO_START = function (BOOT) {
'use strict';
var STATE = BOOT.state || { sites: [], count: {}, total: 0 };
var app = document.getElementById('pno-app');
if (!app) return;

var STATUS_TH = { ok: 'ปกติ', warn: 'ต้องดู', down: 'มีปัญหา', wait: 'รอรอบ' };
var CHAT = ['กาแฟไหม?', 'เช็กรอบนี้ผ่าน ✓', 'เว็บยังปกติดี', 'ไปเติมกาแฟแป๊บ', 'อัปเดตรอบเช้าเรียบร้อย', 'แบ็กอัปเสร็จแล้วนะ', 'วันนี้เว็บเร็วดี', 'ส่งรายงานให้แล้วนะ', 'ใครเห็นแก้วฉันไหม', 'พักสายตาแป๊บนึง'];
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var ago = function (m) { if (m == null) return '-'; if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return m + ' นาทีที่แล้ว'; if (m < 2880) return Math.round(m / 60) + ' ชม.ที่แล้ว'; return Math.round(m / 1440) + ' วันที่แล้ว'; };
var px = function (n) { return n + 'px'; };
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/* ---------- โครงหน้า ---------- */
app.innerHTML =
  '<div class="pno-inner">' +
  '<h1>ออฟฟิศดูแลเว็บของ P\'Neung</h1>' +
  '<p class="sub">แต่ละเว็บคือหนึ่งแผนก มีน้องหลายตัวคอยเช็กว่าเว็บเปิดได้ไหม SSL และโดเมนใกล้หมดหรือยัง เว็บเร็วแค่ไหน มีปลั๊กอินรออัปเดตกี่ตัว แบ็กอัปล่าสุดเมื่อไร และหน้าใหม่มีคำผิดไหม กดที่น้องเพื่อดูงาน กดป้ายห้องเพื่อดูภาพรวมของเว็บ หรือเรียกประชุมให้ทุกคนมารายงาน · <span id="pno-who"></span> <a href="#" id="pno-logout">ออกจากระบบ</a></p>' +
  '<div class="alert" id="pno-offline" style="display:none;border-left-color:#8b949e;background:#1c2128"></div>' +
  '<div class="rainbow" id="pno-rainbow"></div>' +
  '<div class="bar" id="pno-stats"></div>' +
  '<div class="alert" id="pno-alert"></div>' +
  '<div class="mapWrap"><div class="mapOuter" id="pno-outer"><div class="sizer" id="pno-sizer"><div class="map" id="pno-map"></div></div></div><div class="zoomCtl" id="pno-zoom"></div></div>' +
  '<p class="hint">เครื่องตรวจเช็กทุก ' + (STATE.interval_min || 10) + ' นาทีขณะเปิดเครื่อง · หน้านี้ดึงข้อมูลใหม่เองทุก ' + (BOOT.refresh || 60) + ' วินาที · หน้าต่างเปลี่ยนตามเวลากรุงเทพฯ · น้องที่มี ! คืองานที่ต้องดู · น้องที่หลับบนพรมคือรอข้อมูล</p>' +
  '<div class="panels"><div class="card" id="pno-detail"><h3>รายละเอียดงาน</h3><p class="empty">กดที่น้องตัวไหนก็ได้ในออฟฟิศ</p></div>' +
  '<div class="card" id="pno-side"><h3>ภาพรวมรายเว็บ</h3><p class="empty">กดป้ายชื่อห้อง หรือกด “เรียกประชุม” เพื่อให้ทุกคนรายงาน</p></div></div>' +
  '</div>';

var map = document.getElementById('pno-map');
var SITES = STATE.sites;
var N = SITES.length;

/* ---------- ผัง ---------- */
var COLS = [30, 460, 890], RW = 400, SPEED = 150;
/* จำนวนโต๊ะต่อห้อง = จำนวนน้องมากสุดของเว็บใด ๆ · เกิน 6 ตัวแบ่งเป็นโต๊ะ 2 แถว (รองรับถึง 12) */
var NA = Math.max(1, SITES.reduce(function (m, s) { return Math.max(m, (s.agents || []).length); }, 0));
var DROWS = NA > 6 ? 2 : 1, PERROW = Math.ceil(NA / DROWS);
var RH = DROWS === 2 ? 300 : 230;
var DESK_Y = [28, 110], RUG_TOP = DROWS === 2 ? 190 : 108, RUG_H = DROWS === 2 ? RH - RUG_TOP - 22 : 104;
var NROWS = Math.max(1, Math.ceil((N + 1) / 3));
var ROWS = []; for (var r = 0; r < NROWS; r++) ROWS.push(160 + r * (RH + 30));
var MAP_W = 1320, MAP_H = ROWS[NROWS - 1] + RH + 40;
/* ฉากป่ารอบอาคาร (scene.js) · ไม่มีไฟล์ฉาก = หน้าตาแบบเดิม */
var SCENE = typeof window.PNO_SCENE === 'function';
var OX = SCENE ? 170 : 0, OY = SCENE ? 110 : 0, PADB = SCENE ? 330 : 0;
var TW = MAP_W + OX * 2, TH = MAP_H + OY + PADB;
var DSTEP = PERROW > 1 ? Math.min(74, Math.floor((RW - 30 - 58) / (PERROW - 1))) : 0;
var DX0 = Math.round((RW - 6 - (DSTEP * (PERROW - 1) + 58)) / 2);
var RSTEP = NA > 1 ? Math.min(68, Math.floor(300 / (NA - 1))) : 0;
var NTASK = SITES.reduce(function (m, s) { return m + (s.agents || []).length; }, 0);
map.style.width = px(TW); map.style.height = px(TH);
var bldg = map;
if (SCENE) {
  map.classList.add('scene-on');
  try { window.PNO_SCENE(map, { x: OX, y: OY, w: MAP_W, h: MAP_H, W: TW, H: TH }); } catch (e) { if (window.console) console.warn('scene', e); }
  bldg = document.createElement('div'); bldg.className = 'bldg';
  bldg.style.left = px(OX); bldg.style.top = px(OY); bldg.style.width = px(MAP_W); bldg.style.height = px(MAP_H);
  map.appendChild(bldg);
}
var MEET_CELL = [1, Math.floor((NROWS - 1) / 2)];
var CELLS = [];
for (r = 0; r < NROWS; r++) for (var c = 0; c < 3; c++) { if (!(c === MEET_CELL[0] && r === MEET_CELL[1])) CELLS.push([c, r]); }

function mk(cls, style, parent, html) { var e = document.createElement('div'); e.className = cls; for (var k in style) e.style[k] = style[k]; if (html) e.innerHTML = html; (parent || bldg).appendChild(e); return e; }
function rnd(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

// ผนัง หน้าต่าง ป้าย
mk('wall', {});
var windows = [mk('window', { left: px(50) }), mk('window', { left: px(850) })];
var lights = [];
var SEAVIEW = SCENE && window.PNO_SCENE.view === 'sea';
windows.forEach(function (w, wi) {
  if (SEAVIEW) {  // วิวทะเล: ท้องฟ้า เมฆ ดวงอาทิตย์/ดวงจันทร์ ทะเล เรือ
    w.classList.add('seaview');
    w.innerHTML = '<i class="stars"></i>' + (wi === 0 ? '<i class="sun"></i>' : '') + '<i class="cloud c1"></i><i class="cloud c2"></i>' +
      '<div class="sea"></div>' + (wi === 0 ? '<i class="isle"></i>' : '<i class="wboat"></i>') + '<i class="glint"></i>';
    return;
  }
  var R = rnd(7 + wi * 31), x = 0;
  while (x < 410) {
    var bw = 26 + Math.floor(R() * 34), bh = 30 + Math.floor(R() * 60);
    var b = mk('bld', { left: px(x), width: px(bw), height: px(bh), background: '#5b6b82' }, w);
    for (var yy = 6; yy < bh - 6; yy += 10) for (var xx = 5; xx < bw - 6; xx += 9) {
      var l = document.createElement('i'); l.style.left = px(xx); l.style.top = px(yy); l.dataset.r = R(); b.appendChild(l); lights.push(l);
    }
    x += bw + 4 + Math.floor(R() * 8);
  }
});
mk('shelf', { left: px(484) }); mk('shelf', { left: px(818) });
mk('sign', {}, bldg, '<b>WEB P\'NEUNG</b><span id="pno-clock">--:--</span><div class="strip">' + SITES.map(function (s) { return '<i style="background:' + esc(s.color) + '"></i>'; }).join('') + '</div>');
function skyUpdate() {
  var f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }).format(new Date());
  var h = +f.slice(0, 2); document.getElementById('pno-clock').textContent = 'กรุงเทพฯ ' + f + ' น.';
  var sky, bld, lit, p;
  if (h >= 6 && h < 8) { sky = 'linear-gradient(#f6c28b,#9cc3e6)'; bld = '#6b7a93'; lit = '#ffe08a'; p = .25; }
  else if (h >= 8 && h < 17) { sky = 'linear-gradient(#7fb8f5,#cfe8ff)'; bld = '#6f84a3'; lit = '#dbe9ff'; p = .15; }
  else if (h >= 17 && h < 19) { sky = 'linear-gradient(#ff9e6d,#6b5b95)'; bld = '#3f4a63'; lit = '#ffd46b'; p = .4; }
  else { sky = 'linear-gradient(#0b1d3a,#1e2f5a)'; bld = '#1b2436'; lit = '#ffd46b'; p = .6; }
  map.dataset.p = (h >= 6 && h < 8) ? 'dawn' : (h >= 8 && h < 17) ? 'day' : (h >= 17 && h < 19) ? 'dusk' : 'night';
  windows.forEach(function (w) { w.style.background = sky; w.querySelectorAll('.bld').forEach(function (b) { b.style.background = bld; }); });
  lights.forEach(function (l) { l.style.background = (+l.dataset.r < p) ? lit : 'rgba(0,0,0,.18)'; });
}
ROWS.forEach(function (y) { mk('floorline', { left: px(20), width: px(1280), top: px(y + RH + 15) }); });

var ROOMS = [];
function buildRoom(i, col, row, title, color, meeting) {
  var x = COLS[col], y = ROWS[row];
  var el = mk('room' + (meeting ? ' meeting' : ''), { left: px(x), top: px(y), height: px(RH), borderTopColor: color });
  var R = { x: x, y: y, w: RW, h: RH, col: col, row: row, el: el };
  R.label = mk('label', { borderLeftColor: color }, el, title);
  ROOMS[i] = R; return R;
}
SITES.forEach(function (s, i) {
  var cell = CELLS[i], R = buildRoom(i, cell[0], cell[1], esc(s.domain) + '<span class="dot" id="pno-ld-' + i + '"></span>', s.color);
  R.monitors = [];
  for (var k = 0; k < NA; k++) { var d = mk('desk', { left: px(DX0 + (k % PERROW) * DSTEP), top: px(DESK_Y[Math.floor(k / PERROW)]) }, R.el); R.monitors.push(mk('monitor', {}, d, '<i></i>')); }
  mk('rug', { left: px(16), top: px(RUG_TOP), width: px(362), height: px(RUG_H), borderColor: s.color }, R.el);
  mk('plant', { left: px(372), top: px(RH - 32) }, R.el);
  R.label.addEventListener('click', function () { showSite(i); });
});
var MI = N;
var MR = buildRoom(MI, MEET_CELL[0], MEET_CELL[1], 'ห้องประชุม · มุมกาแฟ', '#8b949e', true);
mk('table', { left: px(96), top: px(30), width: px(200), height: px(50) }, MR.el, '<span id="pno-tableTxt">' + N + ' เว็บ · ' + NTASK + ' งาน</span>');
mk('coffee', { left: px(352), top: px(18) }, MR.el);
mk('coffeeLabel', { left: px(340), top: px(62) }, MR.el, '☕ กาแฟ');
mk('plant', { left: px(10), top: px(RH - 32) }, MR.el);
MR.label.addEventListener('click', function () { if (!meeting) startMeeting(); });

/* ---------- ตัวละคร ---------- */
var SPRITE = ['..HHHH..', '.HHHHHH.', '.HSSSSH.', '.SESSES.', '..SSSS..', '.TTTTTT.', 'TTTTTWTT', 'STTTTTTS', '.TTTTTT.', '.PPPPPP.', '.PP..PP.', '.KK..KK.'];
var HAIR = ['#2b2b2b', '#5a3825', '#d4a23c', '#7a4bd1', '#3b5bdb', '#c0392b', '#1f6f4a', '#cfd3d8'];
var SKIN = ['#f1c27d', '#e0ac69', '#ffdbac', '#c68642'];
function sprite(shirt, hair, skin, scale) {
  scale = scale || 3; var C = { H: hair, S: skin, E: '#1f2328', T: shirt, W: '#fff', P: '#2d333b', K: '#111' }, r = '';
  SPRITE.forEach(function (row, y) { row.split('').forEach(function (ch, x) { if (C[ch]) r += '<rect x="' + x + '" y="' + y + '" width="1.03" height="1.03" fill="' + C[ch] + '"/>'; }); });
  return '<svg viewBox="0 0 8 12" width="' + 8 * scale + '" height="' + 12 * scale + '" shape-rendering="crispEdges">' + r + '</svg>';
}

var agents = [], meeting = false;
SITES.forEach(function (s, si) {
  var R = ROOMS[si];
  s.agents.forEach(function (d, ci) {
    var a = {
      id: s.id + '-' + d.key, site: s, si: si, ci: ci, d: d, status: d.status, home: si, room: si, trip: 0, busy: false,
      hair: HAIR[(si * 5 + ci * 3) % HAIR.length], skin: SKIN[(si + ci) % SKIN.length],
      seat: { x: R.x + DX0 + (ci % PERROW) * DSTEP + 17, y: R.y + DESK_Y[Math.floor(ci / PERROW)] + 24 }, rugSpot: { x: R.x + 50 + ci * RSTEP, y: R.y + RUG_TOP + 42 }
    };
    var el = mk('agent', {});
    el.innerHTML = '<div class="body">' + sprite(d.shirt, a.hair, a.skin) + '</div><div class="mark">!</div><div class="z">z</div><div class="tag"></div>';
    a.el = el; a.body = el.querySelector('.body');
    el.addEventListener('click', function (e) { e.stopPropagation(); showAgent(a); });
    agents.push(a); applyAgent(a);
  });
});
function applyAgent(a) {
  var el = a.el, d = a.d;
  ['ok', 'warn', 'down', 'wait'].forEach(function (s) { el.classList.toggle(s, s === d.status); });
  a.status = d.status;
  el.querySelector('.tag').textContent = d.name + ' · ' + a.site.id;
  el.classList.toggle('showtag', d.status === 'warn' || d.status === 'down');
  var mon = ROOMS[a.si].monitors[a.ci]; mon.className = 'monitor ' + d.status;
}
function homePos(a) { return a.status === 'wait' ? a.rugSpot : a.seat; }
function place(a, x, y) { a.x = x; a.y = y; a.el.style.transitionDuration = '0s'; a.el.style.left = px(x); a.el.style.top = px(y); a.el.style.zIndex = Math.round(y + 36); }
function settle(a) { var atHome = a.room === a.home; a.el.classList.toggle('typing', atHome && a.status !== 'wait' && !meeting); a.el.classList.toggle('sleep', atHome && a.status === 'wait' && !meeting); }
agents.forEach(function (a) { var p = homePos(a); place(a, p.x, p.y); settle(a); });

function step(a, x, y, trip) {
  return new Promise(function (res) {
    var d = Math.hypot(x - a.x, y - a.y); if (d < 1) return res(true);
    var t = d / SPEED; a.el.style.transitionDuration = t + 's';
    if (Math.abs(x - a.x) > 2) a.body.classList.toggle('flip', x < a.x);
    a.x = x; a.y = y; a.el.style.left = px(x); a.el.style.top = px(y); a.el.style.zIndex = Math.round(y + 36);
    setTimeout(function () { res(a.trip === trip); }, t * 1000 + 20);
  });
}
function routePts(a, to, tx, ty) {
  var A = ROOMS[a.room], B = ROOMS[to];
  if (a.room === to) return [[tx, ty]];
  var ay = A.y + A.h + 15 - 34, by = B.y + B.h + 15 - 34, ax = A.x + A.w / 2 - 12, bx = B.x + B.w / 2 - 12, pts = [[ax, ay]];
  if (A.row !== B.row) { var vx = (Math.min(A.col, B.col) === 0 ? 445 : 875) - 12; pts.push([vx, ay], [vx, by]); }
  pts.push([bx, by], [tx, ty]); return pts;
}
async function go(a, to, tx, ty) {
  var trip = ++a.trip; a.el.classList.remove('typing', 'sleep'); a.el.classList.add('walking');
  var pts = routePts(a, to, tx, ty);
  for (var i = 0; i < pts.length; i++) { if (!(await step(a, pts[i][0], pts[i][1], trip))) return false; }
  a.room = to; a.el.classList.remove('walking'); settle(a); return true;
}
function goHome(a) { var p = homePos(a); return go(a, a.home, p.x, p.y); }
function say(a, text, ms, cls) {
  var old = a.el.querySelector('.bubble'); if (old) old.remove();
  var b = document.createElement('div'); b.className = 'bubble ' + (cls || ''); b.textContent = text; a.el.appendChild(b);
  setTimeout(function () { b.remove(); }, ms || 2600);
}

/* ---------- ชีวิตในออฟฟิศ ---------- */
setInterval(async function () {
  if (meeting || document.hidden) return;
  var pool = agents.filter(function (a) { return a.status === 'ok' && !a.busy; }); if (!pool.length) return;
  var a = pool[Math.floor(Math.random() * pool.length)];
  if (Math.random() < .4) { say(a, CHAT[Math.floor(Math.random() * CHAT.length)]); return; }
  a.busy = true;
  var coffee = Math.random() < .6, R = coffee ? MR : ROOMS[a.home];
  var tx = coffee ? R.x + 300 + Math.random() * 44 : R.x + 40 + Math.random() * 320, ty = coffee ? R.y + 44 + Math.random() * 22 : R.y + RUG_TOP + 10 + Math.random() * Math.max(10, RUG_H - 46);
  if (await go(a, coffee ? MI : a.home, tx, ty)) {
    say(a, coffee ? (Math.random() < .5 ? 'กาแฟไหม?' : 'เติมกาแฟแป๊บ ☕') : CHAT[Math.floor(Math.random() * CHAT.length)], 3200);
    await sleep(4200); if (!meeting) await goHome(a);
  }
  a.busy = false;
}, 2400);
setInterval(function () {
  if (meeting || document.hidden) return;
  var bad = agents.filter(function (a) { return a.status === 'warn' || a.status === 'down'; });
  var a = bad[Math.floor(Math.random() * bad.length)];
  if (a && a.room === a.home) say(a, a.d.sh, 2800, a.status);
}, 5200);

/* ---------- ประชุม ---------- */
var meetBtn = document.createElement('button'); meetBtn.className = 'meet'; meetBtn.type = 'button'; meetBtn.textContent = '📣 เรียกประชุม';
meetBtn.onclick = function () { meeting ? endMeeting() : startMeeting(); };
async function startMeeting() {
  meeting = true; meetBtn.textContent = 'เลิกประชุม'; meetBtn.classList.add('on');
  document.getElementById('pno-side').innerHTML = '<h3>ประชุมรายงานผล</h3><p class="empty">รอทุกคนเดินมาที่ห้องประชุม…</p>';
  var rowsMax = Math.max(1, Math.floor((RH - 132) / 30) + 1), perRow = Math.max(10, Math.ceil(agents.length / rowsMax)), colW = Math.min(38, Math.floor(370 / perRow)), rowsNeeded = Math.ceil(agents.length / perRow), rowH = Math.min(33, Math.floor((RH - 132) / Math.max(1, rowsNeeded - 1 || 1)));
  var walks = agents.map(function (a, i) {
    a.busy = true; a.el.classList.add('meetingmode');
    var r = Math.floor(i / perRow), c = i % perRow;
    return sleep(i * 45).then(function () { return meeting && go(a, MI, MR.x + 14 + c * colW, MR.y + 92 + r * rowH); });
  });
  await Promise.all(walks); if (!meeting) return;
  document.getElementById('pno-tableTxt').textContent = 'กำลังรายงาน…';
  renderReport();
  for (var i = 0; i < SITES.length; i++) {
    if (!meeting) return;
    var s = SITES[i], team = agents.filter(function (a) { return a.site === s; }), bad = team.filter(function (a) { return a.status !== 'ok'; });
    if (!bad.length) say(team[0], s.domain + ': ปกติครบ ' + team.length + ' ✓', 2600);
    else bad.forEach(function (a, k) { setTimeout(function () { if (meeting) say(a, a.d.sh, 2600, a.status); }, k * 500); });
    await sleep(1400);
  }
  document.getElementById('pno-tableTxt').textContent = N + ' เว็บ · ' + NTASK + ' งาน';
}
function endMeeting() {
  meeting = false; meetBtn.textContent = '📣 เรียกประชุม'; meetBtn.classList.remove('on');
  agents.forEach(function (a, i) { a.el.classList.remove('meetingmode'); sleep(i * 35).then(function () { return goHome(a); }).then(function () { a.busy = false; }); });
}
function worstOf(team) { var bad = team.filter(function (a) { return a.status !== 'ok'; }); return bad.some(function (a) { return a.status === 'down'; }) ? 'down' : bad.some(function (a) { return a.status === 'warn'; }) ? 'warn' : bad.length ? 'wait' : 'ok'; }
function renderReport() {
  var side = document.getElementById('pno-side');
  side.innerHTML = '<h3>ประชุมรายงานผล</h3>' + SITES.map(function (s, i) {
    var team = agents.filter(function (a) { return a.site === s; }), bad = team.filter(function (a) { return a.status !== 'ok'; });
    var txt = bad.length ? bad.map(function (a) { return a.d.name + ': ' + a.d.sh.replace(/!|zz/g, '').trim(); }).join(' · ') : 'ปกติครบ ' + team.length + ' งาน';
    return '<div class="siteRow"><button type="button" data-i="' + i + '"><span class="dot ' + worstOf(team) + '"></span><span class="n">' + esc(s.id) + '</span><span class="v">' + esc(txt) + '</span></button></div>';
  }).join('');
  side.querySelectorAll('button[data-i]').forEach(function (b) { b.onclick = function () { showSite(+b.dataset.i); }; });
}

/* ---------- แผงรายละเอียด ---------- */
function histSVG(a) {
  var h = a.d.hist || [];
  if (!h.length) return '<small>ยังไม่มีข้อมูลย้อนหลัง</small>';
  var vals = h.map(function (x) { return x.v; }).filter(function (v) { return v != null; });
  var max = Math.max.apply(null, vals.concat([1])), W = 300, H = 54, bw = W / 7;
  var col = { ok: '#3fb950', warn: '#e3b341', down: '#f85149', wait: '#6e7681' };
  var s = '<svg width="' + W + '" height="' + (H + 28) + '" viewBox="0 0 ' + W + ' ' + (H + 28) + '">';
  h.forEach(function (x, i) {
    var isNull = x.v == null, val = isNull ? max : x.v, bh = Math.max(3, val / max * H);
    var c = isNull ? (x.s === 'down' ? '#f85149' : '#30363d') : (col[x.s] || '#30363d');
    var label = isNull ? (x.s === 'down' ? 'ล่ม' : '-') : (Math.round(x.v * 10) / 10);
    if (a.d.key === 'uptime' && x.pct != null && x.pct < 100) { c = '#f85149'; label = x.pct + '%'; }
    s += '<rect x="' + (i * bw + 4) + '" y="' + (H - bh) + '" width="' + (bw - 8) + '" height="' + bh + '" fill="' + c + '"><title>' + esc(x.d) + '</title></rect>';
    s += '<text x="' + (i * bw + bw / 2) + '" y="' + (H + 12) + '" fill="#8b949e" font-size="10" text-anchor="middle">' + esc(label) + '</text>';
    s += '<text x="' + (i * bw + bw / 2) + '" y="' + (H + 25) + '" fill="#6e7681" font-size="9" text-anchor="middle">' + esc(String(x.d).slice(8, 10) + '/' + String(x.d).slice(5, 7)) + '</text>';
  });
  return s + '</svg>';
}
var focusT, shownAgent = null, shownSite = null;
function showAgent(a, scroll) {
  shownAgent = a;
  agents.forEach(function (x) { x.el.classList.remove('focus'); }); a.el.classList.add('focus'); clearTimeout(focusT); focusT = setTimeout(function () { a.el.classList.remove('focus'); }, 4000);
  var d = a.d, extra = '';
  for (var k in (d.detail || {})) extra += '<dt>' + esc(k) + '</dt><dd>' + esc(d.detail[k]) + '</dd>';
  var unit = d.key === 'uptime' ? 'ms เฉลี่ยต่อวัน' : d.unit;
  document.getElementById('pno-detail').innerHTML = '<h3>รายละเอียดงาน</h3>' +
    '<div class="dhead"><div class="avatar">' + sprite(d.shirt, a.hair, a.skin, 5) + '</div><div><div class="nm">' + esc(d.name) + '<span class="chip ' + d.status + '">' + STATUS_TH[d.status] + '</span></div>' +
    '<div class="st">แผนก <a href="' + esc(a.site.url) + '" target="_blank" rel="noopener">' + esc(a.site.domain) + '</a> · ' + esc(d.role) + '</div></div></div>' +
    '<dl class="kv"><dt>ผลล่าสุด</dt><dd>' + esc(d.value) + '</dd><dt>เกณฑ์</dt><dd>' + esc(d.rule) + '</dd><dt>ข้อมูลเมื่อ</dt><dd>' + ago(d.last) + '</dd><dt>รอบการรัน</dt><dd>' + esc(d.sched) + '</dd>' + extra + '</dl>' +
    proofHTML(d) +
    '<div class="hist"><small>7 วันล่าสุด (' + esc(unit) + ')</small><br>' + histSVG(a) + '</div>' +
    (d.status === 'ok' ? '' : '<div class="todo"><b>ควรทำ:</b> ' + esc(d.status === 'wait' && !d.stale ? (d.todo || 'รอรอบถัดไป') : d.todo) + '</div>');
  if (scroll) { centerOn(a); document.getElementById('pno-outer').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
function proofHTML(d) {
  if (d.key !== 'proof' || !d.pages || !d.pages.length) return '';
  return '<div class="proof">' + d.pages.map(function (p) {
    var t = esc(p.title || p.url || 'ไม่มีชื่อหน้า');
    var head = p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + t + ' ↗</a>' : t;
    return '<div class="pg"><div class="pt">' + head + '</div><ul>' + p.issues.map(function (x) {
      return '<li class="' + (x.sure ? 'sure' : 'maybe') + '"><span class="w">' + esc(x.wrong) + '</span> → <span class="f">' + esc(x.fix) + '</span>' +
        (x.sure ? '' : ' <span class="q">น่าสงสัย</span>') + (x.context ? '<div class="c">“' + esc(x.context) + '”</div>' : '') + '</li>';
    }).join('') + '</ul></div>';
  }).join('') + '</div>';
}
function showSite(i) {
  shownSite = i;
  var s = SITES[i], team = agents.filter(function (a) { return a.si === i; });
  var side = document.getElementById('pno-side');
  side.innerHTML = '<h3><span class="dot" style="background:' + esc(s.color) + '"></span>' + esc(s.domain) + ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener" style="font-size:13px;font-family:inherit">เปิดเว็บ ↗</a></h3>' +
    team.map(function (a) { return '<div class="siteRow"><button type="button" data-id="' + esc(a.id) + '"><span class="dot ' + a.status + '"></span><span class="n">' + esc(a.d.name) + '</span><span class="v">' + esc(a.d.value) + '</span></button></div>'; }).join('');
  side.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { showAgent(agents.find(function (a) { return a.id === b.dataset.id; })); }; });
}

/* ---------- ส่วนหัว ---------- */
document.getElementById('pno-rainbow').innerHTML = SITES.map(function (s) { return '<span style="background:' + esc(s.color) + '"></span>'; }).join('');
var stats = document.getElementById('pno-stats'), filter = 'all';
function renderHeader() {
  var cnt = { ok: 0, warn: 0, down: 0, wait: 0 }; agents.forEach(function (a) { cnt[a.status]++; });
  stats.innerHTML = '';
  [['all', 'ทั้งทีม', agents.length], ['ok', 'ทำงานปกติ', cnt.ok], ['warn', 'ต้องดู', cnt.warn], ['down', 'มีปัญหา', cnt.down], ['wait', 'รอข้อมูล', cnt.wait]].forEach(function (x) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'stat' + (filter === x[0] ? ' active' : ''); b.dataset.f = x[0]; b.innerHTML = x[1] + ' <b>' + x[2] + '</b>';
    b.onclick = function () { filter = x[0]; renderHeader(); applyFilter(); };
    stats.appendChild(b);
  });
  var up = document.createElement('span'); up.className = 'updated-at'; up.id = 'pno-updated';
  up.textContent = 'ข้อมูล ณ ' + new Date(STATE.generated * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  stats.appendChild(up); stats.appendChild(meetBtn);
  SITES.forEach(function (s, i) { var dot = document.getElementById('pno-ld-' + i); if (dot) dot.className = 'dot ' + worstOf(agents.filter(function (a) { return a.si === i; })); });

  var issues = agents.filter(function (a) { return a.status === 'down' || a.status === 'warn'; }).sort(function (a, b) { return (a.status === 'down' ? 0 : 1) - (b.status === 'down' ? 0 : 1); });
  var al = document.getElementById('pno-alert');
  al.innerHTML = '<h2>ต้องดูวันนี้</h2><div class="list">' + (issues.length ? issues.map(function (a) {
    return '<button type="button" class="issue" data-id="' + esc(a.id) + '"><span class="dot ' + a.status + '"></span><span class="who">' + esc(a.d.name) + ' · ' + esc(a.site.domain) + '</span> — ' + esc(a.d.value) + '</button>';
  }).join('') : '<span>ไม่มีงานที่ต้องดู ทุกเว็บปกติ ✓</span>') + '</div>';
  var pb = zc && zc.querySelector('.prob'); if (pb) { pb.disabled = !issues.length; pb.classList.toggle('down', issues.some(function (a) { return a.status === 'down'; })); }
  al.style.borderLeftColor =issues.some(function (a) { return a.status === 'down'; }) ? 'var(--down)' : issues.length ? 'var(--warn)' : 'var(--ok)';
  al.querySelectorAll('.issue').forEach(function (b) { b.onclick = function () { showAgent(agents.find(function (a) { return a.id === b.dataset.id; }), true); }; });
}
function applyFilter() { agents.forEach(function (a) { a.el.classList.toggle('dim', filter !== 'all' && a.status !== filter); }); }

/* ---------- ดึงข้อมูลใหม่ ---------- */
function renderOffline() {
  var box = document.getElementById('pno-offline'), mins = Math.round((Date.now() / 1000 - STATE.generated) / 60), lim = (STATE.interval_min || 10) * 3;
  if (mins > lim) {
    box.style.display = 'flex';
    box.innerHTML = '<h2 style="color:#8b949e">เครื่องตรวจปิดอยู่</h2><div class="list"><span>ข้อมูลล่าสุดเมื่อ ' + ago(mins) + ' (' + new Date(STATE.generated * 1000).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + ' น.) · ระหว่างนี้ไม่มีการเช็กเว็บ จะกลับมาเองเมื่อเปิดเครื่องตรวจ</span></div>';
  } else box.style.display = 'none';
}
async function refresh() {
  if (!BOOT.fetchState) return;
  try {
    var st = await BOOT.fetchState();
    if (!st || st.generated === STATE.generated) { renderOffline(); return; }
    var same = st.sites.length === SITES.length && st.sites.every(function (s, i) { return s.id === SITES[i].id && (s.agents || []).length === (SITES[i].agents || []).length; });
    if (!same) { location.reload(); return; }
    STATE = st;
    st.sites.forEach(function (s, si) {
      s.agents.forEach(function (d, ci) {
        var a = agents.find(function (x) { return x.si === si && x.ci === ci; }); if (!a) return; var wasWait = a.status === 'wait';
        a.d = d; applyAgent(a);
        if (!meeting && !a.busy && wasWait !== (a.status === 'wait')) goHome(a);
        settle(a);
      });
    });
    renderHeader(); applyFilter(); renderOffline();
    if (shownAgent) showAgent(shownAgent);
    if (meeting) renderReport(); else if (shownSite != null) showSite(shownSite);
  } catch (e) {
    var u = document.getElementById('pno-updated'); if (u) u.textContent = 'ดึงข้อมูลไม่สำเร็จ จะลองใหม่';
  }
}

/* ---------- ย่อผังให้พอดีจอ ---------- */
var outer = document.getElementById('pno-outer'), sizer = document.getElementById('pno-sizer');
var zoom = null;  // null = พอดีความกว้างจอ
function autoScale() { var s = Math.min(1, (outer.clientWidth - 20) / TW); return Math.max(s, SCENE ? .42 : .7); }
function curScale() { return zoom == null ? autoScale() : zoom; }
function fit() { var s = curScale(); map.style.transform = 'scale(' + s + ')'; sizer.style.width = px(TW * s); sizer.style.height = px(TH * s); }
function setZoom(z) {
  var s0 = curScale(), cx = (outer.scrollLeft + outer.clientWidth / 2) / s0, cy = (outer.scrollTop + outer.clientHeight / 2) / s0;
  zoom = z == null ? null : Math.max(.3, Math.min(1.6, z)); fit();
  var s1 = curScale(); outer.scrollLeft = cx * s1 - outer.clientWidth / 2; outer.scrollTop = cy * s1 - outer.clientHeight / 2;
}
function centerOn(a) {
  if (curScale() < .9) { zoom = 1; fit(); }
  var s = curScale();
  outer.scrollTo({ left: (OX + a.x + 12) * s - outer.clientWidth / 2 + 10, top: (OY + a.y + 18) * s - outer.clientHeight / 2 + 10, behavior: 'smooth' });
}
function goProblem() {
  var bad = agents.filter(function (a) { return a.status === 'down'; });
  if (!bad.length) bad = agents.filter(function (a) { return a.status === 'warn'; });
  if (!bad.length) return;
  goProblem.i = ((goProblem.i || 0) + 1) % bad.length;
  var a = bad[goProblem.i]; centerOn(a); showAgent(a);
}
var zc = document.getElementById('pno-zoom');
if (SCENE) {
  [['+', 'ซูมเข้า', function () { setZoom(curScale() * 1.25); }], ['−', 'ซูมออก', function () { setZoom(curScale() / 1.25); }],
   ['⤢', 'พอดีจอ', function () { setZoom(null); }], ['!', 'ไปที่น้องที่มีปัญหา', goProblem]].forEach(function (b) {
    var e = document.createElement('button'); e.type = 'button'; e.textContent = b[0]; e.title = b[1]; e.setAttribute('aria-label', b[1]); e.onclick = b[2];
    if (b[0] === '!') e.className = 'prob'; zc.appendChild(e);
  });
  // ลากเลื่อนแผนที่ด้วยเมาส์ (มือถือใช้ปัดตามปกติ)
  var drag = null;
  outer.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.agent,.label,button,a')) return;
    drag = { x: e.clientX, y: e.clientY, l: outer.scrollLeft, t: outer.scrollTop }; outer.classList.add('dragging');
  });
  window.addEventListener('pointermove', function (e) { if (drag) { outer.scrollLeft = drag.l - (e.clientX - drag.x); outer.scrollTop = drag.t - (e.clientY - drag.y); } });
  window.addEventListener('pointerup', function () { drag = null; outer.classList.remove('dragging'); });
} else zc.style.display = 'none';
window.addEventListener('resize', fit);
document.getElementById('pno-who').textContent = BOOT.email ? 'เข้าระบบเป็น ' + BOOT.email + ' ·' : '';
document.getElementById('pno-logout').onclick = function (e) { e.preventDefault(); if (BOOT.logout) BOOT.logout(); };
renderHeader(); renderOffline(); fit(); skyUpdate();
setInterval(skyUpdate, 30000);
setInterval(refresh, (BOOT.refresh || 60) * 1000);
setInterval(renderOffline, 60000);
};
