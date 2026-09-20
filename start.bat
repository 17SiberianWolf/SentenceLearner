@echo off
cd /d "%~dp0"
echo Starting SentenceLearner local storage server...
"C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" serve.js
pause
