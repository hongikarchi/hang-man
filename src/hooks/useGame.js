/* =========================================================================
   useGame.js — 게임 상태(두뇌). useReducer + 파생값(useMemo).
   상태는 "위치 단위"(tokens) — 각 빈칸이 독립적이다(AC4).
   ========================================================================= */

import { useReducer, useMemo, useCallback } from 'react'
// import attribute(`with { type: 'json' }`)는 Node 22 ESM 과 Vite 양쪽에서 동작.
import quotes from '../data/quotes.json' with { type: 'json' }
import { buildCipherMap } from '../lib/cipher.js'
import { tokenize } from '../lib/tokenize.js'
import {
  pickQuote,
  pickRevealLetters,
  revealCountForLevel,
  ATTEMPTS_BY_LEVEL,
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
    revealLetters: [], // 미리 공개된 글자들 (난이도)
    // 레벨별 플레이한 명언 id 집합 (진행 추적). 객체로 보관.
    playedIds: { 1: new Set(), 2: new Set(), 3: new Set() },
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
  // playedIds 사본 (불변성)
  const playedIds = {
    1: new Set(state.playedIds[1]),
    2: new Set(state.playedIds[2]),
    3: new Set(state.playedIds[3]),
  }

  let quote
  if (opts.forceQuoteId != null) {
    quote = quotes.find((q) => q.id === opts.forceQuoteId)
    if (!quote) throw new Error(`명언 id ${opts.forceQuoteId} 없음`)
  } else {
    const { quote: picked, resetPlayed } = pickQuote(quotes, level, playedIds[level])
    if (resetPlayed) playedIds[level] = new Set()
    quote = picked
  }
  playedIds[level].add(quote.id)

  const cipherMap = buildCipherMap(quote.text)
  // 난이도 = 미리 공개 글자 수. L1 약 절반 / L2 약 1/4 / L3 0개.
  const revealCount = revealCountForLevel(quote.text, level)
  const revealLetters = pickRevealLetters(quote.text, revealCount)
  const tokens = tokenize(quote.text, cipherMap, revealLetters)

  return {
    ...state,
    gameState: 'PLAYING',
    level,
    quote,
    cipherMap,
    tokens,
    remainingAttempts: ATTEMPTS_BY_LEVEL[level],
    selectedLetter: null,
    selectedBlankIndex: null,
    wrongEvent: null,
    // wrongNonce 는 라운드 넘어가도 단조 증가 유지(리셋 안 함) — 항상 새 값 보장.
    revealLetters,
    playedIds,
  }
}

/** 모든 letter 토큰이 correct 인가? (승리 조건, AC8) */
function isAllCorrect(tokens) {
  return tokens.every((t) => t.type !== 'letter' || t.status === 'correct')
}

// reducer/헬퍼는 헤드리스 테스트를 위해 export (UI 없이 검증 가능).
export { makeInitialState, initRound, isAllCorrect }

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

    case 'BACK_TO_LEVELS':
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
        return {
          ...state,
          tokens,
          selectedLetter: null,
          selectedBlankIndex: null,
          wrongEvent: null,
          gameState: won ? 'WIN' : 'PLAYING',
        }
      }

      // 오답 (AC6): 채우지 않음. 시도 -1, 빨강 트리거, 선택 해제.
      const remainingAttempts = state.remainingAttempts - 1
      const lost = remainingAttempts <= 0 // AC7
      const nonce = state.wrongNonce + 1
      return {
        ...state,
        remainingAttempts,
        selectedLetter: null,
        selectedBlankIndex: null,
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
  const selectLevel = useCallback((level) => dispatch({ type: 'SET_LEVEL', level }), [])
  const selectLetter = useCallback((letter) => dispatch({ type: 'SELECT_LETTER', letter }), [])
  const selectBlank = useCallback((blankIndex) => dispatch({ type: 'SELECT_BLANK', blankIndex }), [])
  const placeLetter = useCallback(
    (blankIndex, letter) => dispatch({ type: 'PLACE', blankIndex, letter }),
    [],
  )
  const clearWrong = useCallback((nonce) => dispatch({ type: 'CLEAR_WRONG', nonce }), [])
  const nextQuestion = useCallback(() => dispatch({ type: 'NEXT_QUESTION' }), [])
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [])
  const backToLevels = useCallback(() => dispatch({ type: 'BACK_TO_LEVELS' }), [])

  return {
    state,
    cards,
    letterProgress,
    remainingBlanks,
    actions: {
      selectLevel,
      selectLetter,
      selectBlank,
      placeLetter,
      clearWrong,
      nextQuestion,
      restart,
      backToLevels,
    },
    // raw dispatch (드래그 onDragEnd 등에서 PLACE 직접 호출용)
    dispatch,
  }
}
