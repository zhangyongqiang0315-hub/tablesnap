# Packages TableSnap extension for Microsoft Edge Add-ons / Chrome Web Store
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outZip = Join-Path (Split-Path -Parent $root) "tablesnap-extension-v1.0.0.zip"
$staging = Join-Path $env:TEMP "tablesnap_pkg_$(Get-Random)"

New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item (Join-Path $root "manifest.json") $staging
Copy-Item (Join-Path $root "src") $staging -Recurse
Copy-Item (Join-Path $root "assets") $staging -Recurse

if (Test-Path $outZip) { Remove-Item $outZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $outZip)
Remove-Item $staging -Recurse -Force

Write-Host "Created: $outZip"
