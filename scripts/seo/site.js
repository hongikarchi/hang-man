/* =========================================================================
   site.js — 사이트 공통 SEO/공유 메타 상수.
   index.html(홈)과 gen-seo.mjs(카테고리 랜딩)가 함께 재사용한다.
   프로덕션 도메인 기준 절대 URL — OG/canonical 은 절대 URL 이어야 미리보기가 뜬다.
   ========================================================================= */

export const SITE = {
  origin: 'https://2602-hangman.vercel.app',
  name: '영어 명언 행맨',
  title: '영어 명언 행맨 — 놀면서 배우는 영어',
  description:
    '명언·여행·비즈니스·영화 영어 문장을 크립토그램 행맨으로 풀며 배우는 무료 게임. 한글 뜻과 함께, 모바일에서 바로 플레이.',
  locale: 'ko_KR',
  ogImage: '/og.png', // 1200×630, public/og.png (절대 URL 은 origin + 이 값)
  twitterCard: 'summary_large_image',
}

/** 절대 URL 로 만든다 (path 는 '/' 로 시작). */
export function absUrl(path = '/') {
  return SITE.origin + (path.startsWith('/') ? path : '/' + path)
}
