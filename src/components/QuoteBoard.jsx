import { groupIntoWords } from '../lib/tokenize.js'
import BlankSlot from './BlankSlot.jsx'
import styles from './QuoteBoard.module.css'

/**
 * 명언을 단어 단위로 묶어 렌더. 한 단어(빈칸+암호+구두점)는 줄 사이로 쪼개지지 않고,
 * 줄바꿈은 단어 사이에서만 일어난다(모바일 L3 100자+ 대응).
 */
export default function QuoteBoard({
  tokens,
  selectedLetter,
  selectedBlankIndex,
  wrongEvent,
  draggingLetter,
  onTapBlank,
}) {
  const groups = groupIntoWords(tokens)

  return (
    <div className={styles.board}>
      {groups.map((g, gi) => {
        if (g.type === 'space') {
          return <span key={`sp-${gi}`} className={styles.space} aria-hidden="true" />
        }
        return (
          <span key={`w-${gi}`} className={styles.word}>
            {g.tokens.map((t) =>
              t.type === 'letter' ? (
                <BlankSlot
                  key={t.index}
                  token={t}
                  isSelectedLetter={selectedLetter === t.letter}
                  isSelectedBlank={selectedBlankIndex === t.index}
                  isWrong={wrongEvent != null && wrongEvent.index === t.index}
                  wrongNonce={wrongEvent != null && wrongEvent.index === t.index ? wrongEvent.nonce : null}
                  highlightDrop={
                    (draggingLetter ?? selectedLetter) != null && t.status !== 'correct'
                  }
                  onTap={() => onTapBlank(t.index)}
                />
              ) : (
                <span key={t.index} className={styles.punct}>
                  {t.char}
                </span>
              ),
            )}
          </span>
        )
      })}
    </div>
  )
}
