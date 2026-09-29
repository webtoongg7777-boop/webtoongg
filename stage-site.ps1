# 인터넷에 올릴 파일만 _deploy\ 폴더에 모으는 스크립트
# build-zip.ps1(직접 올릴 때)과 GitHub 자동 갱신(.github\workflows\update.yml)이 함께 써요.
# 사용법: powershell -ExecutionPolicy Bypass -File stage-site.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$out = Join-Path $root "_deploy"

# 키워드별 추천 페이지 · sitemap.xml · rss.xml 을 최신 데이터로 다시 만들어요
Push-Location $root
node generate-pages.js
if ($LASTEXITCODE -ne 0) { throw "generate-pages.js 실패" }
Pop-Location

if (Test-Path $out) { [IO.Directory]::Delete($out, $true) }
New-Item -ItemType Directory $out | Out-Null

$names = "index.html", "style.css", "catalog.js", "app.js", "robots.txt", "sitemap.xml", "rss.xml", "_redirects", "og-image.png",
         "data-naver.js", "data-kakao.js", "data-lezhin.js", "data-ranking.js"
foreach ($n in $names) { Copy-Item (Join-Path $root $n) $out }
Get-ChildItem $root -Filter "google*.html" | Copy-Item -Destination $out   # 구글 소유권 확인 파일 (지우면 안 돼요)
Get-ChildItem $root -Filter "naver*.html"  | Copy-Item -Destination $out   # 네이버 소유권 확인 파일 (지우면 안 돼요)
Copy-Item (Join-Path $root "thumbs") (Join-Path $out "thumbs") -Recurse
Copy-Item (Join-Path $root "recommend") (Join-Path $out "recommend") -Recurse

# 방문자 브라우저가 예전 파일을 쓰지 않게, index.html 의 ?v= 버전을 오늘 날짜로 바꿔요
$indexPath = Join-Path $out "index.html"
$version = Get-Date -Format "yyyyMMddHH"
$html = [IO.File]::ReadAllText($indexPath, [Text.Encoding]::UTF8)
$html = [regex]::Replace($html, '\?v=\d+', "?v=$version")
[IO.File]::WriteAllText($indexPath, $html, (New-Object Text.UTF8Encoding $false))

$files = Get-ChildItem $out -Recurse -File
Write-Host ("_deploy 준비 완료: 파일 {0}개, {1:N1} MB" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB))
