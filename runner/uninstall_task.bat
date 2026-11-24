@echo off
chcp 65001 >nul
schtasks /Delete /F /TN "PNeung Office"
schtasks /Delete /F /TN "PNeung Office (logon)"
echo ลบงานตั้งเวลาแล้ว
pause
