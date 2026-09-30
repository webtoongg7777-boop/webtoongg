# 사이트 아이콘(파비콘) 파일을 만드는 스크립트
# 구글 검색 결과, 브라우저 탭, 휴대폰 홈 화면에 보이는 보라색 gg 아이콘이에요.
# 만드는 파일: favicon.ico (48px), favicon.png (192px), apple-touch-icon.png (180px)
# 사용법: powershell -ExecutionPolicy Bypass -File make-favicon.ps1

Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot

function New-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  # 둥근 사각형 + 보라색 그라데이션 (사이트 로고와 같은 색)
  $r = [int]($size * 0.25)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc(0, 0, 2*$r, 2*$r, 180, 90); $p.AddArc($size-2*$r-1, 0, 2*$r, 2*$r, 270, 90)
  $p.AddArc($size-2*$r-1, $size-2*$r-1, 2*$r, 2*$r, 0, 90); $p.AddArc(0, $size-2*$r-1, 2*$r, 2*$r, 90, 90)
  $p.CloseFigure()
  $c1 = [System.Drawing.ColorTranslator]::FromHtml("#5b4cf0"); $c2 = [System.Drawing.ColorTranslator]::FromHtml("#8b5cf6")
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $size, $size), $c1, $c2
  $g.FillPath($brush, $p)

  # gg 글자
  $font = New-Object System.Drawing.Font "Arial Black", ([float]($size * 0.42)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = "Center"; $fmt.LineAlignment = "Center"
  $rect = New-Object System.Drawing.RectangleF 0, ([float](-$size * 0.04)), $size, $size
  $g.DrawString("gg", $font, [System.Drawing.Brushes]::White, $rect, $fmt)
  $g.Dispose()
  return $bmp
}

function Save-Png($bmp, $path) { $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) }

# favicon.png (192px): 구글 검색 결과용 (48의 배수 크기가 권장돼요)
$b = New-Icon 192; Save-Png $b (Join-Path $root "favicon.png"); $b.Dispose()
# apple-touch-icon.png (180px): 아이폰 홈 화면용
$b = New-Icon 180; Save-Png $b (Join-Path $root "apple-touch-icon.png"); $b.Dispose()

# favicon.ico (48px): 안에 PNG 를 담은 ICO 파일
$b = New-Icon 48; $ms = New-Object IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
$png = $ms.ToArray()
$ico = New-Object IO.MemoryStream
$bw = New-Object IO.BinaryWriter $ico
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)      # 헤더: 예약, 종류(아이콘), 이미지 1개
$bw.Write([byte]48); $bw.Write([byte]48); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
$bw.Write($png); $bw.Flush()
[IO.File]::WriteAllBytes((Join-Path $root "favicon.ico"), $ico.ToArray())

Write-Host "favicon.ico, favicon.png, apple-touch-icon.png 완료"
