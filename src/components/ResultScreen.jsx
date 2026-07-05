import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { getCategory } from '../data/categories.js'
import { shareResult } from '../lib/share.js'
import ShareCard from './ShareCard.jsx'
import styles from './ResultScreen.module.css'

export default function ResultScreen({ game, lastEarned = 0, total = 0 }) {
  const { state, actions } = game
  const won = state.gameState === 'WIN'
  const quote = state.quote
  const category = getCategory(state.category)

  const cardRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('') // 데스크톱 복사 등 사용자 피드백

  async function onShare() {
    if (busy) return
    setBusy(true)
    setToast('')
    // 이미지 카드 캡처 시도(실패해도 텍스트+링크로 공유 — fail-soft).
    let imageBlob = null
    try {
      const node = cardRef.current
      if (node) {
        // ⚠ 한글 tofu 방지: 폰트 로드 완료 후 캡처.
        if (document.fonts?.ready) await document.fonts.ready
        imageBlob = await toBlob(node, { pixelRatio: 2, cacheBust: true })
      }
    } catch {
      imageBlob = null // 캡처 실패 → 텍스트 공유로 강등
    }
    const result = await shareResult({ text: quote.text, ko: quote.ko, imageBlob })
    if (result === 'copied') setToast('링크를 복사했어요 — 붙여넣어 공유하세요')
    else if (result === 'failed') setToast('공유를 열지 못했어요. 잠시 후 다시 시도해 주세요')
    setBusy(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${won ? styles.win : styles.lose}`}>
        <div className={styles.emoji}>{won ? '🎉' : '💡'}</div>
        <h2 className={styles.heading}>{won ? '정답입니다!' : '아쉬워요'}</h2>
        <p className={styles.sub}>
          {won ? '모든 빈칸을 맞혔어요.' : '시도를 모두 사용했어요. 정답은:'}
        </p>

        {won && (
          <div className={styles.score}>
            <span className={styles.earned}>+{lastEarned}점</span>
            <span className={styles.total}>누적 {total}점</span>
          </div>
        )}

        <blockquote className={styles.quote}>
          <span className={styles.quoteText}>{quote.text}</span>
          {quote.ko && <span className={styles.quoteKo}>{quote.ko}</span>}
          {quote.author && <cite className={styles.author}>— {quote.author}</cite>}
        </blockquote>

        <div className={styles.actions}>
          {won && (
            <button
              className={`${styles.btn} ${styles.share}`}
              onClick={onShare}
              disabled={busy}
              aria-label="이 명언과 점수를 친구에게 공유하기"
            >
              {busy ? '공유 준비 중…' : '📤 공유하기'}
            </button>
          )}
          {toast && (
            <p className={styles.toast} role="status">
              {toast}
            </p>
          )}
          <button
            className={`${styles.btn} ${styles.primary}`}
            onClick={actions.nextQuestion}
          >
            다음 문제 →
          </button>
          <button className={styles.btn} onClick={actions.restart}>
            다시 풀기
          </button>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={actions.backToLevels}>
            레벨 선택
          </button>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={actions.backToCategories}>
            카테고리 선택
          </button>
        </div>
      </div>

      {/* 공유용 카드 — 화면 밖에 렌더(캡처 대상). WIN 일 때만 필요. */}
      {won && (
        <div className={styles.offscreen} aria-hidden="true">
          <ShareCard
            ref={cardRef}
            text={quote.text}
            ko={quote.ko}
            author={quote.author}
            categoryLabel={category?.label}
            categoryEmoji={category?.emoji}
            earned={lastEarned}
            total={total}
          />
        </div>
      )}
    </div>
  )
}
