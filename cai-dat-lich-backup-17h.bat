@echo off
chcp 65001 >nul
title CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU SUPABASE - 17:00 HÀNG NGÀY
echo =====================================================================
echo       CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE SANG CSV
echo                (TỰ ĐỘNG CHẠY VÀO 17:00 MỖI NGÀY)
echo =====================================================================
echo.

set TASK_NAME=DDC_Supabase_Daily_Backup_17h
set SCRIPT_DIR=%~dp0
set VBS_PATH=%SCRIPT_DIR%scripts\run-backup-silent.vbs

echo [*] Đang kiểm tra file VBScript: %VBS_PATH%
if not exist "%VBS_PATH%" (
    echo [!] KHÔNG TÌM THẤY FILE: %VBS_PATH%
    echo     Vui lòng kiểm tra lại cấu trúc thư mục dự án!
    goto :END
)

echo [*] Đang đăng ký tác vụ vào Windows Task Scheduler...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$taskName = '%TASK_NAME%';" ^
  "$vbs = '%VBS_PATH%';" ^
  "$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('\"' + $vbs + '\"');" ^
  "$trigger = New-ScheduledTaskTrigger -Daily -At 17:00;" ^
  "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
  "Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null;" ^
  "Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Tu dong sao luu cac bang Supabase sang CSV ve may tinh luc 17h hang ngay' | Out-Null;"

if %ERRORLEVEL% equ 0 (
    echo.
    echo =====================================================================
    echo [✓] ĐÃ CÀI ĐẶT THÀNH CÔNG LỊCH TỰ ĐỘNG SAO LƯU LÚC 17:00 HÀNG NGÀY!
    echo.
    echo     - Tên tác vụ: %TASK_NAME%
    echo     - Thời gian chạy: 17:00 (5 giờ chiều) mỗi ngày
    echo     - Chế độ chạy bù: Bật (Tự động sao lưu ngay khi bật máy nếu 17h tắt máy)
    echo     - Chế độ chạy: Ngầm trong nền (không làm phiền màn hình làm việc)
    echo     - Thư mục lưu: %SCRIPT_DIR%backups\
    echo =====================================================================
) else (
    echo.
    echo [!] CÓ LỖI XẢY RA KHI ĐĂNG KÝ TASK SCHEDULER!
    echo     Vui lòng nhấp chuột phải vào file này và chọn 'Run as administrator'.
)

:END
echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
