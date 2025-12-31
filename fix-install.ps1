# PowerShell script to fix npm installation issues on Windows
Write-Host "Stopping Node processes..."
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Waiting 2 seconds..."
Start-Sleep -Seconds 2

Write-Host "Removing node_modules..."
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}

Write-Host "Removing package-lock.json..."
if (Test-Path package-lock.json) {
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
}

Write-Host "Cleaning npm cache..."
npm cache clean --force

Write-Host "Installing dependencies..."
npm install

Write-Host "Done!"


