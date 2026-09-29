# 레진코믹스 연재작 정보를 모아 data-lezhin.js 와 thumbs/lezhin/ 폴더를 만드는 스크립트
# 사용법: powershell -ExecutionPolicy Bypass -File fetch-lezhin.ps1

$root = $PSScriptRoot
$thumbDir = Join-Path $root "thumbs\lezhin"
New-Item -ItemType Directory -Force $thumbDir | Out-Null
$headers = @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36"; "Accept-Language" = "ko" }
$recentDays = 120   # 마지막 회차가 이 기간 안에 올라온 작품만 "연재중"으로 봐요

function Get-Text($url) {
  $w = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers
  [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray())
}

# 레진 장르 → 사이트 공통 장르 코드 (네이버 기준)
$genreMap = @{
  "romance" = "PURE"; "fantasy" = "FANTASY"; "drama" = "DRAMA"; "bl" = "BL"; "gl" = "BL"
  "action" = "ACTION"; "gag" = "COMIC"; "day" = "COMIC"; "school" = "DRAMA"; "mystery" = "THRILL"
  "thriller" = "THRILL"; "horror" = "THRILL"; "sf" = "FANTASY"; "sports" = "SPORTS"; "historical" = "HISTORICAL"
}
$historicalWords = "무림|강호|천마|무공|마교|무협|문파|정파|사파|협객|검객|내공|혈교|조선|고려|왕세자|세자빈|사극"

# 1) 전체 목록에서 연재중 작품 추리기
$list = @(); $offset = 0
do {
  $j = Get-Text "https://www.lezhin.com/lz-api/v2/comics?menu=general&limit=500&offset=$offset" | ConvertFrom-Json
  $list += $j.data; $offset += 500
} while ($j.hasNext)
$cutoff = ([DateTimeOffset]::UtcNow.AddDays(-$recentDays)).ToUnixTimeMilliseconds()
$ongoing = @($list | Where-Object { $_.contentsState -eq "scheduled" -and $_.lastEpisodePublishedAt -ge $cutoff })
Write-Host "전체 $($list.Count)개 중 연재중 $($ongoing.Count)개"

# 2) 작품 페이지에서 연령 등급 · 태그 · 줄거리 + 썸네일
$out = @()
$i = 0
foreach ($c in $ongoing) {
  $i++
  try {
    $html = Get-Text "https://www.lezhin.com/ko/comic/$($c.alias)"
    $start = $html.IndexOf('\"content\":{\"id\":' + $c.id)
    $seg = $html.Substring($start, [Math]::Min(6000, $html.Length - $start)) -replace '\\"', '"'
    $rating = if ($seg -match '"rating":"?(\d+)') { [int]$Matches[1] } else { 0 }
    $isAdult = $seg -match '"isAdult":true'
    $tags = @()
    if ($seg -match '"tags":\[([^\]]*)\]') { $tags = @([regex]::Matches($Matches[1], '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notmatch "^레진|_" }) }
    $synopsis = if ($seg -match '"synopsis":"((?:[^"\\]|\\.)*)"') { ($Matches[1] -replace '\\\\n', ' ' -replace '\\n', ' ' -replace '\\u003c', '<' -replace '\\u003e', '>' -replace '\s+', ' ').Trim() } else { "" }

    $genres = @($c.genres | ForEach-Object { $genreMap[$_] } | Where-Object { $_ })
    if (-not $genres.Count) { $genres = @("DRAMA") }
    if ("$($c.title) $synopsis" -match $historicalWords) { $genres += "HISTORICAL" }
    if ($c.genres -contains "school") { $tags += "학원물" }
    if ($c.genres -contains "bl") { $tags += "BL" }
    if ($c.genres -contains "gl") { $tags += "GL" }

    $age = if ($isAdult -or $rating -ge 18) { "RATE_18" } elseif ($rating -ge 15) { "RATE_15" } elseif ($rating -ge 12) { "RATE_12" } else { "ALL" }

    $thumbFile = "thumbs/lezhin/$($c.id).jpg"
    $thumbPath = Join-Path $root $thumbFile
    if (-not (Test-Path $thumbPath)) {
      Invoke-WebRequest -UseBasicParsing -Uri "https://ccdn.lezhin.com/v2/comics/$($c.id)/images/tall.jpg?width=240" -Headers $headers -OutFile $thumbPath
    }

    $out += [ordered]@{
      platform  = "lezhin"
      id        = "$($c.id)"
      title     = $c.title
      author    = (($c.artists | ForEach-Object { $_.name } | Select-Object -Unique) -join " / ")
      genres    = @($genres | Select-Object -Unique)
      tags      = @($tags | Select-Object -Unique)
      age       = $age
      finished  = $false
      favorites = [int64]$c.subscriptions
      synopsis  = $synopsis
      url       = "https://www.lezhin.com/ko/comic/$($c.alias)"
      thumb     = $thumbFile
    }
    if ($i % 50 -eq 0) { Write-Host "진행: $i / $($ongoing.Count)" }
    Start-Sleep -Milliseconds 100
  } catch {
    Write-Host "오류: $($c.alias) - $($_.Exception.Message)"
  }
}

$json = $out | ConvertTo-Json -Depth 5
$js = "// fetch-lezhin.ps1 로 생성된 파일입니다.`nwindow.DATA_LEZHIN = $json;`n"
[IO.File]::WriteAllText((Join-Path $root "data-lezhin.js"), $js, (New-Object Text.UTF8Encoding $false))
Write-Host "총 $($out.Count)개 작품 저장"

# 새로 받은 표지를 240px 로 줄여요
& (Join-Path $root "resize-thumbs.ps1")
