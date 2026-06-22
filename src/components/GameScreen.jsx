import { useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { useState } from 'react'
import QuoteBoard from './QuoteBoard.jsx'
import CardTray from './CardTray.jsx'
import AttemptsCounter from './AttemptsCounter.jsx'
import { getCategory } from '../data/categories.js'
import styles from './GameScreen.module.css'

export default function GameScreen({ game, onHelp }) {
  const { state, cards, letterProgress, remainingBlanks, actions } = game
  const { level, selectedLetter, selectedBlankIndex, wrongEvent, tokens } = state

  // 오답 플래시(빨강/흔들림)를 일정 시간 뒤 클리어. nonce 로 최신 이벤트만 클리어.
  useEffect(() => {
    if (!wrongEvent) return
    const id = setTimeout(() => actions.clearWrong(wrongEvent.nonce), 450)
    return () => clearTimeout(id)
  }, [wrongEvent, actions])

  // ---- 드래그(보조 인터랙션) : 탭과 동일한 PLACE 로 수렴 ----
  const [draggingLetter, setDraggingLetter] = useState(null)
  const sensors = useSensors(
    // 8px 이동 전엔 드래그 시작 안 함 → 탭(클릭)은 그대로 탭 핸들러로 처리
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // 짧은 탭은 드래그로 안 잡힘(딜레이), 작은 손떨림 허용
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function handleDragStart(e) {
    setDraggingLetter(e.active.id)
    // 드래그 시작 시 선택 글자도 동기화(드래그 중 빈칸 강조용)
    if (state.selectedLetter !== e.active.id) actions.selectLetter(e.active.id)
  }

  function handleDragEnd(e) {
    setDraggingLetter(null)
    const { active, over } = e
    if (!over) return
    const blankIndex = Number(over.id)
    actions.placeLetter(blankIndex, active.id)
  }

  function handleDragCancel() {
    setDraggingLetter(null)
  }

  const levelTag = `LV ${level}`
  const category = getCategory(state.category)

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.screen}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={actions.backToLevels} aria-label="레벨 선택으로">
            ‹
          </button>
          <span className={styles.levelBadge} data-level={level}>{levelTag}</span>
          {category && <span className={styles.categoryChip}>{category.label}</span>}
          <span className={styles.headerSpacer} />
          <AttemptsCounter
            remaining={state.remainingAttempts}
            total={{ 1: 8, 2: 7, 3: 6 }[level]}
          />
          <button className={styles.helpBtn} onClick={onHelp} aria-label="플레이 방법">
            ?
          </button>
        </header>

        {state.quote?.ko &&
          (state.meaningRevealed ? (
            <div className={styles.hintBar} role="note" aria-label="한국어 뜻">
              <span className={styles.koHintLabel}>뜻</span>
              <p className={styles.koHintText}>{state.quote.ko}</p>
            </div>
          ) : (
            <div className={styles.hintBar}>
              <button
                type="button"
                className={styles.meaningBtn}
                onClick={actions.revealMeaning}
                disabled={state.hintsLeft <= 0}
                aria-label={`한글 뜻 보기, 힌트 1 소모, 남은 힌트 ${state.hintsLeft}개`}
              >
                <span className={styles.koHintLabel}>뜻</span>
                <span className={styles.meaningBtnText}>
                  {state.hintsLeft > 0 ? '한글 뜻 보기' : '힌트가 없어요'}
                </span>
                {state.hintsLeft > 0 && <span className={styles.meaningCost}>힌트 1</span>}
              </button>
            </div>
          ))}

        <main className={styles.board}>
          <div className={styles.boardInner}>
            <QuoteBoard
              tokens={tokens}
              selectedLetter={selectedLetter}
              selectedBlankIndex={selectedBlankIndex}
              wrongEvent={wrongEvent}
              draggingLetter={draggingLetter}
              onTapBlank={(index) => {
                // 글자가 선택돼 있으면 배치, 아니면 이 빈칸을 선택(빈칸 우선)
                if (selectedLetter) actions.placeLetter(index, selectedLetter)
                else actions.selectBlank(index)
              }}
            />
          </div>
        </main>

        <footer className={styles.tray}>
          <div className={styles.instruction} aria-live="polite">
            {selectedLetter ? (
              <span className={styles.instructActive}>
                <b>{selectedLetter.toUpperCase()}</b> 선택됨 — 놓을 <b>빈칸</b>을 탭하세요
              </span>
            ) : selectedBlankIndex != null ? (
              <span className={styles.instructActive}>
                <b>빈칸</b> 선택됨 — 채울 <b>글자 카드</b>를 탭하세요
              </span>
            ) : (
              <span className={styles.instructIdle}>
                <b>카드</b>나 <b>빈칸</b>을 탭해 채우세요 <span className={styles.cue}>▾</span>
              </span>
            )}
            <span className={styles.metaRow}>
              <button
                type="button"
                className={styles.hintBtn}
                onClick={actions.requestHint}
                disabled={state.hintsLeft <= 0}
                aria-label={`힌트 사용, 남은 힌트 ${state.hintsLeft}개`}
              >
                💡 힌트 <b>{state.hintsLeft}</b>
              </button>
              <span className={styles.remain}>남은 {remainingBlanks}</span>
            </span>
          </div>
          <CardTray
            cards={cards}
            cipherFor={(letter) => firstCipher(tokens, letter)}
            letterProgress={letterProgress}
            selectedLetter={selectedLetter}
            onTapCard={(letter) => {
              // 빈칸이 선택돼 있으면 그 빈칸에 이 글자 배치, 아니면 이 글자를 선택(글자 우선)
              if (selectedBlankIndex != null) actions.placeLetter(selectedBlankIndex, letter)
              else actions.selectLetter(letter)
            }}
          />
        </footer>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingLetter ? (
          <div className={styles.dragGhost}>{draggingLetter.toUpperCase()}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// 카드에 보여줄 대표 암호(그 글자 첫 등장 위치의 cipher)
function firstCipher(tokens, letter) {
  const t = tokens.find((t) => t.letter === letter)
  return t ? t.cipher : ''
}
