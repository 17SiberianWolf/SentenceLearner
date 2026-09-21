@echo off
cd /d "%~dp0"
echo Starting SentenceLearner local storage server...
node serve.js
pause