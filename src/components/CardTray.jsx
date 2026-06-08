import LetterCard from './LetterCard.jsx'
import styles from './CardTray.module.css'

/**
 * 하단 카드 영역: 문장에 등장하는 고유 글자만 카드로(AC3).
 * 모든 위치가 정답이면 회색(비활성)(AC5).
 */
export default function CardTray({
  cards,
  cipherFor,
  letterProgress,
  selectedLetter,
  onTapCard,
}) {
  return (
    <div className={styles.tray}>
      {cards.map((letter) => {
        const prog = letterProgress[letter] || { done: 0, total: 0, complete: false }
        return (
          <LetterCard
            key={letter}
            letter={letter}
            cipher={cipherFor(letter)}
            complete={prog.complete}
            selected={selectedLetter === letter}
            onTap={() => onTapCard(letter)}
          />
        )
      })}
    </div>
  )
}
