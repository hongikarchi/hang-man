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
// 3) 빈칸 선택 상태에서 PLACE → 채워지고 커서는 다음 칸으로 전진(글자 선택은 클리어)
let placed = place(bf, bf.selectedBlankIndex, bTok.letter)
ok(placed.tokens.find((t) => t.index === bTok.index).status === 'correct', '★ 빈칸 우선 → 글자 배치로 채워짐')
ok(placed.selectedLetter === null, '배치 후 글자 선택은 클리어')
// 고정 커서: 정답 배치 후 selectedBlankIndex 는 null 이 아니라 다음 미해결 칸(전진).
const stillOpen = letterTokens(placed).some((t) => t.status === 'empty')
ok(
  stillOpen
    ? placed.selectedBlankIndex != null &&
        placed.tokens.find((t) => t.index === placed.selectedBlankIndex)?.status === 'empty'
    : placed.selectedBlankIndex === null,
  '★ 배치 후 커서는 다음 미해결 칸으로 전진(남은 칸 없으면 null)',
)
// 4) 토글: 같은 빈칸 재선택 → 해제
let tg = reducer(bf, { type: 'SELECT_BLANK', blankIndex: bTok.index })
ok(tg.selectedBlankIndex === null, '같은 빈칸 재선택 → 해제(토글)')
// 5) 잠긴(correct) 빈칸은 선택 불가 → no-op(상태 불변, 그 칸이 커서가 되지 않음)
const lockTok = letterTokens(placed).find((t) => t.status === 'correct')
let lk = reducer(placed, { type: 'SELECT_BLANK', blankIndex: lockTok.index })
ok(lk === placed, '잠긴 빈칸 선택 → 상태 불변(no-op)')
ok(lk.selectedBlankIndex !== lockTok.index, '잠긴 빈칸은 커서가 되지 않음')

console.log('\n--- 레벨 진행: 같은 명언 연속 안 나옴 (소진 전까지) ---')
let prog = makeInitialState()
const seen = []
for (let i = 0; i < 10; i++) {
  prog = initRound(prog, 1)
  seen.push(prog.quote.id)
}
const uniqueSeen = new Set(seen)
ok(uniqueSeen.size === 10, `L1 10문제 모두 서로 다름 (소진 전): ${uniqueSeen.size}/10`)

console.log('\n--- 카테고리: SET_CATEGORY / BACK_TO_CATEGORIES / 진행 독립성 ---')
let cat = makeInitialState()
ok(cat.category === null, '초기 category=null (카테고리 선택 화면)')
cat = reducer(cat, { type: 'SET_CATEGORY', category: 'travel' })
ok(cat.category === 'travel' && cat.gameState === 'INIT', 'SET_CATEGORY → category 설정, INIT 유지')
const tr = initRound(cat, 1, { forceQuoteId: 1101 })
ok(tr.quote.id === 1101 && tr.category === 'travel', '여행 회화 풀에서 라운드 시작')
ok(typeof tr.quote.ko === 'string' && tr.quote.ko.length > 0, '여행 회화 quote.ko 존재')
ok(tr.quote.author === undefined, '여행 회화는 author 없음')
ok(tr.playedIds.travel[1].has(1101), 'travel playedIds 에 기록')
ok(!tr.playedIds.quotes[1].has(1101), 'quotes playedIds 와 독립')
const nx = reducer(tr, { type: 'NEXT_QUESTION' })
ok(nx.category === 'travel' && nx.quote.id >= 1100, 'NEXT_QUESTION → 같은 카테고리(travel) 유지')
const bl = reducer(tr, { type: 'BACK_TO_LEVELS' })
ok(bl.gameState === 'INIT' && bl.category === 'travel', 'BACK_TO_LEVELS → 카테고리 유지')
const bc = reducer(tr, { type: 'BACK_TO_CATEGORIES' })
ok(bc.gameState === 'INIT' && bc.category === null, 'BACK_TO_CATEGORIES → 카테고리 해제')
const rs = reducer(tr, { type: 'RESTART' })
ok(rs.quote.id === 1101 && rs.category === 'travel', 'RESTART → 같은 카테고리의 같은 문장')
const dq = initRound(makeInitialState(), 1, { forceQuoteId: 101 })
ok(dq.category === 'quotes' && typeof dq.quote.ko === 'string',
   '카테고리 미지정 → 기본(quotes) + ko 존재 (기존 테스트 호환)')

console.log('\n--- 힌트: USE_HINT ---')
ok(makeInitialState().hintsLeft === 0, 'INIT: hintsLeft 0')
let h = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
ok(h.hintsLeft === 2, '라운드 시작: 힌트 2개')
// 기대 글자: 미해결 중 최소 빈도(동률 알파벳순) — 리듀서와 동일 규칙으로 독립 계산
const hFreq = {}
for (const t of letterTokens(h)) if (t.status === 'empty') hFreq[t.letter] = (hFreq[t.letter] || 0) + 1
const expected = Object.keys(hFreq).sort((a, b) => hFreq[a] - hFreq[b] || (a < b ? -1 : 1))[0]
const h1 = reducer(h, { type: 'USE_HINT' })
ok(h1.hintsLeft === 1, '힌트 사용 → 1 감소')
ok(letterTokens(h1).filter((t) => t.letter === expected).every((t) => t.status === 'correct' && t.isRevealed),
   `★ 최소 빈도 글자(${expected}) 전 위치 공개 + isRevealed`)
const newlySolved = Object.keys(hFreq).filter((l) =>
  letterTokens(h1).filter((t) => t.letter === l).every((t) => t.status === 'correct'))
ok(newlySolved.length === 1, '정확히 글자 1종만 공개됨')
ok(h1.remainingAttempts === h.remainingAttempts, '힌트는 하트를 소모하지 않음')
ok(h1.revealLetters.includes(expected), 'revealLetters 에 추가(불변식 유지)')
// 선택/오답 플래시 클리어
let hSel = reducer(h, { type: 'SELECT_LETTER', letter: expected })
hSel = reducer(hSel, { type: 'USE_HINT' })
ok(hSel.selectedLetter === null && hSel.selectedBlankIndex === null, '힌트 사용 시 선택 해제')
const someEmpty = emptyTok(h)
let hWrong = place(h, someEmpty.index, someEmpty.letter === 'z' ? 'q' : 'z')
hWrong = reducer(hWrong, { type: 'USE_HINT' })
ok(hWrong.wrongEvent === null, '힌트 사용 시 오답 플래시 클리어')
// 소진 가드 + 동일 참조
const h2 = reducer(h1, { type: 'USE_HINT' })
ok(h2.hintsLeft === 0, '두 번째 힌트 → 0')
ok(reducer(h2, { type: 'USE_HINT' }) === h2, '힌트 0개면 무시(동일 참조)')
// 마지막 글자를 힌트로 → WIN
let hw = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
const unsolvedSpecies = [...new Set(letterTokens(hw).filter((t) => t.status === 'empty').map((t) => t.letter))]
for (const l of unsolvedSpecies.slice(0, -1)) hw = place(hw, letterTokens(hw).find((t) => t.letter === l).index, l)
ok(hw.gameState === 'PLAYING', '마지막 1종 남음 — 아직 PLAYING')
hw = reducer(hw, { type: 'USE_HINT' })
ok(hw.gameState === 'WIN', '★ 마지막 글자 힌트 공개 → WIN')
ok(reducer(hw, { type: 'USE_HINT' }) === hw, 'WIN 상태에서 힌트 무시')
// 라운드 전환 시 리셋
ok(reducer(h2, { type: 'NEXT_QUESTION' }).hintsLeft === 2, 'NEXT_QUESTION → 힌트 리셋')
ok(reducer(h2, { type: 'RESTART' }).hintsLeft === 2, 'RESTART → 힌트 리셋')

// --- 마지막 힌트 글자 강조 (lastHintLetter) ---
// ① set: 힌트 사용 → 그 글자가 lastHintLetter
ok(makeInitialState().lastHintLetter === null, 'INIT: lastHintLetter null')
let lh = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
ok(lh.lastHintLetter === null, '라운드 시작: lastHintLetter null')
const lh1 = reducer(lh, { type: 'USE_HINT' })
ok(lh1.lastHintLetter === expected, `★ 힌트 사용 → lastHintLetter = 공개 글자(${expected})`)
// ② overwrite: 두 번째 힌트 → 새 글자로 덮어씀(append 아님)
const lh2 = reducer(lh1, { type: 'USE_HINT' })
ok(lh2.lastHintLetter !== null && lh2.lastHintLetter !== expected,
   `★ 두 번째 힌트 → lastHintLetter 가 새 글자로 덮어써짐(${lh2.lastHintLetter})`)
// ③ clear-on-correct-PLACE: 다른(미해결) 글자를 정답 배치 → 강조 해제
const lhFresh = reducer(initRound(makeInitialState(), 2, { forceQuoteId: 201 }), { type: 'USE_HINT' })
const otherEmpty = letterTokens(lhFresh).find((t) => t.status === 'empty' && t.letter !== lhFresh.lastHintLetter)
const lhPlaced = place(lhFresh, otherEmpty.index, otherEmpty.letter)
ok(lhPlaced.lastHintLetter === null, '★ 다른 글자 정답 배치 → lastHintLetter 해제')
// ④ preserve-on-wrong-PLACE: 오답 배치는 강조 유지(아무것도 안 채우므로)
const lhWrongTok = letterTokens(lhFresh).find((t) => t.status === 'empty')
const lhWrongGuess = lhWrongTok.letter === 'z' ? 'q' : 'z'
const lhWrong = place(lhFresh, lhWrongTok.index, lhWrongGuess)
ok(lhWrong.remainingAttempts === lhFresh.remainingAttempts - 1, '오답 → 하트 감소(전제 확인)')
ok(lhWrong.lastHintLetter === lhFresh.lastHintLetter, '★ 오답 배치 → lastHintLetter 유지')
// ⑤ round-reset: 강조가 다음 라운드로 새지 않음
ok(reducer(lh1, { type: 'NEXT_QUESTION' }).lastHintLetter === null, 'NEXT_QUESTION → lastHintLetter 리셋')
ok(reducer(lh1, { type: 'RESTART' }).lastHintLetter === null, 'RESTART → lastHintLetter 리셋')

console.log('\n--- 뜻 보기: REVEAL_MEANING (힌트 1 소모) ---')
let m = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
ok(m.meaningRevealed === false, '라운드 시작: 뜻 숨김')
ok(makeInitialState().meaningRevealed === false, 'INIT: 뜻 숨김')
const blanksBefore = m.tokens.filter((t) => t.type === 'letter' && t.status !== 'correct').length
const m1 = reducer(m, { type: 'REVEAL_MEANING' })
ok(m1.meaningRevealed === true, '뜻 보기 → 공개됨')
ok(m1.hintsLeft === 1, '뜻 보기 → 힌트 1 소모')
ok(m1.remainingAttempts === m.remainingAttempts, '뜻 보기는 하트 미소모')
const blanksAfter = m1.tokens.filter((t) => t.type === 'letter' && t.status !== 'correct').length
ok(blanksAfter === blanksBefore && m1.gameState === 'PLAYING',
   '★ 뜻 보기는 토큰 불변(글자 안 채움) — WIN 유발 불가')
ok(reducer(m1, { type: 'REVEAL_MEANING' }) === m1, '이미 공개됐으면 멱등(동일 참조, 힌트 추가 소모 안 함)')
// 힌트 0이면 뜻 보기 불가
let mz = reducer(reducer(m, { type: 'USE_HINT' }), { type: 'USE_HINT' })
ok(mz.hintsLeft === 0, '힌트 2개 모두 글자에 사용 → 0')
ok(reducer(mz, { type: 'REVEAL_MEANING' }) === mz, '힌트 0개면 뜻 보기 무시(동일 참조)')
// WIN/INIT 상태 가드
const mWin = { ...m1, gameState: 'WIN', meaningRevealed: false, hintsLeft: 2 }
ok(reducer(mWin, { type: 'REVEAL_MEANING' }) === mWin, 'PLAYING 아니면 뜻 보기 무시')
// 글자 힌트와 뜻 보기는 같은 풀을 공유
let mm = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
mm = reducer(mm, { type: 'REVEAL_MEANING' }) // 1 소모
mm = reducer(mm, { type: 'USE_HINT' }) // 1 소모
ok(mm.hintsLeft === 0 && mm.meaningRevealed === true, '뜻 보기+글자 힌트가 힌트 풀 공유(2→0)')
// 라운드 전환 시 리셋
ok(reducer(m1, { type: 'NEXT_QUESTION' }).meaningRevealed === false, 'NEXT_QUESTION → 뜻 숨김 리셋')
ok(reducer(m1, { type: 'RESTART' }).meaningRevealed === false, 'RESTART → 뜻 숨김 리셋')

console.log('\n--- 고정 커서 + 자동 이동 (주루룩 입력) ---')
{
  // 라운드 시작엔 커서 없음 — 사용자가 먼저 첫 빈칸을 탭해 커서를 놓는다(사용자 설계).
  let c = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  ok(c.selectedBlankIndex === null, '라운드 시작 → 커서 없음(사용자가 첫 빈칸을 탭)')
  const firstOpen = letterTokens(c).find((t) => t.status === 'empty')
  c = reducer(c, { type: 'SELECT_BLANK', blankIndex: firstOpen.index })
  ok(c.selectedBlankIndex === firstOpen.index, '첫 빈칸 탭 → 커서가 그 칸에 놓임')

  // 정답 배치 → 커서가 "다음" 미해결 빈칸으로 전진(reading order). 방금 채운 칸은 건너뜀.
  const placedLetter = firstOpen.letter
  const c2 = place(c, c.selectedBlankIndex, placedLetter)
  // 방금 채운 글자(같은 글자 전부 correct)를 제외한, index 가 가장 작은 미해결 칸이 새 커서.
  const expectedNext = letterTokens(c2)
    .filter((t) => t.status === 'empty')
    .map((t) => t.index)
    .sort((a, b) => a - b)[0]
  ok(c2.selectedBlankIndex === expectedNext,
     `★ 정답 배치 → 커서가 다음 미해결 빈칸(index ${expectedNext})으로 자동 전진`)
  ok(c2.selectedLetter === null, '자동 전진 시 글자 선택은 비움(상호 배타 유지)')
  // 전진한 커서 칸은 절대 이미 채워진 칸이 아니다(방금 채운 칸 건너뜀).
  ok(c2.tokens.find((t) => t.index === c2.selectedBlankIndex).status === 'empty',
     '새 커서는 항상 미해결(empty) 빈칸 — 채워진 칸으로 가지 않음')

  // "주루룩": 커서를 한 번 놓은 뒤엔 카드만 연달아 놓아도 계속 채워진다.
  // (UI 의 onTapCard 가 selectedBlankIndex 로 PLACE 하는 흐름을 리듀서 수준에서 재현.)
  let streak = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  const streakFirst = letterTokens(streak).find((t) => t.status === 'empty')
  streak = reducer(streak, { type: 'SELECT_BLANK', blankIndex: streakFirst.index }) // 사용자가 커서 한 번 놓음
  let placements = 0
  let guard = 0
  while (streak.gameState === 'PLAYING' && guard++ < 200) {
    const cur = streak.tokens.find((t) => t.index === streak.selectedBlankIndex)
    if (!cur) break // 커서 없음(이론상 WIN 직전)
    streak = place(streak, streak.selectedBlankIndex, cur.letter) // 항상 그 칸의 정답을 놓음
    placements++
  }
  ok(streak.gameState === 'WIN',
     `★ 커서 한 번 놓고 카드만 연달아 → WIN (${placements}회 배치)`)

  // 오답 → 커서는 같은 칸에 유지(바로 다른 카드로 재시도 가능), 하트 -1.
  let w = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  const wTok = letterTokens(w).find((t) => t.status === 'empty')
  // 커서를 그 칸으로 둔 뒤 오답
  w = reducer(w, { type: 'SELECT_BLANK', blankIndex: wTok.index })
  const wrongL = wTok.letter === 'z' ? 'q' : 'z'
  const wAfter = place(w, wTok.index, wrongL)
  ok(wAfter.remainingAttempts === w.remainingAttempts - 1, '오답 → 하트 -1(전제)')
  ok(wAfter.selectedBlankIndex === wTok.index,
     '★ 오답 → 커서가 같은 칸에 유지(재시도 흐름)')
  ok(wAfter.selectedLetter === null, '오답 → 글자 선택은 비움')

  // 손 우선: 자동 이동 중에도 다른 빈칸을 탭하면 커서가 그쪽으로 점프.
  let j = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  const opens = letterTokens(j).filter((t) => t.status === 'empty').map((t) => t.index)
  const jumpTo = opens[opens.length - 1] // 일부러 뒤쪽 칸으로
  j = reducer(j, { type: 'SELECT_BLANK', blankIndex: jumpTo })
  ok(j.selectedBlankIndex === jumpTo, '★ 다른 빈칸 탭 → 커서가 그 칸으로 점프(손 우선)')

  // wrap: 마지막(가장 뒤) 빈칸에 정답을 놓으면 커서가 맨 앞 미해결 칸으로 돌아온다.
  let wr = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  const lastOpen = letterTokens(wr)
    .filter((t) => t.status === 'empty')
    .map((t) => t.index)
    .sort((a, b) => a - b)
    .at(-1)
  // 가장 뒤 칸의 정답 글자
  const lastLetter = wr.tokens.find((t) => t.index === lastOpen).letter
  const wr2 = place(wr, lastOpen, lastLetter)
  if (wr2.gameState === 'PLAYING') {
    const remainingIdx = letterTokens(wr2)
      .filter((t) => t.status === 'empty')
      .map((t) => t.index)
      .sort((a, b) => a - b)
    // 뒤쪽엔 더 없으니 맨 앞으로 wrap → 남은 칸 중 최소 index
    ok(wr2.selectedBlankIndex === remainingIdx[0],
       `★ 마지막 칸 채움 → 커서가 맨 앞 미해결 칸(index ${remainingIdx[0]})으로 wrap`)
  } else {
    ok(wr2.selectedBlankIndex === null, '마지막 칸이 곧 WIN 이면 커서 없음(null)')
  }

  // LOSE → 커서 해제(게임 종료).
  let lz = initRound(makeInitialState(), 2, { forceQuoteId: 201 })
  const lzTok = letterTokens(lz).find((t) => t.status === 'empty')
  const lzWrong = lzTok.letter === 'z' ? 'q' : 'z'
  for (let i = 0; i < 7; i++) lz = place(lz, lzTok.index, lzWrong)
  ok(lz.gameState === 'LOSE', 'LOSE 도달(전제)')
  ok(lz.selectedBlankIndex === null, '★ LOSE → 커서 해제(null)')
}

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
