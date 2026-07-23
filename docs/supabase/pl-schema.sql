-- SQL schema for PL (Phế liệu) tables in Supabase
-- Run this script in the Supabase SQL Editor

-- 1. Bảng Dữ liệu Phế liệu Cần thu (pl-can-thu)
CREATE TABLE IF NOT EXISTS public."pl-can-thu" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày" date,
    "Kì đổ" text,
    "Xưởng" text,
    "Loại phế liệu" text,
    "Số lượng (kg)" numeric,
    "Ghi chú" text,
    "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng Dữ liệu Phế liệu Chưa thu (pl-chua-thu)
CREATE TABLE IF NOT EXISTS public."pl-chua-thu" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày" date,
    "Kì đổ" text,
    "Xưởng" text,
    "Loại phế liệu" text,
    "Số lượng (kg)" numeric,
    "Ghi chú" text,
    "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng Dữ liệu Phế liệu Đã thu (pl-da-thu)
CREATE TABLE IF NOT EXISTS public."pl-da-thu" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày" date,
    "Kì đổ" text,
    "Xưởng" text,
    "Loại phế liệu" text,
    "Số lượng (kg)" numeric,
    "Ghi chú" text,
    "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Bảng Dữ liệu Phiếu In (pl-phieu-in)
CREATE TABLE IF NOT EXISTS public."pl-phieu-in" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày" date,
    "Số phiếu" text,
    "Bên nhận/Xưởng/Đội" text,
    "Loại xuất" text,
    "Mặt hàng" text,
    "ĐVT" text,
    "Trọng lượng hàng" numeric,
    "Số xe" text,
    "Mã công trình" text,
    "Tên công trình" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Bảng Danh mục Mặt hàng (pl-mathang)
CREATE TABLE IF NOT EXISTS public."pl-mathang" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text UNIQUE,
    unit text,
    code text,
    note text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security to allow direct client queries
ALTER TABLE IF EXISTS public."pl-can-thu" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."pl-chua-thu" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."pl-da-thu" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."pl-phieu-in" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."pl-mathang" DISABLE ROW LEVEL SECURITY;
