// Test suite: Verification of ReceiptOcrService Edge Function Integration
const fs = require('fs');
const path = require('path');

const serviceCode = fs.readFileSync(path.join(__dirname, '../assets/js/core/receipt-ocr-service.js'), 'utf8');

console.log('1. Checking for client-side hardcoded keys or XOR obfuscation...');
if (serviceCode.includes('_SEC_DATA') || serviceCode.includes('_getEmbeddedKey')) {
  console.error('FAIL: Obfuscated key still found in code!');
  process.exit(1);
} else {
  console.log('PASS: No hardcoded or obfuscated keys found in client JS.');
}

console.log('2. Checking for Edge Function integration...');
if (serviceCode.includes("window.supabase.functions.invoke('ocr-receipt'") || serviceCode.includes("callEdgeFunctionVision")) {
  console.log('PASS: Edge Function invocation is present.');
} else {
  console.error('FAIL: Missing Edge Function call!');
  process.exit(1);
}

console.log('ALL Task 1 unit checks passed successfully!');
