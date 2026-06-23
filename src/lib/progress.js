// 진행(푼 문제) 저장 — localStorage 가 1차 저장소, 서버는 닉네임 기준 기기 간 동기화.
//
// 왜 이 구조인가 (leaderboard.js 와 같은 fail-soft 규약):
//  - 익명 사용자(닉네임 "건너뛰기")도 같은 기기 재방문 시 푼 문제가 안 나와야 한다
//    → 서버만으로는 불가능(닉네임 없으면 서버에 안 남음). localStorage 가 기본.
//  - playedIds 는 라운드 시작(pickQuote) "전에" 필요한데, 네트워크로 그 시점을 막으면
//    안 된다(이 앱은 모든 fetch 가 fail-soft). 그래서 로컬은 동기 복원, 서버는 비동기 병합.
//
// 형식(직렬화): { [catId]: { 1:{ids:number[], cycle:number}, 2:{...}, 3:{...} } }
//   — useGame.js 의 serializeProgress / mergeProgress 와 정확히 일치.

const PROGRESS_KEY = 'qh_progress'

// ---- localStorage (1차 저장소, 모든 접근 try/catch) ----

/** 저장된 진행을 읽는다. 없거나 깨졌으면 null (호출부는 그냥 병합 안 함). */
export function loadLocalProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** 직렬화된 진행(serializeProgress 결과)을 저장한다. 실패는 무시. */
export function saveLocalProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* 비활성/쿼터 초과 — 무시 */
  }
}

// ---- 서버 (닉네임 기준 동기화, 전부 fail-soft) ----

/**
 * 서버에서 (닉네임, 카테고리, 레벨, 사이클)에 푼 quote_id 목록을 가져온다.
 * 실패하면 null → 호출부는 로컬 값을 그대로 유지(서버 union 만 스킵).
 * @returns {Promise<number[]|null>}
 */
export async function fetchPlayed(nickname, category, level, cycle) {
  if (!nickname) return null
  try {
    const qs = new URLSearchParams({
      nickname,
      category,
      level: String(level),
      cycle: String(cycle),
    })
    const res = await fetch(`/api/played?${qs}`)
    if (!res.ok) return null // vite dev 의 index.html(200) 은 아래 json 파싱에서 걸러짐
    const data = await res.json()
    return Array.isArray(data?.played) ? data.played.map(Number).filter(Number.isFinite) : null
  } catch {
    return null
  }
}

/**
 * 한 문제를 푼 것으로 서버에 마킹 (fire-and-forget). 실패는 삼킨다.
 * 호출부는 닉네임이 있을 때만 호출할 것(서버는 닉네임 없으면 400).
 */
export async function postPlayed(nickname, category, level, cycle, quoteId) {
  if (!nickname) return
  try {
    await fetch('/api/played', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, category, level, cycle, quoteId }),
    })
  } catch {
    /* 오프라인/네트워크 오류 — 무시 */
  }
}
