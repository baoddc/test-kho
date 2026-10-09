Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

cmd = "cmd.exe /c node """ & scriptDir & "\backup-supabase-to-csv.js"" --silent"
WshShell.CurrentDirectory = projectDir
WshShell.Run cmd, 0, True
