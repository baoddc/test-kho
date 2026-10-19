// Supabase Edge Function: ocr-scorecard-5s
// Đọc ảnh PHIẾU CHẤM ĐIỂM 5S hằng tháng bằng Google Gemini Vision, trả về điểm S1-S5 của từng kho.
// Dùng chung GEMINI_API_KEY với ocr-receipt; cùng cơ chế CORS + bắt buộc đăng nhập Supabase Auth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://baoddc.com",
  "https://www.baoddc.com",
  "https://web-supabase-five.vercel.app",
  "https://baoddc.github.io",
  "https://localhost",
  "capacitor://localhost",
];
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const MAX_BASE64_LENGTH = 10 * 1024 * 1024;

// 6 kho cố định của bảng xếp hạng (khớp với hse.js)
const AREAS = ["Kho sơn", "Kho vật tư", "Thép tấm", "Kho thép cuộn", "Kho vật liệu hàn", "Thép hình"];

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowed.includes(origin) || LOCAL_ORIGIN_RE.test(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonError(message: string, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyCaller(req: Request): Promise<boolean> {
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!match || !supabaseUrl || !anonKey || match[1].trim() === anonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1].trim()}` },
    });
    if (!res.ok) return false;
    const user = await res.json();
    if (!user?.id) return false;

    // Chỉ admin được chấm điểm 5S (khớp checkPermission() trong hse.js và RLS is_admin() của hse_5s_scores)
    const adminRes = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1].trim()}`, "Content-Type": "application/json" },
      body: "{}",
    });
    return adminRes.ok && (await adminRes.json()) === true;
  } catch (_) {
    return false;
  }
}

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash",
];

const SCORECARD_PROMPT = `
Bạn là chuyên gia đọc bảng điểm 5S của xưởng cơ khí. Ảnh là PHIẾU CHẤM ĐIỂM 5S hằng tháng (bảng Excel), mỗi dòng là một kho, mỗi cột là một tiêu chí S1 (Sàng lọc), S2 (Sắp xếp), S3 (Sạch sẽ), S4 (Săn sóc), S5 (Sẵn sàng) và cột Tổng điểm.
Trích xuất điểm của các kho sau (đúng tên chuẩn này): ${AREAS.join(", ")}.
Quy tắc:
1. Chỉ trả JSON thuần túy, không markdown, không giải thích.
2. Đọc ĐÚNG số trên phiếu, giữ số thập phân nếu có (ví dụ 22.5). Không tự tính, không đoán.
3. Nếu phiếu ghi tên khác (ví dụ "Kho phôi", "Xưởng thép hình") thì ánh xạ về tên chuẩn gần nhất; kho nào không có trên phiếu hoặc chưa chấm thì bỏ qua, không bịa.
4. total là số ở cột Tổng điểm của chính dòng đó trên phiếu (null nếu không có cột này).
5. thang: ngày/tháng chấm điểm ghi trên phiếu dạng "YYYY-MM" nếu đọc được, nếu không thì null.

Format:
{
  "thang": "YYYY-MM" | null,
  "items": [
    { "area": "Kho sơn", "s1": 24, "s2": 24, "s3": 14, "s4": 19, "s5": 15, "total": 96 }
  ]
}
`;

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function canonicalArea(name: unknown): string | null {
  const key = String(name || "").trim().toLowerCase();
  return AREAS.find((a) => a.toLowerCase() === key) || null;
}

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405, corsHeaders);

  const reqOrigin = req.headers.get("Origin");
  if (reqOrigin && !corsHeaders["Access-Control-Allow-Origin"]) {
    return jsonError("Origin không được phép.", 403, corsHeaders);
  }
  if (!(await verifyCaller(req))) {
    return jsonError("Phiên đăng nhập không hợp lệ, đã hết hạn hoặc không phải quản trị viên.", 401, corsHeaders);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonError("Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets.", 500, corsHeaders);
    }

    const declaredLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (declaredLength > MAX_BASE64_LENGTH + 4096) return jsonError("Ảnh vượt quá dung lượng cho phép.", 413, corsHeaders);

    const { base64Data, mimeType } = await req.json();
    if (typeof base64Data === "string" && base64Data.length > MAX_BASE64_LENGTH) {
      return jsonError("Ảnh vượt quá dung lượng cho phép.", 413, corsHeaders);
    }
    if (mimeType && !ALLOWED_MIME_TYPES.includes(String(mimeType).toLowerCase())) {
      return jsonError("Định dạng ảnh không được hỗ trợ.", 415, corsHeaders);
    }
    if (!base64Data) return jsonError("Thiếu dữ liệu hình ảnh (base64Data).", 400, corsHeaders);

    const modelErrors: string[] = [];

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: SCORECARD_PROMPT },
                  { inline_data: { mime_type: mimeType || "image/jpeg", data: base64Data } },
                ],
              }],
              generationConfig: { temperature: 0, topP: 0.95, maxOutputTokens: 2048, responseMimeType: "application/json" },
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errText = await response.text();
          modelErrors.push(`${modelName} (status ${response.status}): ${errText.substring(0, 150)}`);
          if (response.status === 429 || response.status === 404 || response.status === 503) continue;
          throw new Error(`Google API Error (${response.status}): ${errText}`);
        }

        const resData = await response.json();
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!rawText) throw new Error(`Model ${modelName} returned empty text`);

        const cleaned = rawText.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);

        // Mỗi kho chỉ giữ 1 dòng đầu tiên đọc được
        const byArea = new Map<string, Record<string, number | string | null>>();
        for (const it of Array.isArray(parsed.items) ? parsed.items : []) {
          const area = canonicalArea(it.area);
          if (!area || byArea.has(area)) continue;
          byArea.set(area, {
            area,
            s1: toNumber(it.s1),
            s2: toNumber(it.s2),
            s3: toNumber(it.s3),
            s4: toNumber(it.s4),
            s5: toNumber(it.s5),
            total: toNumber(it.total),
          });
        }
        if (byArea.size === 0) throw new Error(`Model ${modelName} không đọc được kho nào trên phiếu`);

        const thang = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(parsed.thang || "")) ? String(parsed.thang) : null;

        return new Response(
          JSON.stringify({ success: true, data: { thang, items: [...byArea.values()], usedModel: modelName } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err: any) {
        modelErrors.push(`${modelName} (exception): ${err.message}`);
        continue;
      }
    }

    return jsonError(`Tất cả các model AI đều không đọc được phiếu: ${modelErrors.join(" | ")}`, 500, corsHeaders);
  } catch (err: any) {
    return jsonError(err.message || "Lỗi xử lý hình ảnh tại server.", 500, corsHeaders);
  }
});
