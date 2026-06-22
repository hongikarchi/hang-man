// 닉네임 로그인 + 랭킹의 클라이언트 측 글루.
//  - 정체성/누적 총점은 localStorage 가 진실의 원천 (App.jsx 의 try/catch 패턴 미러).
//  - 네트워크는 전부 fail-soft: 실패해도 절대 throw 하지 않아 게임플레이를 막지 않는다.
//    (일반 `vite dev` 는 /api 를 안 띄우고 index.html(HTML 200)을 돌려주므로 가드 필수.)

const NICK_KEY = 'qh_nickname'
const TOTAL_KEY = 'qh_total'
export const MAX_NICK = 24

// ---- localStorage (모든 접근 try/catch — 비활성/쿼터 초과 시 안전 폴백) ----

export function getNickname() {
  try {
    return localStorage.getItem(NICK_KEY) || ''
  } catch {
    return ''
  }
}

export function setNickname(name) {
  const clean = String(name ?? '').trim().slice(0, MAX_NICK)
  try {
    localStorage.setItem(NICK_KEY, clean)
  } catch {
    /* ignore */
  }
  return clean
}

export function getTotal() {
  try {
    return Number(localStorage.getItem(TOTAL_KEY)) || 0
  } catch {
    return 0
  }
}

export function setTotal(n) {
  try {
    localStorage.setItem(TOTAL_KEY, String(n))
  } catch {
    /* ignore */
  }
}

// ---- 네트워크 (fail-soft) ----

// 누적 총점 서버 제출. fire-and-forget — 실패는 삼킨다(게임플레이 무관).
// 호출부는 닉네임이 비어있지 않을 때만 호출할 것.
export async function postScore(nickname, score) {
  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, score }),
    })
  } catch {
    /* 오프라인/네트워크 오류 — 무시 */
  }
}

// 리더보드 top-N. 어떤 실패에서도 [] 를 돌려준다(절대 throw/크래시 없음).
export async function fetchLeaderboard(limit = 10) {
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`)
    if (!res.ok) return [] // vite dev 의 index.html(200) 도 여기서 걸러짐(아래 json 파싱 실패)
    const data = await res.json()
    return Array.isArray(data?.leaderboard) ? data.leaderboard : []
  } catch {
    return []
  }
}
