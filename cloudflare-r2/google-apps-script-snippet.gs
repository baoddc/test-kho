/**
 * GOOGLE APPS SCRIPT - BỔ SUNG CHO HỆ THỐNG HSE KHI DÙNG CLOUDFLARE R2
 * 
 * Cách cập nhật:
 * 1. Mở dự án Google Apps Script hiện tại của HSE (nơi deploy APPS_SCRIPT_URL_HSE).
 * 2. Mở file Code.gs.
 * 3. Tìm hàm doPost(e) và thêm các case (hoặc if-else) dưới đây vào xử lý action.
 * 4. Nhấp "Deploy" (Triển khai) > "Manage deployments" > Chỉnh sửa phiên bản lên "New version" và lưu.
 */

// =========================================================================
// CÁC ACTION MỚI XỬ LÝ LINK TỪ CLOUDFLARE R2 (CỰC KỲ NHẸ & NHANH, KHÔNG BASE64)
// =========================================================================

function handleR2Actions(data) {
  var SPREADSHEET_ID = '1keZMSZqlHFIe7la0H2eR-PDmO2S2ChHo5vn3-H1uoh8'; // ID Google Sheet HSE
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Ghi dòng ảnh mới (Dùng cho Ảnh vệ sinh, Ảnh mẫu kho, Thi đua 5S)
  if (data.action === 'recordImageRow') {
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) {
      return { status: 'error', message: 'Không tìm thấy sheet: ' + data.sheetName };
    }
    // Cấu trúc cột chuẩn: [Tên ảnh, Ngày, Link ảnh R2, Ghi chú]
    sheet.appendRow([data.fileName || 'Ảnh mới', data.date || '', data.fileUrl || '', '']);
    return {
      status: 'success',
      message: 'Đã lưu dòng ảnh R2 vào Sheet thành công',
      fileUrl: data.fileUrl
    };
  }

  // 2. Ghi link ảnh vào ô cụ thể (Dùng cho bảng Khắc phục 5S Trước/Sau)
  if (data.action === 'recordImageCell') {
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) {
      return { status: 'error', message: 'Không tìm thấy sheet: ' + data.sheetName };
    }

    var row = parseInt(data.row);
    var col = data.column;
    var colNumber = typeof col === 'string' && isNaN(col) ? columnLetterToNumber(col) : parseInt(col);

    sheet.getRange(row, colNumber).setValue(data.fileUrl);
    return {
      status: 'success',
      message: 'Đã cập nhật ô ảnh R2 vào dòng ' + row + ', cột ' + col,
      fileUrl: data.fileUrl
    };
  }

  // 3. Xóa an toàn: Xóa dòng/ô trên Sheet mà không bị lỗi nếu là link R2 (không phải Drive)
  if (data.action === 'deleteImageRow') {
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) return { status: 'error', message: 'Không tìm thấy sheet: ' + data.sheetName };

    var values = sheet.getDataRange().getValues();
    var fileUrl = data.fileUrl;
    var deleted = false;

    for (var i = values.length - 1; i >= 1; i--) {
      if (values[i][2] == fileUrl) { // Cột C chứa URL ảnh
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    // Nếu là link Google Drive thì xóa thêm trên Drive, link R2 thì bỏ qua vì client đã xóa trên R2
    if (fileUrl && fileUrl.indexOf('drive.google.com') !== -1) {
      try {
        var match = fileUrl.match(/\/d\/([-\w]{25,})/);
        if (match && match[1]) {
          DriveApp.getFileById(match[1]).setTrashed(true);
        }
      } catch (err) {
        console.warn('Không thể xóa file Drive cũ: ' + err.message);
      }
    }

    return { status: 'success', message: deleted ? 'Đã xóa hàng trong Sheet' : 'Không tìm thấy hàng khớp' };
  }

  if (data.action === 'deleteImageCell') {
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) return { status: 'error', message: 'Không tìm thấy sheet: ' + data.sheetName };

    var row = parseInt(data.row);
    var col = data.column;
    var colNumber = typeof col === 'string' && isNaN(col) ? columnLetterToNumber(col) : parseInt(col);

    sheet.getRange(row, colNumber).clearContent();

    var fileUrl = data.fileUrl;
    if (fileUrl && fileUrl.indexOf('drive.google.com') !== -1) {
      try {
        var match = fileUrl.match(/\/d\/([-\w]{25,})/);
        if (match && match[1]) {
          DriveApp.getFileById(match[1]).setTrashed(true);
        }
      } catch (err) {
        console.warn('Không thể xóa file Drive cũ: ' + err.message);
      }
    }

    return { status: 'success', message: 'Đã xóa ảnh trong ô' };
  }

  return null; // Không thuộc action R2
}

/**
 * Hàm hỗ trợ chuyển đổi chữ cái cột ('A', 'B', 'H', ...) thành số nguyên (1, 2, 8, ...)
 */
function columnLetterToNumber(letter) {
  var column = 0;
  var str = letter.toUpperCase();
  for (var i = 0; i < str.length; i++) {
    column = column * 26 + (str.charCodeAt(i) - 64);
  }
  return column;
}

// =========================================================================
// MẪU TÍCH HỢP VÀO doPost(e) HIỆN TẠI
// =========================================================================
/*
function doPost(e) {
  try {
    var data = {};
    if (e.parameter && e.parameter.contents) {
      data = JSON.parse(e.parameter.contents);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // 1. Ưu tiên xử lý các action R2 siêu tốc
    var r2Result = handleR2Actions(data);
    if (r2Result !== null) {
      return ContentService.createTextOutput(JSON.stringify(r2Result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Các xử lý cũ (uploadImageRow dạng base64, v.v...) giữ nguyên ở dưới
    // ... code cũ của bạn ...

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
*/
