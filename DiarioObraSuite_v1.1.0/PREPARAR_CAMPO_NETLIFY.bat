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
python scripts\baixar_bibliotecas.py
if errorlevel 1 goto :fail
python scripts\preparar_distribuicao.py
if errorlevel 1 goto :fail
echo.
echo O arquivo distribuicao\Campo_Netlify.zip esta pronto.
echo No Netlify, arraste a pasta Campo_Netlify ou descompacte o ZIP antes do deploy.
pause
goto :end
:fail
echo Falha ao preparar a publicacao.
pause
:end
endlocal
