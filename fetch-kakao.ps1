# 카카오웹툰 연재작 정보를 모아 data-kakao.js 와 thumbs/kakao/ 폴더를 만드는 스크립트
# 사용법: powershell -ExecutionPolicy Bypass -File fetch-kakao.ps1

$root = $PSScriptRoot
$thumbDir = Join-Path $root "thumbs\kakao"
New-Item -ItemType Directory -Force $thumbDir | Out-Null
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Accept-Language" = "ko" }

function Get-Json($url) {
  $w = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers
  [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray()) | ConvertFrom-Json
}

# 카카오웹툰 장르 → 사이트 공통 장르 코드 (네이버 기준)
$genreMap = @{
  "로맨스 판타지" = @("PURE");     "로맨스" = @("PURE");      "판타지 드라마" = @("FANTASY", "DRAMA")
  "액션/무협"     = @("ACTION");   "학원/판타지" = @("FANTASY"); "드라마" = @("DRAMA")
  "코믹/일상"     = @("COMIC");    "공포/스릴러" = @("THRILL");  "BL" = @("BL"); "GL" = @("BL")
}
# 카카오웹툰 키워드 → 사이트 공통 태그 (index.html 의 KEYWORDS 태그와 맞춤)
$tagMap = @{
  "로맨스 판타지" = "로판"; "학원/판타지" = "학원물"; "로맨틱코미디물" = "로맨틱코미디"; "통쾌한" = "사이다"
  "빙의물" = "빙의"; "회귀물" = "회귀"; "환생물" = "환생"; "차원이동물" = "차원이동"; "타임슬립" = "타임슬립"; "영혼체인지" = "빙의"
  "육아물" = "육아물"; "성공성장물" = "성장물"; "성장하는" = "성장물"; "성장물" = "성장물"; "레벨업물" = "게임판타지"; "레이드물" = "헌터물"
  "복수물" = "복수극"; "힐링물" = "힐링"; "따뜻한" = "힐링"; "평온한" = "힐링"; "웃기는" = "개그"; "유쾌한" = "개그"; "유머러스한" = "개그"
  "처절한" = "자극적인"; "피폐물" = "자극적인"; "분노유발" = "자극적인"; "에로틱한" = "고자극로맨스"; "몸정>맘정" = "고자극로맨스"; "치정물" = "고자극로맨스"
  "설레는" = "설렘폭발"; "가슴 먹먹한" = "눈물샘자극"; "슬픈" = "눈물샘자극"; "감동적인" = "눈물샘자극"; "공감되는" = "공감"
  "미스테리한" = "미스터리"; "궁금하게 하는" = "미스터리"; "긴장감 있는" = "서스펜스"; "등골 오싹한" = "공포"
  "범죄스릴러물" = "범죄"; "수사물" = "범죄"; "조직/암흑가" = "느와르"; "재난물" = "아포칼립스"; "전쟁물" = "전쟁"
  "정치물" = "정치"; "암투물" = "정치"; "오피스물" = "오피스"; "전문직물" = "직업드라마"; "학원로맨스물" = "학원로맨스"; "학원물" = "학원물"
  "캠퍼스물" = "캠퍼스"; "식욕을 자극하는" = "음식&요리"; "가상시대물" = "시대물"; "하렘물" = "하렘"; "모험물" = "모험"; "배틀물" = "배틀"
  "옴니버스물" = "옴니버스"; "수인물" = "인외존재"; "메카닉물" = "SF"; "청춘드라마" = "청춘"; "소꿉친구" = "소꿉친구"; "집착" = "집착물"
  "가족물" = "가족"; "막장드라마" = "고자극드라마"; "로맨스릴러" = "로맨스릴러"; "BL" = "BL"; "GL" = "GL"; "액션/무협" = "액션"
}
# 제목·줄거리에 이런 단어가 있으면 무협/사극으로도 분류
$historicalWords = "무림|강호|천마|무공|마교|무협|문파|정파|사파|협객|검객|내공|혈교|조선|고려|왕세자|세자빈|사극"

# 1) 요일별 연재 목록
$cards = [ordered]@{}
foreach ($d in "mon", "tue", "wed", "thu", "fri", "sat", "sun") {
  $j = Get-Json "https://gateway-kw.kakao.com/section/v2/timetables/days?placement=timetable_$d"
  foreach ($c in $j.data[0].cardGroups.cards) { if (-not $cards.Contains("$($c.content.id)")) { $cards["$($c.content.id)"] = $c.content } }
}
Write-Host "연재중 작품: $($cards.Count)개"

# 2) 작품별 상세 정보 + 썸네일
$out = @()
$i = 0
foreach ($id in @($cards.Keys)) {
  $i++
  try {
    $card = $cards[$id]
    $info = (Get-Json "https://gateway-kw.kakao.com/decorator/v2/decorator/contents/$id").data
    # 최신 회차 1개: 전체 회차 수(좋아요를 회차 수로 나눌 때 사용)와 연령 등급
    $ep = Get-Json "https://gateway-kw.kakao.com/episode/v2/views/content-home/contents/$id/episodes?sort=-NO&offset=0&limit=1"
    $episodes = [int]$ep.meta.pagination.totalCount
    $ageLimit = if ($ep.data.episodes) { [int]$ep.data.episodes[0].ageLimit } else { -1 }
    $raw = @($card.seoKeywords | ForEach-Object { $_.TrimStart("#").Trim() })
    $tags = @($raw | ForEach-Object { $tagMap[$_] } | Where-Object { $_ } | Select-Object -Unique)
    $genres = @($genreMap[$info.genre])
    if (-not $genres.Count) { $genres = @("DRAMA") }
    if ("$($info.title) $($info.synopsis)" -match $historicalWords) { $genres += "HISTORICAL" }

    $thumbFile = "thumbs/kakao/$id.jpg"
    $thumbPath = Join-Path $root $thumbFile
    if (-not (Test-Path $thumbPath) -and $info.sharingThumbnailImage) {
      # 확장자를 붙여야 받아져요 (600x600 정사각형 표지)
      Invoke-WebRequest -UseBasicParsing -Uri "$($info.sharingThumbnailImage).jpg" -Headers $headers -OutFile $thumbPath
    }

    $out += [ordered]@{
      platform  = "kakao"
      id        = [int]$id
      title     = $info.title
      author    = (($info.authors | Where-Object { $_.type -ne "PUBLISHER" } | ForEach-Object { $_.name } | Select-Object -Unique) -join " / ")
      genres    = @($genres | Select-Object -Unique)
      tags      = $tags
      age       = $(if ($info.adult -or $ageLimit -ge 18) { "RATE_18" } elseif ($ageLimit -ge 15) { "RATE_15" } elseif ($ageLimit -ge 12) { "RATE_12" } elseif ($ageLimit -eq 0) { "ALL" } else { "UNKNOWN" })
      finished  = $false
      favorites = [int64]$info.statistics.likeCount
      episodes  = $episodes
      synopsis  = ($info.synopsis -replace "\s+", " ").Trim()
      url       = "https://webtoon.kakao.com/content/$([uri]::EscapeDataString($info.seoId))/$id"
      thumb     = $thumbFile
    }
    if ($i % 50 -eq 0) { Write-Host "진행: $i / $($cards.Count)" }
    Start-Sleep -Milliseconds 100
  } catch {
    Write-Host "오류: $id - $($_.Exception.Message)"
  }
}

$json = $out | ConvertTo-Json -Depth 5
$js = "// fetch-kakao.ps1 로 생성된 파일입니다.`nwindow.DATA_KAKAO = $json;`n"
[IO.File]::WriteAllText((Join-Path $root "data-kakao.js"), $js, (New-Object Text.UTF8Encoding $false))
Write-Host "총 $($out.Count)개 작품 저장"

# 새로 받은 표지를 240px 로 줄여요
& (Join-Path $root "resize-thumbs.ps1")
