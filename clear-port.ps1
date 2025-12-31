# PowerShell script to clear a port
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Finding processes using port $Port..."

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    
    foreach ($processId in $processes) {
        if ($processId -gt 0) {
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Stopping process: $($process.ProcessName) (PID: $processId)"
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "Process stopped successfully"
                }
            } catch {
                Write-Host "Could not stop process $processId : $_"
            }
        }
    }
} else {
    Write-Host "No processes found using port $Port"
}

Write-Host "Done!"

