#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script đồng bộ dữ liệu từ Google Sheets (sheet mb51) vào Supabase (bảng xg_sap_mb51).
Sử dụng Google Service Account và Supabase REST API.
"""

import os
import sys
import json
import re
import datetime
import urllib.request
import urllib.parse
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Đảm bảo UTF-8 console output trên Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Cấu hình Google Sheet
SPREADSHEET_ID = '1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs'
SHEET_NAME = 'mb51'

# Cấu hình Supabase (nạp tự động từ biến môi trường hoặc assets/js/core/supabase-config.js)
def get_supabase_credentials():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    if url and key:
        return url, key

    # Đọc trực tiếp từ file cấu hình JS của dự án
    cfg_candidates = [
        os.path.join(os.path.dirname(__file__), '..', 'assets', 'js', 'core', 'supabase-config.js'),
        os.path.join(os.path.dirname(__file__), '..', 'assets', 'js', 'supabase-config.js')
    ]
    for p in cfg_candidates:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            with open(abs_p, 'r', encoding='utf-8') as f:
                content = f.read()
                url_m = re.search(r"const\s+SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", content)
                key_m = re.search(r"const\s+SUPABASE_ANON_KEY\s*=\s*['\"]([^'\"]+)['\"]", content)
                if url_m and key_m:
                    return url_m.group(1), key_m.group(1)

    raise ValueError("Không tìm thấy cấu hình Supabase trong môi trường hoặc supabase-config.js")

SUPABASE_URL, SUPABASE_ANON_KEY = get_supabase_credentials()
TABLE_NAME = 'xg_sap_mb51'

# Tìm đường dẫn service_account.json
def find_service_account_path():
    candidate_paths = [
        os.path.join(os.path.dirname(__file__), '..', 'service_account.json'),
        os.path.join(os.path.dirname(__file__), 'service_account.json'),
        r'C:\Users\benhhc\Desktop\chi-y\service_account.json',
        r'C:\Users\benhhc\Desktop\web-supabase\service_account.json'
    ]
    for p in candidate_paths:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            return abs_p
    raise FileNotFoundError("Không tìm thấy file service_account.json. Vui lòng đặt file tại thư mục gốc.")

def parse_date(raw_date):
    if not raw_date:
        return None
    s = str(raw_date).strip()
    m_iso = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m_iso:
        return f"{m_iso.group(1)}-{int(m_iso.group(2)):02d}-{int(m_iso.group(3)):02d}"
    m_vn = re.match(r'^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})', s)
    if m_vn:
        y = int(m_vn.group(3))
        if y < 100:
            y += 2000 if y < 50 else 1900
        return f"{y:04d}-{int(m_vn.group(2)):02d}-{int(m_vn.group(1)):02d}"
    return None

def parse_numeric(val):
    if val is None or val == '':
        return 0.0
    s = str(val).strip().replace(' ', '')
    if not s:
        return 0.0
    # Xử lý dấu phẩy thập phân kiểu Việt Nam
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0

def supabase_request(method, endpoint, payload=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json'
    }
    if extra_headers:
        headers.update(extra_headers)
    
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"HTTP Error {e.code} on {method} {url}: {err_msg}", file=sys.stderr)
        raise

def main():
    print("=" * 60)
    print(" BẮT ĐẦU ĐỒNG BỘ GOOGLE SHEETS (mb51) SANG SUPABASE")
    print("=" * 60)
    
    sa_path = find_service_account_path()
    print(f"[*] Sử dụng Service Account: {sa_path}")
    
    # 1. Kết nối Google Sheets
    print(f"[*] Đang kết nối Google Sheets: {SPREADSHEET_ID} (sheet: {SHEET_NAME})...")
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=creds)
    
    sheet_data = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{SHEET_NAME}'!A1:Z"
    ).execute()
    
    rows = sheet_data.get('values', [])
    if not rows or len(rows) < 2:
        print("[!] Không có dữ liệu trong sheet", file=sys.stderr)
        return
    
    headers = [str(h).strip() for h in rows[0]]
    data_rows = rows[1:]
    print(f"[✓] Đã đọc thành công {len(data_rows)} dòng từ Google Sheets.")
    
    # Helper tìm index cột an toàn (ưu tiên so khớp chính xác)
    def col_idx(name):
        target = name.strip().lower()
        for i, h in enumerate(headers):
            if h.strip().lower() == target:
                return i
        for i, h in enumerate(headers):
            if target in h.strip().lower():
                return i
        return -1
    
    idx_doc = col_idx('Material Document')
    idx_date = col_idx('Posting Date')
    idx_mat = col_idx('Material')
    idx_mat_desc = col_idx('Material Description')
    idx_batch = col_idx('Batch')
    idx_qty = col_idx('Quantity')
    idx_unit = col_idx('Unit of Entry')
    idx_prj_id = col_idx('Project ID')
    idx_prj_name = col_idx('Project name')
    idx_sloc = col_idx('Storage Location')
    idx_mvt = col_idx('Movement Type')
    idx_mvt_text = col_idx('Movement Type Text')
    idx_plant = col_idx('Plant')
    idx_vendor = col_idx('Vendor name')
    idx_customer = col_idx('Customer name')
    
    print(f"[*] Map cột: Doc={idx_doc} ('{headers[idx_doc]}'), Material={idx_mat} ('{headers[idx_mat]}'), Desc={idx_mat_desc} ('{headers[idx_mat_desc]}')")
    
    def safe_get(row, idx):
        if idx >= 0 and idx < len(row):
            v = str(row[idx]).strip()
            return v if v else None
        return None

    # 2. Chuyển đổi và chuẩn hóa dữ liệu
    print("[*] Đang chuẩn hóa dữ liệu...")
    records = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    for r in data_rows:
        doc = safe_get(r, idx_doc)
        if not doc:
            continue
        
        record = {
            'material_document': doc,
            'posting_date': parse_date(safe_get(r, idx_date)),
            'material': safe_get(r, idx_mat),
            'material_description': safe_get(r, idx_mat_desc),
            'batch': safe_get(r, idx_batch),
            'quantity': parse_numeric(safe_get(r, idx_qty)),
            'unit_of_entry': safe_get(r, idx_unit),
            'project_id': safe_get(r, idx_prj_id),
            'project_name': safe_get(r, idx_prj_name),
            'movement_type': safe_get(r, idx_mvt),
            'movement_type_text': safe_get(r, idx_mvt_text),
            'storage_location': safe_get(r, idx_sloc),
            'plant': safe_get(r, idx_plant),
            'vendor_name': safe_get(r, idx_vendor),
            'customer_name': safe_get(r, idx_customer),
            'synced_at': now_iso
        }
        records.append(record)
    
    print(f"[✓] Số bản ghi hợp lệ sẵn sàng đồng bộ: {len(records)}")
    
    # 3. Xóa dữ liệu cũ trên bảng Supabase để đảm bảo dữ liệu mới nhất
    print(f"[*] Đang làm sạch bảng cũ '{TABLE_NAME}' trên Supabase...")
    try:
        supabase_request('DELETE', f'{TABLE_NAME}?id=gt.0')
        print("[✓] Đã làm sạch dữ liệu cũ.")
    except Exception as e:
        print(f"[!] Cảnh báo làm sạch bảng: {e}")
    
    # 4. Gửi dữ liệu theo batch (1.000 dòng/lần)
    batch_size = 1000
    total_batches = (len(records) + batch_size - 1) // batch_size
    print(f"[*] Đang đẩy {len(records)} dòng lên Supabase theo {total_batches} đợt...")
    
    for b in range(total_batches):
        batch = records[b * batch_size : (b + 1) * batch_size]
        supabase_request('POST', TABLE_NAME, payload=batch, extra_headers={'Prefer': 'return=minimal'})
        print(f"  -> Đợt {b + 1}/{total_batches}: Đã gửi {len(batch)} dòng thành công.")
    
    print("=" * 60)
    print(f"[✓] HOÀN TẤT ĐỒNG BỘ: {len(records)} bản ghi đã được lưu vào Supabase ({TABLE_NAME})!")
    print("=" * 60)

if __name__ == '__main__':
    main()
