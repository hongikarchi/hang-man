import { useState } from 'react'
import { useGame } from './hooks/useGame.js'
import { getCategory } from './data/categories.js'
import CategorySelect from './components/CategorySelect.jsx'
import LevelSelect from './components/LevelSelect.jsx'
import GameScreen from './components/GameScreen.jsx'
import ResultScreen from './components/ResultScreen.jsx'
import HowToPlay from './components/HowToPlay.jsx'
import styles from './App.module.css'

const SEEN_KEY = 'qh_seen_howto'

export default function App() {
  const game = useGame()
  const { gameState } = game.state

  // 처음 방문 시 플레이 방법을 자동으로 띄운다(이후엔 ? 버튼으로).
  const [showHowTo, setShowHowTo] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== '1'
    } catch {
      return true
    }
  })

  function closeHowTo() {
    setShowHowTo(false)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.app}>
      <div className={styles.frame}>
        {gameState === 'INIT' &&
          (game.state.category == null ? (
            <CategorySelect
              onSelectCategory={game.actions.selectCategory}
              onHelp={() => setShowHowTo(true)}
            />
          ) : (
            <LevelSelect
              category={getCategory(game.state.category)}
              onSelectLevel={game.actions.selectLevel}
              onBack={game.actions.backToCategories}
              onHelp={() => setShowHowTo(true)}
            />
          ))}

        {gameState === 'PLAYING' && (
          <GameScreen game={game} onHelp={() => setShowHowTo(true)} />
        )}

        {(gameState === 'WIN' || gameState === 'LOSE') && (
          <ResultScreen game={game} />
        )}
      </div>

      {showHowTo && <HowToPlay onClose={closeHowTo} />}
    </div>
  )
}
