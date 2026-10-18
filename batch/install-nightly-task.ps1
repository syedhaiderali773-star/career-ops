# One-time install: daily 02:00 last-24h sweep + pack.
# Run in PowerShell from anywhere:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\syedh\Documents\career-ops\batch\install-nightly-task.ps1"

$root = "C:\Users\syedh\Documents\career-ops"
$node = "C:\Program Files\nodejs\node.exe"
$action = New-ScheduledTaskAction -Execute $node -Argument "batch/nightly-sweep.mjs" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 8)
Register-ScheduledTask -TaskName "career-ops-nightly-24h" -Action $action -Trigger $trigger -Settings $settings -Description "Last-24h intern/WS + FT scan and pack (career-ops)" -Force | Out-Null
Get-ScheduledTask -TaskName "career-ops-nightly-24h" | Get-ScheduledTaskInfo | Format-List TaskName, NextRunTime, LastRunTime, LastTaskResult
