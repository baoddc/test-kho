# Script go bo Windows Task Scheduler
$taskName = 'DDC_Supabase_Daily_Backup_17h'
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "[OK] Da go bo thanh cong tac vu $taskName"
} catch {
    Write-Host "[INFO] Tac vu $taskName khong ton tai hoac da duoc go truoc do."
}
