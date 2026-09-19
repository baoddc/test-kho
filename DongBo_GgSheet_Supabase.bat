@echo off
chcp 65001 >nul
title ĐỒNG BỘ GOOGLE SHEETS SANG SUPABASE - KHO XÀ GỒ
echo =====================================================================
echo    HỆ THỐNG ĐỒNG BỘ DỮ LIỆU SAP MB51 TỪ GOOGLE SHEETS SANG SUPABASE
echo =====================================================================
echo.

python "%~dp0scripts\sync-mb51-to-supabase.py"

echo.
echo =====================================================================
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
