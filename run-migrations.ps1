# PowerShell script to run database migrations
Write-Host "Waiting for server to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host "Running database migrations..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/run-migrations" -Method POST -ContentType "application/json"
    
    Write-Host "`n✅ Migrations completed successfully!" -ForegroundColor Green
    Write-Host "`nResults:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "`n❌ Migration failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Database is now ready with year and archived columns!" -ForegroundColor Green
Write-Host "You can now reload the groups page." -ForegroundColor White
