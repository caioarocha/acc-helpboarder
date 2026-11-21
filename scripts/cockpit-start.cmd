@echo off
rem Inicia o Cockpit em modo "app" (tela + API num processo so, em http://localhost:4300).
rem Normalmente e chamado escondido pelo cockpit-hidden.vbs na inicializacao do Windows.
cd /d "%~dp0.."
if not exist data mkdir data

rem Ja esta rodando? Nao abre outro.
netstat -ano | findstr /R /C:"127.0.0.1:4300 .*LISTENING" >nul && exit /b 0

set SERVE_WEB=true
set API_PORT=4300
echo. >> data\cockpit.log
echo ===== %date% %time% iniciando o Cockpit ===== >> data\cockpit.log
rem Compila a versao mais recente da tela e sobe o servidor
call npm run app >> data\cockpit.log 2>&1
