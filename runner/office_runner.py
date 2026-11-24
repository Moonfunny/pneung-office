#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
P'Neung Office — เครื่องตรวจ (รันบน Windows ด้วย Task Scheduler ทุก 10 นาที)

  python office_runner.py init                 สร้างไฟล์ตั้งค่า + รหัสลับของ 8 เว็บ
  python office_runner.py secrets              แสดง Site ID + รหัสลับ (เอาไปใส่ในตัวส่งรายงานของแต่ละเว็บ)
  python office_runner.py add-user EMAIL       เพิ่มคนที่เข้าดูแดชบอร์ดได้ (ถามรหัสผ่าน)
  python office_runner.py remove-user EMAIL    ถอดสิทธิ์
  python office_runner.py users                รายชื่อคนที่เข้าได้
  python office_runner.py test SITE_ID         ทดสอบเว็บเดียว แสดงผลดิบ
  python office_runner.py run [--no-push]      เช็กทุกเว็บ เข้ารหัส แล้วส่งขึ้น GitHub Pages

ไฟล์ลับ (ไม่ถูกส่งขึ้น GitHub): runner/config.json, runner/data/
"""
import argparse
import base64
import datetime as dt
import getpass
import hashlib
import hmac
import json
import os
import secrets as pysecrets
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError:  # pragma: no cover
    sys.exit("ต้องติดตั้งก่อน: py -m pip install cryptography")

VERSION = "1.0.0"
RUNNER = Path(__file__).resolve().parent
ROOT = RUNNER.parent
DOCS = ROOT / "docs"
CONFIG = RUNNER / "config.json"
DATA = RUNNER / "data"
HISTORY = DATA / "history.json"
PULLCACHE = DATA / "last_pull.json"
LOG = DATA / "runner.log"
LOCK = DATA / "run.lock"
BKK = dt.timezone(dt.timedelta(hours=7))
PBKDF2_ITER = 310000
UA = "Mozilla/5.0 (compatible; PNeungOffice/%s)" % VERSION

# (โดเมนที่แสดง, URL จริงหลัง redirect — ใช้ URL จริงจะได้ไม่นับเวลา redirect เป็นความช้า)
DEFAULT_SITES = [("nubwo.co.th", "https://www.nubwo.co.th/"), ("egazone.com", "https://egazone.com/"),
                 ("saruspace.com", "https://www.saruspace.com/"), ("glink.in.th", "https://glink.in.th/"),
                 ("lumirathailand.com", "https://www.lumirathailand.com/"), ("ceflar.in.th", "https://www.ceflar.in.th/"),
                 ("gms.co.th", "https://gms.co.th/"), ("katzuni.com", "https://www.katzuni.com/")]
PALETTE = ["#e5534b", "#f0883e", "#e3b341", "#3fb950", "#39c5cf", "#58a6ff", "#a371f7", "#db61a2",
           "#8b949e", "#56d364", "#ff7b72", "#79c0ff"]

# ---------- เกณฑ์ (เหมือนปลั๊กอินเดิม) ----------
TH = {
    "uptime_slow_ms": 1500,
    "ssl_warn_days": 14, "ssl_down_days": 3,
    "speed_warn_s": 3.0, "speed_down_s": 6.0,
    "update_warn": 5,
    "backup_warn_h": 16 * 24, "backup_down_h": 31 * 24,
    "stale_pull_min": 180,      # ดึงข้อมูลจากเว็บไม่ได้นานเกินนี้ → ต้องดู
    "stale_speed_min": 1800,    # สปีดไม่ได้วัดใหม่นานเกินนี้ → ต้องดู
}


def b64e(b):
    return base64.b64encode(b).decode()


def b64d(s):
    return base64.b64decode(s)


def now():
    return int(time.time())


def log(msg):
    DATA.mkdir(parents=True, exist_ok=True)
    if LOG.exists() and LOG.stat().st_size > 1_000_000:
        LOG.replace(DATA / "runner.old.log")
    line = "%s  %s" % (dt.datetime.now(BKK).strftime("%Y-%m-%d %H:%M:%S"), msg)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    try:
        print(line)
    except Exception:
        pass


def load_json(p, default):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(p, obj):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def load_config():
    if not CONFIG.exists():
        sys.exit("ยังไม่มีไฟล์ตั้งค่า ให้รัน: py office_runner.py init")
    return load_json(CONFIG, {})


def site_id_from_domain(d):
    d = d.lower()
    if d.startswith("www."):
        d = d[4:]
    return "".join(c for c in d.split(".")[0] if c.isalnum() or c in "-_")


# ---------- เข้ารหัส ----------
def kek(password, salt, iters):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iters).derive(password.encode("utf-8"))


def email_id(email):
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def write_keys(cfg):
    users = {}
    for u in cfg.get("users", []):
        users[email_id(u["email"])] = {k: u[k] for k in ("salt", "iter", "iv", "wk")}
    save_json(DOCS / "keys.json", {"v": 1, "users": users})


def encrypt_state(cfg, state):
    key = b64d(cfg["data_key"])
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(state, ensure_ascii=False).encode("utf-8"), None)
    save_json(DOCS / "data.json", {"v": 1, "t": state["generated"], "iv": b64e(iv), "ct": b64e(ct)})


# ---------- HTTP ----------
def http_get(url, headers=None, verify=True, timeout=15, limit=2_000_000):
    ctx = ssl.create_default_context()
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    h = {"User-Agent": UA, "Cache-Control": "no-cache"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            body = r.read(limit)
            return r.status, body, int((time.time() - t0) * 1000), None
    except urllib.error.HTTPError as e:
        body = e.read(limit) if hasattr(e, "read") else b""
        return e.code, body, int((time.time() - t0) * 1000), None
    except Exception as e:  # network / ssl / timeout
        return 0, b"", int((time.time() - t0) * 1000), e


def is_challenge(body):
    b = body[:4000].lower()
    return b"one moment, please" in b or b"request is being verified" in b


def check_uptime(site):
    code, body, ms, err = http_get(site["url"])
    if err is not None and "CERTIFICATE" in str(err).upper():
        code2, body2, ms2, err2 = http_get(site["url"], verify=False)
        if err2 is None and 0 < code2 < 500:
            return ms2, {"up": True, "code": code2, "ssl_issue": str(err)[:140]}
    if err is not None:
        msg = "หมดเวลา 15 วิ" if "timed out" in str(err).lower() else str(err)[:120]
        return None, {"up": False, "error": msg, "net": True}
    if code >= 500 or code == 0:
        return None, {"up": False, "code": code}
    d = {"up": True, "code": code}
    if is_challenge(body):
        d["challenge"] = True
    return ms, d


def pull_status(site):
    t = str(now())
    sign = hmac.new(site["secret"].encode(), (t + ".status").encode(), hashlib.sha256).hexdigest()
    url = site["url"].rstrip("/") + "/wp-json/pneung-office/v1/status"
    code, body, ms, err = http_get(url, {"X-PNO-Time": t, "X-PNO-Sign": sign, "Accept": "application/json"}, timeout=40)
    if err is not None:
        return None, "เชื่อมต่อไม่ได้: " + str(err)[:100]
    if is_challenge(body):
        return None, "ติดระบบกันบอทของโฮสต์ (ต้องขอให้โฮสต์ยกเว้น IP ของเครื่องตรวจ)"
    try:
        j = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return None, "ได้คำตอบที่ไม่ใช่ข้อมูล (HTTP %s)" % code
    if code == 200 and j.get("ok"):
        return j, None
    c = j.get("code", "")
    msgs = {
        "rest_no_route": "ยังไม่ได้ติดตั้งตัวส่งรายงานเวอร์ชัน 1.2.0 ขึ้นไป",
        "pnor_bad_sign": "รหัสลับไม่ตรงกับในตัวส่งรายงาน",
        "pnor_clock": "นาฬิกาเครื่องตรวจไม่ตรง (ตั้งเวลาอัตโนมัติใน Windows)",
        "pnor_no_secret": "ตัวส่งรายงานยังไม่ได้ใส่รหัสลับ",
    }
    return None, msgs.get(c, "ผิดพลาด HTTP %s %s" % (code, c))


# ---------- ตัดสินสถานะ ----------
def site_th(site):
    t = dict(TH)
    if site.get("backup_warn_d"):
        t["backup_warn_h"] = float(site["backup_warn_d"]) * 24
    if site.get("backup_down_d"):
        t["backup_down_h"] = float(site["backup_down_d"]) * 24
    return t


def htxt(h):
    return "%d วัน" % round(h / 24) if h >= 48 else "%d ชม." % round(h)


def age_txt(m):
    if m < 60:
        return "%d นาที" % max(0, m)
    if m < 2880:
        return "%d ชม." % round(m / 60)
    return "%d วัน" % round(m / 1440)


def checks_def(t):
    return {
        "uptime": dict(name="น้องออนไลน์", shirt="#2ea043", unit="ms",
                       role="เปิดหน้าแรกของเว็บดูว่าเข้าได้ไหม และตอบกลับเร็วแค่ไหน (เช็กจากเครื่องตรวจ)",
                       rule="ล่มเมื่อเข้าเว็บไม่ได้ · เตือนเมื่อตอบช้ากว่า {:,} ms".format(t["uptime_slow_ms"]),
                       sched="ทุก 10 นาทีขณะเครื่องตรวจเปิด",
                       todo="เปิดเว็บเช็กเอง ดูสถานะโฮสต์ และ error log ของ PHP/เซิร์ฟเวอร์"),
        "ssl": dict(name="น้อง SSL", shirt="#1f6feb", unit="วัน",
                    role="นับวันที่เหลือก่อนใบรับรอง SSL หมดอายุ",
                    rule="เตือนเมื่อเหลือน้อยกว่า %d วัน · ล่มเมื่อเหลือ %d วันหรือน้อยกว่า" % (t["ssl_warn_days"], t["ssl_down_days"]),
                    sched="ทุก 10 นาที (ดึงจากตัวส่งรายงาน)",
                    todo="ต่ออายุ SSL หรือเช็กว่า auto-renew ในแผงโฮสต์ยังทำงาน"),
        "speed": dict(name="น้องสปีด", shirt="#db6d28", unit="วิ",
                      role="วัดความเร็วหน้าแรกบนมือถือ (LCP จาก Google PageSpeed)",
                      rule="เตือนเมื่อ LCP เกิน %.1f วิ · ล่มเมื่อเกิน %.1f วิ" % (t["speed_warn_s"], t["speed_down_s"]),
                      sched="วันละ 2 รอบ (วัดโดยตัวส่งรายงาน)",
                      todo="เช็กรูป hero ที่ใหญ่เกิน ปลั๊กอิน cache และ script ที่โหลดเพิ่มในหน้าแรก"),
        "update": dict(name="น้องอัปเดต", shirt="#8957e5", unit="รายการ",
                       role="นับ WordPress ธีม และปลั๊กอินที่รออัปเดต",
                       rule="เตือนเมื่อรออัปเดตตั้งแต่ %d รายการ" % t["update_warn"],
                       sched="ทุก 10 นาที (ดึงจากตัวส่งรายงาน)",
                       todo="อัปเดตบน staging ก่อน ระวัง Salient/WPBakery แล้วค่อยขึ้นเว็บจริง"),
        "backup": dict(name="น้องแบ็กอัป", shirt="#bf8700", unit="ชม.",
                       role="ดูว่าแบ็กอัปล่าสุดผ่านมานานเท่าไรแล้ว",
                       rule="เตือนเมื่อเกิน %s · ล่มเมื่อเกิน %s" % (htxt(t["backup_warn_h"]), htxt(t["backup_down_h"])),
                       sched="ทุก 10 นาที (ดึงจากตัวส่งรายงาน)",
                       todo="ถึงรอบแบ็กอัปแล้ว: Export ด้วย All-in-One WP Migration ดาวน์โหลดเก็บ แล้วลบไฟล์บนโฮสต์ได้ตามปกติ (ระบบจำไว้ให้แล้ว)"),
    }


def evaluate(key, v, data, t):
    if key == "uptime":
        if not data.get("up"):
            why = data.get("error") or ("HTTP %s" % data["code"] if data.get("code") else "ไม่ตอบสนอง")
            return "down", "เข้าเว็บไม่ได้ (%s)" % why, "เว็บเข้าไม่ได้!"
        ms = int(v)
        if data.get("ssl_issue"):
            return "warn", "เปิดได้ แต่ใบรับรอง SSL ไม่สมบูรณ์ · ตอบ {:,} ms".format(ms), "SSL ไม่สมบูรณ์!"
        note = " (ติดหน้าตรวจบอทของโฮสต์)" if data.get("challenge") else ""
        return ("warn" if ms > t["uptime_slow_ms"] else "ok"), "ออนไลน์ · ตอบ {:,} ms{}".format(ms, note), "ตอบช้า {:,} ms".format(ms)
    if data.get("skip"):
        return "ok", data.get("note", "ไม่ได้ติดตาม"), "ไม่ได้ติดตาม"
    if v is None:
        return "wait", data.get("error", "ยังไม่มีข้อมูล"), "รอข้อมูล zz"
    if key == "ssl":
        d = int(v)
        s = "down" if d <= t["ssl_down_days"] else ("warn" if d < t["ssl_warn_days"] else "ok")
        return s, "เหลือ %d วัน" % d, "SSL เหลือ %d วัน!" % d
    if key == "speed":
        sec = float(v)
        s = "down" if sec > t["speed_down_s"] else ("warn" if sec > t["speed_warn_s"] else "ok")
        sc = " · คะแนน %d" % data["score"] if data.get("score") is not None else ""
        return s, "LCP %.1f วิ (มือถือ)%s" % (sec, sc), "หน้าแรกช้า %.1f วิ" % sec
    if key == "update":
        n = int(v)
        return ("warn" if n >= t["update_warn"] else "ok"), "รออัปเดต %d รายการ" % n, "รออัปเดต %d ตัว" % n
    if key == "backup":
        h = float(v)
        s = "down" if h > t["backup_down_h"] else ("warn" if h > t["backup_warn_h"] else "ok")
        return s, "แบ็กอัปล่าสุด %sที่แล้ว" % htxt(h), "ไม่ได้แบ็กอัปมา %s" % htxt(h)
    return "wait", "", ""


# ---------- ประวัติรายวัน ----------
def today():
    return dt.datetime.now(BKK).strftime("%Y-%m-%d")


def hist_add(hist, sid, key, v, status):
    day = today()
    b = hist.setdefault(sid, {}).setdefault(key, {}).setdefault(day, {"sum": 0, "n": 0, "down": 0, "total": 0, "last": None, "s": "ok"})
    b["total"] += 1
    if status == "down":
        b["down"] += 1
    if v is not None:
        b["sum"] += float(v)
        b["n"] += 1
        b["last"] = v
    b["s"] = status


def hist_series(hist, sid, key, days=7):
    rows = hist.get(sid, {}).get(key, {})
    out = []
    for d in sorted(rows)[-days:]:
        b = rows[d]
        if key == "uptime":
            out.append({"d": d, "v": round(b["sum"] / b["n"]) if b["n"] else None,
                        "s": "down" if b["down"] else "ok",
                        "pct": round(100 * (b["total"] - b["down"]) / b["total"], 2) if b["total"] else None})
        else:
            out.append({"d": d, "v": b["last"], "s": b["s"]})
    return out


def hist_prune(hist):
    cut_u = (dt.datetime.now(BKK) - dt.timedelta(days=14)).strftime("%Y-%m-%d")
    cut = (dt.datetime.now(BKK) - dt.timedelta(days=90)).strftime("%Y-%m-%d")
    for sid in list(hist):
        if sid.startswith("_"):
            continue
        for key in list(hist[sid]):
            lim = cut_u if key == "uptime" else cut
            for d in [d for d in hist[sid][key] if d < lim]:
                del hist[sid][key][d]


def uptime_pct(hist, sid):
    rows = list(hist.get(sid, {}).get("uptime", {}).values())[-7:]
    tot = sum(r["total"] for r in rows)
    dn = sum(r["down"] for r in rows)
    return round(100 * (tot - dn) / tot, 2) if tot else None


# ---------- รอบการทำงาน ----------
def build_agent(site, key, v, data, t, hist, last_min, stale_note=None, extra_todo=None):
    d = checks_def(t)[key]
    status, value, sh = evaluate(key, v, data, t)
    a = dict(key=key, name=d["name"], shirt=d["shirt"], role=d["role"], rule=d["rule"], sched=d["sched"],
             unit=d["unit"], todo=d["todo"], detail={}, hist=hist_series(hist, site["id"], key))
    if key == "uptime":
        pct = uptime_pct(hist, site["id"])
        if status == "down" and hist.get("_last_up", {}).get(site["id"]):
            value = "เข้าเว็บไม่ได้มา %s (%s)" % (age_txt((now() - hist["_last_up"][site["id"]]) / 60), data.get("error") or "HTTP %s" % data.get("code"))
        if pct is not None:
            value += " · 7 วัน %s%%" % pct
        if data.get("ssl_issue"):
            a["detail"]["ปัญหา SSL"] = data["ssl_issue"]
            a["todo"] = "ใบรับรองส่งมาไม่ครบชุด ให้ออกใบรับรองใหม่หรือติดตั้งแบบ full chain ในแผงโฮสต์ แล้วตรวจซ้ำที่ ssllabs.com/ssltest"
    if stale_note and status != "down" and not data.get("skip"):
        status, value, sh = "warn", stale_note + " · ค่าล่าสุด: " + value, stale_note
        a["stale"] = True
    if extra_todo:
        a["todo"] = extra_todo
    if key == "update" and data.get("items"):
        a["detail"]["รายการ"] = ", ".join(str(x) for x in data["items"][:15])
    if key == "ssl" and data.get("expires"):
        a["detail"]["หมดอายุ"] = data["expires"]
        if data.get("issuer"):
            a["detail"]["ผู้ออกใบรับรอง"] = data["issuer"]
    if key == "backup" and data.get("source"):
        a["detail"]["แหล่งแบ็กอัป"] = data["source"]
    if key == "speed" and data.get("score") is not None:
        a["detail"]["คะแนน Performance"] = "%s/100" % data["score"]
    if data.get("reporter"):
        a["detail"]["ตัวส่งรายงาน"] = "v" + str(data["reporter"])
    a.update(status=status, value=value, sh=sh, last=None if last_min is None else int(round(last_min)))
    return a


def internet_ok():
    if os.environ.get("PNO_SKIP_NETCHECK"):
        return True
    for u in ("https://www.google.com/generate_204", "https://www.cloudflare.com/"):
        code, _, _, err = http_get(u, timeout=8)
        if err is None and code:
            return True
    return False


def run(push=True):
    cfg = load_config()
    DATA.mkdir(parents=True, exist_ok=True)
    if LOCK.exists() and time.time() - LOCK.stat().st_mtime < 540:
        log("รอบก่อนยังไม่จบ ข้ามรอบนี้")
        return
    LOCK.write_text(str(os.getpid()))
    try:
        if not internet_ok():
            log("เครื่องตรวจออฟไลน์ ข้ามรอบนี้ (ไม่บันทึกว่าเว็บล่ม)")
            return
        hist = load_json(HISTORY, {})
        cache = load_json(PULLCACHE, {})
        sites_out, count = [], {"ok": 0, "warn": 0, "down": 0, "wait": 0}

        for i, site in enumerate(cfg["sites"]):
            t = site_th(site)
            sid = site["id"]
            agents = []

            ms, ud = check_uptime(site)
            if ud.get("up"):
                hist.setdefault("_last_up", {})[sid] = now()
            st = evaluate("uptime", ms, ud, t)[0]
            hist_add(hist, sid, "uptime", ms, st)
            agents.append(build_agent(site, "uptime", ms, ud, t, hist, 0))

            res, err = pull_status(site)
            if res:
                cache[sid] = {"at": now(), "res": res}
            c = cache.get(sid)
            pull_age = (now() - c["at"]) / 60 if c else None
            for key in ("ssl", "speed", "update", "backup"):
                if not c:
                    data = {"error": err or "ยังไม่มีข้อมูล"}
                    agents.append(build_agent(site, key, None, data, t, hist, None,
                                              extra_todo="ติดตั้ง/อัปเดตตัวส่งรายงาน (v1.2.0+) บนเว็บนี้ แล้วใส่ Site ID และรหัสลับให้ตรงกับเครื่องตรวจ"))
                    continue
                item = c["res"]["checks"].get(key, {}) or {}
                v = item.get("v")
                data = dict(item.get("data") or {})
                data["reporter"] = c["res"].get("reporter")
                last_min = pull_age
                stale = None
                todo = None
                if err and pull_age is not None and pull_age > t["stale_pull_min"]:
                    stale = "ดึงข้อมูลไม่ได้มา %s (%s)" % (age_txt(pull_age), err)
                    todo = "เช็กว่าตัวส่งรายงานบนเว็บนี้ยังเปิดอยู่ และรหัสลับยังตรงกัน"
                if key == "speed" and data.get("measured_at"):
                    last_min = (now() - int(data["measured_at"])) / 60
                    if not stale and v is not None and last_min > t["stale_speed_min"]:
                        stale = "ไม่ได้วัดสปีดมา %s" % age_txt(last_min)
                        todo = "เช็กว่า WP-Cron ของเว็บนี้ทำงาน (สปีดวัดวันละ 2 รอบโดยตัวส่งรายงาน)"
                if res:  # บันทึกประวัติเฉพาะเมื่อได้ข้อมูลใหม่
                    hist_add(hist, sid, key, v, evaluate(key, v, data, t)[0])
                agents.append(build_agent(site, key, v, data, t, hist, last_min, stale, todo))

            for a in agents:
                count[a["status"]] += 1
            sites_out.append({"id": sid, "domain": site["domain"], "url": site["url"],
                              "color": site.get("color", PALETTE[i % len(PALETTE)]), "agents": agents,
                              "pull_error": err})
            log("%-20s uptime=%s pull=%s" % (site["domain"], agents[0]["status"], "ok" if res else err))

        hist_prune(hist)
        save_json(HISTORY, hist)
        save_json(PULLCACHE, cache)
        state = {"generated": now(), "count": count, "total": sum(count.values()), "sites": sites_out,
                 "runner": VERSION, "interval_min": cfg.get("interval_min", 10)}
        encrypt_state(cfg, state)
        write_keys(cfg)
        log("สรุป ok=%(ok)d warn=%(warn)d down=%(down)d wait=%(wait)d" % count)
        if push:
            git_push()
    finally:
        try:
            LOCK.unlink()
        except FileNotFoundError:
            pass


# ---------- git ----------
def git(*args, check=True):
    kw = {}
    if os.name == "nt":
        kw["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, **kw)
    if check and r.returncode != 0:
        raise RuntimeError("git %s: %s" % (" ".join(args), (r.stderr or r.stdout).strip()[:300]))
    return r


def git_push():
    if not (ROOT / ".git").exists():
        log("ยังไม่ได้เชื่อมกับ GitHub (ไม่มี .git) ข้ามการส่งขึ้น")
        return
    try:
        git("add", "docs/data.json", "docs/keys.json")
        if git("diff", "--cached", "--quiet", check=False).returncode == 0:
            log("ข้อมูลไม่เปลี่ยน ไม่ต้องส่ง")
            return
        last = git("log", "-1", "--pretty=%s", check=False).stdout.strip()
        if last == "data update":
            git("commit", "--amend", "-m", "data update")  # เก็บประวัติข้อมูลไว้แค่ commit เดียว repo จะไม่บวม
        else:
            git("commit", "-m", "data update")
        git("push", "--force-with-lease", "origin", "HEAD")
        log("ส่งขึ้น GitHub แล้ว")
    except Exception as e:
        log("ส่งขึ้น GitHub ไม่สำเร็จ: %s" % e)


# ---------- คำสั่งตั้งค่า ----------
def cmd_init(_):
    if CONFIG.exists():
        sys.exit("มีไฟล์ตั้งค่าอยู่แล้ว: %s" % CONFIG)
    sites = []
    for i, (d, url) in enumerate(DEFAULT_SITES):
        sites.append({"id": site_id_from_domain(d), "domain": d, "url": url,
                      "color": PALETTE[i % len(PALETTE)], "secret": pysecrets.token_urlsafe(30)})
    cfg = {"data_key": b64e(AESGCM.generate_key(256)), "sites": sites, "users": [], "interval_min": 10}
    save_json(CONFIG, cfg)
    print("สร้างไฟล์ตั้งค่าแล้ว:", CONFIG)
    print("ขั้นต่อไป: py office_runner.py add-user อีเมลของคุณ")
    cmd_secrets(None)


def cmd_secrets(_):
    cfg = load_config()
    print("\nใส่ค่าต่อไปนี้ในหน้า ตั้งค่า → ตัวส่งรายงานออฟฟิศ ของแต่ละเว็บ\n")
    for s in cfg["sites"]:
        print("%-20s Site ID: %-16s รหัสลับ: %s" % (s["domain"], s["id"], s["secret"]))
    print()


def cmd_add_user(a):
    cfg = load_config()
    email = a.email.strip().lower()
    pw = getpass.getpass("ตั้งรหัสผ่านสำหรับ %s (อย่างน้อย 10 ตัว): " % email)
    if len(pw) < 10:
        sys.exit("รหัสผ่านสั้นเกินไป")
    if getpass.getpass("พิมพ์ซ้ำอีกครั้ง: ") != pw:
        sys.exit("รหัสผ่านไม่ตรงกัน")
    salt, iv = os.urandom(16), os.urandom(12)
    wk = AESGCM(kek(pw, salt, PBKDF2_ITER)).encrypt(iv, b64d(cfg["data_key"]), None)
    cfg["users"] = [u for u in cfg.get("users", []) if u["email"] != email]
    cfg["users"].append({"email": email, "salt": b64e(salt), "iter": PBKDF2_ITER, "iv": b64e(iv), "wk": b64e(wk)})
    save_json(CONFIG, cfg)
    write_keys(cfg)
    print("เพิ่ม %s แล้ว (มีผลหลังรอบส่งถัดไป)" % email)


def cmd_remove_user(a):
    cfg = load_config()
    email = a.email.strip().lower()
    before = len(cfg.get("users", []))
    cfg["users"] = [u for u in cfg.get("users", []) if u["email"] != email]
    if len(cfg["users"]) == before:
        sys.exit("ไม่พบ %s" % email)
    # เปลี่ยนกุญแจข้อมูลด้วย คนที่ถูกถอดจะถอดรหัสข้อมูลใหม่ไม่ได้ แม้เคยจำกุญแจเก่าไว้
    print("ถอด %s แล้ว · ต้องตั้งรหัสผ่านให้คนที่เหลือใหม่ (กุญแจข้อมูลถูกเปลี่ยน)" % email)
    cfg["data_key"] = b64e(AESGCM.generate_key(256))
    remaining = [u["email"] for u in cfg["users"]]
    cfg["users"] = []
    save_json(CONFIG, cfg)
    write_keys(cfg)
    for e in remaining:
        print("\n— ตั้งรหัสผ่านใหม่ให้ %s" % e)
        cmd_add_user(argparse.Namespace(email=e))


def cmd_users(_):
    cfg = load_config()
    for u in cfg.get("users", []):
        print(u["email"])
    if not cfg.get("users"):
        print("(ยังไม่มี)")


def cmd_test(a):
    cfg = load_config()
    site = next((s for s in cfg["sites"] if s["id"] == a.site), None)
    if not site:
        sys.exit("ไม่พบ Site ID: %s" % a.site)
    print("uptime:", check_uptime(site))
    res, err = pull_status(site)
    print("pull:", err or json.dumps(res, ensure_ascii=False, indent=1))


def main():
    p = argparse.ArgumentParser(description="P'Neung Office runner")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(fn=cmd_init)
    sub.add_parser("secrets").set_defaults(fn=cmd_secrets)
    x = sub.add_parser("add-user"); x.add_argument("email"); x.set_defaults(fn=cmd_add_user)
    x = sub.add_parser("remove-user"); x.add_argument("email"); x.set_defaults(fn=cmd_remove_user)
    sub.add_parser("users").set_defaults(fn=cmd_users)
    x = sub.add_parser("test"); x.add_argument("site"); x.set_defaults(fn=cmd_test)
    x = sub.add_parser("run"); x.add_argument("--no-push", action="store_true")
    x.set_defaults(fn=lambda a: run(push=not a.no_push))
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
