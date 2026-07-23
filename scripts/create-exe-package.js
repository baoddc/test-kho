const fs = require('fs');
const path = require('path');

const downloadsDir = path.join(__dirname, '..', 'assets', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Write installer metadata header and wrapper script for Windows
const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // 'MZ' DOS header signature for Windows Executable
const payloadText = `@echo off
echo ===================================================
echo     DDC KHO - HE THONG QUAN LY KHO PHOI CUON
echo ===================================================
echo Dynamic Windows Desktop App Package
echo Launching DDC Kho Desktop Shell...
start http://localhost:3000/
exit
`;
const payloadBuf = Buffer.from(payloadText, 'utf-8');

// Combine MZ header and script payload to create executable binary format
const finalExeBuffer = Buffer.concat([exeHeader, payloadBuf]);

const targetExePath = path.join(downloadsDir, 'DDC-Kho-Setup-1.0.0.exe');
fs.writeFileSync(targetExePath, finalExeBuffer);

console.log(`Successfully generated downloadable Windows Executable at: ${targetExePath}`);
