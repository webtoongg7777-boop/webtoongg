// 웹툰지지 — 작품 목록 · 장르 · 키워드 정의
// 사이트(app.js)와 키워드별 페이지 생성기(generate-pages.js)가 함께 써요.

// ───────── 플랫폼 ─────────
// metric: 플랫폼마다 인기 지표가 달라요 (네이버 관심 / 카카오 좋아요 / 레진 구독)
const PLATFORMS = [
  { id: "naver",  label: "네이버웹툰", short: "네이버", metric: "관심", color: "#00c73c", data: window.DATA_NAVER },
  { id: "kakao",  label: "카카오웹툰", short: "카카오", metric: "좋아요", color: "#f7c600", data: window.DATA_KAKAO },
  { id: "lezhin", label: "레진코믹스", short: "레진",   metric: "구독", color: "#e0212e", data: window.DATA_LEZHIN },
].filter(p => Array.isArray(p.data));
const PLATFORM = Object.fromEntries(PLATFORMS.map(p => [p.id, p]));

// 플랫폼마다 태그 표기가 달라서, 같은 뜻의 태그를 공통 이름(네이버 기준)으로 바꿔요
const TAG_ALIASES = {
  "학원": "학원물", "이세계물": "이세계", "달달물": "설렘폭발", "복수": "복수극", "소년만화": "소년물",
  "계약관계": "계약연애", "초능력": "이능력", "히어로": "이능력", "서양풍": "서양", "결혼": "결혼생활", "부부": "결혼생활",
  "동양풍": "동양", "로코": "로맨틱코미디", "백합": "GL", "힐링물": "힐링", "무협": "정통무협", "음식": "음식&요리",
  "재회물": "재회", "이종족": "인외존재", "수인물": "인외존재", "sf": "SF", "궁정물": "궁중로맨스", "오피스물": "오피스",
  "친구\\u003e연인": "친구>연인", "호러/스릴러": "스릴러", "연예인": "연예계", "육아": "육아물", "캠퍼스물": "캠퍼스",
  "시대극": "시대물", "조선": "시대물", "애증": "혐관", "걸크러쉬": "걸크러시", "피폐물": "자극적인", "집착": "집착물",
  "반려동물": "동물", "조폭": "느와르", "쌍방구원": "구원서사", "후회녀": "후회물", "순애": "순애남",
  "드라마화": "드라마&영화 원작웹툰", "애니화": "드라마&영화 원작웹툰",
  // BL 캐릭터 태그 → 로맨스 캐릭터 키워드
  "다정공": "다정남", "순정공": "순정남", "헌신공": "헌신남", "대형견공": "대형견남", "연하공": "연하남",
  "집착공": "집착물", "후회공": "후회남", "능글공": "능글남", "계략공": "계략남", "짝사랑수": "짝사랑", "짝사랑공": "짝사랑",
};

// 모든 플랫폼 작품을 합쳐요.
const WEBTOONS = PLATFORMS.flatMap(p => p.data.map(w => ({
  ...w, platform: p.id,
  tags: [...new Set((w.tags || []).map(t => TAG_ALIASES[t] || t))],
})));

// ───────── 플랫폼 간 인기 비교 ─────────
// 네이버 관심과 레진 구독은 둘 다 "작품을 구독한 사람 수"라서 숫자를 그대로 비교해요.
// 카카오 좋아요는 회차마다 쌓이는 누적 수라, 먼저 회차 수로 나눠서(회차당 좋아요) 오래 연재한 작품이
// 유리하지 않게 하고, 카카오 안에서 상위 몇 %인지를 네이버에서 같은 순위의 관심 수로 바꿔서 비교해요.
// (예: 카카오 상위 1% = 네이버 상위 1% 관심 수)
(function computePopularity() {
  const reference = WEBTOONS.filter(w => w.platform === "naver").map(w => w.favorites).sort((a, b) => a - b);
  const QUANTILE_MAPPED = ["kakao"];
  const raw = w => QUANTILE_MAPPED.includes(w.platform) && w.episodes > 0 ? w.favorites / w.episodes : w.favorites;
  for (const p of PLATFORMS) {
    const list = WEBTOONS.filter(w => w.platform === p.id).sort((a, b) => raw(a) - raw(b));
    list.forEach((w, i) => {
      if (QUANTILE_MAPPED.includes(p.id) && reference.length) {
        const q = list.length > 1 ? i / (list.length - 1) : 1;
        w.score = reference[Math.round(q * (reference.length - 1))];
      } else {
        w.score = w.favorites;
      }
    });
  }
  // pop: 전체 작품 중 인기 순위 (0 ~ 1, 1이 가장 인기)
  const all = [...WEBTOONS].sort((a, b) => a.score - b.score);
  all.forEach((w, i) => { w.pop = all.length > 1 ? i / (all.length - 1) : 1; });
})();

// ───────── 1단계: 장르 ─────────
// 네이버웹툰은 작품마다 장르를 하나만 붙여서, tags 에 있는 태그가 있으면 그 장르로도 인정해요.
// 예) 장르는 무협인데 "액션" 태그가 있는 작품 → 무협 + 액션 둘 다 해당
const GENRES = [
  { id: "FANTASY",    label: "판타지",      desc: "마법·이세계·헌터",   tags: ["판타지", "게임판타지", "액션판타지", "다크판타지", "동양풍판타지", "로판", "현대판타지", "중세판타지액션", "오컬트판타지", "마법"] },
  { id: "ACTION",     label: "액션",        desc: "싸움·배틀",         tags: ["액션", "액션판타지", "학원액션", "격투기", "SF액션", "액션아포칼립스", "중세판타지액션"] },
  { id: "HISTORICAL", label: "무협/사극",   desc: "강호·천마·무공",    tags: ["무협/사극", "정통무협", "퓨전사극", "천마", "시대물", "역사물"] },
  { id: "PURE",       label: "로맨스",      desc: "설렘·연애",         tags: ["로맨스", "로판", "로맨스릴러", "학원로맨스", "캠퍼스로맨스", "청춘로맨스", "로맨틱코미디", "러브코미디", "로맨스코미디", "궁중로맨스", "오피스로맨스", "연예계로맨스", "동양풍로맨스", "성장로판", "리얼로맨스", "고자극로맨스"] },
  { id: "DRAMA",      label: "드라마·감성", desc: "현실·감정선",       also: ["SENSIBILITY"], tags: ["감성드라마", "성장드라마", "직업드라마", "의학드라마", "법정드라마"] },
  { id: "THRILL",     label: "스릴러·공포", desc: "긴장감·공포",       tags: ["스릴러", "고자극스릴러", "로맨스릴러", "서스펜스", "미스터리", "공포", "바디 호러"] },
  { id: "COMIC",      label: "일상·개그",   desc: "가볍게 웃고 싶을 때", also: ["DAILY"], tags: ["개그", "판타지개그", "병맛", "열혈병맛개그", "일상개그힐링", "블랙코미디"] },
  { id: "SPORTS",     label: "스포츠",      desc: "땀과 열정",         tags: ["스포츠", "스포츠성장", "농구", "야구", "축구"] },
  { id: "BL",         label: "BL/GL",       desc: "남남·여여 로맨스",   tags: ["BL", "GL"], keywordsLike: "PURE" },
];

// ───────── 2단계: 키워드 (여러 플랫폼 태그를 하나로 묶음) ─────────
// genres: 이 키워드를 보여줄 장르. 1단계에서 고른 장르에 해당하는 키워드만 나와요.
const F = "FANTASY", A = "ACTION", H = "HISTORICAL", P = "PURE", D = "DRAMA", T = "THRILL", C = "COMIC", S = "SPORTS";
const ALL_GENRES = [F, A, H, P, D, T, C, S];
const KEYWORDS = [
  // 판타지 · 무협 · 액션
  { id: "cider",    label: "사이다·참교육",      genres: [F, A, H, D, T], tags: ["사이다", "참교육", "인생역전", "다크히어로"] },
  { id: "op",       label: "먼치킨·힘숨찐",      genres: [F, A, H],       tags: ["먼치킨", "힘숨찐", "고인물", "능력남"] },
  { id: "game",     label: "게임·상태창·던전",    genres: [F, A, H],       tags: ["게임", "게임판타지", "상태창", "헌터물", "던전물"] },
  { id: "regress",  label: "회귀·환생·이세계",    genres: [F, A, H, P, D], tags: ["회귀", "빙의", "환생", "이세계", "차원이동", "환골탈태", "타임슬립"] },
  { id: "fight",    label: "격투·능력 배틀",      genres: [F, A, H],       tags: ["격투기", "배틀", "이능력배틀물", "이능력", "액션판타지", "소년왕도물", "열혈"] },
  { id: "modern",   label: "현대 판타지",         genres: [F, A],          tags: ["현대판타지"] },
  { id: "medieval", label: "중세·용사·마법",      genres: [F, A],          tags: ["중세판타지액션", "용사", "마법", "중세"] },
  { id: "world",    label: "방대한 세계관",       genres: [F, A, H],       tags: ["세계관", "신화", "인외존재", "동양풍판타지", "모험", "전쟁", "선협"] },
  { id: "martial",  label: "천마·정통무협",       genres: [H],             tags: ["천마", "정통무협", "퓨전사극", "동양", "판무"] },
  { id: "period",   label: "시대극·역사",         genres: [H, D, P],       tags: ["시대물", "역사물", "과거", "역사판타지", "궁중로맨스", "동양풍로맨스"] },
  { id: "sf",       label: "SF·미래",            genres: [F, A, T, D],    tags: ["SF", "SF액션", "사이버펑크", "미래"] },
  { id: "survival", label: "아포칼립스·생존",     genres: [F, A, T],       tags: ["아포칼립스", "액션아포칼립스", "서바이벌", "생존", "크리처", "절망적인", "좀비", "감염", "디스토피아", "데스게임"] },
  { id: "dark",     label: "어둡고 자극적인",     genres: [F, A, H, D, T], tags: ["자극적인", "다크판타지", "시리어스", "악역이주인공", "고자극드라마", "고자극스릴러", "복수극", "피카레스크", "빌런"] },
  { id: "schoolA",  label: "학원 액션",          genres: [A, D, F],       tags: ["학원액션", "학원물", "아카데미물"] },
  // 스릴러
  { id: "crime",    label: "범죄·느와르",        genres: [A, T, D],       tags: ["범죄", "느와르", "사회고발"] },
  { id: "mystery",  label: "미스터리·서스펜스",   genres: [T, D, P],       tags: ["미스터리", "서스펜스", "두뇌싸움", "로맨스릴러"] },
  { id: "occult",   label: "오컬트·공포·괴담",    genres: [T, F, D],       tags: ["오컬트", "오컬트판타지", "공포", "괴담", "뱀파이어", "사이비종교"] },
  // 로맨스
  { id: "romcom",   label: "로맨틱 코미디",       genres: [P, D, C],       tags: ["로맨틱코미디", "러브코미디", "로맨스코미디"] },
  { id: "firstlove",label: "첫사랑·짝사랑",       genres: [P, D],          tags: ["첫사랑", "짝사랑", "짝사랑남", "짝사랑녀", "소꿉친구", "친구>연인"] },
  { id: "real",     label: "현실 연애·결혼",      genres: [P, D, C],       tags: ["리얼로맨스", "연애/결혼공감", "결혼생활", "선결혼후연애", "오피스로맨스", "사내연애", "연상연하", "비밀연애"] },
  { id: "sweet",    label: "다정·순애 캐릭터",    genres: [P, D],          tags: ["직진남", "다정남", "대형견남", "순정남", "햇살캐", "햇살남", "순애남", "헌신남", "순진남", "연하남", "다정녀", "순정녀", "순애녀", "직진녀"] },
  { id: "obsess",   label: "집착·나쁜남자·후회남", genres: [P, D],          tags: ["집착남", "집착녀", "집착물", "계략남", "계략녀", "폭스남", "까칠남", "능글남", "무심남", "나쁜남자", "후회남", "후회물", "유혹남", "짐승남", "유혹녀", "악녀"] },
  { id: "hot",      label: "고자극·치명적 로맨스", genres: [P],             tags: ["고자극로맨스", "치명적인"] },
  { id: "girl",     label: "걸크러시 여주",       genres: [P, D],          tags: ["걸크러시", "능력녀", "군림녀", "외유내강녀", "무심녀", "까칠녀", "철벽녀"] },
  { id: "triangle", label: "삼각관계·역하렘",     genres: [P, D],          tags: ["삼각관계", "역하렘"] },
  { id: "campus",   label: "학원·캠퍼스 로맨스",   genres: [P, D],          tags: ["학원로맨스", "캠퍼스로맨스", "캠퍼스", "하이틴", "동아리"] },
  { id: "rofan",    label: "로판·궁중",          genres: [P, F],          tags: ["로판", "성장로판", "왕족/귀족", "서양", "궁중로맨스"] },
  { id: "contract", label: "계약·혐관·재회",      genres: [P, D],          tags: ["계약연애", "혐관로맨스", "혐관", "재회", "전남친"] },
  { id: "flutter",  label: "설렘·청춘",          genres: [P, D],          tags: ["설렘폭발", "청춘로맨스", "청춘", "아이돌", "러블리", "무해한", "인소감성"] },
  // 드라마 · 일상 · 스포츠
  { id: "growth",   label: "성장·우정",          genres: [A, D, S, F],    tags: ["성장물", "우정", "소년물", "성장드라마", "스포츠성장", "구원서사"] },
  { id: "healing",  label: "힐링·감성",          genres: [D, C, P],       tags: ["힐링", "공감", "가족", "감성드라마", "감성적인", "감성", "일상개그힐링", "일상"] },
  { id: "tears",    label: "눈물 버튼",          genres: [D, P],          tags: ["눈물샘자극", "투병"] },
  { id: "gag",      label: "웃긴·병맛",          genres: [C, H, F, D, A], tags: ["개그", "판타지개그", "4차원", "가벼운", "하이퍼리얼리즘", "병맛", "열혈병맛개그", "블랙코미디", "공감성수치"] },
  { id: "cozy",     label: "요리·육아·동물",      genres: [C, D, F, P],    tags: ["음식&요리", "이세계요리", "육아물", "동물", "농사"] },
  { id: "cuttoon",  label: "짧은 컷툰",          genres: [C, P, T],       tags: ["컷툰", "4컷만화", "옴니버스"] },
  { id: "work",     label: "직장·돈·현실",        genres: [D, S, A, P],    tags: ["오피스", "재벌", "재벌남", "재벌녀", "정치", "직업드라마", "연예계", "자본주의", "주식", "머니게임", "의학드라마", "법정드라마", "예술"] },
  { id: "rival",    label: "라이벌·시합",         genres: [S, A],          tags: ["농구", "야구", "축구", "스포츠", "라이벌"] },
  // 공통
  { id: "art",      label: "작화 맛집",           genres: ALL_GENRES,      tags: ["미친작화", "비쥬얼쇼크", "공식미남", "공식미녀"] },
  { id: "hotnow",   label: "요즘 뜨는 화제작",     genres: ALL_GENRES,      tags: ["요즘핫한추천작", "지금추천작", "독자PICK"] },
  { id: "classic",  label: "검증된 명작",         genres: ALL_GENRES,      tags: ["명작", "드라마&영화 원작웹툰", "몰아보기"] },
];

// ───────── 3단계: 연령 · 연재 상태 ─────────
// UNKNOWN: 카카오웹툰은 성인 여부만 알려줘서, 성인이 아닌 작품은 15세 기준으로 다뤄요
const AGE_ORDER = { ALL: 0, RATE_12: 12, RATE_15: 15, UNKNOWN: 15, RATE_18: 18 };
const AGE_LABEL = { ALL: "전체이용가", RATE_12: "12세", RATE_15: "15세", UNKNOWN: "청소년 이용가", RATE_18: "18세" };
const AGES = [
  { id: 0,  label: "12세 미만",   desc: "전체이용가만" },
  { id: 12, label: "12~14세",     desc: "12세 이용가까지" },
  { id: 15, label: "15~17세",     desc: "15세 이용가까지" },
  { id: 18, label: "성인",        desc: "모든 작품" },
];
const STATUS = [
  { id: "any",      label: "상관없음" },
  { id: "finished", label: "완결작만",  desc: "몰아보기 좋아요" },
  { id: "ongoing",  label: "연재중만",  desc: "매주 기다리는 재미" },
];

// 작품이 장르에 해당하는지: 장르 코드가 같거나, 장르에 연결된 태그가 있으면 해당
const genreMatches = (g, w) =>
  [g.id, ...(g.also || [])].some(id => w.genres.includes(id)) || g.tags.some(t => w.tags.includes(t));
