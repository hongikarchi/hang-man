import styles from './ResultScreen.module.css'

export default function ResultScreen({ game, lastEarned = 0, total = 0 }) {
  const { state, actions } = game
  const won = state.gameState === 'WIN'
  const quote = state.quote

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
