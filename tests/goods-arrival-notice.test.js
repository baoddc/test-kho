const assert = require('assert');
const {
  generateArrivalTitle,
  groupArrivalData,
  formatAnnouncementContent,
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

// Test 3: Gom nhóm theo Loại kho (XG, TOLE), Tên công trình và Tồn trơn
const mockRows = [
  // Xà gồ rows
  { _sourceType: 'XG', 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '0.75X45VN', 'Số lượng (Kg)': 7712 },
  { _sourceType: 'XG', 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '1.5X348VN', 'Số lượng (Kg)': 26770 },
  { _sourceType: 'XG', 'Tên công trình': '', 'Tên vật tư': '1.5X50VN', 'Số lượng (Kg)': 8050 },
  { _sourceType: 'XG', 'Tên công trình': '   ', 'Tên vật tư': '1.5X50VN', 'Số lượng (Kg)': 1000 },
  { _sourceType: 'XG', 'Tên công trình': null, 'Tên vật tư': '1.8X50VN', 'Số lượng (Kg)': 2250 },

  // Tole rows
  { _sourceType: 'TOLE', 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '0.45X1200', 'Số lượng (Kg)': 5210 },
  { _sourceType: 'TOLE', 'Tên công trình': '', 'Tên vật tư': '0.35X1200', 'Số lượng (Kg)': 3150 }
];

const grouped = groupArrivalData(mockRows);
assert.strictEqual(grouped.XG.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.XG.has('Tồn trơn'), true);
assert.strictEqual(grouped.XG.get('Dự án Sky Tower').get('0.75X45VN'), 7712);
assert.strictEqual(grouped.XG.get('Dự án Sky Tower').get('1.5X348VN'), 26770);
// 1.5X50VN trong Tồn trơn XG được cộng dồn (8050 + 1000 = 9050)
assert.strictEqual(grouped.XG.get('Tồn trơn').get('1.5X50VN'), 9050);
assert.strictEqual(grouped.XG.get('Tồn trơn').get('1.8X50VN'), 2250);

// Tole
assert.strictEqual(grouped.TOLE.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.TOLE.has('Tồn trơn'), true);
assert.strictEqual(grouped.TOLE.get('Dự án Sky Tower').get('0.45X1200'), 5210);
assert.strictEqual(grouped.TOLE.get('Tồn trơn').get('0.35X1200'), 3150);
console.log('✅ Test 3 Passed: Grouping & summation logic for XG and TOLE');

// Test 4: Định dạng nội dung thông báo chuẩn Cách A (🔷 XG và 🔶 TOLE cách nhau bởi dòng trống)
const content = formatAnnouncementContent(grouped);
const expected = `🔷 XG:
[Dự án Sky Tower]
0.75X45VN: 7.712kg
1.5X348VN: 26.770kg

[Tồn trơn]
1.5X50VN: 9.050kg
1.8X50VN: 2.250kg

🔶 TOLE:
[Dự án Sky Tower]
0.45X1200: 5.210kg

[Tồn trơn]
0.35X1200: 3.150kg`;

assert.strictEqual(content.trim(), expected.trim());
console.log('✅ Test 4 Passed: Content format with XG and TOLE separated by blank line');

// Test 5: Nếu chỉ có Xà gồ (không có Tole)
const xgOnly = groupArrivalData(mockRows.filter(r => r._sourceType === 'XG'));
const contentXgOnly = formatAnnouncementContent(xgOnly);
const expectedXgOnly = `🔷 XG:
[Dự án Sky Tower]
0.75X45VN: 7.712kg
1.5X348VN: 26.770kg

[Tồn trơn]
1.5X50VN: 9.050kg
1.8X50VN: 2.250kg`;
assert.strictEqual(contentXgOnly.trim(), expectedXgOnly.trim());
console.log('✅ Test 5 Passed: Only XG content formatted cleanly');

console.log('🎉 ALL TESTS PASSED!');
