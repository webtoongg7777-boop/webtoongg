# 링크 공유 미리보기 이미지(og-image.png, 1200x630)를 만드는 스크립트
# 카카오톡 · SNS 에 webtoongg.com 링크를 붙여 넣으면 이 그림이 보여요.
# 문구를 바꾸고 싶으면 아래 $title, $subtitle, $chips 를 고치고 다시 실행하세요.
# 사용법: powershell -ExecutionPolicy Bypass -File make-og-image.ps1

Add-Type -AssemblyName System.Drawing
$W = 1200; $H = 630
$out = Join-Path $PSScriptRoot "og-image.png"

$title    = "웹툰지지"
$subtitle = "취향으로 찾는 웹툰 추천"
$line     = "네이버웹툰 · 카카오웹툰 · 레진코믹스 연재작 2,300+"
$chips    = "무협", "판타지", "로맨스", "회귀", "먼치킨", "사이다", "로판", "스릴러"
$url      = "webtoongg.com"
$fontName = "Malgun Gothic"

$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2*$r, 2*$r, 180, 90); $p.AddArc($x+$w-2*$r, $y, 2*$r, 2*$r, 270, 90)
  $p.AddArc($x+$w-2*$r, $y+$h-2*$r, 2*$r, 2*$r, 0, 90); $p.AddArc($x, $y+$h-2*$r, 2*$r, 2*$r, 90, 90)
  $p.CloseFigure(); return $p
}
function C($hex, $a = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($a, $c) }

# 배경: 보라색 그라데이션 + 은은한 원 장식
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $W, $H), (C "#4f3fe0"), (C "#9b5cf6")
$g.FillRectangle($bg, 0, 0, $W, $H)
$g.FillEllipse((New-Object System.Drawing.SolidBrush (C "#ffffff" 18)), 760, -180, 620, 620)
$g.FillEllipse((New-Object System.Drawing.SolidBrush (C "#ffffff" 12)), 880, 330, 460, 460)

# 로고 마크 (gg)
$g.FillPath((New-Object System.Drawing.SolidBrush (C "#ffffff")), (RoundRect 80 90 110 110 28))
$fmtC = New-Object System.Drawing.StringFormat; $fmtC.Alignment = "Center"; $fmtC.LineAlignment = "Center"
$g.DrawString("gg", (New-Object System.Drawing.Font "Arial Black", 44, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)), (New-Object System.Drawing.SolidBrush (C "#5b4cf0")), (New-Object System.Drawing.RectangleF 80, 92, 110, 110), $fmtC)

# 제목 · 부제 · 설명
$white = New-Object System.Drawing.SolidBrush (C "#ffffff")
$soft  = New-Object System.Drawing.SolidBrush (C "#ffffff" 215)
$px = [System.Drawing.GraphicsUnit]::Pixel
$g.DrawString($title,    (New-Object System.Drawing.Font $fontName, 112, ([System.Drawing.FontStyle]::Bold), $px), $white, 70, 225)
$g.DrawString($subtitle, (New-Object System.Drawing.Font $fontName, 50, ([System.Drawing.FontStyle]::Bold), $px), $white, 80, 375)
$g.DrawString($line,     (New-Object System.Drawing.Font $fontName, 28, ([System.Drawing.FontStyle]::Regular), $px), $soft, 82, 450)

# 장르 · 키워드 칩
$chipFont = New-Object System.Drawing.Font $fontName, 26, ([System.Drawing.FontStyle]::Bold), $px
$x = 82; $y = 520
foreach ($c in $chips) {
  $chipW = [int]$g.MeasureString($c, $chipFont).Width + 30   # (PowerShell 변수는 대소문자를 구분하지 않아서 $W 와 다른 이름을 써요)
  if ($x + $chipW -gt 900) { break }
  $g.FillPath((New-Object System.Drawing.SolidBrush (C "#ffffff" 45)), (RoundRect $x $y $chipW 50 25))
  $g.DrawString($c, $chipFont, $white, (New-Object System.Drawing.RectangleF $x, $y, $chipW, 50), $fmtC)
  $x += $chipW + 12
}

# 주소
$urlFont = New-Object System.Drawing.Font $fontName, 30, ([System.Drawing.FontStyle]::Bold), $px
$urlSize = $g.MeasureString($url, $urlFont)
$g.DrawString($url, $urlFont, $white, [float]($W - 80 - $urlSize.Width), [float]128)

$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("og-image.png 완료 ({0:N0} KB)" -f ((Get-Item $out).Length / 1KB))
