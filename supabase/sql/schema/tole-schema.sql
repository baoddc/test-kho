-- SQL schema for Tole tables in Supabase
-- Run this script in the Supabase SQL Editor

-- 1. Bảng Nhập Tole (tole-nhap)
CREATE TABLE IF NOT EXISTS public."tole-nhap" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Mã chứng từ" text,
    "Ngày nhập" date,
    "Phiếu nhập" text,
    "Loại nhập" text,
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Số lượng (Kg)" numeric,
    "Số lượng (m)" numeric,
    "Vị trí" text,
    "Mã công trình" text,
    "Tên công trình" text,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng Xuất Tole (tole-xuat)
CREATE TABLE IF NOT EXISTS public."tole-xuat" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Mã chứng từ" text,
    "Ngày nhập" date,
    "Phiếu nhập" text,
    "Loại nhập" text,
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Số lượng (Kg)" numeric,
    "Số lượng (m)" numeric,
    "Mã công trình" text,
    "Tên công trình" text,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng Tồn Tole tĩnh (tole-ton)
CREATE TABLE IF NOT EXISTS public."tole-ton" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày nhập" date,
    "Thời gian lưu kho" numeric,
    "Vị trí" text,
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Khối lượng (kg)" numeric,
    "Mã công trình" text,
    "Tên công trình" text,
    "Khối lượng (m)" numeric,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security to allow easy client access
ALTER TABLE IF EXISTS public."tole-nhap" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."tole-xuat" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."tole-ton" DISABLE ROW LEVEL SECURITY;
