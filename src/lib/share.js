/* =========================================================================
   share.js — 결과 공유. 바이럴의 핵심은 "게임 링크가 페이로드에 따라가는 것".
   Web Share API 우선(모바일 네이티브 공유창) → 미지원이면 링크 복사 폴백.
   모든 경로 fail-soft: 공유가 실패해도 게임 흐름을 절대 깨지 않는다(프로젝트 규약).

   이미지 첨부는 하지 않는다(사용자 결정): 카톡에서 이미지+텍스트가 메시지
   여러 개로 쪼개져 과함. 텍스트+링크 1개면 충분 — 링크 미리보기(og.png)가
   "빈칸 뚫린 문장" 티저로 어그로를 담당한다.
   ========================================================================= */

// 홈 URL. 딥링크 라우팅이 없으니 홈으로 보낸다(라우터 추가는 범위 밖).
const HOME_URL =
  typeof window !== 'undefined' ? window.location.origin + '/' : 'https://2602-hangman.vercel.app/'

/** 공유 문구(해요체 — 앱 보이스와 일치). URL 은 여기 넣지 않는다 —
 *  navigator.share 의 url 파라미터와 합쳐지면 링크가 2번 찍히므로 분리. */
export function buildShareText({ text, ko } = {}) {
  const lines = ['이 영어, 맞혀볼래요? 🔤', '']
  if (text) lines.push(`"${text}"`)
  if (ko) lines.push(ko)
  lines.push('', '▶ 놀면서 배우는 영어')
  return lines.join('\n')
}

/**
 * 결과를 공유한다. 우선순위:
 *  1) 텍스트+링크 Web Share (모바일 네이티브 공유창)
 *  2) 문구+링크 복사 (데스크톱/미지원) → 'copied'
 * 반환: 'shared' | 'copied' | 'dismissed' | 'failed' (호출측이 토스트 문구 결정)
 *
 * @param {{ text?:string, ko?:string }} payload
 */
export async function shareResult({ text, ko } = {}) {
  const message = buildShareText({ text, ko })

  // 1) Web Share API — text 와 url 을 분리해 넘기면 대상 앱이 알아서 합친다.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message, url: HOME_URL })
      return 'shared'
    } catch (err) {
      // 사용자가 공유창을 닫음(취소)은 실패가 아니다.
      if (err && err.name === 'AbortError') return 'dismissed'
      // 그 외(권한 등)는 아래 복사 폴백으로 강등.
    }
  }

  // 2) 링크 복사 폴백 (복사본에는 URL 을 직접 붙인다)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${message}\n${HOME_URL}`)
      return 'copied'
    }
  } catch {
    /* 무시 — 아래 failed */
  }
  return 'failed'
}
