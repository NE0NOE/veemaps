@echo off
title GeoTrilateracion - Iniciando Servidor...
cd /d "%~dp0"

:: Verificar si el servidor ya está activo en el puerto 8080
netstat -ano | findstr :8080 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    start /min "GeoTrilateracion Server" python -m http.server 8080
    timeout /t 1 /nobreak >nul
)

:: Abrir en el navegador predeterminado
start http://localhost:8080
exit
