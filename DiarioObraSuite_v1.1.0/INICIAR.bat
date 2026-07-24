@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Diario de Obra Suite

if not exist ".venv\Scripts\python.exe" (
  echo O sistema ainda nao foi instalado.
  call INSTALAR_E_INICIAR.bat
  goto :end
)

if not exist "app\static\vendor\react.production.min.js" (
  echo Bibliotecas web ausentes. Executando preparacao...
  call ".venv\Scripts\activate.bat"
  python scripts\baixar_bibliotecas.py
  if errorlevel 1 (
    echo Nao foi possivel preparar as bibliotecas.
    pause
    goto :end
  )
)

call ".venv\Scripts\activate.bat"
python iniciar.py

:end
endlocal
