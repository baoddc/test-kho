/* =============================================================================
   SUPABASE CONFIGURATION
   Cấu hình kết nối Supabase - chỉnh sửa file này để cập nhật thông tin kết nối
================================================================================ */

// ⚠️ THAY THẾ các giá trị dưới đây bằng thông tin Supabase của bạn
// Lấy từ: Supabase Dashboard → Settings → API

const SUPABASE_URL = 'https://ahcethtonjwktjtmxzog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';

// Lưu library vào biến tạm, sau đó ghi đè window.supabase bằng client
// để tất cả JS files sau có thể dùng: supabase.from(...)
const _supabaseLib = window.supabase;
window.supabase = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
