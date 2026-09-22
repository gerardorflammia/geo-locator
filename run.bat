@echo off
title GeoLocator - Iniciando...
cd /d "%~dp0"

echo ========================================================
echo        GeoLocator - Localizador de Coordenadas
echo ========================================================
echo.

if exist "dist\GeoLocator.exe" (
    echo Iniciando ejecutable compilado GeoLocator.exe...
    start "" "dist\GeoLocator.exe"
    exit /b
)

echo Iniciando GeoLocator en modo desarrollo con Python...
python main.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo Ocurrio un error al iniciar la aplicacion.
    pause
)
