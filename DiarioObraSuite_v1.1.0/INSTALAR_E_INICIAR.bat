@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Diario de Obra Suite - Instalacao

echo ============================================================
echo   DIARIO DE OBRA SUITE v1.1.0 - INSTALACAO E INICIO
echo ============================================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  set "PY_LAUNCHER=py -3"
) else (
  where python >nul 2>&1
  if not %errorlevel%==0 goto :python_missing
  set "PY_LAUNCHER=python"
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/5] Criando ambiente virtual Python...
  %PY_LAUNCHER% -m venv .venv
  if errorlevel 1 goto :error
) else (
  echo [1/5] Ambiente virtual ja existente.
)

call ".venv\Scripts\activate.bat"

echo [2/5] Instalando dependencias do sistema...
python -m pip install --upgrade pip
if errorlevel 1 goto :error
python -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

echo [3/5] Preparando bibliotecas web para operacao offline...
python scripts\baixar_bibliotecas.py
if errorlevel 1 goto :vendor_error

echo [4/5] Executando validacao automatizada...
python scripts\validar_projeto.py
if errorlevel 1 goto :error

echo [5/5] Preparando pacote de publicacao do aplicativo de campo...
python scripts\preparar_distribuicao.py
if errorlevel 1 goto :error

echo.
echo Instalacao concluida. Iniciando o sistema...
echo.
python iniciar.py
goto :end

:python_missing
echo.
echo ERRO: Python 3.11 ou superior nao foi localizado.
echo Instale o Python para Windows e marque a opcao "Add Python to PATH".
echo Depois execute este arquivo novamente.
pause
goto :end

:vendor_error
echo.
echo ERRO: as bibliotecas web nao puderam ser baixadas.
echo Verifique internet, proxy corporativo ou bloqueio do antivirus.
echo Depois execute INSTALAR_E_INICIAR.bat novamente.
pause
goto :end

:error
echo.
echo A instalacao foi interrompida por um erro.
echo Consulte as mensagens acima e execute novamente.
pause

:end
endlocal
