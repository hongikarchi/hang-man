import { useState, useRef, useEffect } from 'react'
import { useGame } from './hooks/useGame.js'
import { getCategory } from './data/categories.js'
import CategorySelect from './components/CategorySelect.jsx'
import LevelSelect from './components/LevelSelect.jsx'
import GameScreen from './components/GameScreen.jsx'
import ResultScreen from './components/ResultScreen.jsx'
import HowToPlay from './components/HowToPlay.jsx'
import NicknamePrompt from './components/NicknamePrompt.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import { scoreForWin } from './lib/score.js'
import {
  getNickname,
  setNickname as persistNickname,
  getTotal,
  setTotal as persistTotal,
  postScore,
} from './lib/leaderboard.js'
import styles from './App.module.css'

const SEEN_KEY = 'qh_seen_howto'

export default function App() {
  const game = useGame()
  const { gameState } = game.state

  // ---- 닉네임 / 누적 총점 (localStorage 가 진실의 원천, state 는 반응형 미러) ----
  const [nickname, setNick] = useState(getNickname)
  const [total, setTotal] = useState(getTotal)
  const [lastEarned, setLastEarned] = useState(0)

  // 닉네임 프롬프트: 첫 실행(닉네임 없음) 시 자동 노출, 이후 칩으로 다시 열기.
  const [showNick, setShowNick] = useState(() => !getNickname())
  const [showRank, setShowRank] = useState(false)

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

  function saveNickname(name) {
    const clean = persistNickname(name)
    setNick(clean)
    setShowNick(false)
  }

  // ---- WIN 감지: INIT/PLAYING → WIN 전환 시 정확히 한 번 점수 적립 ----
  // reducer 는 순수하고 WIN 은 PLACE/USE_HINT 두 경로라 여기서 side-effect 처리.
  // prevGameState ref 로 한 판당 한 번만 발동(StrictMode 2중 호출도 견딤).
  const prevGameState = useRef(gameState)
  useEffect(() => {
    const prev = prevGameState.current
    prevGameState.current = gameState
    if (gameState === 'WIN' && prev !== 'WIN') {
      const earned = scoreForWin(game.state)
      const next = total + earned
      setTotal(next)
      persistTotal(next)
      setLastEarned(earned)
      const nick = nickname.trim()
      if (nick) postScore(nick, next) // 게이트: 닉네임 있을 때만 제출(next = 새 누적 총점)
    }
    // gameState 변화에만 반응. 나머지 값은 WIN 커밋 시점에 읽음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState])

  return (
    <div className={styles.app}>
      <div className={styles.frame}>
        {gameState === 'INIT' &&
          (game.state.category == null ? (
            <CategorySelect
              onSelectCategory={game.actions.selectCategory}
              onHelp={() => setShowHowTo(true)}
              onRank={() => setShowRank(true)}
              nickname={nickname}
              total={total}
              onEditNickname={() => setShowNick(true)}
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
          <ResultScreen game={game} lastEarned={lastEarned} total={total} />
        )}
      </div>

      {showNick && (
        <NicknamePrompt
          initial={nickname}
          onSubmit={saveNickname}
          onClose={() => setShowNick(false)}
        />
      )}
      {showRank && (
        <Leaderboard myNickname={nickname} onClose={() => setShowRank(false)} />
      )}
      {showHowTo && <HowToPlay onClose={closeHowTo} />}
    </div>
  )
}
