' Roda o cockpit-start.cmd sem abrir janela (usado na inicializacao do Windows)
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & dir & "\cockpit-start.cmd""", 0, False
