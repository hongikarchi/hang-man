import styles from './AttemptsCounter.module.css'

/** 남은 시도: total 개의 하트로 표시. 남은 만큼 채워진 하트(♥), 잃은 만큼 빈 하트(♡).
 *  숫자는 없애고 아이콘으로만 — 목숨이 몇 개 남았는지 한눈에.
 *  스크린리더는 wrap 의 numeric aria-label 하나로 읽고(각 하트는 aria-hidden),
 *  목숨 1 감소 시 한 하트가 alive→broken 으로 바뀌며 .heart transition 이 자동 발동. */
export default function AttemptsCounter({ remaining, total }) {
  const low = remaining <= 2 // 2 이하: 남은 하트 붉게 강조 + 깜빡

  return (
    <div
      className={`${styles.wrap} ${low ? styles.low : ''}`}
      role="img"
      aria-label={`남은 시도 ${remaining} / ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const alive = i < remaining // remaining ∈ [0,total] 보장 → clamp 불필요
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`${styles.heart} ${alive ? styles.alive : styles.broken}`}
          >
            {alive ? '♥' : '♡'}
          </span>
        )
      })}
    </div>
  )
}
