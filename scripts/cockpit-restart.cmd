@echo off
rem Reinicia o Cockpit (use depois de trocar o .env ou quando houver atualizacao).
echo Parando o Cockpit...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"127.0.0.1:4300 .*LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
ping -n 3 127.0.0.1 >nul
echo Iniciando o Cockpit (leva cerca de 30 segundos para compilar)...
wscript "%~dp0cockpit-hidden.vbs"
ping -n 4 127.0.0.1 >nul
echo Pronto. Abra http://localhost:4300 em alguns segundos.
ping -n 5 127.0.0.1 >nul
