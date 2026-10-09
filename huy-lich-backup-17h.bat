@echo off
chcp 65001 >nul
title HỦY LỊCH TỰ ĐỘNG SAO LƯU SUPABASE
echo =====================================================================
echo              HỦY LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE
echo =====================================================================
echo.

set TASK_NAME=DDC_Supabase_Daily_Backup_17h

echo [*] Đang gỡ bỏ tác vụ '%TASK_NAME%' khỏi Windows Task Scheduler...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName '%TASK_NAME%' -Confirm:$false -ErrorAction Stop" >nul 2>&1

if %ERRORLEVEL% equ 0 (
    echo [✓] Đã hủy thành công lịch tự động sao lưu '%TASK_NAME%'.
) else (
    echo [i] Lịch tự động '%TASK_NAME%' không tồn tại hoặc đã được gỡ trước đó.
)

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
