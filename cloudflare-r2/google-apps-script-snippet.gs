// --- CẤU HÌNH THƯ MỤC LƯU TRỮ GOOGLE DRIVE (CHO TÀI LIỆU PDF & DỰ PHÒNG) ---
const FOLDER_ID_KHO = "1MbmYs81Y4kcjh3c5KwPwt2y4b4W-6tuv"; 
const FOLDER_ID_VESINH = "1xmISjtKJaonTiwWZX23ZCzYNwmydTvKi"; 
const FOLDER_ID_5S_KHACPHUC = "1xoB7i8MQ7ykpE2BnjnqcHng5t2BxYpjE"; 
const FOLDER_ID_5S_THIDUA = "1X3OxLVJdU2-FxnHAZlV-9ynEVp8feDQ_"; 
const FOLDER_ID_PDF = "1oiPaOOwPzeFuNCMH27l_PeNvMoghP97c"; 

function doPost(e) {
  try {
    let payload;
    if (e.parameter && e.parameter.contents) {
      payload = JSON.parse(e.parameter.contents);
    } else if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = JSON.parse(e.postData.getDataAsString());
    }
    const action = payload.action;

    // =========================================================================
    // ⚡ CÁC HÀNH ĐỘNG MỚI: CLOUDFLARE R2 & CHECKLIST THIẾT BỊ HÀNG NGÀY
    // =========================================================================

    // --- A. GHI DÒNG ẢNH MỚI TỪ R2 (Ảnh vệ sinh, Ảnh mẫu kho, Thi đua 5S) ---
    if (action === 'recordImageRow') {
      const sheetName = payload.sheetName;
      const fileName = payload.fileName || "Ảnh mới";
      const fileUrl = payload.fileUrl;
      const dateStr = payload.date || "";

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      sheet.appendRow([fileName, dateStr, fileUrl, "Lưu trên Cloudflare R2"]);

      return responseData({ status: 'success', fileUrl: fileUrl, message: 'Đã ghi nhận ảnh R2' });
    }

    // --- B. CẬP NHẬT Ô ẢNH TỪ R2 (Bảng Khắc phục 5S Trước/Sau) ---
    if (action === 'recordImageCell') {
      const sheetName = payload.sheetName;
      const rowIndex = payload.row;
      const columnHeader = payload.column;
      const fileUrl = payload.fileUrl;

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIndex = headers.indexOf(columnHeader) + 1;

      if (colIndex > 0) {
        sheet.getRange(rowIndex, colIndex).setValue(fileUrl);
      }
      return responseData({ status: 'success', fileUrl: fileUrl, message: 'Đã cập nhật ô ảnh R2' });
    }

    // --- C. LƯU KẾT QUẢ CHECKLIST KIỂM TRA THIẾT BỊ HÀNG NGÀY ---
    if (action === 'saveEquipmentChecklist') {
      const sheetName = payload.sheetName || 'Checklist kiểm tra thiết bị';
      const targetDate = (payload.date || '').trim();
      const inspector = payload.inspector || '';
      const deviceResults = payload.deviceResults || {};

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      const values = sheet.getDataRange().getValues();

      if (values.length === 0) {
        return responseData({ status: 'error', message: 'Sheet rỗng' });
      }

      const headers = values[0];
      let targetRowIndex = -1;

      // Tìm dòng theo ngày (Cột A)
      for (let i = 1; i < values.length; i++) {
        let rowDate = values[i][0];
        let rowDateStr = '';
        if (rowDate instanceof Date) {
          let d = String(rowDate.getDate()).padStart(2, '0');
          let m = String(rowDate.getMonth() + 1).padStart(2, '0');
          let y = rowDate.getFullYear();
          rowDateStr = d + '/' + m + '/' + y;
        } else {
          rowDateStr = String(rowDate).trim();
        }

        if (rowDateStr === targetDate) {
          targetRowIndex = i + 1; // Số dòng trên Sheet (1-based index)
          break;
        }
      }

      // Chuẩn bị mảng dữ liệu cho dòng: [Ngày, Người kiểm tra, Thiết bị 1, Thiết bị 2, ...]
      const rowData = [targetDate, inspector];
      for (let h = 2; h < headers.length; h++) {
        const devName = headers[h];
        rowData.push(deviceResults[devName] || '');
      }

      if (targetRowIndex > 0) {
        // Cập nhật dòng hiện có
        sheet.getRange(targetRowIndex, 1, 1, rowData.length).setValues([rowData]);
        return responseData({ status: 'success', message: 'Đã cập nhật kiểm tra ngày ' + targetDate, isNew: false });
      } else {
        // Thêm dòng mới
        sheet.appendRow(rowData);
        return responseData({ status: 'success', message: 'Đã thêm mới kiểm tra ngày ' + targetDate, isNew: true });
      }
    }

    // =========================================================================
    // 📦 CÁC HÀNH ĐỘNG CŨ (VẪN GIỮ NGUYÊN ĐỂ TƯƠNG THÍCH VỚI DRIVE VÀ PDF)
    // =========================================================================

    // --- 1. UPLOAD FILE TRỰC TIẾP LÊN DRIVE (DỰ PHÒNG HOẶC TÀI LIỆU PDF) ---
    if (action === 'uploadImageRow') {
      const sheetName = payload.sheetName;
      const fileName = payload.fileName;
      const mimeType = payload.mimeType;
      const fileData = payload.fileData;
      const dateStr = payload.date;
      
      let targetFolderId = payload.folderId || payload.folderID || FOLDER_ID_KHO;
      if (!payload.folderId && !payload.folderID) {
        if (sheetName === 'Ảnh vệ sinh') targetFolderId = FOLDER_ID_VESINH;
        else if (sheetName === 'Khắc phục 5S') targetFolderId = FOLDER_ID_5S_KHACPHUC;
        else if (sheetName === 'Thi đua 5S') targetFolderId = FOLDER_ID_5S_THIDUA;
        else if (sheetName === 'Quy định phân loại phế liệu') targetFolderId = FOLDER_ID_PDF;
      }
      
      const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
      const folder = DriveApp.getFolderById(targetFolderId);
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      const fileUrl = newFile.getUrl(); 
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      sheet.appendRow([fileName, dateStr, fileUrl, "Tải lên từ App"]);
      
      return responseData({ status: 'success', fileUrl: fileUrl });
    }

    // --- 2. XÓA FILE (HỖ TRỢ CẢ ẢNH DRIVE CŨ VÀ ẢNH R2 MỚI) ---
    if (action === 'deleteImageRow') {
      const sheetName = payload.sheetName;
      const fileUrl = payload.fileUrl || ""; 

      // Nếu là link Drive thì xóa thêm trên Drive, link R2 thì bỏ qua vì app đã xóa trên R2
      if (fileUrl.indexOf('drive.google.com') !== -1) {
        var match = fileUrl.match(/[-\w]{25,}/);
        if (match) {
          try { DriveApp.getFileById(match[0]).setTrashed(true); } catch (err) {}
        }
      }

      // Xóa trên Sheet
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      const data = sheet.getDataRange().getValues();
      let deleted = false;
      
      for (let i = data.length - 1; i >= 0; i--) {
        for (let j = 0; j < data[i].length; j++) {
          let cellValue = data[i][j] ? data[i][j].toString().trim() : "";
          if (cellValue === fileUrl.trim()) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
        if (deleted) break;
      }
      
      return responseData({ status: 'success', message: deleted ? 'Đã xóa thành công' : 'Đã xóa nhưng không tìm thấy dòng trong Sheet' });
    }

    // --- 3. CẬP NHẬT Ô QUA DRIVE (updateImageCell cũ) ---
    if (action === 'updateImageCell') {
      const sheetName = payload.sheetName;
      const rowIndex = payload.row;
      const columnHeader = payload.column;
      const fileName = payload.fileName;
      const mimeType = payload.mimeType;
      const fileData = payload.fileData;

      let targetFolderId = payload.folderId || payload.folderID || FOLDER_ID_5S_KHACPHUC;
      const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
      const folder = DriveApp.getFolderById(targetFolderId);
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileUrl = newFile.getUrl();
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIndex = headers.indexOf(columnHeader) + 1;
      if (colIndex > 0) sheet.getRange(rowIndex, colIndex).setValue(fileUrl);
      return responseData({ status: 'success', fileUrl: fileUrl });
    }

    // --- 4. XÓA Ô (deleteImageCell) ---
    if (action === 'deleteImageCell') {
      const sheetName = payload.sheetName;
      const rowIndex = payload.row;
      const columnHeader = payload.column;
      const fileUrl = payload.fileUrl || "";

      if (fileUrl.indexOf('drive.google.com') !== -1) {
        var match = fileUrl.match(/[-\w]{25,}/);
        if (match) { try { DriveApp.getFileById(match[0]).setTrashed(true); } catch (e) {} }
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIndex = headers.indexOf(columnHeader) + 1;
      if (colIndex > 0) sheet.getRange(rowIndex, colIndex).clearContent();
      return responseData({ status: 'success', message: 'Đã xóa ô' });
    }

    throw new Error('Hành động không xác định: ' + action);
  } catch (error) {
    return responseData({ status: 'error', message: error.toString() });
  }
}

function responseData(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput("HSE Apps Script API is running.");
}
