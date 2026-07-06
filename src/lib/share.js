/* =========================================================================
   share.js — 결과 공유. 링크 1개만 보낸다(사용자 결정: 메시지 여러 개는 과함).
   /s/<id> 가 문장별 OG 미리보기(빈칸 티저 이미지 + "이 문장, 맞혀볼래요?")를
   담당하므로, 페이로드는 링크만으로 충분 — 정답 스포일러도 없음.
   Web Share API 우선 → 링크 복사 폴백. 전 경로 fail-soft(게임 흐름 안 깸).
   ========================================================================= */

const ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'https://2602-hangman.vercel.app'

/** 문장별 공유 URL — /s/:id (서버가 문장별 OG 메타 + 게임 리다이렉트 제공). */
export function shareUrlFor(quoteId) {
  return `${ORIGIN}/s/${quoteId}`
}

/**
 * 결과를 공유한다. 링크만(미리보기가 티저 담당).
 *  1) Web Share (모바일 네이티브 공유창)
 *  2) 링크 복사 (데스크톱/미지원) → 'copied'
 * 반환: 'shared' | 'copied' | 'dismissed' | 'failed'
 *
 * @param {{ quoteId: number }} payload
 */
export async function shareResult({ quoteId } = {}) {
  const url = shareUrlFor(quoteId)

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url })
      return 'shared'
    } catch (err) {
      if (err && err.name === 'AbortError') return 'dismissed' // 사용자가 닫음 = 실패 아님
      // 그 외는 아래 복사 폴백으로 강등.
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return 'copied'
    }
  } catch {
    /* 무시 — 아래 failed */
  }
  return 'failed'
}
