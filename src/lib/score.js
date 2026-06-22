// 승리 시 획득 점수 (난이도 가중). 순수 함수 — 헤드리스 테스트 가능.
//
//   기본점:  레벨1=10 · 레벨2=20 · 레벨3=30  (난이도 보상)
//   + 남은 하트당 +1        (실수 적을수록 보상)
//   + 안 쓴 힌트당 +2       (힌트 아낄수록 보상)
export const BASE_POINTS = { 1: 10, 2: 20, 3: 30 }

export function scoreForWin({ level, remainingAttempts = 0, hintsLeft = 0 } = {}) {
  const base = BASE_POINTS[level] ?? 0
  return base + remainingAttempts + hintsLeft * 2
}
