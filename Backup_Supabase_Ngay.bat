@echo off
chcp 65001 >nul
title SAO LƯU DỮ LIỆU SUPABASE SANG CSV - KHO DDC
echo =====================================================================
echo         HỆ THỐNG SAO LƯU DỮ LIỆU TỪ SUPABASE VỀ MÁY TÍNH
echo                   (MỖI BẢNG LÀ 1 FILE .CSV RIÊNG)
echo =====================================================================
echo.

node "%~dp0scripts\backup-supabase-to-csv.js"

echo.
echo =====================================================================
echo Hoàn tất phiên sao lưu. File CSV được lưu tại thư mục: %~dp0backups\
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
