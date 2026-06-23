/* =========================================================================
   useGame.js — 게임 상태(두뇌). useReducer + 파생값(useMemo).
   상태는 "위치 단위"(tokens) — 각 빈칸이 독립적이다(AC4).
   ========================================================================= */

import { useReducer, useMemo, useCallback } from 'react'
import { CATEGORIES, DEFAULT_CATEGORY, getCategory } from '../data/categories.js'
import { buildCipherMap } from '../lib/cipher.js'
import { tokenize } from '../lib/tokenize.js'
import {
  pickQuote,
  pickRevealLetters,
  revealCountForLevel,
  ATTEMPTS_BY_LEVEL,
  HINTS_PER_ROUND,
} from '../lib/quotePicker.js'

/** 초기 상태: 아직 레벨 선택 전(INIT). */
function makeInitialState() {
  return {
    gameState: 'INIT', // 'INIT' | 'PLAYING' | 'WIN' | 'LOSE'
    level: null,
    quote: null,
    cipherMap: {},
    tokens: [],
    remainingAttempts: 0,
    selectedLetter: null, // 탭-투-플레이스: 선택된 글자 (글자 우선)
    selectedBlankIndex: null, // 탭-투-플레이스: 선택된 빈칸 (빈칸 우선). 둘은 상호 배타.
    // 방금 오답 배치된 빈칸 (빨강/흔들림 트리거).
    // nonce 는 단조 증가 — 같은 빈칸에 연속 오답해도 값이 바뀌어 애니메이션이 재발동된다.
    wrongEvent: null, // { index: number, nonce: number } | null
    wrongNonce: 0, // 단조 증가 카운터
    hintsLeft: 0, // 남은 힌트 (라운드마다 HINTS_PER_ROUND 로 리셋)
    meaningRevealed: false, // 한글 뜻 공개 여부 (힌트 1 소모, 라운드마다 리셋)
    // 마지막 힌트로 공개한 글자 (어느 알파벳이 방금 채워졌는지 강조 표시).
    // 다른 글자를 새로 채우면(정답 배치 또는 다음 힌트) 해제. null = 강조 없음.
    lastHintLetter: null,
    revealLetters: [], // 미리 공개된 글자들 (난이도)
    category: null, // 선택된 카테고리 id (null = 카테고리 선택 화면)
    // 카테고리→레벨별 "현재 사이클에" 플레이한 문장 id 집합 (진행 추적).
    playedIds: Object.fromEntries(
      CATEGORIES.map((c) => [c.id, { 1: new Set(), 2: new Set(), 3: new Set() }]),
    ),
    // 카테고리→레벨별 사이클 번호. 한 레벨의 문제를 전부 풀어 소진되면 +1 되고
    // playedIds 가 비워진다. 서버 동기화(union)는 "현재 사이클"의 기록만 합쳐
    // 소진-리셋 후에도 "한 사이클 안에서는 중복 없음"이 유지되게 한다.
    cycles: Object.fromEntries(
      CATEGORIES.map((c) => [c.id, { 1: 0, 2: 0, 3: 0 }]),
    ),
  }
}

/**
 * 한 라운드를 초기화한다 (명언 선택 → 암호 → 토큰화 → 시도 설정).
 * @param {object} state 현재 상태 (playedIds 진행 유지)
 * @param {1|2|3} level
 * @param {object} [opts]
 * @param {number} [opts.forceQuoteId] 특정 명언 강제 (테스트/디버그)
 */
function initRound(state, level, opts = {}) {
  // 카테고리 미선택(헤드리스 테스트 등)이면 기본 카테고리로 동작.
  const catId = state.category ?? DEFAULT_CATEGORY
  const pool = getCategory(catId).data

  // playedIds 사본 (불변성) — 활성 카테고리만 깊은 복사
  const playedIds = {
    ...state.playedIds,
    [catId]: {
      1: new Set(state.playedIds[catId][1]),
      2: new Set(state.playedIds[catId][2]),
      3: new Set(state.playedIds[catId][3]),
    },
  }
  // cycles 사본 (불변성) — 소진 시 해당 레벨만 +1
  const cycles = {
    ...state.cycles,
    [catId]: { ...state.cycles[catId] },
  }

  let quote
  if (opts.forceQuoteId != null) {
    quote = pool.find((q) => q.id === opts.forceQuoteId)
    if (!quote) throw new Error(`문장 id ${opts.forceQuoteId} 없음 (카테고리 ${catId})`)
  } else {
    const { quote: picked, resetPlayed } = pickQuote(pool, level, playedIds[catId][level])
    if (resetPlayed) {
      // 레벨 소진 → 새 사이클 시작: 기록 비우고 사이클 번호 +1.
      // (서버 union 이 이전 사이클 기록을 다시 끌어오지 않도록 cycle 로 분리.)
      playedIds[catId][level] = new Set()
      cycles[catId][level] = cycles[catId][level] + 1
    }
    quote = picked
  }
  playedIds[catId][level].add(quote.id)

  const cipherMap = buildCipherMap(quote.text)
  // 난이도 = 미리 공개 글자 수. L1 약 절반 / L2 약 1/4 / L3 0개.
  const revealCount = revealCountForLevel(quote.text, level)
  const revealLetters = pickRevealLetters(quote.text, revealCount)
  const tokens = tokenize(quote.text, cipherMap, revealLetters)

  return {
    ...state,
    gameState: 'PLAYING',
    category: catId,
    level,
    quote,
    cipherMap,
    tokens,
    remainingAttempts: ATTEMPTS_BY_LEVEL[level],
    hintsLeft: HINTS_PER_ROUND,
    meaningRevealed: false,
    lastHintLetter: null,
    selectedLetter: null,
    // 라운드 시작엔 커서 없음 — 사용자가 첫 빈칸을 탭해 "커서를 놓고", 그 뒤부터
    // 카드만 연달아 탭하면 커서가 자동 전진하며 주루룩 채워진다(반복 탭 제거가 핵심).
    selectedBlankIndex: null,
    wrongEvent: null,
    // wrongNonce 는 라운드 넘어가도 단조 증가 유지(리셋 안 함) — 항상 새 값 보장.
    revealLetters,
    playedIds,
    cycles,
  }
}

/** 모든 letter 토큰이 correct 인가? (승리 조건, AC8) */
function isAllCorrect(tokens) {
  return tokens.every((t) => t.type !== 'letter' || t.status === 'correct')
}

/**
 * 외부(저장된 진행)에서 들어온 played 기록을 현재 상태에 병합한다.
 * localStorage 복원(시작 시)과 서버 동기화(닉네임 로그인 후) 둘 다 이 함수로 수렴.
 *
 * 병합 규칙 (사이클 기준):
 *  - 들어온 cycle > 현재 cycle  → 더 진행된 사이클. 그 레벨을 들어온 값으로 교체(채택).
 *  - 들어온 cycle === 현재 cycle → 같은 사이클. id 합집합(union).
 *  - 들어온 cycle < 현재 cycle  → 오래된 기록. 무시.
 * 이렇게 해야 "소진→리셋(cycle++)" 후에도 이전 사이클 기록이 다시 끌려와 즉시
 * 재소진되는 일이 없다(= 한 사이클 내 중복 없음 보장).
 *
 * @param {object} state
 * @param {Record<string, Record<number, {ids:number[], cycle:number}>>} incoming
 *   카테고리→레벨→{ids, cycle}. 일부만 있어도 됨(있는 항목만 병합).
 * @returns {object} 새 state (playedIds/cycles 갱신). 변화 없으면 동일 참조.
 */
function mergeProgress(state, incoming) {
  if (!incoming || typeof incoming !== 'object') return state
  let changed = false
  const playedIds = { ...state.playedIds }
  const cycles = { ...state.cycles }

  for (const catId of Object.keys(incoming)) {
    // 알 수 없는 카테고리(데이터 변경 등)는 건너뜀 — 방어
    if (!state.playedIds[catId] || !state.cycles[catId]) continue
    const catIn = incoming[catId]
    if (!catIn || typeof catIn !== 'object') continue

    let catPlayed = null // 이 카테고리에서 변경 시에만 사본 생성(불필요 복사 방지)
    let catCycles = null

    for (const lvlKey of Object.keys(catIn)) {
      const level = Number(lvlKey)
      if (![1, 2, 3].includes(level)) continue
      const entry = catIn[lvlKey]
      if (!entry || typeof entry !== 'object') continue
      const inCycle = Number(entry.cycle) || 0
      const inIds = Array.isArray(entry.ids)
        ? entry.ids.map(Number).filter(Number.isFinite)
        : []
      const curCycle = state.cycles[catId][level]
      const curSet = state.playedIds[catId][level]

      if (inCycle < curCycle) continue // 오래된 기록 무시

      if (inCycle > curCycle) {
        // 더 진행된 사이클 채택 — id 교체 + 사이클 올림
        if (!catPlayed) catPlayed = { ...state.playedIds[catId] }
        if (!catCycles) catCycles = { ...state.cycles[catId] }
        catPlayed[level] = new Set(inIds)
        catCycles[level] = inCycle
        changed = true
      } else {
        // 같은 사이클 — 합집합. 새로 추가되는 id 가 있을 때만 갱신.
        const merged = new Set(curSet)
        let added = false
        for (const id of inIds) if (!merged.has(id)) { merged.add(id); added = true }
        if (added) {
          if (!catPlayed) catPlayed = { ...state.playedIds[catId] }
          catPlayed[level] = merged
          changed = true
        }
      }
    }

    if (catPlayed) playedIds[catId] = catPlayed
    if (catCycles) cycles[catId] = catCycles
  }

  if (!changed) return state // 멱등 — 동일 참조 반환(불필요 리렌더 방지)
  return { ...state, playedIds, cycles }
}

/**
 * 다음 미해결 빈칸의 index 를 reading order(= token.index 오름차순)로 찾는다.
 * "고정 커서 + 자동 이동": 정답 배치 후 커서를 옆 칸으로 자동 전진시켜
 * "빈칸 한 번 누르고 카드를 연달아 누르면 주루룩 채워지는" 흐름을 만든다.
 *
 * @param {Token[]} tokens
 * @param {number} from 직전에 배치한 빈칸 index (이 칸 "다음"부터 탐색)
 * @returns {number|null} 다음 미해결 빈칸 index. 뒤쪽에 없으면 맨 앞으로 wrap.
 *                        남은 빈칸이 하나도 없으면 null (WIN 직전이라 커서 불필요).
 *
 * token.index 는 원문 문자열 위치라 tokenize/groupIntoWords 모두에서 단조 증가 →
 * 정렬 없이 "index > from 중 최소"가 곧 화면상 다음 칸이다. wrap 은 처음부터 최소.
 */
function nextUnsolved(tokens, from) {
  const open = tokens.filter((t) => t.type === 'letter' && t.status !== 'correct')
  if (open.length === 0) return null
  // from 다음에 오는 첫 미해결 칸
  const ahead = open.find((t) => t.index > from)
  if (ahead) return ahead.index
  // 뒤쪽에 없으면 맨 앞으로 한 바퀴 (사용자 결정: 끝 도달 시 첫 빈칸으로 wrap)
  return open[0].index
}

/**
 * 힌트로 공개할 글자: 미해결 글자 중 등장 빈도 최소(동률은 알파벳순).
 * 빈도 높은 글자는 암호 반복 패턴으로 스스로 추론하기 쉽고 사전공개와도 중복 —
 * 힌트는 단서가 가장 적은(틀리면 하트만 잃는) 희귀 글자를 풀어준다. 결정적이라 테스트 용이.
 */
function pickHintLetter(tokens) {
  const freq = {}
  for (const t of tokens) {
    if (t.type === 'letter' && t.status !== 'correct') freq[t.letter] = (freq[t.letter] || 0) + 1
  }
  const letters = Object.keys(freq)
  if (letters.length === 0) return null
  letters.sort((a, b) => freq[a] - freq[b] || (a < b ? -1 : 1))
  return letters[0]
}

/**
 * 현재 진행을 저장/전송용 평면 형식으로 직렬화한다.
 * { [catId]: { 1:{ids,cycle}, 2:{ids,cycle}, 3:{ids,cycle} } }
 * (Set → 배열). localStorage 저장과 서버 POST(닉네임 동기화) 둘 다 이 형식을 쓴다.
 * @param {object} state
 */
function serializeProgress(state) {
  const out = {}
  for (const catId of Object.keys(state.playedIds)) {
    out[catId] = {}
    for (const level of [1, 2, 3]) {
      out[catId][level] = {
        ids: [...state.playedIds[catId][level]],
        cycle: state.cycles[catId][level],
      }
    }
  }
  return out
}

// reducer/헬퍼는 헤드리스 테스트를 위해 export (UI 없이 검증 가능).
export { makeInitialState, initRound, isAllCorrect, mergeProgress, serializeProgress }

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_LEVEL': // 레벨 선택 → 첫 라운드 시작
    case 'INIT_ROUND':
      return initRound(state, action.level, action.opts)

    case 'NEXT_QUESTION': // 같은 레벨 다음 문제
      return initRound(state, state.level)

    case 'RESTART': // 같은 명언 다시
      return initRound(
        { ...state, playedIds: { ...state.playedIds } },
        state.level,
        { forceQuoteId: state.quote.id },
      )

    case 'HYDRATE_PLAYED':
      // 저장된/서버 진행을 병합 (localStorage 복원 + 닉네임 동기화 둘 다).
      // 멱등 — 새 정보 없으면 동일 참조라 리렌더/재저장 루프 안 생김.
      return mergeProgress(state, action.progress)

    case 'SET_CATEGORY': // 카테고리 선택 → 레벨 선택 화면 (INIT 유지)
      return { ...state, category: action.category }

    case 'BACK_TO_CATEGORIES':
      return { ...state, gameState: 'INIT', category: null, quote: null, tokens: [] }

    case 'BACK_TO_LEVELS': // 카테고리는 유지 — 같은 카테고리의 레벨 목록으로
      return { ...state, gameState: 'INIT', quote: null, tokens: [] }

    case 'SELECT_LETTER': {
      if (state.gameState !== 'PLAYING') return state
      const { letter } = action
      // 토글: 같은 글자 다시 누르면 해제. 빈칸 선택은 항상 클리어(상호 배타 불변식).
      const next = state.selectedLetter === letter ? null : letter
      return { ...state, selectedLetter: next, selectedBlankIndex: null }
    }

    case 'SELECT_BLANK': {
      if (state.gameState !== 'PLAYING') return state
      const { blankIndex } = action
      const token = state.tokens.find((t) => t.index === blankIndex)
      // 빈 글자칸만 선택 가능(잠긴/공백/구두점 무시)
      if (!token || token.type !== 'letter' || token.status === 'correct') return state
      // 토글. 글자 선택은 항상 클리어(상호 배타 불변식).
      const next = state.selectedBlankIndex === blankIndex ? null : blankIndex
      return { ...state, selectedBlankIndex: next, selectedLetter: null }
    }

    case 'CLEAR_WRONG':
      // nonce 가 주어지면 그 이벤트가 아직 최신일 때만 클리어(오래된 타임아웃이
      // 새 오답 플래시를 조기에 지우는 것을 방지).
      if (state.wrongEvent == null) return state
      if (action.nonce != null && action.nonce !== state.wrongEvent.nonce) return state
      return { ...state, wrongEvent: null }

    case 'USE_HINT': {
      if (state.gameState !== 'PLAYING' || state.hintsLeft <= 0) return state
      const letter = pickHintLetter(state.tokens)
      if (!letter) return state // 방어: PLAYING이면 항상 존재
      // 사전공개와 동일 메커니즘: 그 글자의 모든 위치 correct + isRevealed(인디고 타일)
      const tokens = state.tokens.map((t) =>
        t.letter === letter ? { ...t, status: 'correct', isRevealed: true } : t,
      )
      return {
        ...state,
        tokens,
        hintsLeft: state.hintsLeft - 1,
        revealLetters: [...state.revealLetters, letter], // isRevealed ⊆ revealLetters 불변식 유지
        lastHintLetter: letter, // 이 글자를 강조 (다음 힌트는 덮어쓰고, 다른 글자 정답 배치는 해제)
        selectedLetter: null,
        selectedBlankIndex: null,
        wrongEvent: null,
        gameState: isAllCorrect(tokens) ? 'WIN' : 'PLAYING',
      }
    }

    case 'REVEAL_MEANING': {
      // 한글 뜻 공개 = 힌트 1 소모(글자 힌트와 같은 풀). 토큰은 건드리지 않음 →
      // WIN 유발 불가. 이미 공개됐거나 힌트 0이면 멱등(동일 참조).
      if (state.gameState !== 'PLAYING') return state
      if (state.meaningRevealed || state.hintsLeft <= 0) return state
      return { ...state, meaningRevealed: true, hintsLeft: state.hintsLeft - 1 }
    }

    case 'PLACE': {
      if (state.gameState !== 'PLAYING') return state
      const { blankIndex, letter } = action
      if (letter == null) return state // 선택된 글자 없음

      const token = state.tokens.find((t) => t.index === blankIndex)
      // 가드: letter 토큰이 아니거나 이미 correct면 무시
      if (!token || token.type !== 'letter' || token.status === 'correct') {
        return state
      }

      if (letter === token.letter) {
        // 정답: 같은 글자의 모든 위치를 한 번에 채운다 (크립토그램 방식).
        // 사용자 결정으로 스펙 AC4(자동공개 안 함)를 의도적으로 뒤집음 —
        // "3=A"를 정하면 모든 '3' 칸이 A로 채워져 노가다를 없앤다.
        // (t.letter는 space/punct면 null이라 영향 없음, 이미 correct면 멱등)
        const tokens = state.tokens.map((t) =>
          t.letter === token.letter ? { ...t, status: 'correct' } : t,
        )
        const won = isAllCorrect(tokens)
        // 고정 커서 자동 전진: 정답이면 커서를 다음 미해결 빈칸으로 옮겨,
        // 카드만 연달아 눌러도 주루룩 채워지게 한다. (won 이면 커서 불필요 → null)
        // 방금 채워진 같은-글자 칸들은 tokens(=갱신본)을 스캔하므로 자연히 건너뛴다.
        const nextCursor = won ? null : nextUnsolved(tokens, blankIndex)
        return {
          ...state,
          tokens,
          // 사용자가 다른 글자를 새로 채움 → 힌트 강조 해제("다른 알파벳을 새로 채우기 전까지").
          // 오답 분기는 아무것도 안 채우므로 강조를 유지한다(여기서만 해제).
          lastHintLetter: null,
          selectedLetter: null,
          // 글자 선택은 항상 비우고(상호 배타), 빈칸 커서만 다음 칸으로 전진.
          selectedBlankIndex: nextCursor,
          wrongEvent: null,
          gameState: won ? 'WIN' : 'PLAYING',
        }
      }

      // 오답 (AC6): 채우지 않음. 시도 -1, 빨강 트리거.
      const remainingAttempts = state.remainingAttempts - 1
      const lost = remainingAttempts <= 0 // AC7
      const nonce = state.wrongNonce + 1
      return {
        ...state,
        remainingAttempts,
        selectedLetter: null,
        // 고정 커서: 오답이면 같은 칸에 커서를 유지해 바로 다른 카드로 재시도 가능.
        // (LOSE 면 게임 종료라 커서 해제.)
        selectedBlankIndex: lost ? null : blankIndex,
        wrongEvent: { index: blankIndex, nonce },
        wrongNonce: nonce,
        gameState: lost ? 'LOSE' : 'PLAYING',
      }
    }

    default:
      return state
  }
}

/**
 * 게임 훅. 상태 + 파생값 + 액션 디스패처를 반환.
 */
export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)

  // ---- 파생값 (저장하지 않고 tokens 에서 계산) ----

  // 표시할 카드 = 문장에 등장하는 고유 글자 (AC3). 정렬해 안정적 순서.
  const cards = useMemo(() => {
    const set = new Set()
    for (const t of state.tokens) if (t.type === 'letter') set.add(t.letter)
    return [...set].sort()
  }, [state.tokens])

  // 각 글자별: 총 등장 수 / 맞힌 수. 카드 회색 판정(AC5)에 사용.
  const letterProgress = useMemo(() => {
    const total = {}
    const done = {}
    for (const t of state.tokens) {
      if (t.type !== 'letter') continue
      total[t.letter] = (total[t.letter] || 0) + 1
      if (t.status === 'correct') done[t.letter] = (done[t.letter] || 0) + 1
    }
    const result = {}
    for (const letter of cards) {
      const tot = total[letter] || 0
      const dn = done[letter] || 0
      result[letter] = { total: tot, done: dn, complete: tot > 0 && dn === tot }
    }
    return result
  }, [state.tokens, cards])

  // 채워야 할 남은 빈칸 수 (진행 표시용)
  const remainingBlanks = useMemo(
    () => state.tokens.filter((t) => t.type === 'letter' && t.status !== 'correct').length,
    [state.tokens],
  )

  // ---- 액션 (안정적 참조) ----
  const selectCategory = useCallback(
    (category) => dispatch({ type: 'SET_CATEGORY', category }),
    [],
  )
  const backToCategories = useCallback(() => dispatch({ type: 'BACK_TO_CATEGORIES' }), [])
  const selectLevel = useCallback((level) => {
    let opts
    // DEV 전용: ?quote=<id> 로 특정 문장 강제(레이아웃/E2E 검증용). 프로덕션에서 제거됨.
    if (import.meta.env.DEV) {
      const q = Number(new URLSearchParams(window.location.search).get('quote'))
      if (q) opts = { forceQuoteId: q }
    }
    dispatch({ type: 'SET_LEVEL', level, opts })
  }, [])
  const selectLetter = useCallback((letter) => dispatch({ type: 'SELECT_LETTER', letter }), [])
  const selectBlank = useCallback((blankIndex) => dispatch({ type: 'SELECT_BLANK', blankIndex }), [])
  const placeLetter = useCallback(
    (blankIndex, letter) => dispatch({ type: 'PLACE', blankIndex, letter }),
    [],
  )
  const clearWrong = useCallback((nonce) => dispatch({ type: 'CLEAR_WRONG', nonce }), [])
  const requestHint = useCallback(() => dispatch({ type: 'USE_HINT' }), [])
  const revealMeaning = useCallback(() => dispatch({ type: 'REVEAL_MEANING' }), [])
  const nextQuestion = useCallback(() => dispatch({ type: 'NEXT_QUESTION' }), [])
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [])
  const backToLevels = useCallback(() => dispatch({ type: 'BACK_TO_LEVELS' }), [])
  // 저장된/서버 진행 병합 (localStorage 복원 + 닉네임 동기화). progress 형식은 mergeProgress 참고.
  const hydratePlayed = useCallback((progress) => dispatch({ type: 'HYDRATE_PLAYED', progress }), [])

  return {
    state,
    cards,
    letterProgress,
    remainingBlanks,
    actions: {
      selectCategory,
      backToCategories,
      selectLevel,
      selectLetter,
      selectBlank,
      placeLetter,
      clearWrong,
      requestHint,
      revealMeaning,
      nextQuestion,
      restart,
      backToLevels,
      hydratePlayed,
    },
    // raw dispatch (드래그 onDragEnd 등에서 PLACE 직접 호출용)
    dispatch,
  }
}
