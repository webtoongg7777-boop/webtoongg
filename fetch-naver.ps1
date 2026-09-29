# 네이버웹툰 작품 정보를 모아 data-naver.js 와 thumbs/ 폴더를 만드는 스크립트
# 현재 연재중인 작품은 모두 자동으로 가져오고, 완결작 등은 아래 $titles 목록에 작품명을 추가
# 사용법: PowerShell 에서 실행
#   powershell -ExecutionPolicy Bypass -File fetch-naver.ps1

$titles = @(
  "나노마신", "화산귀환", "전지적 독자 시점", "광마회귀", "입학용병", "싸움독학",
  "외모지상주의", "김부장", "신의 탑", "여신강림", "연애혁명", "유미의 세포들",
  "마음의 소리", "참교육", "퀘스트지상주의", "재혼황후", "템빨", "나 혼자 만렙 뉴비",
  "약한영웅", "스위트홈", "타인은 지옥이다", "윈드브레이커", "가비지타임", "똑 닮은 딸",
  "호랑이형님", "게임 속 바바리안으로 살아남기", "달마건", "장씨세가 호위무사", "사신소년",
  "일렉시드", "소녀의 세계", "선의의 경쟁", "대학원 탈출일지", "머니게임", "열렙전사",
  "쿠베라", "갓 오브 하이스쿨", "바른연애 길잡이", "모죠의 일지", "하루만 네가 되고 싶어",
  "이번 생도 잘 부탁해", "원수를 사랑하라", "고수", "헬퍼 2 : 킬베로스", "한림체육관",
  "북검전기", "절대검감", "학사재생", "앵무살수", "고삼무쌍", "무사만리행", "화산전생",
  "천마육성", "철혈검가 사냥개의 회귀", "검술명가 막내아들", "광마", "무림서부", "마검왕",
  "환생천마", "사상최강", "천하제일인", "귀환자의 마법은 특별해야 합니다", "신화급 귀속 아이템을 손에 넣었다",
  "내 ID는 강남미인!", "치즈인더트랩", "세기말 풋사과 보습학원", "화장 지워주는 남자", "오늘도 사랑스럽개",
  "사내 맞선", "마른 가지에 바람처럼", "샤인 미", "그 기사가 레이디로 사는 법", "재벌집 막내아들",
  "살인자ㅇ난감", "양말도깨비", "지금 우리 학교는", "비질란테", "금요일", "경이로운 소문", "타인의 집",
  "대학일기", "냐한남자", "조의 영역", "용이 산다", "가우스전자", "독립일기", "그림자 미녀",
  "WIND BREAKER", "더 복서", "프리드로우", "빅맨", "리턴 투 플레이어"
)

$root = $PSScriptRoot
$thumbDir = Join-Path $root "thumbs"
New-Item -ItemType Directory -Force $thumbDir | Out-Null
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://comic.naver.com/" }

function Get-Json($url) {
  $w = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers
  [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray()) | ConvertFrom-Json
}

# 1) 요일별 연재 목록 전체 (현재 연재중인 네이버웹툰 정식 연재작)
$ids = [ordered]@{}
$weekday = Get-Json "https://comic.naver.com/api/webtoon/titlelist/weekday?order=user"
foreach ($day in $weekday.titleListMap.PSObject.Properties) {
  foreach ($t in $day.Value) { $k = "$($t.titleId)"; if (-not $ids.Contains($k)) { $ids[$k] = $t.starScore } }
}
Write-Host "연재중 작품: $($ids.Count)개"

# 2) 위 $titles 목록 (완결작 등 직접 추가한 작품)
foreach ($name in $titles) {
  try {
    $s = Get-Json ("https://comic.naver.com/api/search/all?keyword=" + [uri]::EscapeDataString($name))
    $hit = $s.searchWebtoonResult.searchViewList | Where-Object { $_.titleName -eq $name } | Select-Object -First 1
    if (-not $hit) { Write-Host "건너뜀(검색 결과 없음): $name"; continue }
    $k = "$($hit.titleId)"; if (-not $ids.Contains($k)) { $ids[$k] = $null }
  } catch { Write-Host "오류: $name - $($_.Exception.Message)" }
}
Write-Host "총 대상: $($ids.Count)개"

# 3) 작품별 상세 정보 + 썸네일
$out = @()
$i = 0
foreach ($titleId in @($ids.Keys)) {
  $i++
  try {
    $info = Get-Json ("https://comic.naver.com/api/article/list/info?titleId=" + $titleId)
    $hit = @{ titleId = $titleId; displayAuthor = (($info.communityArtists | ForEach-Object { $_.name }) -join " / ") }
    $thumbFile = "thumbs/$($hit.titleId).jpg"
    $thumbPath = Join-Path $root $thumbFile
    if (-not (Test-Path $thumbPath)) {
      Invoke-WebRequest -UseBasicParsing -Uri $info.thumbnailUrl -Headers $headers -OutFile $thumbPath
    }

    $out += [ordered]@{
      id        = [int]$titleId
      title     = $info.titleName
      author    = $hit.displayAuthor
      genres    = @($info.gfpAdCustomParam.genreTypes)
      tags      = @($info.curationTagList | Where-Object { $_.curationType -eq "CUSTOM_TAG" -or $_.curationType -eq "NOVEL_ORIGIN" } | ForEach-Object { $_.tagName })
      age       = $info.age.type
      finished  = [bool]$info.finished
      favorites = $info.favoriteCount
      star      = $ids[$titleId]
      synopsis  = ($info.synopsis -replace "\s+", " ").Trim()
      url       = "https://comic.naver.com/webtoon/list?titleId=$($hit.titleId)"
      thumb     = $thumbFile
    }
    if ($i % 50 -eq 0) { Write-Host "진행: $i / $($ids.Count)" }
    Start-Sleep -Milliseconds 150
  } catch {
    Write-Host "오류: $titleId - $($_.Exception.Message)"
  }
}

$json = $out | ConvertTo-Json -Depth 5
$js = "// fetch-naver.ps1 로 생성된 파일입니다.`nwindow.DATA_NAVER = $json;`n"
[IO.File]::WriteAllText((Join-Path $root "data-naver.js"), $js, (New-Object Text.UTF8Encoding $false))
Write-Host "총 $($out.Count)개 작품 저장"

# 새로 받은 표지를 240px 로 줄여요
& (Join-Path $root "resize-thumbs.ps1")
