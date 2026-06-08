/* =========================================================================
   quotePicker.js — 레벨별 명언 선택 + 진행(progression) + 무료 공개 글자 선정
   ========================================================================= */

import { uniqueLetters } from './cipher.js'

// 레벨별 시도 횟수 (스펙 §4).
export const ATTEMPTS_BY_LEVEL = { 1: 8, 2: 7, 3: 6 }

/**
 * 해당 레벨에서 아직 안 푼 명언 중 하나를 무작위 선택한다.
 * playedIds 에 모두 들어있으면(소진) 그 레벨의 기록을 비우고 다시 고른다(무한 반복).
 *
 * @param {Array} quotes 전체 명언 배열
 * @param {1|2|3} level
 * @param {Set<number>} playedIds 이미 플레이한 id 집합 (이 함수는 변형하지 않음)
 * @param {() => number} [rand]
 * @returns {{ quote: object, resetPlayed: boolean }}
 *   resetPlayed=true 이면 호출 측에서 playedIds 를 비워야 함을 의미.
 */
export function pickQuote(quotes, level, playedIds, rand = Math.random) {
  const pool = quotes.filter((q) => q.level === level)
  if (pool.length === 0) {
    throw new Error(`레벨 ${level} 명언이 없습니다.`)
  }

  let candidates = pool.filter((q) => !playedIds.has(q.id))
  let resetPlayed = false
  if (candidates.length === 0) {
    // 전부 소진 → 리셋하고 전체에서 다시 선택
    candidates = pool
    resetPlayed = true
  }

  const quote = candidates[Math.floor(rand() * candidates.length)]
  return { quote, resetPlayed }
}

/**
 * 미리 공개할 글자 N개를 고른다 (난이도 = 공개 글자 수).
 * 전략: 등장 빈도가 높은 순으로 N개 → 가장 많은 "주어진 단서(범례)"를 제공.
 * 빈도 동률 구간은 무작위 셔플로 다양성 확보.
 *
 * @param {string} text
 * @param {number} n 공개할 고유 글자 수
 * @param {() => number} [rand]
 * @returns {string[]} 공개할 글자 배열 (최대 n개)
 */
export function pickRevealLetters(text, n, rand = Math.random) {
  if (n <= 0) return []
  const freq = {}
  for (const ch of text.toLowerCase()) {
    if (ch >= 'a' && ch <= 'z') freq[ch] = (freq[ch] || 0) + 1
  }
  const letters = Object.keys(freq)
  if (letters.length === 0) return []

  // 빈도 내림차순 정렬, 동률은 무작위(작은 난수 가산)로 섞는다.
  const sorted = letters.sort((a, b) => {
    const diff = freq[b] - freq[a]
    return diff !== 0 ? diff : rand() - 0.5
  })
  return sorted.slice(0, Math.min(n, letters.length))
}

/**
 * 레벨별 "미리 공개 글자 수" 계산.
 * 고유 글자 수에 비례하되, 풀어야 할 글자가 최소 3종 이상 남도록 보장.
 *  - L1: 고유 글자의 약 절반 공개(가장 쉬움)
 *  - L2: 약 1/4
 *  - L3: 0 (아무 단서 없음, 가장 어려움)
 *
 * @param {string} text
 * @param {1|2|3} level
 * @returns {number}
 */
export function revealCountForLevel(text, level) {
  const u = uniqueLetters(text).length
  const FRACTION = { 1: 0.5, 2: 0.25, 3: 0 }
  const raw = Math.round(u * FRACTION[level])
  // 풀 거리(미공개 고유 글자)를 최소 3종 보장 → 너무 쉬워지지 않게.
  const maxReveal = Math.max(0, u - 3)
  return Math.min(raw, maxReveal)
}

/**
 * 명언이 풀 만한지(고유 글자 수) 가벼운 확인 — 디버그/방어용.
 * @param {object} quote
 */
export function quoteUniqueLetterCount(quote) {
  return uniqueLetters(quote.text).length
}
