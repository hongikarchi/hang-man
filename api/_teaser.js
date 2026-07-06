/* =========================================================================
   _teaser.js — 공유 티저 공용 헬퍼 (_ 접두사 = 라우트로 노출 안 됨).
   문장 id 조회 + "빈칸 뚫기"(결정적) — /api/og 이미지와 /s/:id 메타가 공유.
   ========================================================================= */
import { CATEGORIES } from '../src/data/categories.js'

/** 전 카테고리에서 문장 id 로 찾는다. 없으면 null. */
export function findQuote(id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return null
  for (const c of CATEGORIES) {
    const q = c.data.find((x) => x.id === n)
    if (q) return { ...q, category: c.id, categoryLabel: c.label }
  }
  return null
}

/**
 * 문장에 빈칸을 뚫는다 — 게임과 같은 크립토그램 규칙(같은 글자 = 전 위치 동시).
 * 최빈 글자부터(동률은 알파벳순) 고유 글자의 약 1/4(1~3종)을 골라 전부 '_' 로.
 * 결정적(랜덤 없음) — 같은 문장이면 항상 같은 티저 → OG 캐시와 궁합.
 */
export function blankText(text) {
  const freq = {}
  for (const ch of String(text).toLowerCase()) {
    if (ch >= 'a' && ch <= 'z') freq[ch] = (freq[ch] || 0) + 1
  }
  const letters = Object.keys(freq).sort(
    (a, b) => freq[b] - freq[a] || (a < b ? -1 : 1),
  )
  const count = Math.max(1, Math.min(3, Math.round(letters.length / 4)))
  const hide = new Set(letters.slice(0, count))
  return String(text).replace(/[a-zA-Z]/g, (ch) =>
    hide.has(ch.toLowerCase()) ? '_' : ch,
  )
}
