# ออฟฟิศดูแลเว็บ — คู่มือติดตั้ง (Windows + GitHub Pages)

ระบบมี 3 ส่วน
1. **เครื่องตรวจ (Windows เครื่องนี้)** — รันทุก 10 นาทีตอนเครื่องเปิด เช็กว่าเว็บเปิดได้ไหม + ดึงข้อมูลจากตัวส่งรายงานของแต่ละเว็บ แล้วเข้ารหัสส่งขึ้น GitHub
2. **หน้าแดชบอร์ดบน GitHub Pages** — เข้าด้วยอีเมล + รหัสผ่านรายคน ถอดรหัสในเบราว์เซอร์
3. **ตัวส่งรายงาน (ปลั๊กอิน WordPress v1.2.0)** — ติดทั้ง 8 เว็บ

> ไฟล์ลับอยู่ที่ `runner\config.json` และโฟลเดอร์ `runner\data\` — ถูกกันไว้ไม่ให้ส่งขึ้น GitHub แล้ว (ใน .gitignore) **ห้ามส่งไฟล์เหล่านี้ให้ใคร**

---

## 1. สมัคร GitHub และสร้าง repo
1. สมัครที่ https://github.com/signup (ฟรี)
2. กด **New repository** → ชื่อ `pneung-office` → เลือก **Public** → กด Create
   - แพ็กเกจฟรีต้องเป็น Public ถึงจะเปิด GitHub Pages ได้ ไม่เป็นไร เพราะข้อมูลถูกเข้ารหัส และไฟล์ลับไม่ถูกส่งขึ้นไป

## 2. ติดตั้งโปรแกรมบน Windows
1. **Python** — https://www.python.org/downloads/ → ตอนติดตั้งติ๊ก **Add python.exe to PATH** และ **py launcher**
2. **Git for Windows** — https://git-scm.com/download/win → กด Next ตามค่าเริ่มต้น (มี Git Credential Manager ให้ล็อกอิน GitHub ผ่านเบราว์เซอร์)
3. เปิด **Command Prompt** แล้วพิมพ์
   ```
   py -m pip install cryptography
   ```

## 3. วางโฟลเดอร์และเชื่อมกับ GitHub
1. แตกไฟล์ zip ไว้ที่ `C:\pneung-office`
2. ใน Command Prompt (เปลี่ยน `USERNAME` เป็นชื่อบัญชี GitHub)
   ```
   cd C:\pneung-office
   git init -b main
   git config user.name "PNeung Office"
   git config user.email "office@example.com"
   git add .
   git commit -m "first"
   git remote add origin https://github.com/USERNAME/pneung-office.git
   git push -u origin main
   ```
   ครั้งแรกจะมีหน้าต่างให้ล็อกอิน GitHub → กด **Sign in with your browser** → อนุญาต (ระบบจำไว้ ครั้งต่อไปไม่ต้องล็อกอิน)
3. ใน GitHub → repo `pneung-office` → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** โฟลเดอร์ **/docs** → Save
   รอ 1–2 นาที จะได้ที่อยู่ `https://USERNAME.github.io/pneung-office/`

## 4. สร้างรหัสลับของ 8 เว็บ และคนที่เข้าดูได้
```
cd C:\pneung-office\runner
py office_runner.py init
py office_runner.py add-user อีเมลของคุณ
```
- `init` จะแสดง **Site ID + รหัสลับ** ของแต่ละเว็บ (ดูซ้ำได้ด้วย `py office_runner.py secrets`)
- `add-user` จะถามรหัสผ่าน (อย่างน้อย 10 ตัว) — เพิ่มคนอื่นได้เรื่อยๆ ด้วยคำสั่งเดียวกัน
- ถอดสิทธิ์: `py office_runner.py remove-user อีเมล` (ระบบจะเปลี่ยนกุญแจและให้ตั้งรหัสใหม่ให้คนที่เหลือ)

## 5. ติดตัวส่งรายงานทั้ง 8 เว็บ
1. Plugins → Add Plugin → Upload → `pneung-office-reporter.zip` (v1.2.0) → Activate
2. ตั้งค่า → **ตัวส่งรายงานออฟฟิศ** → ใส่ **Site ID** และ **รหัสลับ** ตามที่ได้จากข้อ 4 → **ช่อง URL แดชบอร์ดเว้นว่างไว้** → บันทึก
3. ทดสอบจากเครื่องตรวจ: `py office_runner.py test SITE_ID` (เช่น `test nubwo`) ต้องเห็นข้อมูล ไม่ใช่ error

## 6. รันครั้งแรก แล้วตั้งให้รันเอง
1. ดับเบิลคลิก `runner\run_now.bat` → ดูว่าแต่ละเว็บ `pull=ok`
2. เปิด `https://USERNAME.github.io/pneung-office/` → ล็อกอินด้วยอีเมล/รหัสผ่านข้อ 4
3. ดับเบิลคลิก `runner\install_task.bat` → ตั้งให้รันทุก 10 นาที + ทันทีที่ล็อกอิน Windows
4. ตั้ง **Power Options** ให้ไม่ Sleep ระหว่างเวลาทำงาน (Settings → System → Power → Screen and sleep → When plugged in, put my device to sleep: Never)

---

## ถ้ามีปัญหา
- ดูบันทึกการทำงาน: `runner\data\runner.log`
- **pull: รหัสลับไม่ตรง** → ใส่รหัสลับในตัวส่งรายงานใหม่ (คัดลอกจาก `py office_runner.py secrets`)
- **pull: ยังไม่ได้ติดตั้งตัวส่งรายงานเวอร์ชัน 1.2.0** → อัปโหลดตัวส่งรายงาน v1.2.0 ทับ
- **pull: ติดระบบกันบอทของโฮสต์** → ขอโฮสต์ของเว็บนั้นยกเว้น IP ของออฟฟิศ (ดู IP ได้ที่ https://toolbox.hostatom.com/getinfo หรือค้น "what is my ip")
- **pull: นาฬิกาเครื่องตรวจไม่ตรง** → Windows Settings → Time & language → เปิด Set time automatically
- **ส่งขึ้น GitHub ไม่สำเร็จ** → เปิด Command Prompt ที่ `C:\pneung-office` แล้วรัน `git push` ดูข้อความ error
- หน้าแดชบอร์ดขึ้น **"เครื่องตรวจปิดอยู่"** = ไม่ได้ข้อมูลใหม่เกิน 30 นาที (เครื่องปิด/หลับ/เน็ตหลุด) ปกติสำหรับนอกเวลาทำงาน

## เปลี่ยนรายชื่อเว็บ
แก้ `runner\config.json` ในส่วน `sites` (id, domain, url, color, secret) — ตั้งเกณฑ์แบ็กอัปรายเว็บได้ด้วย `"backup_warn_d": 8, "backup_down_d": 15`
