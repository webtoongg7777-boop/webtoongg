# 각 플랫폼의 공식 인기 순위를 받아 data-ranking.js 를 만드는 스크립트 ("지금 인기 웹툰"에 사용)
# 1분 안에 끝나요. 자주 실행할수록 "지금" 순위에 가까워져요.
# 사용법: powershell -ExecutionPolicy Bypass -File fetch-ranking.ps1

$root = $PSScriptRoot
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36"

function Get-Text($url, $referer) {
  $h = @{ "User-Agent" = $ua; "Accept-Language" = "ko" }
  if ($referer) { $h["Referer"] = $referer }
  $w = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $h
  [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray())
}

# 네이버웹툰: 요일별 "인기순" 목록을 순위대로 섞어요 (각 요일 1위 → 각 요일 2위 → …)
$naver = @()
$naverByDay = [ordered]@{}   # 요일별 인기순 ("오늘 연재" 탭용). 키: mon ~ sun
$dayKey = @{ MONDAY = "mon"; TUESDAY = "tue"; WEDNESDAY = "wed"; THURSDAY = "thu"; FRIDAY = "fri"; SATURDAY = "sat"; SUNDAY = "sun" }
try {
  $j = Get-Text "https://comic.naver.com/api/webtoon/titlelist/weekday?order=user" "https://comic.naver.com/" | ConvertFrom-Json
  foreach ($prop in $j.titleListMap.PSObject.Properties) {
    if ($dayKey.Contains($prop.Name)) { $naverByDay[$dayKey[$prop.Name]] = @($prop.Value | Select-Object -First 40 | ForEach-Object { "$($_.titleId)" }) }
  }
  $days = @($j.titleListMap.PSObject.Properties | ForEach-Object { , @($_.Value) })
  $maxLen = ($days | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
  for ($r = 0; $r -lt $maxLen; $r++) {
    foreach ($d in $days) { if ($r -lt $d.Count) { $id = "$($d[$r].titleId)"; if ($naver -notcontains $id) { $naver += $id } } }
  }
} catch { Write-Host "네이버 순위 오류: $($_.Exception.Message)" }

# 카카오웹툰: 공식 "실시간 랭킹" (전체)
$kakao = @()
try {
  $j = Get-Text "https://gateway-kw.kakao.com/section/v2/sections?placement=rank_all" | ConvertFrom-Json
  $kakao = @($j.data | ForEach-Object { $_.cardGroups } | ForEach-Object { $_.cards } | ForEach-Object { "$($_.content.id)" } | Select-Object -Unique)
} catch { Write-Host "카카오 순위 오류: $($_.Exception.Message)" }

# 카카오웹툰: 요일별 연재 목록 (카카오 요일 화면 순서) ("오늘 연재" 탭용)
$kakaoByDay = [ordered]@{}
foreach ($d in "mon", "tue", "wed", "thu", "fri", "sat", "sun") {
  try {
    $j = Get-Text "https://gateway-kw.kakao.com/section/v2/timetables/days?placement=timetable_$d" | ConvertFrom-Json
    $kakaoByDay[$d] = @($j.data[0].cardGroups.cards | Select-Object -First 40 | ForEach-Object { "$($_.content.id)" })
  } catch { Write-Host "카카오 $d 요일 목록 오류: $($_.Exception.Message)" }
}

# 레진코믹스: 랭킹 페이지에 나오는 작품 순서
$lezhin = @()
try {
  $html = Get-Text "https://www.lezhin.com/ko/ranking"
  $lezhin = @([regex]::Matches($html, '\\"alias\\":\\"([^"\\]+)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
} catch { Write-Host "레진 순위 오류: $($_.Exception.Message)" }

$data = [ordered]@{
  updatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  naver     = $naver
  kakao     = $kakao
  lezhin    = $lezhin    # 레진은 작품 주소의 별칭(alias)으로 저장
  byDay     = [ordered]@{ naver = $naverByDay; kakao = $kakaoByDay }
}
$json = $data | ConvertTo-Json -Depth 5 -Compress
$js = "// fetch-ranking.ps1 로 생성된 파일입니다.`nwindow.DATA_RANKING = $json;`n"
[IO.File]::WriteAllText((Join-Path $root "data-ranking.js"), $js, (New-Object Text.UTF8Encoding $false))
Write-Host "순위 저장: 네이버 $($naver.Count)개, 카카오 $($kakao.Count)개, 레진 $($lezhin.Count)개"
