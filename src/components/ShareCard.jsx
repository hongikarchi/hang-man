import { forwardRef } from 'react'
import styles from './ShareCard.module.css'

/**
 * 공유용 이미지 카드 — 화면 밖(off-screen)에 렌더해 두고 html-to-image 로 캡처한다.
 * 결과 화면(.card/.quote)의 디자인 토큰을 계승하되, 캡처 안정성을 위해 고정 크기.
 * ⚠ 캡처 전에 document.fonts.ready 를 기다려야 한글이 tofu 로 깨지지 않는다.
 */
const ShareCard = forwardRef(function ShareCard(
  { text, ko, author, categoryLabel, categoryEmoji, earned, total },
  ref,
) {
  return (
    <div ref={ref} className={styles.card}>
      <div className={styles.badge}>
        <span className={styles.badgeEmoji}>{categoryEmoji}</span>
        <span>{categoryLabel}</span>
      </div>

      <blockquote className={styles.quote}>
        <span className={styles.quoteText}>{text}</span>
        {ko && <span className={styles.quoteKo}>{ko}</span>}
        {author && <cite className={styles.author}>— {author}</cite>}
      </blockquote>

      {earned != null && (
        <div className={styles.score}>
          <span className={styles.earned}>+{earned}점</span>
          {total != null && <span className={styles.total}>누적 {total}점</span>}
        </div>
      )}

      {/* ⚠ 도메인을 카드에 "보이게" 둔다 — 이미지 전용 공유(스토리/카톡 사진)는
          text·url 을 버리고 이미지만 남기므로, 카드에 링크가 없으면 유입 경로가 끊긴다. */}
      <div className={styles.brand}>
        <span className={styles.brandMark}>A</span>
        영어 명언 행맨 · 2602-hangman.vercel.app
      </div>
    </div>
  )
})

export default ShareCard
