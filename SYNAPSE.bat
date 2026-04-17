@echo off
setlocal
title SYNAPSE Desktop Swarm

echo ==========================================
echo    SYNAPSE MULTI-AGENT SWARM
echo ==========================================
echo.

:: Check for node_modules to determine if setup is needed
if not exist node_modules (
    echo [1/3] First-time setup: Installing dependencies...
    call npm install
    call npx electron-rebuild
) else (
    echo [1/3] Dependencies verified.
)

echo [2/3] Building desktop assets...
call npm run build

echo [3/3] Launching Swarm...
echo.
echo [INFO] Decoupling process from terminal...
start /b npx electron .
exit
