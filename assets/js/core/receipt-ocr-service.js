/**
 * =============================================================================
 * RECEIPT OCR SERVICE (Vision AI & Pattern Parser)
 * Tự động trích xuất thông tin từ ảnh Phiếu Xuất Kho (DDC / Phiếu kho)
 * =============================================================================
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'gemini_ocr_api_key';
  const CACHED_MODEL_KEY = 'gemini_cached_model_name';

  const CANDIDATE_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  const ReceiptOcrService = {
    /**
     * Lấy API Key từ localStorage
     */
    getApiKey: function () {
      return (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';
    },

    /**
     * Lưu API Key vào localStorage
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
     * Kiểm tra xem đã có API Key chưa
     */
    hasApiKey: function () {
      const key = this.getApiKey();
      return Boolean(key && key.length > 10);
    },

    /**
     * Tự động dò tìm model tốt nhất được hỗ trợ bởi API Key của người dùng
     */
    resolveWorkingModel: async function (apiKey) {
      const cached = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(CACHED_MODEL_KEY) : null;
      if (cached) return cached;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const models = data.models || [];
          const supported = models
            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => (m.name || '').replace(/^models\//, ''));

          for (const cand of CANDIDATE_MODELS) {
            if (supported.includes(cand)) {
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CACHED_MODEL_KEY, cand);
              return cand;
            }
          }

          if (supported.length > 0) {
            const first = supported[0];
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CACHED_MODEL_KEY, first);
            return first;
          }
        }
      } catch (err) {
        console.warn('ListModels failed, fallback to default candidate:', err);
      }

      return 'gemini-2.0-flash';
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
     * Gọi Gemini Vision API để bóc tách thông tin phiếu xuất kho
     */
    callGeminiVision: async function (base64Data, mimeType, apiKey) {
      const prompt = `
Bạn là chuyên gia OCR và trích xuất dữ liệu phiếu kho chứng từ tiếng Việt của CÔNG TY CỔ PHẦN CƠ KHÍ XÂY DỰNG THƯƠNG MẠI ĐẠI DŨNG (DAI DUNG).
Hãy phân tích hình ảnh PHIẾU XUẤT KHO (GOODS ISSUE NOTE) được cung cấp và trích xuất thông tin theo cấu trúc JSON thuần túy (không chứa markdown, không chứa giải thích).

Quy tắc bóc tách:
1. ngayXuat: Tìm ngày xuất hiển thị trên phiếu (thường nằm ngay trên 'Số phiếu' hoặc mục ngày, dạng dd/mm/yyyy, ví dụ '31/08/2026' -> trả về '2026-08-31').
2. phieuXuat: Lấy số sau 'Số phiếu (No.):' (ví dụ '4900137998').
3. maChungTu: Luôn trả về "PX".
4. loaiXuat: Lấy từ 'Đơn vị nhận (Receiving Party):' (ví dụ 'Xưởng sản xuất') hoặc 'Loại giao dịch (Movement type):' (ví dụ '261-Xuất vật tư cho LSX'). Ưu tiên dạng tên đơn vị nhận như 'Xưởng sản xuất'.
5. maVatTu: Lấy từ cột 'Mã hàng / Material' trong bảng chi tiết (ví dụ '10002377').
6. tenVatTu: Lấy từ cột 'Tên hàng / Material Description' (ví dụ 'Phôi tôn mạ 1.0x1200 Z275 G450').
7. batch: Lấy từ cột 'Lô / Batch' (ví dụ 'PHN-VN').
8. maCongTrinh: Lấy phần mã phía trước trong mục 'Đối tượng chi phí (Cost Object):' (ví dụ '10626-056.01').
9. tenCongTrinh: Lấy phần tên công trình phía sau mã trong mục 'Đối tượng chi phí (Cost Object):' (ví dụ 'DG TN APF ĐỒNG NAI').
10. soLuongKg: Luôn trả về null.
11. ghiChu: Luôn trả về chuỗi rỗng "".

Format JSON mong đợi:
{
  "ngayXuat": "YYYY-MM-DD",
  "phieuXuat": "...",
  "maChungTu": "PX",
  "loaiXuat": "...",
  "maVatTu": "...",
  "tenVatTu": "...",
  "batch": "...",
  "maCongTrinh": "...",
  "tenCongTrinh": "...",
  "soLuongKg": null,
  "ghiChu": ""
}
`;

      const modelName = await this.resolveWorkingModel(apiKey);
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

      if (!response.ok) {
        let errMsg = `Lỗi API (${response.status}): ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error && errJson.error.message) {
            errMsg = errJson.error.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        throw new Error('Không nhận được dữ liệu phản hồi từ AI Vision.');
      }

      // Parse JSON an toàn
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

      const parsed = JSON.parse(cleaned);

      // Đảm bảo tuân thủ các quy tắc bất biến
      return {
        ngayXuat: this.normalizeDate(parsed.ngayXuat) || new Date().toISOString().split('T')[0],
        phieuXuat: String(parsed.phieuXuat || '').trim(),
        maChungTu: 'PX',
        loaiXuat: String(parsed.loaiXuat || 'Xưởng sản xuất').trim(),
        maVatTu: String(parsed.maVatTu || '').trim(),
        tenVatTu: String(parsed.tenVatTu || '').trim(),
        batch: String(parsed.batch || '').trim(),
        maCongTrinh: String(parsed.maCongTrinh || '').trim(),
        tenCongTrinh: String(parsed.tenCongTrinh || '').trim(),
        soLuongKg: null,
        ghiChu: ''
      };
    },

    /**
     * Xử lý file/ảnh và trích xuất dữ liệu
     * @param {File|Blob} fileOrBlob 
     * @returns {Promise<{success: boolean, data?: object, error?: string, rawBase64?: string}>}
     */
    processImage: async function (fileOrBlob) {
      if (!fileOrBlob) {
        return { success: false, error: 'Vui lòng chọn hoặc dán file ảnh.' };
      }

      try {
        const { base64Data, mimeType, dataUrl } = await this.fileToBase64(fileOrBlob);
        const apiKey = this.getApiKey();

        if (!apiKey) {
          return {
            success: false,
            needsApiKey: true,
            dataUrl: dataUrl,
            error: 'Chưa cấu hình Gemini API Key. Vui lòng bấm vào biểu tượng cài đặt để nhập API Key (miễn phí).'
          };
        }

        const extractedData = await this.callGeminiVision(base64Data, mimeType, apiKey);

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
     * Test kết nối API Key và tìm model hoạt động
     */
    testApiKey: async function (apiKey) {
      if (!apiKey || !apiKey.trim()) throw new Error('API Key không được để trống.');

      // 1. Kiểm tra API Key và liệt kê model
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const listRes = await fetch(listUrl);

      if (!listRes.ok) {
        let msg = `API Key không hợp lệ (HTTP ${listRes.status})`;
        try {
          const json = await listRes.json();
          if (json.error && json.error.message) msg = json.error.message;
        } catch (_) {}
        throw new Error(msg);
      }

      const listData = await listRes.json();
      const models = listData.models || [];
      const supported = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => (m.name || '').replace(/^models\//, ''));

      if (supported.length === 0) {
        throw new Error('API Key hợp lệ nhưng không tìm thấy model nào hỗ trợ generateContent.');
      }

      // Chọn model tốt nhất
      let selectedModel = 'gemini-2.0-flash';
      for (const cand of CANDIDATE_MODELS) {
        if (supported.includes(cand)) {
          selectedModel = cand;
          break;
        }
      }
      if (!supported.includes(selectedModel)) selectedModel = supported[0];

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(CACHED_MODEL_KEY, selectedModel);
      }

      return {
        success: true,
        model: selectedModel,
        availableModelsCount: supported.length
      };
    }
  };

  window.ReceiptOcrService = ReceiptOcrService;
})(window);
