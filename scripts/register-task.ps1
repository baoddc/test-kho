# Script dang ky Windows Task Scheduler tu dong chay luc 17:00 hang ngay
$ErrorActionPreference = 'Stop'
$taskName = 'DDC_Supabase_Daily_Backup_17h'
$projectDir = Split-Path -Parent $PSScriptRoot
$vbsPath = Join-Path $PSScriptRoot 'run-backup-silent.vbs'

if (-not (Test-Path $vbsPath)) {
    Write-Error "Khong tim thay file: $vbsPath"
    exit 1
}

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 17:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Tu dong sao luu cac bang Supabase sang CSV ve may tinh luc 17h hang ngay' | Out-Null

Write-Host "[OK] Da dang ky thanh cong tac vu vao Windows Task Scheduler!"
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
