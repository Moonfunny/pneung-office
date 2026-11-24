@echo off
chcp 65001 >nul
setlocal
set "PYW="
for /f "delims=" %%i in ('where pyw 2^>nul') do if not defined PYW set "PYW=%%i"
if not defined PYW (
  echo ไม่พบ pyw.exe - ติดตั้ง Python จาก python.org แล้วติ๊ก "py launcher" ด้วย
  pause
  exit /b 1
)
echo ใช้ %PYW%
schtasks /Create /F /SC MINUTE /MO 10 /TN "PNeung Office" /TR "\"%PYW%\" \"%~dp0office_runner.py\" run"
schtasks /Create /F /SC ONLOGON /TN "PNeung Office (logon)" /TR "\"%PYW%\" \"%~dp0office_runner.py\" run"
echo.
echo ตั้งงานเรียบร้อย: เครื่องตรวจจะรันทุก 10 นาที และทันทีที่ล็อกอิน Windows
echo ดูผลการทำงานได้ที่ %~dp0data\runner.log
pause
