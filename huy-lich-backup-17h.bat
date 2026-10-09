@echo off
chcp 65001 >nul
title HỦY LỊCH TỰ ĐỘNG SAO LƯU SUPABASE
echo =====================================================================
echo              HỦY LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE
echo =====================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\unregister-task.ps1"

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
