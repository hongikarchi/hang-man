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
  fetchScore,
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

  async function saveNickname(name) {
    // persistNickname 이 localStorage 를 덮어쓰기 전에 "이전 정체성"을 먼저 잡는다.
    // (state 의 nickname 은 아직 이전 값 — setNick 리렌더 전이라 안전한 판별자.)
    const prev = nickname.trim()
    const clean = persistNickname(name)
    setNick(clean)
    setShowNick(false)
    if (!clean) return

    // 정체성 전환 (alice → bob): 로컬 누적 총점은 "이전 사람" 것이므로 절대 물려주지 않는다.
    // 새 닉네임의 서버 점수(없으면 0)로 통째로 교체. 합치지도, 이전 총점을 올리지도 않는다.
    if (prev && prev !== clean) {
      const serverScore = await fetchScore(clean)
      const next = serverScore ?? 0 // 조회 실패/신규 → 0 (이전 닉의 점수를 끌고오지 않음)
      setTotal(next)
      persistTotal(next)
      return
    }

    // 같은 닉네임 재확인 또는 익명→첫 닉 등록(prev 없음):
    // 다른 기기/오프라인 누적과 합치는 것이 정당하다. 서버 GREATEST 와 일관.
    const serverScore = await fetchScore(clean)
    if (serverScore == null) return // 조회 실패 → 로컬 값 유지(0으로 덮어쓰지 않음)
    const local = getTotal()
    const merged = Math.max(local, serverScore)
    if (merged !== local) {
      setTotal(merged)
      persistTotal(merged)
    }
    // 로컬이 서버보다 컸다면 서버에도 반영(이 기기에서 더 많이 쌓았을 수 있음).
    if (merged > serverScore) postScore(clean, merged)
  }

  // 로그아웃: 정체성/누적 총점을 비우고 닉네임 프롬프트를 다시 띄운다.
  // (서버 점수는 닉네임 키로 남아있어, 같은 닉으로 재로그인하면 fetchScore 로 복구됨.)
  function logout() {
    persistNickname('')
    persistTotal(0)
    setNick('')
    setTotal(0)
    setLastEarned(0)
    setShowNick(true)
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
              onLogout={logout}
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
