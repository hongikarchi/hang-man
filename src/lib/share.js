/* =========================================================================
   share.js — 결과 공유. 바이럴의 핵심은 "게임 링크가 페이로드에 따라가는 것".
   Web Share API 우선(모바일 네이티브 공유창) → 미지원이면 링크 복사 폴백.
   모든 경로 fail-soft: 공유가 실패해도 게임 흐름을 절대 깨지 않는다(프로젝트 규약).
   ========================================================================= */

// 홈 URL. 딥링크 라우팅이 없으니 홈으로 보낸다(라우터 추가는 범위 밖).
const HOME_URL =
  typeof window !== 'undefined' ? window.location.origin + '/' : 'https://2602-hangman.vercel.app/'

/** 공유 문구(해요체 — 앱 보이스와 일치). 친구가 명언을 보고 링크를 타게 만든다. */
export function buildShareText({ text, ko } = {}) {
  const lines = ['이 영어, 맞혀볼래요? 🔤', '']
  if (text) lines.push(`"${text}"`)
  if (ko) lines.push(ko)
  lines.push('', '▶ 놀면서 배우는 영어', HOME_URL)
  return lines.join('\n')
}

/** File 첨부 공유가 가능한 환경인가(모바일 크롬/사파리 등). */
function canShareFiles(file) {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      file &&
      navigator.canShare({ files: [file] })
    )
  } catch {
    return false
  }
}

/**
 * 결과를 공유한다. 우선순위:
 *  1) 이미지 첨부 Web Share (모바일, 이미지 지원 시) — 스토리에 카드로 뿌리기 최적
 *  2) 텍스트+링크 Web Share (모바일, 이미지 미지원 시)
 *  3) 링크 복사 (데스크톱/미지원) → 'copied'
 * 반환: 'shared' | 'copied' | 'dismissed' | 'failed' (호출측이 토스트 문구 결정)
 *
 * @param {{ text?:string, ko?:string, imageBlob?:Blob }} payload
 */
export async function shareResult({ text, ko, imageBlob } = {}) {
  const message = buildShareText({ text, ko })

  // 1·2) Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file =
        imageBlob != null
          ? new File([imageBlob], 'quote-hangman.png', { type: 'image/png' })
          : null
      if (file && canShareFiles(file)) {
        await navigator.share({ text: message, url: HOME_URL, files: [file] })
      } else {
        await navigator.share({ text: message, url: HOME_URL })
      }
      return 'shared'
    } catch (err) {
      // 사용자가 공유창을 닫음(취소)은 실패가 아니다.
      if (err && err.name === 'AbortError') return 'dismissed'
      // 그 외(권한 등)는 아래 복사 폴백으로 강등.
    }
  }

  // 3) 링크 복사 폴백
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message)
      return 'copied'
    }
  } catch {
    /* 무시 — 아래 failed */
  }
  return 'failed'
}
