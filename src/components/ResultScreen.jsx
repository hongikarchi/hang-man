import { useState } from 'react'
import { shareResult } from '../lib/share.js'
import styles from './ResultScreen.module.css'

export default function ResultScreen({ game, lastEarned = 0, total = 0 }) {
  const { state, actions } = game
  const won = state.gameState === 'WIN'
  const quote = state.quote

  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('') // 데스크톱 복사 등 사용자 피드백

  // 텍스트+링크만 공유(이미지 첨부 없음 — 카톡에서 메시지가 쪼개져 과함).
  // 링크 미리보기(og.png)가 티저 역할. 전 경로 fail-soft.
  async function onShare() {
    if (busy) return
    setBusy(true)
    setToast('')
    const result = await shareResult({ text: quote.text, ko: quote.ko })
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
              aria-label="이 명언을 친구에게 공유하기"
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
    </div>
  )
}
