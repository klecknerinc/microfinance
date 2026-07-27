$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-InsForge {
  param([Parameter(Mandatory = $true)][string[]]$CliArgs)

  & npx "@insforge/cli" @CliArgs
  if ($LASTEXITCODE -ne 0) {
    throw "InsForge command failed: $($CliArgs -join ' ')"
  }
}

function Get-InsForgeJson {
  param([Parameter(Mandatory = $true)][string[]]$CliArgs)

  $output = & npx "@insforge/cli" @CliArgs 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "InsForge command failed: $($CliArgs -join ' ')"
  }
  return ($output | Out-String | ConvertFrom-Json)
}

function Set-InsForgeSecret {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if ($script:SecretKeys -contains $Name) {
    Invoke-InsForge @("secrets", "update", $Name, "--value", $Value)
  }
  else {
    Invoke-InsForge @("secrets", "add", $Name, $Value)
    $script:SecretKeys += $Name
  }
}

Write-Host ""
Write-Host "AMEX Savings Transfer - Production InsForge Deployment" -ForegroundColor Cyan
Write-Host "No sandbox and no test transfer will be used."
Write-Host "The app records transfers created inside American Express; it cannot move money."
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed. Install the LTS version from https://nodejs.org/en/download and run this file again."
}

Write-Host "1. Sign in to InsForge." -ForegroundColor Yellow
Invoke-InsForge @("login", "--device")

if (-not (Test-Path ".insforge\project.json")) {
  Write-Host ""
  Write-Host "2. Select your existing InsForge project." -ForegroundColor Yellow
  Invoke-InsForge @("link")
}

if (-not (Test-Path ".insforge\project.json")) {
  throw "No project is linked. Run npx @insforge/cli link in this folder."
}

$project = Get-Content ".insforge\project.json" -Raw | ConvertFrom-Json
$backendUrl = ([string]$project.oss_host).TrimEnd("/")
if (-not $backendUrl) {
  throw "The linked project does not contain an InsForge backend URL."
}

Write-Host ""
Write-Host "Linked project: $($project.project_name)" -ForegroundColor Green
Write-Host "Backend: $backendUrl"

Write-Host ""
Write-Host "3. Validate the production source code (no bank transaction)." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
& npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Type checking failed." }
& npm run lint
if ($LASTEXITCODE -ne 0) { throw "Lint failed." }
& npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

Write-Host ""
Write-Host "4. Apply the production database migration." -ForegroundColor Yellow
Invoke-InsForge @("db", "migrations", "up", "--all")

$anonSecret = Get-InsForgeJson @("secrets", "get", "ANON_KEY", "--json")
$anonKey = [string]$anonSecret.value
if (-not $anonKey) {
  throw "InsForge did not return the ANON_KEY."
}

Write-Host ""
Write-Host "5. Configure and publish the production website." -ForegroundColor Yellow
Invoke-InsForge @("deployments", "env", "set", "VITE_INSFORGE_URL", $backendUrl)
Invoke-InsForge @("deployments", "env", "set", "VITE_INSFORGE_ANON_KEY", $anonKey)

$deployment = Get-InsForgeJson @("deployments", "deploy", ".", "--json")
$siteUrlProperty = $deployment.PSObject.Properties["url"]
$siteUrl = if ($null -ne $siteUrlProperty) {
  [string]$siteUrlProperty.Value
}
else {
  ""
}
$deploymentProperty = $deployment.PSObject.Properties["deployment"]
if (-not $siteUrl -and $null -ne $deploymentProperty) {
  $nestedUrlProperty = $deploymentProperty.Value.PSObject.Properties["url"]
  if ($null -ne $nestedUrlProperty) {
    $siteUrl = [string]$nestedUrlProperty.Value
  }
}
if (-not $siteUrl) {
  $siteUrl = Read-Host "Enter the live HTTPS website URL shown by InsForge"
}
$siteUrl = $siteUrl.TrimEnd("/")
if (-not $siteUrl.StartsWith("https://")) {
  throw "A valid HTTPS website URL is required."
}

Write-Host ""
Write-Host "Live website: $siteUrl" -ForegroundColor Green

$secrets = Get-InsForgeJson @("secrets", "list", "--json")
$secretsProperty = $secrets.PSObject.Properties["secrets"]
$secretRows = if ($null -ne $secretsProperty) {
  @($secretsProperty.Value)
}
else {
  @($secrets)
}
$script:SecretKeys = @($secretRows | ForEach-Object { [string]$_.key })
Set-InsForgeSecret "APP_ORIGIN" $siteUrl

Write-Host ""
Write-Host "6. Deploy the secure recordkeeping function." -ForegroundColor Yellow
Invoke-InsForge @(
  "functions", "deploy", "bank-operations",
  "--file", "functions/bank-operations.ts"
)

Write-Host ""
Write-Host "7. Disable any processor left by the previous version." -ForegroundColor Yellow
$scheduleList = Get-InsForgeJson @("schedules", "list", "--json")
$schedulesProperty = $scheduleList.PSObject.Properties["schedules"]
$scheduleRows = if ($null -ne $schedulesProperty) {
  @($schedulesProperty.Value)
}
else {
  @($scheduleList)
}
$oldSchedules = @($scheduleRows | Where-Object { $_.name -eq "Process Due Withdrawals" })
foreach ($oldSchedule in $oldSchedules) {
  $idProperty = $oldSchedule.PSObject.Properties["id"]
  $scheduleIdProperty = $oldSchedule.PSObject.Properties["scheduleId"]
  $scheduleId = if ($null -ne $idProperty) {
    [string]$idProperty.Value
  }
  elseif ($null -ne $scheduleIdProperty) {
    [string]$scheduleIdProperty.Value
  }
  else {
    ""
  }
  if ($scheduleId) {
    Invoke-InsForge @("schedules", "update", $scheduleId, "--active", "false")
    Write-Host "Disabled old schedule: $scheduleId"
  }
}
if ($oldSchedules.Count -eq 0) {
  Write-Host "No old automatic-withdrawal schedule was present."
}

Write-Host ""
Write-Host "Production deployment completed." -ForegroundColor Green
Write-Host "Website: $siteUrl"
Write-Host ""
Write-Host "Final bank step:" -ForegroundColor Yellow
Write-Host "Open American Express Savings, link the external business account, and create the live transfer there."
Write-Host "Then record the last four digits and AMEX confirmation in this app."
Write-Host "No sandbox or test transfer was performed."
