@echo off
rem Para o Cockpit que roda em segundo plano (porta 4300).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"127.0.0.1:4300 .*LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
echo Cockpit parado.
ping -n 4 127.0.0.1 >nul
