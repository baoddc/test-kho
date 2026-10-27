@echo off
chcp 65001 >nul
title HỦY LỊCH TỰ ĐỘNG SAO LƯU SUPABASE
echo =====================================================================
echo              HỦY LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE
echo =====================================================================
echo.

pushd "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\backup\unregister-task.ps1"

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
popd
