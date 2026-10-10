const assert = require('assert');
const {
  generateArrivalTitle,
  groupArrivalData,
  formatAnnouncementContent,
  formatArrivalItemLabel,
  parseNumeric
} = require('../assets/js/components/goods-arrival-notice.js');

console.log('--- RUNNING GOODS ARRIVAL NOTICE TESTS ---');

// Test 1: Sinh tiêu đề từ chuỗi ngày (hỗ trợ YYYY-MM-DD và DD/MM/YYYY)
assert.strictEqual(generateArrivalTitle('2026-08-29'), 'Hàng về kho ngày 29/08');
assert.strictEqual(generateArrivalTitle('29/08/2026'), 'Hàng về kho ngày 29/08');
assert.strictEqual(generateArrivalTitle('2026-09-05T00:00:00.000Z'), 'Hàng về kho ngày 05/09');
console.log('✅ Test 1 Passed: Title generation');

// Test 2: Parse số lượng kg dạng số hoặc chuỗi có dấu phẩy/chấm
assert.strictEqual(parseNumeric(1500), 1500);
assert.strictEqual(parseNumeric('7.712'), 7712);
assert.strictEqual(parseNumeric('26,770'), 26.77);
assert.strictEqual(parseNumeric('26.770,5'), 26770.5);
console.log('✅ Test 2 Passed: Numeric parsing');

// Test 3: Định dạng nhãn mục hàng: Xà gồ (Mã vật tư + Batch) và Tole (Mã vật tư + Tên vật tư + Batch)
assert.strictEqual(
  formatArrivalItemLabel({ 'Mã vật tư': '10001189', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '1.5X145VN' }, 'XG'),
  '10001189 - 1.5X145VN'
);
assert.strictEqual(
  formatArrivalItemLabel({ 'Mã vật tư': '10002891', 'Tên vật tư': 'Phôi tôn mạ màu 0.45x1200 AM150 G300', 'Batch': 'CL02BLS-VN' }, 'TOLE'),
  '10002891 - Phôi tôn mạ màu 0.45x1200 AM150 G300 - CL02BLS-VN'
);
// Fallback khi thiếu trường
assert.strictEqual(
  formatArrivalItemLabel({ 'Mã vật tư': '10001189', 'Batch': '' }, 'XG'),
  '10001189'
);
assert.strictEqual(
  formatArrivalItemLabel({ 'Mã vật tư': '', 'Batch': '1.5X348VN' }, 'XG'),
  '1.5X348VN'
);
assert.strictEqual(
  formatArrivalItemLabel({ 'Tên vật tư': 'Vật tư mẫu' }, 'XG'),
  'Vật tư mẫu'
);
console.log('✅ Test 3 Passed: formatArrivalItemLabel rules for XG and TOLE');

// Test 4: Gom nhóm theo Loại kho (XG, TOLE), Tên công trình và Tồn trơn
const mockRows = [
  // Xà gồ rows
  { _sourceType: 'XG', 'Tên công trình': 'Dự án Sky Tower', 'Mã vật tư': '10001189', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '0.75X45VN', 'Số lượng (Kg)': 7712 },
  { _sourceType: 'XG', 'Tên công trình': 'Dự án Sky Tower', 'Mã vật tư': '10001189', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '1.5X348VN', 'Số lượng (Kg)': 26770 },
  { _sourceType: 'XG', 'Tên công trình': '', 'Mã vật tư': '10001189', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '1.5X50VN', 'Số lượng (Kg)': 8050 },
  { _sourceType: 'XG', 'Tên công trình': '   ', 'Mã vật tư': '10001189', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '1.5X50VN', 'Số lượng (Kg)': 1000 },
  { _sourceType: 'XG', 'Tên công trình': null, 'Mã vật tư': '10001190', 'Tên vật tư': 'Thép phôi kẽm Z275 G450', 'Batch': '1.8X50VN', 'Số lượng (Kg)': 2250 },

  // Tole rows
  { _sourceType: 'TOLE', 'Tên công trình': 'Dự án Sky Tower', 'Mã vật tư': '10002891', 'Tên vật tư': 'Phôi tôn mạ màu', 'Batch': '0.45X1200', 'Số lượng (Kg)': 5210 },
  { _sourceType: 'TOLE', 'Tên công trình': '', 'Mã vật tư': '10002892', 'Tên vật tư': 'Phôi tôn lạnh', 'Batch': '0.35X1200', 'Số lượng (Kg)': 3150 }
];

const grouped = groupArrivalData(mockRows);
assert.strictEqual(grouped.XG.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.XG.has('Tồn trơn'), true);
assert.strictEqual(grouped.XG.get('Dự án Sky Tower').get('10001189 - 0.75X45VN'), 7712);
assert.strictEqual(grouped.XG.get('Dự án Sky Tower').get('10001189 - 1.5X348VN'), 26770);
// 10001189 - 1.5X50VN trong Tồn trơn XG được cộng dồn (8050 + 1000 = 9050)
assert.strictEqual(grouped.XG.get('Tồn trơn').get('10001189 - 1.5X50VN'), 9050);
assert.strictEqual(grouped.XG.get('Tồn trơn').get('10001190 - 1.8X50VN'), 2250);

// Tole
assert.strictEqual(grouped.TOLE.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.TOLE.has('Tồn trơn'), true);
assert.strictEqual(grouped.TOLE.get('Dự án Sky Tower').get('10002891 - Phôi tôn mạ màu - 0.45X1200'), 5210);
assert.strictEqual(grouped.TOLE.get('Tồn trơn').get('10002892 - Phôi tôn lạnh - 0.35X1200'), 3150);
console.log('✅ Test 4 Passed: Grouping & summation logic for XG and TOLE');

// Test 5: Định dạng nội dung thông báo (🔷 XG và 🔶 TOLE cách nhau bởi dòng trống)
const content = formatAnnouncementContent(grouped);
const expected = `🔷 XG:
[Dự án Sky Tower]
10001189 - 0.75X45VN: 7.712kg
10001189 - 1.5X348VN: 26.770kg

[Tồn trơn]
10001189 - 1.5X50VN: 9.050kg
10001190 - 1.8X50VN: 2.250kg

🔶 TOLE:
[Dự án Sky Tower]
10002891 - Phôi tôn mạ màu - 0.45X1200: 5.210kg

[Tồn trơn]
10002892 - Phôi tôn lạnh - 0.35X1200: 3.150kg`;

assert.strictEqual(content.trim(), expected.trim());
console.log('✅ Test 5 Passed: Content format with XG and TOLE separated by blank line');

// Test 6: Nếu chỉ có Xà gồ (không có Tole)
const xgOnly = groupArrivalData(mockRows.filter(r => r._sourceType === 'XG'));
const contentXgOnly = formatAnnouncementContent(xgOnly);
const expectedXgOnly = `🔷 XG:
[Dự án Sky Tower]
10001189 - 0.75X45VN: 7.712kg
10001189 - 1.5X348VN: 26.770kg

[Tồn trơn]
10001189 - 1.5X50VN: 9.050kg
10001190 - 1.8X50VN: 2.250kg`;
assert.strictEqual(contentXgOnly.trim(), expectedXgOnly.trim());
console.log('✅ Test 6 Passed: Only XG content formatted cleanly');

// Test 7: Tương thích ngược với dữ liệu cũ chỉ có 'Tên vật tư'
const legacyRows = [
  { _sourceType: 'XG', 'Tên công trình': '', 'Tên vật tư': 'Thép cũ 1.5x50', 'Số lượng (Kg)': 1500 }
];
const legacyGrouped = groupArrivalData(legacyRows);
const legacyContent = formatAnnouncementContent(legacyGrouped);
assert.strictEqual(legacyContent.trim(), `🔷 XG:\n[Tồn trơn]\nThép cũ 1.5x50: 1.500kg`);
console.log('✅ Test 7 Passed: Backward compatibility for legacy rows without Mã VT/Batch');

console.log('🎉 ALL TESTS PASSED!');
