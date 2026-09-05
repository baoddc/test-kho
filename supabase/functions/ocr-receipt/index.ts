// Supabase Edge Function: ocr-receipt
// Tự động phân tích & bóc tách Phiếu Xuất Kho qua Google Gemini Vision AI
// Chạy trên runtime Deno của Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro"
];

const OCR_PROMPT = `
Bạn là chuyên gia OCR và trích xuất dữ liệu phiếu kho chứng từ tiếng Việt của CÔNG TY CỔ PHẦN CƠ KHÍ XÂY DỰNG THƯƠNG MẠI ĐẠI DŨNG (DAI DUNG).
Hãy phân tích hình ảnh PHIẾU XUẤT KHO (GOODS ISSUE NOTE) được cung cấp và trích xuất thông tin theo cấu trúc JSON thuần túy (không chứa markdown, không chứa giải thích).

Quy tắc bóc tách:
1. ngayXuat: Tìm ngày xuất hiển thị trên phiếu (thường nằm ngay trên 'Số phiếu' hoặc mục ngày, dạng dd/mm/yyyy, ví dụ '31/08/2026' -> trả về '2026-08-31').
2. phieuXuat: Lấy số sau 'Số phiếu (No.):' (ví dụ '4900137996').
3. maChungTu: Luôn trả về "PX".
4. loaiXuat: Lấy từ 'Đơn vị nhận (Receiving Party):' (ví dụ 'Xưởng sản xuất') hoặc 'Loại giao dịch (Movement type):' (ví dụ '261-Xuất vật tư cho LSX'). Ưu tiên dạng tên đơn vị nhận như 'Xưởng sản xuất'.
5. maCongTrinh: Lấy phần mã phía trước trong mục 'Đối tượng chi phí (Cost Object):' (ví dụ '10626-056.01').
6. tenCongTrinh: Lấy phần tên công trình phía sau mã trong mục 'Đối tượng chi phí (Cost Object):' (ví dụ 'DG TN APF ĐỒNG NAI').
7. items: Quét toàn bộ các dòng hàng trong bảng chi tiết (cột Stt, Mã hàng, Tên hàng, Lô, Số lượng). Với MỖI DÒNG trong bảng, trích xuất 1 phần tử gồm:
   - stt: Số thứ tự dòng (1, 2, 3...)
   - maVatTu: Cột 'Mã hàng / Material' (ví dụ '10001189')
   - tenVatTu: Cột 'Tên hàng / Material Description' (ví dụ 'Thép phôi kẽm Z275 G450')
   - batch: Cột 'Lô / Batch' (ví dụ '1.8X351VN' hoặc '2.5X350VN')
8. ghiChu: Luôn trả về chuỗi rỗng "".

Format JSON mong đợi:
{
  "ngayXuat": "YYYY-MM-DD",
  "phieuXuat": "...",
  "maChungTu": "PX",
  "loaiXuat": "...",
  "maCongTrinh": "...",
  "tenCongTrinh": "...",
  "items": [
    {
      "stt": 1,
      "maVatTu": "...",
      "tenVatTu": "...",
      "batch": "..."
    }
  ],
  "ghiChu": ""
}
`;

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  dateStr = String(dateStr).trim();
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const m = String(dmy[2]).padStart(2, "0");
    const d = String(dmy[1]).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

serve(async (req: Request) => {
  // Xử lý CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets (Project Settings -> Edge Functions -> Secrets)."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { base64Data, mimeType } = await req.json();
    if (!base64Data) {
      return new Response(
        JSON.stringify({ success: false, error: "Thiếu dữ liệu hình ảnh (base64Data)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    let lastError = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        const requestBody = {
          contents: [
            {
              parts: [
                { text: OCR_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            responseMimeType: "application/json"
          }
        };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429 || response.status === 404 || response.status === 503) {
            console.warn(`[OCR Edge Function] Model ${modelName} returned ${response.status}. Trying next model...`);
            lastError = new Error(`Model ${modelName}: ${errText}`);
            continue;
          }
          throw new Error(`Google API Error (${response.status}): ${errText}`);
        }

        const resData = await response.json();
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!rawText) throw new Error(`Model ${modelName} returned empty text`);

        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
        else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();

        const parsed = JSON.parse(cleaned);

        let itemsList = [];
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          itemsList = parsed.items.map((it: any, idx: number) => ({
            stt: it.stt || (idx + 1),
            maVatTu: String(it.maVatTu || "").trim(),
            tenVatTu: String(it.tenVatTu || "").trim(),
            batch: String(it.batch || "").trim()
          })).filter((it: any) => it.maVatTu || it.tenVatTu || it.batch);
        }

        if (itemsList.length === 0) {
          itemsList = [{
            stt: 1,
            maVatTu: String(parsed.maVatTu || "").trim(),
            tenVatTu: String(parsed.tenVatTu || "").trim(),
            batch: String(parsed.batch || "").trim()
          }];
        }

        const normalizedData = {
          ngayXuat: normalizeDate(parsed.ngayXuat) || new Date().toISOString().split("T")[0],
          phieuXuat: String(parsed.phieuXuat || "").trim(),
          maChungTu: "PX",
          loaiXuat: String(parsed.loaiXuat || "Xưởng sản xuất").trim(),
          maCongTrinh: String(parsed.maCongTrinh || "").trim(),
          tenCongTrinh: String(parsed.tenCongTrinh || "").trim(),
          items: itemsList,
          maVatTu: itemsList[0]?.maVatTu || "",
          tenVatTu: itemsList[0]?.tenVatTu || "",
          batch: itemsList[0]?.batch || "",
          soLuongKg: null,
          ghiChu: "",
          usedModel: modelName
        };

        return new Response(
          JSON.stringify({ success: true, data: normalizedData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: lastError?.message || "Tất cả các model AI đều không khả dụng hoặc đã vượt hạn mức quota."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Lỗi xử lý hình ảnh tại server." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
