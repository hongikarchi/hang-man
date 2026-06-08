import styles from './AttemptsCounter.module.css'

/** 남은 시도: 하트 아이콘 + 남은/전체 숫자. 헤더에서 한눈에 읽히게. */
export default function AttemptsCounter({ remaining, total }) {
  const low = remaining <= 2

  return (
    <div
      className={`${styles.wrap} ${low ? styles.low : ''}`}
      aria-label={`남은 시도 ${remaining} / ${total}`}
    >
      <span className={styles.heart}>♥</span>
      <span className={styles.count}>
        <b>{remaining}</b>
        <span className={styles.total}>/{total}</span>
      </span>
    </div>
  )
}
