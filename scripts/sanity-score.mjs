/* 가중 점수 공식 순수 검증. 실행: node scripts/sanity-score.mjs */
import { scoreForWin, BASE_POINTS } from '../src/lib/score.js'

let pass = 0
let fail = 0
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.error('  ✗ FAIL:', msg) }
}

console.log('--- 레벨 기본점 (보너스 0) ---')
ok(scoreForWin({ level: 1, remainingAttempts: 0, hintsLeft: 0 }) === 10, 'L1 = 10')
ok(scoreForWin({ level: 2, remainingAttempts: 0, hintsLeft: 0 }) === 20, 'L2 = 20')
ok(scoreForWin({ level: 3, remainingAttempts: 0, hintsLeft: 0 }) === 30, 'L3 = 30')
ok(BASE_POINTS[1] === 10 && BASE_POINTS[2] === 20 && BASE_POINTS[3] === 30, 'BASE_POINTS 노출')

console.log('\n--- 보너스: 남은 하트 +1, 안 쓴 힌트 +2 ---')
ok(scoreForWin({ level: 1, remainingAttempts: 5, hintsLeft: 0 }) === 15, 'L1 + 하트5 = 15')
ok(scoreForWin({ level: 1, remainingAttempts: 0, hintsLeft: 2 }) === 14, 'L1 + 힌트2 = 14 (2*2)')
ok(scoreForWin({ level: 3, remainingAttempts: 6, hintsLeft: 2 }) === 40, 'L3 + 하트6 + 힌트2 = 40')

console.log('\n--- 방어: 미지/누락 레벨 → 기본 0, 보너스만 ---')
ok(scoreForWin({ level: 99, remainingAttempts: 3, hintsLeft: 1 }) === 5, '미지 레벨 → 0 + 보너스(3+2)')
ok(scoreForWin({ level: undefined }) === 0, 'level 없음 → 0')
ok(scoreForWin({}) === 0, '빈 객체 → 0')
ok(scoreForWin() === 0, '인자 없음 → 0')

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
