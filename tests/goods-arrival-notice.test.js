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

// Test 3: Gom nhóm theo Tên công trình và Tồn trơn
const mockRows = [
  { 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '0.75X45VN', 'Số lượng (Kg)': 7712 },
  { 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '1.5X348VN', 'Số lượng (Kg)': 26770 },
  { 'Tên công trình': '', 'Tên vật tư': '1.5X50VN', 'Số lượng (Kg)': 8050 },
  { 'Tên công trình': '   ', 'Tên vật tư': '1.5X50VN', 'Số lượng (Kg)': 1000 },
  { 'Tên công trình': null, 'Tên vật tư': '1.8X50VN', 'Số lượng (Kg)': 2250 }
];

const grouped = groupArrivalData(mockRows);
assert.strictEqual(grouped.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.has('Tồn trơn'), true);
assert.strictEqual(grouped.get('Dự án Sky Tower').get('0.75X45VN'), 7712);
assert.strictEqual(grouped.get('Dự án Sky Tower').get('1.5X348VN'), 26770);
// 1.5X50VN trong Tồn trơn được cộng dồn (8050 + 1000 = 9050)
assert.strictEqual(grouped.get('Tồn trơn').get('1.5X50VN'), 9050);
assert.strictEqual(grouped.get('Tồn trơn').get('1.8X50VN'), 2250);
console.log('✅ Test 3 Passed: Grouping & summation logic');

// Test 4: Định dạng nội dung thông báo chuẩn
const content = formatAnnouncementContent(grouped);
const expected = `[Dự án Sky Tower]
0.75X45VN: 7.712kg
1.5X348VN: 26.770kg

[Tồn trơn]
1.5X50VN: 9.050kg
1.8X50VN: 2.250kg`;

assert.strictEqual(content.trim(), expected.trim());
console.log('✅ Test 4 Passed: Content format matches screenshot style');

console.log('🎉 ALL TESTS PASSED!');
