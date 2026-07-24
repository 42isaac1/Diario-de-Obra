@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Execute primeiro INSTALAR_E_INICIAR.bat.
  pause
  goto :end
)
call ".venv\Scripts\activate.bat"
python scripts\validar_projeto.py
pause
:end
endlocal
