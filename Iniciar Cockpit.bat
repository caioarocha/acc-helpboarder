@echo off
rem Clique duas vezes para iniciar o Cockpit em segundo plano e abrir no navegador.
rem Para parar: scripts\cockpit-stop.cmd (ou Menu Iniciar > Cockpit > Parar Cockpit).
title Cockpit
cd /d "%~dp0"

rem Ja esta rodando? So abre a pagina.
netstat -ano | findstr /R /C:"127.0.0.1:4300 .*LISTENING" >nul && goto abrir

echo Iniciando o Cockpit... (na primeira vez leva cerca de 30 segundos)
wscript "%~dp0scripts\cockpit-hidden.vbs"

rem Espera o servidor subir (ate ~90 segundos)
for /l %%i in (1,1,45) do (
  ping -n 3 127.0.0.1 >nul
  netstat -ano | findstr /R /C:"127.0.0.1:4300 .*LISTENING" >nul && goto abrir
)
echo.
echo O Cockpit nao iniciou. Veja o log em data\cockpit.log
pause
exit /b 1

:abrir
if not defined COCKPIT_NO_BROWSER start "" "http://localhost:4300/"
exit /b 0
