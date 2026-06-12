import { useMemo } from 'react'
import { groupIntoWords } from '../lib/tokenize.js'
import BlankSlot from './BlankSlot.jsx'
import styles from './QuoteBoard.module.css'

// CSS 계약: BlankSlot .slot = 1.55em + 0.1em×2 마진 = 1.75em.
// .punct = 글리프(최대 '?' ≈0.6em bold) + 0.05em×2 패딩 ≤ 0.7em (보수적 상한).
const LETTER_EM = 1.75
const PUNCT_EM = 0.7

/**
 * 명언을 단어 단위로 묶어 렌더. 한 단어(빈칸+암호+구두점)는 줄 사이로 쪼개지지 않고,
 * 줄바꿈은 단어 사이에서만 일어난다(모바일 L3 100자+ 대응).
 * 가장 긴 단어의 폭(em)을 --max-word-em 으로 주입해, CSS 가 보드 폭에 맞춰
 * 폰트를 캡한다(긴 단어 가로 잘림 방지).
 */
export default function QuoteBoard({
  tokens,
  selectedLetter,
  selectedBlankIndex,
  wrongEvent,
  draggingLetter,
  onTapBlank,
}) {
  const groups = useMemo(() => groupIntoWords(tokens), [tokens])
  const maxWordEm = useMemo(
    () =>
      Math.max(
        1, // tokens 가 비어도 -Infinity 방지
        ...groups
          .filter((g) => g.type === 'word')
          .map((g) =>
            g.tokens.reduce(
              (em, t) => em + (t.type === 'letter' ? LETTER_EM : PUNCT_EM),
              0,
            ),
          ),
      ),
    [groups],
  )

  return (
    <div className={styles.board} style={{ '--max-word-em': maxWordEm }}>
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
