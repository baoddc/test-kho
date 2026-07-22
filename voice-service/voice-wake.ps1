# =============================================================================
# WINDOWS VOICE WAKE-UP SERVICE FOR INVENTORY ASSISTANT
# Lắng nghe giọng nói và tự động kích hoạt trang web khi nghe thấy "Hey, người đẹp"
# =============================================================================

# Thiet lap bang ma console sang UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TRUONG TRINH WAKE-UP - KICH HOAT BANG GIONG NOI" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

try {
    # Tai thu vien nhan dien giong noi cua Windows
    Add-Type -AssemblyName System.Speech
} catch {
    Write-Host "LOI: Khong the tai thu vien System.Speech." -ForegroundColor Red
    Exit
}

# Khoi tao Speech Recognition Engine
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine

# Cau hinh Microphone mac dinh
try {
    $recognizer.SetInputToDefaultAudioDevice()
} catch {
    Write-Host "LOI: Khong tim thay thiet bi thu am (Microphone)." -ForegroundColor Red
    Exit
}

# Khai bao tu khoa nhan dang
$choices = New-Object System.Speech.Recognition.Choices
$choices.Add([string[]]@(
    "hey nguoi dep", 
    "hey nguoi dep oi", 
    "he nguoi dep", 
    "nguoi dep oi"
))

# Xay dung ngu phap
$gb = New-Object System.Speech.Recognition.GrammarBuilder
$gb.Append($choices)

# Nap ngu phap
$grammar = New-Object System.Speech.Recognition.Grammar($gb)
$recognizer.LoadGrammar($grammar)

Write-Host "Trang thai: Dang lang nghe..." -ForegroundColor Yellow
Write-Host "Hay noi: 'Hey, nguoi dep' de mo trang quan ly kho." -ForegroundColor Green
Write-Host "------------------------------------------------------------"

# Xu ly su kien
$action = {
    param($sender, $eventArgs)
    $resultText = $eventArgs.Result.Text
    $confidence = $eventArgs.Result.Confidence
    
    if ($confidence -gt 0.5) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Da nhan dien: '$resultText' (Confidence: $([Math]::Round($confidence * 100))%)" -ForegroundColor Green
        Write-Host "-> Dang mo trang chu..." -ForegroundColor Cyan
        
        $path = "c:\Users\benhhc\Desktop\web\pages\home.html"
        
        # Mo Chrome hoac mac dinh
        if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
            Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" $path
        } elseif (Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") {
            Start-Process "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" $path
        } else {
            Start-Process $path
        }
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Bo qua do do tin cay thap: '$resultText' ($([Math]::Round($confidence * 100))%)" -ForegroundColor Gray
    }
}

# Dang ky su kien SpeechRecognized
Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action $action | Out-Null

# Bat dau nhan dien bat dong bo
$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

# Giu script chay ngam
while ($true) {
    Start-Sleep -Seconds 2
}
