# PowerShell script to update all remaining "department" references to "group"
# Run this from the project root directory

Write-Host "Starting bulk update: department -> group..." -ForegroundColor Green

# Files to update with simple find/replace
$filesToUpdate = @(
    "app\sheep-seeker\page.tsx",
    "app\person\[id]\page.tsx",
    "app\super-admin\people\page.tsx",
    "app\super-admin\people\register\page.tsx",
    "app\super-admin\sms\send\page.tsx",
    "app\super-admin\sms\logs\page.tsx",
    "app\super-admin\reports\overview\page.tsx",
    "app\super-admin\reports\attendance\page.tsx",
    "app\super-admin\department\[month]\page.tsx",
    "app\sheep-seeker\people\page.tsx",
    "app\sheep-seeker\people\register\page.tsx",
    "app\sheep-seeker\people\bulk-register\page.tsx",
    "app\sheep-seeker\attendance\page.tsx",
    "app\sheep-seeker\progress\page.tsx",
    "app\super-admin\people\bulk-register\page.tsx"
)

foreach ($file in $filesToUpdate) {
    if (Test-Path $file) {
        Write-Host "Updating $file..." -ForegroundColor Yellow
        
        $content = Get-Content $file -Raw
        
        # Update TypeScript interfaces
        $content = $content -replace 'department_name:', 'group_name:'
        $content = $content -replace 'department_name\?:', 'group_name?:'
        $content = $content -replace 'department_name\s*=', 'group_name ='
        
        # Update variable names
        $content = $content -replace 'selectedDepartment', 'selectedGroup'
        $content = $content -replace 'departmentName', 'groupName'
        
        # Update UI text
        $content = $content -replace 'Department:', 'Group:'
        $content = $content -replace 'My Department:', 'My Group:'
        $content = $content -replace "'Department'", "'Group'"
        $content = $content -replace '"Department"', '"Group"'
        $content = $content -replace 'All Departments', 'All Groups'
        $content = $content -replace 'Target Department', 'Target Group'
        
        # Update dataIndex and key
        $content = $content -replace "dataIndex: 'department_name'", "dataIndex: 'group_name'"
        $content = $content -replace "key: 'department_name'", "key: 'group_name'"
        $content = $content -replace 'name="department_name"', 'name="group_name"'
        
        # Update field labels  
        $content = $content -replace 'Department \(Month\)', 'Group (Month)'
        $content = $content -replace 'Select department', 'Select group'
        $content = $content -replace 'select department', 'select group'
        
        # Update imports (DEPARTMENTS -> GROUPS)
        $content = $content -replace 'DEPARTMENTS', 'GROUPS'
        
        # Update error messages
        $content = $content -replace 'in your department', 'in your group'
        $content = $content -replace 'in their department', 'in their group'
        
        # Update filter references
        $content = $content -replace 'filter\((p|person)\) => \1\.department_name', 'filter($1) => $1.group_name'
        
        Set-Content $file $content -NoNewline
        
        Write-Host "✓ Updated $file" -ForegroundColor Green
    } else {
        Write-Host "✗ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`nBulk update complete!" -ForegroundColor Green
Write-Host "Please review the changes and test the application." -ForegroundColor Cyan
