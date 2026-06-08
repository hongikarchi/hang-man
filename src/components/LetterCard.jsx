import { useDraggable } from '@dnd-kit/core'
import styles from './LetterCard.module.css'

/**
 * 알파벳 카드. 탭하면 선택(토글), 드래그하면 빈칸에 배치(둘 다 동일 PLACE).
 * complete(모든 위치 정답)면 회색 비활성(AC5) — 선택/드래그 불가.
 */
export default function LetterCard({
  letter,
  cipher,
  complete,
  selected,
  onTap,
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: letter,
    disabled: complete,
  })

  const cls = [
    styles.card,
    complete ? styles.complete : '',
    selected ? styles.selected : '',
    isDragging ? styles.dragging : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={setNodeRef}
      className={cls}
      disabled={complete}
      onClick={complete ? undefined : onTap}
      {...(complete ? {} : listeners)}
      {...(complete ? {} : attributes)}
      aria-label={`글자 ${letter.toUpperCase()}, 힌트 ${cipher}${complete ? ', 완료' : ''}`}
      aria-pressed={selected}
    >
      {/* 카드는 글자만 표시(숫자는 보드 타일이 범례 역할). 힌트는 aria-label에만 유지.
          done/total 배지는 제거 — 글자 정답 시 모든 위치가 한 번에 채워져 0/N→N/N 즉시이므로 무의미. */}
      <span className={`${styles.letter} ${styles.letterOnly}`}>
        {letter.toUpperCase()}
      </span>
    </button>
  )
}
