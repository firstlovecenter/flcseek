# Populate Database with Sample Members
# This script adds 120 realistic members (10 per department) to your database

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FLC Sheep Seeker - Populate Members" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get database URL from .env.local
Write-Host "Reading database connection..." -ForegroundColor Yellow
$envContent = Get-Content .env.local -ErrorAction Stop
$dbUrl = ($envContent | Select-String "DATABASE_URL").ToString().Split('=', 2)[1].Trim()

if (-not $dbUrl) {
    Write-Host "❌ ERROR: DATABASE_URL not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Database connection found" -ForegroundColor Green
Write-Host ""

# Check if psql is available
Write-Host "Checking PostgreSQL client..." -ForegroundColor Yellow
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlExists) {
    Write-Host "❌ ERROR: psql command not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client or use one of these alternatives:" -ForegroundColor Yellow
    Write-Host "1. Install PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Use Neon Console SQL Editor: https://console.neon.tech" -ForegroundColor White
    Write-Host "3. Use pgAdmin or another database client" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run the SQL file manually:" -ForegroundColor Yellow
    Write-Host "  scripts/populate-members.sql" -ForegroundColor White
    exit 1
}

Write-Host "✓ PostgreSQL client found" -ForegroundColor Green
Write-Host ""

# Confirm with user
Write-Host "This will add 120 members to your database:" -ForegroundColor Cyan
Write-Host "  • 10 members per department" -ForegroundColor White
Write-Host "  • Realistic Ghanaian names" -ForegroundColor White
Write-Host "  • Real locations across Ghana" -ForegroundColor White
Write-Host "  • Phone numbers and contact details" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (Y/N)"

if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "❌ Operation cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Running migration..." -ForegroundColor Yellow

# Run the SQL script
try {
    $env:PGPASSWORD = ""
    psql $dbUrl -f scripts/populate-members.sql -v ON_ERROR_STOP=1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✓ SUCCESS!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "120 members added successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Breakdown by department:" -ForegroundColor Cyan
        Write-Host "  January   - 10 members" -ForegroundColor White
        Write-Host "  February  - 10 members" -ForegroundColor White
        Write-Host "  March     - 10 members" -ForegroundColor White
        Write-Host "  April     - 10 members" -ForegroundColor White
        Write-Host "  May       - 10 members" -ForegroundColor White
        Write-Host "  June      - 10 members" -ForegroundColor White
        Write-Host "  July      - 10 members" -ForegroundColor White
        Write-Host "  August    - 10 members" -ForegroundColor White
        Write-Host "  September - 10 members" -ForegroundColor White
        Write-Host "  October   - 10 members" -ForegroundColor White
        Write-Host "  November  - 10 members" -ForegroundColor White
        Write-Host "  December  - 10 members" -ForegroundColor White
        Write-Host ""
        Write-Host "You can now view them in your dashboard!" -ForegroundColor Cyan
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to populate database" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
