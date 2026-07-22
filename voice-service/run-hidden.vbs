Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""c:\Users\benhhc\Desktop\web\voice-service\voice-wake.ps1""", 0, False
