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
   - maVatTu: Cột 'Mã hàng / Material' (ví dụ '10001189', '10001141')
   - tenVatTu: Cột 'Tên hàng / Material Description'. CỰC KỲ QUAN TRỌNG: Ghi nhận ĐẦY ĐỦ TOÀN BỘ dữ liệu và tất cả các dòng chữ, số trong ô 'Tên hàng / Material Description' (bao gồm cả tên hàng, quy cách kích thước như 0.5x1200, độ mạ và mác thép như AZ150 G550, tuyệt đối không được bỏ sót bất kỳ dòng nào hay thông số kích thước độ dày x khổ rộng nào). Tự động ghép Lô/Batch vào đúng vị trí tên vật tư (ví dụ: 'Phôi tôn mạ 0.5x1200 AZ150 G550' + Lô 'DOA-VN' -> 'Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550'; 'Thép phôi kẽm Z275 G450' + Lô '1.5x348VN' -> 'Thép phôi kẽm 1.5x348VN Z275 G450').
   - batch: Cột 'Lô / Batch'. QUAN TRỌNG: Lấy chính xác nguyên văn từng ký tự như in trên phiếu xuất kho, giữ nguyên toàn bộ chữ hoa/chữ thường và ký tự số (ví dụ trên phiếu in '2X349VN' thì phải trả về đúng '2X349VN', in 'DOA-VN' thì trả về đúng 'DOA-VN', in '2.5X350VN' thì trả về đúng '2.5X350VN', tuyệt đối không tự ý đổi 'X' thành 'x', không tự ý thêm '.0').
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

function formatBatchForMaterialName(batch: string): string {
  if (!batch) return "";
  batch = String(batch).trim();
  // If batch starts with an integer before x/X (e.g. 3x451VN -> 3.0x451VN, 3X451VN -> 3.0x451VN)
  let formatted = batch.replace(/^(\d+)\s*[xX]/, "$1.0x");
  // Convert any capital 'X' used as dimension separator to lowercase 'x' (e.g. 1.5X348VN -> 1.5x348VN)
  formatted = formatted.replace(/^(\d+(?:\.\d+)?)\s*[xX]/, "$1x");
  formatted = formatted.replace(/(\d)\s*[xX]\s*(\d)/g, "$1x$2");
  return formatted;
}

function mergeBatchIntoTenVatTu(tenVatTu: string, batch: string, oldBatch?: string): string {
  if (!tenVatTu && !batch) return "";
  if (!batch || !String(batch).trim()) return (tenVatTu || "").trim();

  const formattedBatch = formatBatchForMaterialName(batch);
  const rawBatch = String(batch).trim();
  let name = (tenVatTu || "").trim();

  if (!name) return formattedBatch;

  const lowerName = name.toLowerCase();
  const lowerBatch = rawBatch.toLowerCase();
  const lowerFormatted = formattedBatch.toLowerCase();
  if (lowerName.includes(lowerBatch) || lowerName.includes(lowerFormatted)) {
    // If name already contains batch but with capital X, ensure X is replaced by x in dimension
    return name.replace(/\b(\d+(?:\.\d+)?)\s*X\s*(\d+[A-Za-z0-9]*)\b/g, "$1x$2");
  }

  // If oldBatch was provided and is present in name, replace it with new formattedBatch
  if (oldBatch && String(oldBatch).trim()) {
    const rawOld = String(oldBatch).trim();
    const formattedOld = formatBatchForMaterialName(rawOld);
    if (name.includes(rawOld)) {
      return name.replace(rawOld, formattedBatch);
    }
    if (name.includes(formattedOld)) {
      return name.replace(formattedOld, formattedBatch);
    }
  }

  // If name has an existing tole batch between dimension and grade marker:
  // e.g. "Phôi tôn mạ 0.5x1200 PREV_BATCH AZ150 G550" -> replace PREV_BATCH with formattedBatch
  const gradeTokens = "Z\\d+|G\\d+|AZ\\d+|AM\\d+|S\\d+GD|S\\d+|SGCC|SGCD|SECC|SPCC|SUS\\s*\\d+|GI\\s+Z";
  const toleBatchMidRegex = new RegExp("(\\b\\d+(?:\\.\\d+)?\\s*[xX]\\s*\\d+\\s+)(?!(?:" + gradeTokens + ")\\b)([A-Za-z0-9\\-_]+)(\\s+(?:" + gradeTokens + ")\\b)", "i");
  const midMatch = name.match(toleBatchMidRegex);
  if (midMatch) {
    return name.replace(toleBatchMidRegex, `$1${formattedBatch}$3`);
  }

  // If name already has a dimension-batch WITH letter suffix (like 1.5X348VN or 3x451VN),
  // and the new batch is ALSO a dimension-like batch (like 3x451VN), replace it.
  // CRITICAL: Pure dimensions (like 0.5x1200 without trailing letter suffix) are material sizes, NEVER replace them!
  const batchWithDimRegex = /\b\d+(\.\d+)?\s*[xX]\s*\d+[A-Za-z]+[A-Za-z0-9]*\b/i;
  const isNewBatchDim = /\b\d+(\.\d+)?\s*[xX]/i.test(formattedBatch);
  if (isNewBatchDim && batchWithDimRegex.test(name)) {
    return name.replace(batchWithDimRegex, formattedBatch);
  }

  // Look for standard grade/coating markers (Z275, G450, AZ150, S450GD, SGCC, etc.)
  const gradeRegex = new RegExp("(?=\\b(" + gradeTokens + ")\\b)", "i");
  const gradeMatch = name.search(gradeRegex);
  if (gradeMatch !== -1) {
    const before = name.substring(0, gradeMatch).trim();
    const after = name.substring(gradeMatch).trim();
    return `${before} ${formattedBatch} ${after}`.replace(/\s+/g, " ").trim();
  }

  // Fallback: prefix match
  const prefixRegex = /^(Thép phôi kẽm|Thép phôi|Phôi tôn kẽm|Phôi tôn mạ|Phôi tôn|Phôi thép mạ kẽm|Phôi thép|Thép tấm cuộn|Thép cuộn|Thép Inox cuộn|Thép Inox|Tôn cuộn)(\s+|$)(.*)$/i;
  const prefixMatch = name.match(prefixRegex);
  if (prefixMatch) {
    const prefix = prefixMatch[1].trim();
    const rest = (prefixMatch[3] || "").trim();
    if (rest) {
      const dimMatch = rest.match(/^(\d+(?:\.\d+)?\s*[xX]\s*\d+)(.*)$/);
      if (dimMatch) {
        const dimStr = dimMatch[1].replace(/\s*[xX]\s*/, "x");
        const remaining = dimMatch[2].trim();
        return remaining ? `${prefix} ${dimStr} ${formattedBatch} ${remaining}`.replace(/\s+/g, " ").trim() : `${prefix} ${dimStr} ${formattedBatch}`;
      }
      return `${prefix} ${formattedBatch} ${rest}`.replace(/\s+/g, " ").trim();
    }
    return `${prefix} ${formattedBatch}`;
  }

  return `${name} ${formattedBatch}`.trim();
}

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
          itemsList = parsed.items.map((it: any, idx: number) => {
            const b = String(it.batch || "").trim();
            const rawT = String(it.tenVatTu || "").trim();
            return {
              stt: it.stt || (idx + 1),
              maVatTu: String(it.maVatTu || "").trim(),
              tenVatTu: mergeBatchIntoTenVatTu(rawT, b),
              batch: b
            };
          }).filter((it: any) => it.maVatTu || it.tenVatTu || it.batch);
        }

        if (itemsList.length === 0) {
          const b = String(parsed.batch || "").trim();
          const rawT = String(parsed.tenVatTu || "").trim();
          itemsList = [{
            stt: 1,
            maVatTu: String(parsed.maVatTu || "").trim(),
            tenVatTu: mergeBatchIntoTenVatTu(rawT, b),
            batch: b
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
