@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ATENCAO: esta operacao apaga o banco local, PDFs e pacotes importados.
set /p CONFIRMA=Digite APAGAR para confirmar: 
if /I not "%CONFIRMA%"=="APAGAR" goto :cancel
if exist "data\diario_obra.sqlite3" del /q "data\diario_obra.sqlite3"
if exist "data\diario_obra.sqlite3-shm" del /q "data\diario_obra.sqlite3-shm"
if exist "data\diario_obra.sqlite3-wal" del /q "data\diario_obra.sqlite3-wal"
for %%D in (uploads pdfs packages attachments backups) do (
  if exist "data\%%D" rmdir /s /q "data\%%D"
  mkdir "data\%%D" >nul 2>&1
)
echo Dados locais removidos. Uma nova base sera criada na proxima execucao.
pause
goto :end
:cancel
echo Operacao cancelada.
pause
:end
endlocal
