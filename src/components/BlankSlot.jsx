import { useDroppable } from '@dnd-kit/core'
import styles from './BlankSlot.module.css'

/**
 * 한 글자 위치(빈칸). 상태:
 *  - correct : 채워진 글자 표시(잠김)
 *  - empty   : 밑줄 빈칸 + 아래 암호 기호
 * 탭 또는 드롭으로 글자 배치. 오답이면 빨강+흔들림(wrongNonce 로 재발동).
 */
export default function BlankSlot({
  token,
  isSelectedLetter,
  isSelectedBlank,
  isLastHint,
  isWrong,
  wrongNonce,
  highlightDrop,
  onTap,
}) {
  const filled = token.status === 'correct'

  const { setNodeRef, isOver } = useDroppable({
    id: String(token.index),
    disabled: filled,
  })

  const cls = [
    styles.slot,
    filled ? styles.filled : styles.empty,
    token.isRevealed ? styles.revealed : '',
    // 마지막 힌트 글자 강조 — .revealed 뒤에 와서 시각적으로 이긴다(아래 CSS 참고).
    isLastHint ? styles.lastHint : '',
    isSelectedLetter && filled ? styles.matchHint : '',
    isSelectedBlank ? styles.selectedBlank : '',
    highlightDrop ? styles.droppable : '',
    isOver ? styles.over : '',
    isWrong ? styles.wrong : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      ref={setNodeRef}
      className={cls}
      // wrongNonce 를 key 에 섞어, 같은 빈칸 연속 오답에도 애니메이션이 재시작되게 함
      data-wrong-nonce={wrongNonce ?? undefined}
      role={filled ? undefined : 'button'}
      tabIndex={filled ? undefined : 0}
      aria-pressed={filled ? undefined : isSelectedBlank}
      aria-label={
        filled
          ? `채워짐: ${token.letter}${isLastHint ? ' (방금 힌트로 공개)' : ''}`
          : `빈칸, 힌트 ${token.cipher}`
      }
      onClick={filled ? undefined : onTap}
      onKeyDown={
        filled
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onTap()
              }
            }
      }
    >
      <span key={wrongNonce ?? 'static'} className={styles.glyph}>
        {filled ? token.letter.toUpperCase() : ''}
      </span>
      {/* 숫자는 항상 표시 — 채워진/공개 타일이 보이는 "범례"가 되어 19=R 같은 매핑을 유지 */}
      <span className={styles.cipher}>{token.cipher}</span>
    </span>
  )
}
