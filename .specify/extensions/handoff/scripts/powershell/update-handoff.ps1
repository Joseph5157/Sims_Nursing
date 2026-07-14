#!/usr/bin/env pwsh
# Handoff extension: update-handoff.ps1
# Ensures specs/<feature-folder>/handoff.md exists, seeding it from
# specs/_templates/handoff.md when missing. The calling agent fills in the
# actual content afterward.
#
# Usage: update-handoff.ps1 [feature_folder]
#   e.g.: update-handoff.ps1 001-auth-user-accounts
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$FeatureFolder
)
$ErrorActionPreference = 'Stop'

function Find-ProjectRoot {
    param([string]$StartDir)
    $current = Resolve-Path $StartDir
    while ($true) {
        foreach ($marker in @('.specify', '.git')) {
            if (Test-Path (Join-Path $current $marker)) {
                return $current
            }
        }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current) { return $null }
        $current = $parent
    }
}

$repoRoot = Find-ProjectRoot -StartDir $PSScriptRoot
if (-not $repoRoot) { $repoRoot = Get-Location }
Set-Location $repoRoot

if (-not $FeatureFolder) {
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
    } finally {
        $ErrorActionPreference = $savedEAP
    }
    if ($branch -and (Test-Path (Join-Path $repoRoot "specs/$branch"))) {
        $FeatureFolder = $branch
    }
}

if (-not $FeatureFolder) {
    $candidate = Get-ChildItem -Path (Join-Path $repoRoot "specs") -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne '_templates' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($candidate) { $FeatureFolder = $candidate.Name }
}

if (-not $FeatureFolder) {
    Write-Warning "[handoff] Warning: could not determine a feature folder under specs/; skipped"
    exit 0
}

$template = Join-Path $repoRoot "specs/_templates/handoff.md"
if (-not (Test-Path $template)) {
    Write-Warning "[handoff] Warning: template not found at specs/_templates/handoff.md; skipped"
    exit 0
}

$targetDir = Join-Path $repoRoot "specs/$FeatureFolder"
$target = Join-Path $targetDir "handoff.md"
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if (-not (Test-Path $target)) {
    Copy-Item $template $target
    Write-Host "[handoff] Seeded specs/$FeatureFolder/handoff.md from template; fill in this task's details before committing."
} else {
    Write-Host "[handoff] specs/$FeatureFolder/handoff.md exists; overwrite it with this task's details before committing."
}
