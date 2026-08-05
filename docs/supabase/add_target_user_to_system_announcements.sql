-- Migration: Bổ sung cột target_user cho bảng system_announcements
ALTER TABLE public.system_announcements 
ADD COLUMN IF NOT EXISTS target_user TEXT DEFAULT NULL;

-- Tạo index tăng tốc truy vấn lọc thông báo theo người dùng
CREATE INDEX IF NOT EXISTS idx_system_announcements_target_user 
ON public.system_announcements (target_user);
