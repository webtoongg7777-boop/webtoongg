# thumbs/ 폴더의 표지 이미지를 가로 240px JPEG 로 줄여서 사이트 용량을 줄이는 스크립트
# 이미 240px 이하인 이미지는 건너뛰어요. fetch-*.ps1 이 끝날 때 자동으로 실행돼요.
# 사용법: powershell -ExecutionPolicy Bypass -File resize-thumbs.ps1

Add-Type -AssemblyName System.Drawing
$maxWidth = 240
$quality = 82

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$quality)

$files = Get-ChildItem (Join-Path $PSScriptRoot "thumbs") -Recurse -File -Include *.jpg
$done = 0
foreach ($f in $files) {
  try {
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    $ms = New-Object IO.MemoryStream (, $bytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    if ($img.Width -le $maxWidth) { $img.Dispose(); continue }
    $h = [int]($img.Height * $maxWidth / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap $maxWidth, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $maxWidth, $h)
    $img.Dispose(); $g.Dispose()
    $bmp.Save($f.FullName, $codec, $params)
    $bmp.Dispose()
    $done++
  } catch {
    Write-Host "건너뜀: $($f.Name) - $($_.Exception.Message)"
  }
}
Write-Host "이미지 $($done)개 축소 완료"
