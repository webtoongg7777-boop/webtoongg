# Netlify 에 직접 올릴 webtoongg-site.zip 을 만드는 스크립트
# (GitHub 자동 갱신을 쓰면 이 스크립트는 필요 없어요. 수동으로 올릴 때만 써요.)
# 폴더째 올리면 파일이 너무 많아서 Netlify 가 요청을 막아요. zip 하나로 올려야 해요.
# 사용법: powershell -ExecutionPolicy Bypass -File build-zip.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = $PSScriptRoot
$stage = Join-Path $root "_deploy"
$zip = Join-Path $root "webtoongg-site.zip"

# 올릴 파일을 _deploy 폴더에 모아요 (추천 페이지 생성 포함)
& (Join-Path $root "stage-site.ps1")

if ([IO.File]::Exists($zip)) { [IO.File]::Delete($zip) }
$fs = [IO.File]::Open($zip, [IO.FileMode]::Create)
$za = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
$bs = [string][char]92
$files = Get-ChildItem $stage -Recurse -File
foreach ($f in $files) {
  # Netlify 서버에서 경로가 깨지지 않게 \ 대신 / 로 저장해요
  $name = $f.FullName.Substring($stage.Length + 1).Replace($bs, "/")
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($za, $f.FullName, $name, [IO.Compression.CompressionLevel]::Optimal)
}
$za.Dispose(); $fs.Dispose()

Write-Host ("webtoongg-site.zip 완료: 파일 {0}개, {1:N1} MB" -f $files.Count, ((Get-Item $zip).Length / 1MB))
