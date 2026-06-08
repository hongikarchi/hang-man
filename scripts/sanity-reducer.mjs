/* 리듀서 헤드리스 검증 (AC4~AC9). 실행: node scripts/sanity-reducer.mjs */
import {
  reducer,
  makeInitialState,
  initRound,
} from '../src/hooks/useGame.js'

let pass = 0, fail = 0
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.error('  ✗ FAIL:', msg) }
}

// 헬퍼: letter 토큰 한 개의 정답 글자를 알아내 PLACE
const place = (s, index, letter) => reducer(s, { type: 'PLACE', blankIndex: index, letter })
const letterTokens = (s) => s.tokens.filter((t) => t.type === 'letter')

console.log('--- 라운드 초기화 (L2, 무료공개 없음) ---')
// L2 id 201: "The only limit..." — 무료공개 없음
let s = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
ok(s.gameState === 'PLAYING', 'PLAYING 상태')
ok(s.remainingAttempts === 7, 'L2 시도 7회')
ok(Array.isArray(s.revealLetters), 'revealLetters 배열')
// L2는 일부 글자 공개(난이도). 공개된 글자는 correct, 나머지는 empty.
ok(letterTokens(s).some((t) => t.status === 'empty'), '아직 풀 빈칸이 남아있음')
ok(
  letterTokens(s).filter((t) => t.isRevealed).every((t) => t.status === 'correct'),
  '공개된 글자는 시작부터 correct',
)

// 헬퍼: 공개 안 된(empty) 글자 토큰 중 하나 — AC 테스트는 미공개 글자로 해야 정확
const emptyTok = (st, letter) =>
  letterTokens(st).find((t) => t.status === 'empty' && (!letter || t.letter === letter))

console.log('\n--- 크립토그램 자동 채움: 한 번 정답이면 같은 글자 전부 채워짐 (구 AC4 반전) ---')
// 미공개 글자 중 2회 이상 등장하는 글자를 찾는다
const counts = {}
for (const t of letterTokens(s)) if (t.status === 'empty') counts[t.letter] = (counts[t.letter] || 0) + 1
const dupLetter = Object.keys(counts).find((l) => counts[l] >= 2)
ok(!!dupLetter, '미공개 글자 중 2회 이상 등장하는 글자 존재')
const dupToks = letterTokens(s).filter((t) => t.letter === dupLetter && t.status === 'empty')
let s2 = place(s, dupToks[0].index, dupLetter)
ok(s2.tokens.find((t) => t.index === dupToks[0].index).status === 'correct', '첫 글자 correct')
ok(s2.tokens.find((t) => t.index === dupToks[1].index).status === 'correct',
   '★ 같은 글자 둘째 위치도 자동 correct (크립토그램 방식)')
ok(letterTokens(s2).filter((t) => t.letter === dupLetter).every((t) => t.status === 'correct'),
   '★ 그 글자의 모든 위치가 한 번에 채워짐')

console.log('\n--- AC6/AC7: 오답 → 시도 감소, 0이면 LOSE ---')
const firstLetter = emptyTok(s)
const wrongLetter = firstLetter.letter === 'z' ? 'q' : 'z' // 문장에 없을 법한 글자
let sw = place(s, firstLetter.index, wrongLetter)
ok(sw.remainingAttempts === 6, 'AC6: 오답 시 시도 7→6')
ok(sw.tokens.find((t) => t.index === firstLetter.index).status === 'empty', '오답이면 빈칸 안 채워짐')
ok(sw.wrongEvent && sw.wrongEvent.index === firstLetter.index, 'wrongEvent.index 설정(빨강 트리거)')
// 같은 빈칸 연속 오답 → nonce 가 증가해야 함 (애니메이션 재발동용)
const sw2 = place(sw, firstLetter.index, wrongLetter)
ok(sw2.wrongEvent.nonce > sw.wrongEvent.nonce, '같은 빈칸 연속 오답 → nonce 증가(shake 재발동)')
// 시도 0까지 오답 반복
let sl = s
for (let i = 0; i < 7; i++) sl = place(sl, firstLetter.index, wrongLetter)
ok(sl.gameState === 'LOSE', 'AC7: 시도 0 → LOSE')
ok(sl.remainingAttempts === 0, '시도 0')

console.log('\n--- AC8: 전부 맞히면 WIN ---')
let win = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
for (const t of letterTokens(win)) {
  win = place(win, t.index, t.letter)
}
ok(win.gameState === 'WIN', 'AC8: 모든 빈칸 정답 → WIN')

console.log('\n--- 난이도: 레벨별 미리 공개 글자 수 ---')
let l1 = initRound(makeInitialState(), 1, { forceQuoteId: 101 }) // "Knowledge is power."
ok(l1.revealLetters.length >= 1, 'L1: 미리 공개 글자 1개 이상')
ok(l1.remainingAttempts === 8, 'L1 시도 8회')
const revealedTok = letterTokens(l1).filter((t) => t.isRevealed)
ok(revealedTok.length > 0 && revealedTok.every((t) => t.status === 'correct'),
   '공개 글자의 모든 위치가 correct로 시작')
// L1이 L3보다 더 많이 공개(쉬움)
let l3 = initRound(makeInitialState(), 3, { forceQuoteId: 301 })
ok(l3.revealLetters.length === 0, 'L3: 공개 없음(가장 어려움)')
ok(l1.revealLetters.length > l3.revealLetters.length, 'L1이 L3보다 더 많이 공개(난이도 차)')

console.log('\n--- 가드: 이미 correct/잠긴 빈칸 재배치 무시 ---')
let g = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
const lt = emptyTok(g) // 미공개 빈칸으로 테스트
g = place(g, lt.index, lt.letter) // correct
const before = g.remainingAttempts
g = place(g, lt.index, 'z') // 이미 correct → 무시되어야 함 (시도 안 깎임)
ok(g.remainingAttempts === before, '이미 correct인 빈칸 재배치는 시도 안 깎음')

console.log('\n--- SELECT_LETTER 토글 ---')
let sel = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
sel = reducer(sel, { type: 'SELECT_LETTER', letter: 'e' })
ok(sel.selectedLetter === 'e', '선택됨')
sel = reducer(sel, { type: 'SELECT_LETTER', letter: 'e' })
ok(sel.selectedLetter === null, '같은 글자 재선택 → 해제(토글)')

console.log('\n--- 양방향: 빈칸 우선 선택 → 글자 배치 ---')
let bf = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
const bTok = emptyTok(bf)
// 1) 빈칸 선택
bf = reducer(bf, { type: 'SELECT_BLANK', blankIndex: bTok.index })
ok(bf.selectedBlankIndex === bTok.index, '빈칸 선택됨')
ok(bf.selectedLetter === null, '빈칸 선택 시 글자 선택은 클리어(상호 배타)')
// 2) 상호 배타: 글자 선택하면 빈칸 선택 클리어
let mx = reducer(bf, { type: 'SELECT_LETTER', letter: bTok.letter })
ok(mx.selectedBlankIndex === null && mx.selectedLetter === bTok.letter, '글자 선택 시 빈칸 클리어')
// 3) 빈칸 선택 상태에서 PLACE → 채워지고 선택 클리어
let placed = place(bf, bf.selectedBlankIndex, bTok.letter)
ok(placed.tokens.find((t) => t.index === bTok.index).status === 'correct', '★ 빈칸 우선 → 글자 배치로 채워짐')
ok(placed.selectedBlankIndex === null && placed.selectedLetter === null, '배치 후 모든 선택 클리어')
// 4) 토글: 같은 빈칸 재선택 → 해제
let tg = reducer(bf, { type: 'SELECT_BLANK', blankIndex: bTok.index })
ok(tg.selectedBlankIndex === null, '같은 빈칸 재선택 → 해제(토글)')
// 5) 잠긴(correct) 빈칸은 선택 불가
const lockTok = letterTokens(placed).find((t) => t.status === 'correct')
let lk = reducer(placed, { type: 'SELECT_BLANK', blankIndex: lockTok.index })
ok(lk.selectedBlankIndex === null, '잠긴 빈칸은 선택 안 됨')

console.log('\n--- 레벨 진행: 같은 명언 연속 안 나옴 (소진 전까지) ---')
let prog = makeInitialState()
const seen = []
for (let i = 0; i < 10; i++) {
  prog = initRound(prog, 1)
  seen.push(prog.quote.id)
}
const uniqueSeen = new Set(seen)
ok(uniqueSeen.size === 10, `L1 10문제 모두 서로 다름 (소진 전): ${uniqueSeen.size}/10`)

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
