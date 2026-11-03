[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$BackendRepo = $env:HAYQ_BACKEND_REPO,
  [string]$PreviewSiteUrl = 'https://hayq-tours-preview.onrender.com',
  [string]$PreviewApiUrl = 'https://hayq-tours-api-staging.onrender.com',
  [string]$ProductionSiteUrl = 'https://hro2009.github.io/toursit-front',
  [string]$ProductionApiUrl = 'https://hayq-tours-api.onrender.com',
  [int]$TimeoutSeconds = 600
)

$ErrorActionPreference = 'Stop'
$dryRun = $WhatIfPreference
$WhatIfPreference = $false
$FrontendRepo = $PSScriptRoot
if (-not $BackendRepo) {
  $BackendRepo = Join-Path (Split-Path -Parent $FrontendRepo) 'tourist-backend'
}

function Invoke-Git {
  param([string]$Repository, [string[]]$GitArguments)
  $result = & git -C $Repository @GitArguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArguments -join ' ') failed in $Repository."
  }
  return ($result | Out-String).Trim()
}

function Assert-ReadyRepository {
  param([string]$Repository, [string]$Name)
  if (-not (Test-Path (Join-Path $Repository '.git'))) {
    throw "$Name repository not found at '$Repository'. Set HAYQ_BACKEND_REPO if needed."
  }
  $branch = Invoke-Git $Repository @('branch', '--show-current')
  if ($branch -ne 'staging') {
    throw "$Name repository must be checked out on the staging branch (currently '$branch')."
  }
  $changes = Invoke-Git $Repository @('status', '--porcelain')
  if ($changes) {
    throw "$Name repository has uncommitted changes. Commit and push them to staging before promotion."
  }
  Invoke-Git $Repository @('fetch', '--prune', 'origin') | Out-Null
  $local = Invoke-Git $Repository @('rev-parse', 'staging')
  $remote = Invoke-Git $Repository @('rev-parse', 'origin/staging')
  if ($local -ne $remote) {
    throw "$Name staging is not published exactly as checked out. Push staging, wait for its preview deployment, then retry."
  }
  & git -C $Repository merge-base --is-ancestor origin/main origin/staging
  if ($LASTEXITCODE -ne 0) {
    throw "$Name staging cannot fast-forward production main. Rebase or merge the latest main into staging first."
  }
  return $local
}

function Wait-ForCommit {
  param([string]$Url, [string]$Property, [string]$Expected, [string]$Name)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastState = 'not reachable'
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 25
      $actual = [string]$response.data.$Property
      if (-not $actual) { $actual = [string]$response.$Property }
      if ($actual -eq $Expected) {
        Write-Host "$Name is running $Expected"
        return
      }
      $lastState = "serving commit '$actual'"
    } catch {
      $lastState = $_.Exception.Message
    }
    Write-Host "Waiting for $Name ($lastState)..."
    Start-Sleep -Seconds 10
  }
  throw "$Name did not report expected commit $Expected within $TimeoutSeconds seconds. Last result: $lastState"
}

if (-not (Test-Path (Join-Path $BackendRepo '.git'))) {
  throw "Backend repository not found at '$BackendRepo'. Set HAYQ_BACKEND_REPO to its path."
}

$frontendCommit = Assert-ReadyRepository $FrontendRepo 'Frontend'
$backendCommit = Assert-ReadyRepository $BackendRepo 'Backend'

Write-Host 'Checking frontend JavaScript and building the preview artifact...'
$javascriptFiles = @((Join-Path $FrontendRepo 'script.js')) +
  @(Get-ChildItem (Join-Path $FrontendRepo 'admin'), (Join-Path $FrontendRepo 'js'), (Join-Path $FrontendRepo 'scripts') -Recurse -File -Filter '*.js' | ForEach-Object FullName)
foreach ($file in $javascriptFiles) {
  & node --check $file
  if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
}
Push-Location $FrontendRepo
try {
  & node scripts/build-preview.js
  if ($LASTEXITCODE -ne 0) { throw 'Frontend preview build failed.' }
} finally {
  Pop-Location
}

Write-Host 'Running backend integration tests...'
Push-Location $BackendRepo
try {
  & npm test
  if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
} finally {
  Pop-Location
}

Wait-ForCommit "$($PreviewSiteUrl.TrimEnd('/'))/version.json" 'commit' $frontendCommit 'Staging website'
Wait-ForCommit "$($PreviewApiUrl.TrimEnd('/'))/api/health" 'commit' $backendCommit 'Staging API'

Write-Host 'Checking production branches can be fast-forwarded...'
foreach ($repository in @($BackendRepo, $FrontendRepo)) {
  & git -C $repository push --dry-run origin 'staging:main'
  if ($LASTEXITCODE -ne 0) { throw "Production push check failed for $repository." }
}

if ($dryRun) {
  Write-Host 'WhatIf: checks passed; no production branches were changed.'
  return
}

if ($PSCmdlet.ShouldProcess('both production repositories', "Promote frontend $frontendCommit and backend $backendCommit")) {
  Write-Host "Promoting backend $backendCommit..."
  Invoke-Git $BackendRepo @('push', 'origin', 'staging:main') | Out-Null
  Write-Host "Promoting frontend $frontendCommit..."
  Invoke-Git $FrontendRepo @('push', 'origin', 'staging:main') | Out-Null

  Wait-ForCommit "$($ProductionSiteUrl.TrimEnd('/'))/version.json" 'commit' $frontendCommit 'Production website'
  Wait-ForCommit "$($ProductionApiUrl.TrimEnd('/'))/api/health" 'commit' $backendCommit 'Production API'
  Write-Host 'Promotion complete: production is running the exact commits verified on staging.'
} else {
  Write-Host 'WhatIf: checks passed; no production branches were changed.'
}
