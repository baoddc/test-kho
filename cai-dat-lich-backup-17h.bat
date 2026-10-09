@echo off
chcp 65001 >nul
title CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU SUPABASE - 17:00 HÀNG NGÀY
echo =====================================================================
echo       CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE SANG CSV
echo                (TỰ ĐỘNG CHẠY VÀO 17:00 MỖI NGÀY)
echo =====================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\register-task.ps1"

if %ERRORLEVEL% equ 0 (
    echo.
    echo =====================================================================
    echo [✓] ĐÃ CÀI ĐẶT THÀNH CÔNG LỊCH TỰ ĐỘNG SAO LƯU LÚC 17:00 HÀNG NGÀY!
    echo.
    echo     - Tên tác vụ: DDC_Supabase_Daily_Backup_17h
    echo     - Thời gian chạy: 17:00 (5 giờ chiều) mỗi ngày
    echo     - Chế độ chạy bù: Bật (Tự động sao lưu ngay khi bật máy nếu 17h tắt máy)
    echo     - Chế độ chạy: Ngầm trong nền (không làm phiền màn hình làm việc)
    echo     - Thư mục lưu: %~dp0backups\
    echo =====================================================================
) else (
    echo.
    echo [!] CÓ LỖI XẢY RA KHI ĐĂNG KÝ TASK SCHEDULER!
    echo     Vui lòng nhấp chuột phải vào file này và chọn 'Run as administrator'.
)

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
