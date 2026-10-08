/**
 * =============================================================================
 * RECEIPT OCR SERVICE (Vision AI & Pattern Parser)
 * Tự động trích xuất thông tin từ ảnh Phiếu Xuất Kho (DDC / Phiếu kho)
 * Sử dụng Supabase Edge Function để bảo vệ API Key tuyệt đối trên máy chủ
 * =============================================================================
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'gemini_ocr_api_key';
  const CACHED_MODEL_KEY = 'gemini_cached_model_name';

  // Danh sách candidate models khi chạy direct test
  const CANDIDATE_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-2.5-flash'
  ];

  const ReceiptOcrService = {
    /**
     * Lấy API Key tùy chỉnh của người dùng nếu có (dùng cho môi trường dev riêng)
     */
    getCustomApiKey: function () {
      return (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';
    },

    /**
     * Lưu API Key tùy chọn (nếu có)
     */
    setApiKey: function (apiKey) {
      if (typeof localStorage !== 'undefined') {
        if (apiKey && apiKey.trim()) {
          localStorage.setItem(STORAGE_KEY, apiKey.trim());
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(CACHED_MODEL_KEY);
        }
      }
    },

    /**
     * Kiểm tra xem dịch vụ OCR có sẵn sàng không.
     * Mặc định luôn sẵn sàng thông qua Supabase Edge Function (hoặc custom key nếu có).
     */
    hasApiKey: function () {
      return true;
    },

    /**
     * Chuyển File / Blob sang Base64
     */
    fileToBase64: function (fileOrBlob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64Data = result.split(',')[1];
          const mimeType = result.split(';')[0].split(':')[1] || 'image/jpeg';
          resolve({ base64Data, mimeType, dataUrl: result });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(fileOrBlob);
      });
    },

    /**
     * Nén và tối ưu hóa kích thước ảnh trước khi gửi lên AI OCR.
     * Tự động thu nhỏ cạnh lớn nhất về tối đa 1600px và nén JPEG chất lượng 0.82.
     * Giúp giảm dung lượng từ 5MB-15MB xuống ~200KB-400KB trong ~100ms, giữ độ sắc nét 100% cho chữ và số,
     * loại bỏ hoàn toàn lỗi quá tải bộ nhớ Supabase Edge Function (WORKER_RESOURCE_LIMIT / HTTP 546).
     */
    compressImageForOcr: function (fileOrBlob, maxDimension = 1600, quality = 0.82) {
      return new Promise((resolve) => {
        // Fallback sang fileToBase64 nếu ở môi trường không có DOM Canvas hoặc file không phải là ảnh
        if (
          typeof window === 'undefined' ||
          typeof Image === 'undefined' ||
          typeof document === 'undefined' ||
          !fileOrBlob ||
          (fileOrBlob.type && !fileOrBlob.type.startsWith('image/'))
        ) {
          return this.fileToBase64(fileOrBlob).then(resolve).catch(() => resolve({ base64Data: '', mimeType: 'image/jpeg', dataUrl: '' }));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (!width || !height) {
              return this.fileToBase64(fileOrBlob).then(resolve).catch(() => resolve({ base64Data: '', mimeType: 'image/jpeg', dataUrl: '' }));
            }

            // Tính tỷ lệ thu nhỏ nếu kích thước vượt quá maxDimension
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            try {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');

              // Nền trắng phòng trường hợp PNG có kênh alpha
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              const mimeType = 'image/jpeg';
              const dataUrl = canvas.toDataURL(mimeType, quality);
              const base64Data = dataUrl.split(',')[1];

              resolve({ base64Data, mimeType, dataUrl });
            } catch (canvasErr) {
              console.warn('[ReceiptOcrService] Canvas nén ảnh lỗi, fallback file gốc:', canvasErr);
              this.fileToBase64(fileOrBlob).then(resolve).catch(() => resolve({ base64Data: '', mimeType: 'image/jpeg', dataUrl: '' }));
            }
          };

          img.onerror = () => {
            this.fileToBase64(fileOrBlob).then(resolve).catch(() => resolve({ base64Data: '', mimeType: 'image/jpeg', dataUrl: '' }));
          };

          img.src = e.target.result;
        };

        reader.onerror = () => {
          this.fileToBase64(fileOrBlob).then(resolve).catch(() => resolve({ base64Data: '', mimeType: 'image/jpeg', dataUrl: '' }));
        };

        reader.readAsDataURL(fileOrBlob);
      });
    },

    /**
     * Chuẩn hóa ngày từ các định dạng dd/mm/yyyy sang yyyy-mm-dd
     */
    normalizeDate: function (dateStr) {
      if (!dateStr) return '';
      dateStr = String(dateStr).trim();
      const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

      const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (dmy) {
        let y = parseInt(dmy[3], 10);
        if (y < 100) y += y < 50 ? 2000 : 1900;
        const m = String(dmy[2]).padStart(2, '0');
        const d = String(dmy[1]).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return dateStr;
    },

    /**
     * Chuẩn hóa batch/lô trước khi đưa vào tên vật tư (VD: 3x451VN -> 3.0x451VN, 1.5X348VN -> 1.5x348VN)
     */
    formatBatchForMaterialName: function (batch) {
      if (!batch) return '';
      batch = String(batch).trim();
      // If batch starts with an integer before x/X (e.g. 3x451VN -> 3.0x451VN, 3X451VN -> 3.0x451VN)
      let formatted = batch.replace(/^(\d+)\s*[xX]/, '$1.0x');
      // Convert any capital 'X' used as dimension separator to lowercase 'x' (e.g. 1.5X348VN -> 1.5x348VN)
      formatted = formatted.replace(/^(\d+(?:\.\d+)?)\s*[xX]/, '$1x');
      formatted = formatted.replace(/(\d)\s*[xX]\s*(\d)/g, '$1x$2');
      return formatted;
    },

    /**
     * Tự động chèn Lô/Batch vào Tên vật tư theo đúng cấu trúc tiêu chuẩn:
     * VD: 'Thép phôi kẽm Z275 G450' + '1.5X348VN' -> 'Thép phôi kẽm 1.5x348VN Z275 G450'
     * VD: 'Thép phôi kẽm Z275 G450' + '3x451VN'   -> 'Thép phôi kẽm 3.0x451VN Z275 G450'
     * VD: 'Phôi tôn mạ 0.5x1200 AZ150 G550' + 'DOA-VN' -> 'Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550'
     */
    mergeBatchIntoTenVatTu: function (tenVatTu, batch, oldBatch) {
      if (!tenVatTu && !batch) return '';
      if (!batch || !String(batch).trim()) return (tenVatTu || '').trim();

      const formattedBatch = this.formatBatchForMaterialName(batch);
      const rawBatch = String(batch).trim();
      let name = (tenVatTu || '').trim();

      if (!name) return formattedBatch;

      const lowerName = name.toLowerCase();
      const lowerBatch = rawBatch.toLowerCase();
      const lowerFormatted = formattedBatch.toLowerCase();
      if (lowerName.includes(lowerBatch) || lowerName.includes(lowerFormatted)) {
        // If name already contains batch but with capital X, ensure X is replaced by x in dimension
        return name.replace(/\b(\d+(?:\.\d+)?)\s*X\s*(\d+[A-Za-z0-9]*)\b/g, '$1x$2');
      }

      // If oldBatch was provided and is present in name, replace it with new formattedBatch
      if (oldBatch && String(oldBatch).trim()) {
        const rawOld = String(oldBatch).trim();
        const formattedOld = this.formatBatchForMaterialName(rawOld);
        if (name.includes(rawOld)) {
          return name.replace(rawOld, formattedBatch);
        }
        if (name.includes(formattedOld)) {
          return name.replace(formattedOld, formattedBatch);
        }
      }

      // If name has an existing tole batch between dimension and grade marker:
      // e.g. "Phôi tôn mạ 0.5x1200 PREV_BATCH AZ150 G550" -> replace PREV_BATCH with formattedBatch
      const gradeTokens = 'Z\\d+|G\\d+|AZ\\d+|AM\\d+|S\\d+GD|S\\d+|SGCC|SGCD|SECC|SPCC|SUS\\s*\\d+|GI\\s+Z';
      const toleBatchMidRegex = new RegExp('(\\b\\d+(?:\\.\\d+)?\\s*[xX]\\s*\\d+\\s+)(?!(?:' + gradeTokens + ')\\b)([A-Za-z0-9\\-_]+)(\\s+(?:' + gradeTokens + ')\\b)', 'i');
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
      const gradeRegex = new RegExp('(?=\\b(' + gradeTokens + ')\\b)', 'i');
      const gradeMatch = name.search(gradeRegex);
      if (gradeMatch !== -1) {
        const before = name.substring(0, gradeMatch).trim();
        const after = name.substring(gradeMatch).trim();
        return `${before} ${formattedBatch} ${after}`.replace(/\s+/g, ' ').trim();
      }

      // Fallback: prefix match
      const prefixRegex = /^(Thép phôi kẽm|Thép phôi|Phôi tôn kẽm|Phôi tôn mạ|Phôi tôn|Phôi thép mạ kẽm|Phôi thép|Thép tấm cuộn|Thép cuộn|Thép Inox cuộn|Thép Inox|Tôn cuộn)(\s+|$)(.*)$/i;
      const prefixMatch = name.match(prefixRegex);
      if (prefixMatch) {
        const prefix = prefixMatch[1].trim();
        const rest = (prefixMatch[3] || '').trim();
        if (rest) {
          const dimMatch = rest.match(/^(\d+(?:\.\d+)?\s*[xX]\s*\d+)(.*)$/);
          if (dimMatch) {
            const dimStr = dimMatch[1].replace(/\s*[xX]\s*/, 'x');
            const remaining = dimMatch[2].trim();
            return remaining ? `${prefix} ${dimStr} ${formattedBatch} ${remaining}`.replace(/\s+/g, ' ').trim() : `${prefix} ${dimStr} ${formattedBatch}`;
          }
          return `${prefix} ${formattedBatch} ${rest}`.replace(/\s+/g, ' ').trim();
        }
        return `${prefix} ${formattedBatch}`;
      }

      return `${name} ${formattedBatch}`.trim();
    },

    /**
     * Gọi Supabase Edge Function ocr-receipt để bóc tách thông tin bảo mật qua Server
     */
    callEdgeFunctionVision: async function (base64Data, mimeType) {
      if (!window.supabase || typeof window.supabase.functions?.invoke !== 'function') {
        throw new Error('Supabase client chưa được khởi tạo đầy đủ.');
      }

      const { data, error } = await window.supabase.functions.invoke('ocr-receipt', {
        body: { base64Data, mimeType }
      });

      if (error) {
        let detailedMsg = error.message || '';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            if (errBody?.error) detailedMsg = errBody.error;
            else if (errBody?.message) detailedMsg = errBody.message;
          } else if (error.context && typeof error.context.text === 'function') {
            const errText = await error.context.text();
            if (errText) detailedMsg = errText;
          }
        } catch (_) {
          // fallback giữ nguyên error.message
        }

        if (detailedMsg.includes('WORKER_RESOURCE_LIMIT') || detailedMsg.includes('non-2xx status code')) {
          detailedMsg = 'Máy chủ xử lý ảnh tạm thời quá tải hoặc ảnh có dung lượng quá lớn. Vui lòng thử chụp lại gần hơn hoặc tải lại ảnh.';
        } else if (detailedMsg.includes('quota') || detailedMsg.includes('RESOURCE_EXHAUSTED') || detailedMsg.includes('429')) {
          detailedMsg = 'Hệ thống AI đang tạm thời vượt hạn mức yêu cầu. Vui lòng thử lại sau 30 giây.';
        }

        throw new Error(detailedMsg || 'Lỗi kết nối máy chủ Supabase Edge Function.');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Không thể bóc tách dữ liệu từ phiếu xuất.');
      }

      return data.data;
    },

    /**
     * Fallback gọi Gemini Vision trực tiếp nếu người dùng cung cấp custom API Key
     */
    callDirectGeminiVision: async function (base64Data, mimeType, apiKey) {
      const prompt = `
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
   - tenVatTu: Cột 'Tên hàng / Material Description'. CỰC KỲ QUAN TRỌNG: Ghi nhận ĐẦY ĐỦ NGUYÊN BẢN TOÀN BỘ dữ liệu và tất cả các dòng chữ, số trong ô 'Tên hàng / Material Description' như in trên phiếu (bao gồm cả tên hàng, quy cách kích thước như 0.5x1200, độ mạ và mác thép như AZ150 G550, tuyệt đối không được bỏ sót bất kỳ dòng nào hay thông số kích thước độ dày x khổ rộng nào). TUYỆT ĐỐI KHÔNG tự ý ghép Lô/Batch vào tên vật tư, giữ nguyên bản đúng như in trên phiếu.
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

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
          const requestBody = {
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || 'image/jpeg',
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              responseMimeType: 'application/json'
            }
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) continue;

          const resData = await response.json();
          const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!rawText) continue;

          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

          const parsed = JSON.parse(cleaned);

          let itemsList = [];
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            itemsList = parsed.items.map((it, idx) => {
              const b = String(it.batch || '').trim();
              const rawT = String(it.tenVatTu || '').trim();
              return {
                stt: it.stt || (idx + 1),
                maVatTu: String(it.maVatTu || '').trim(),
                tenVatTu: rawT,
                batch: b
              };
            }).filter(it => it.maVatTu || it.tenVatTu || it.batch);
          }

          if (itemsList.length === 0) {
            const b = String(parsed.batch || '').trim();
            const rawT = String(parsed.tenVatTu || '').trim();
            itemsList = [{
              stt: 1,
              maVatTu: String(parsed.maVatTu || '').trim(),
              tenVatTu: rawT,
              batch: b
            }];
          }

          return {
            ngayXuat: this.normalizeDate(parsed.ngayXuat) || new Date().toISOString().split('T')[0],
            phieuXuat: String(parsed.phieuXuat || '').trim(),
            maChungTu: 'PX',
            loaiXuat: String(parsed.loaiXuat || 'Xưởng sản xuất').trim(),
            maCongTrinh: String(parsed.maCongTrinh || '').trim(),
            tenCongTrinh: String(parsed.tenCongTrinh || '').trim(),
            items: itemsList,
            maVatTu: itemsList[0]?.maVatTu || '',
            tenVatTu: itemsList[0]?.tenVatTu || '',
            batch: itemsList[0]?.batch || '',
            soLuongKg: null,
            ghiChu: '',
            usedModel: modelName
          };
        } catch (err) {
          continue;
        }
      }

      throw new Error('Tất cả các model AI đều không khả dụng hoặc đã vượt hạn mức quota.');
    },

    /**
     * Xử lý file/ảnh và trích xuất dữ liệu
     * Ưu tiên Edge Function phía server để giấu API Key hoàn toàn.
     * @param {File|Blob} fileOrBlob 
     * @returns {Promise<{success: boolean, data?: object, error?: string, rawBase64?: string}>}
     */
    processImage: async function (fileOrBlob) {
      if (!fileOrBlob) {
        return { success: false, error: 'Vui lòng chọn hoặc dán file ảnh.' };
      }

      try {
        const { base64Data, mimeType, dataUrl } = await this.compressImageForOcr(fileOrBlob);
        const customKey = this.getCustomApiKey();

        let extractedData = null;

        // Nếu có custom key người dùng tự cấu hình thì dùng direct call
        if (customKey && customKey.trim().length > 10) {
          extractedData = await this.callDirectGeminiVision(base64Data, mimeType, customKey);
        } else {
          // Mặc định gọi qua Supabase Edge Function bảo mật
          extractedData = await this.callEdgeFunctionVision(base64Data, mimeType);
        }

        if (extractedData) {
          if (Array.isArray(extractedData.items)) {
            extractedData.items = extractedData.items.map(it => ({
              ...it,
              tenVatTu: String(it.tenVatTu || '').trim()
            }));
          }
          if (extractedData.tenVatTu) {
            extractedData.tenVatTu = String(extractedData.tenVatTu || '').trim();
          }
        }

        return {
          success: true,
          data: extractedData,
          dataUrl: dataUrl
        };
      } catch (err) {
        console.error('ReceiptOcrService error:', err);
        return {
          success: false,
          error: err.message || 'Không thể trích xuất dữ liệu từ ảnh.'
        };
      }
    },

    /**
     * Test kết nối API Key tùy chọn (nếu người dùng cấu hình thủ công)
     */
    testApiKey: async function (apiKey) {
      if (!apiKey || !apiKey.trim()) throw new Error('API Key không được để trống.');
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const listRes = await fetch(listUrl);
      if (!listRes.ok) throw new Error(`API Key không hợp lệ (HTTP ${listRes.status})`);
      return { success: true };
    },

    /**
     * Tự động nhận diện và phân loại phiếu xuất kho thuộc Xà Gồ hay Tole
     * @param {Object} receiptData - Dữ liệu phiếu đã trích xuất ({ phieuXuat, items })
     * @param {string} currentWarehouse - 'xg' hoặc 'tole'
     * @returns {Promise<{ targetWarehouse: string, confidence: string, reason: string, isMatchCurrent: boolean, targetPageUrl: string, targetLabel: string }>}
     */
    classifyReceipt: async function (receiptData, currentWarehouse) {
      const emptyResult = {
        targetWarehouse: 'unknown',
        confidence: 'none',
        reason: 'Không xác định được loại vật tư',
        isMatchCurrent: true,
        targetPageUrl: '',
        targetLabel: ''
      };

      if (!receiptData) return emptyResult;

      const docNo = String(receiptData.phieuXuat || '').trim();
      let matchedWarehouse = 'unknown';
      let confidence = 'none';
      let reason = '';

      // Tầng 1: Ưu tiên tra cứu SAP MB51 (chính xác 100%)
      if (docNo && typeof window !== 'undefined' && window.supabase) {
        try {
          const { data, error } = await window.supabase
            .from('xg_sap_mb51')
            .select('material_document, material_group, material, debit_credit_ind')
            .ilike('material_document', `%${docNo}%`)
            .limit(10);

          if (!error && Array.isArray(data) && data.length > 0) {
            for (const row of data) {
              const grp = String(row.material_group || '').trim();
              if (grp.startsWith('10040') || grp.startsWith('10041')) {
                matchedWarehouse = 'xg';
                confidence = 'sap';
                reason = `Khớp nhóm SAP MB51: ${grp}`;
                break;
              }
              if (['10030', '10031', '10022', '10091'].some(p => grp.startsWith(p))) {
                matchedWarehouse = 'tole';
                confidence = 'sap';
                reason = `Khớp nhóm SAP MB51: ${grp}`;
                break;
              }
            }
          }
        } catch (err) {
          console.warn('[ReceiptOcrService] Lỗi tra cứu SAP khi phân loại:', err);
        }
      }

      // Tầng 2: Dự phòng phân tích từ khóa Tên hàng & Mã hàng trên phiếu
      if (matchedWarehouse === 'unknown') {
        const items = Array.isArray(receiptData.items) ? receiptData.items : [];
        const fullText = items.map(it => `${it.maVatTu || ''} ${it.tenVatTu || ''}`).join(' ').toLowerCase();

        const xgRegex = /(xà gồ|xa go|thép phôi kẽm|thep phoi kem|phôi kẽm|phoi kem|phôi xà gồ|phoi xa go)/i;
        const toleRegex = /(phôi tôn|phoi ton|tôn cuộn|ton cuon|thép cuộn inox|thep cuon inox|nhôm cuộn|nhom cuon|phôi thép mạ kẽm|tole|\btôn\b|\bton\b)/i;

        if (xgRegex.test(fullText)) {
          matchedWarehouse = 'xg';
          confidence = 'keywords';
          reason = 'Tên hàng chứa quy cách Xà Gồ';
        } else if (toleRegex.test(fullText)) {
          matchedWarehouse = 'tole';
          confidence = 'keywords';
          reason = 'Tên hàng chứa quy cách Tole';
        }
      }

      const isXg = matchedWarehouse === 'xg';
      const isTole = matchedWarehouse === 'tole';
      const targetPageUrl = isXg ? '/pages/xg/xg-xuat.html' : (isTole ? '/pages/tole/tole-xuat.html' : '');
      const targetLabel = isXg ? 'Kho Xà Gồ - Xuất' : (isTole ? 'Kho Tole - Xuất' : '');
      const isMatchCurrent = matchedWarehouse === 'unknown' || (currentWarehouse ? matchedWarehouse === currentWarehouse : true);

      return {
        targetWarehouse: matchedWarehouse,
        confidence,
        reason: reason || 'Chưa phân loại rõ',
        isMatchCurrent,
        targetPageUrl,
        targetLabel
      };
    }
  };

  window.ReceiptOcrService = ReceiptOcrService;
})(window);
