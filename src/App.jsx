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
import { serializeProgress } from './hooks/useGame.js'
import {
  getNickname,
  setNickname as persistNickname,
  getTotal,
  setTotal as persistTotal,
  getToken,
  setToken as persistToken,
  postScore,
  fetchScore,
  loginNickname,
  MAX_NICK,
} from './lib/leaderboard.js'
import {
  loadLocalProgress,
  saveLocalProgress,
  fetchPlayed,
  postPlayed,
} from './lib/progress.js'
import styles from './App.module.css'

const SEEN_KEY = 'qh_seen_howto'

export default function App() {
  const game = useGame()
  const { gameState } = game.state

  // ---- 닉네임 / 누적 총점 (localStorage 가 진실의 원천, state 는 반응형 미러) ----
  const [nickname, setNick] = useState(getNickname)
  const [total, setTotal] = useState(getTotal)
  const [lastEarned, setLastEarned] = useState(0)
  // 잠긴 닉의 서버 쓰기 토큰. 잠기지 않은/익명 닉은 빈 문자열(서버가 토큰 없이도 통과).
  const [token, setTok] = useState(getToken)

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

  // 닉네임(+선택 PIN)으로 로그인/등록. NicknamePrompt 의 onSubmit.
  // 반환 계약:
  //  - 성공/잠금없는 통과 → 오버레이를 닫고(undefined 반환). 점수/토큰 정착.
  //  - PIN 실패(잠긴 닉 PIN 틀림/필요) → { error } 반환 → 오버레이 유지(닉 저장 안 함).
  // fail-soft: 서버 도달 실패(vite dev/오프라인)는 "잠금 없는 통과"로 취급해 게임을 막지 않는다.
  async function saveNickname(name, pin) {
    const clean = String(name ?? '').trim().slice(0, MAX_NICK)
    if (!clean) return

    // 이미 이 닉으로 로그인돼 있고(토큰 보유) PIN 을 새로 입력하지 않았다면, 재검증 없이 닫는다.
    // (잠긴 닉의 칩을 눌러 프롬프트를 다시 열었을 때 PIN 재입력을 강요하지 않기 위함 —
    //  PIN 을 입력했다면 변경/재확인 의도로 보고 아래 정상 흐름을 탄다.)
    if (clean === nickname.trim() && token && !pin) {
      setShowNick(false)
      return
    }

    // 먼저 서버에 로그인/등록을 시도. 여기서 잠긴 닉의 PIN 이 검증된다.
    const auth = await loginNickname(clean, pin)

    // PIN 관련 실패만 사용자에게 되돌린다(오버레이 유지). 닉/점수는 건드리지 않는다.
    if (!auth.ok && auth.reason !== 'network') {
      const msg =
        auth.reason === 'pin_required' ? '이미 PIN 으로 잠긴 닉네임이에요. PIN 을 입력해 주세요.'
        : auth.reason === 'pin_mismatch' ? 'PIN 이 일치하지 않아요.'
        : auth.reason === 'pin_invalid' ? 'PIN 은 숫자 4자리예요.'
        : '로그인에 실패했어요. 다시 시도해 주세요.'
      return { error: msg }
    }

    // 여기부터는 "정착" — 이전 정체성을 먼저 잡고(아직 state 갱신 전) 닉을 저장한다.
    const prev = nickname.trim()
    persistNickname(clean)
    setNick(clean)
    // 토큰: 성공 응답이면 그 값(잠긴 닉이면 토큰, 아니면 빈 문자열)으로 교체.
    // network 폴백이면 토큰 정보를 모르므로 비운다(잠긴 닉이라면 이후 쓰기는 막히지만 로컬은 동작).
    const nextToken = auth.ok ? (auth.token || '') : ''
    persistToken(nextToken)
    setTok(nextToken)
    setShowNick(false)

    // ── 점수 정착 ──
    // auth 가 score 를 이미 돌려줬으면(서버 도달 성공) 그걸 권위값으로 쓴다. 안 그러면 fetchScore.
    const serverScore = auth.ok ? auth.score : await fetchScore(clean)

    // 정체성 전환 (alice → bob): 로컬 누적 총점은 "이전 사람" 것이므로 절대 물려주지 않는다.
    // 새 닉네임의 서버 점수(없으면 0)로 통째로 교체. 합치지도, 이전 총점을 올리지도 않는다.
    if (prev && prev !== clean) {
      const next = serverScore ?? 0 // 조회 실패/신규 → 0 (이전 닉의 점수를 끌고오지 않음)
      setTotal(next)
      persistTotal(next)
      return
    }

    // 같은 닉네임 재확인 또는 익명→첫 닉 등록(prev 없음):
    // 다른 기기/오프라인 누적과 합치는 것이 정당하다. 서버 GREATEST 와 일관.
    if (serverScore == null) return // 조회 실패 → 로컬 값 유지(0으로 덮어쓰지 않음)
    const local = getTotal()
    const merged = Math.max(local, serverScore)
    if (merged !== local) {
      setTotal(merged)
      persistTotal(merged)
    }
    // 로컬이 서버보다 컸다면 서버에도 반영(이 기기에서 더 많이 쌓았을 수 있음). 토큰 동봉.
    if (merged > serverScore) postScore(clean, merged, nextToken)
  }

  // 로그아웃: 정체성/누적 총점/토큰을 비우고 닉네임 프롬프트를 다시 띄운다.
  // (서버 점수는 닉네임 키로 남아있어, 같은 닉으로 재로그인하면 복구됨. 잠긴 닉은 PIN 필요.)
  function logout() {
    persistNickname('')
    persistTotal(0)
    persistToken('')
    setNick('')
    setTotal(0)
    setTok('')
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
      if (nick) postScore(nick, next, token) // 게이트: 닉네임 있을 때만 제출(next = 새 누적 총점, 잠긴 닉이면 토큰 동봉)
    }
    // gameState 변화에만 반응. 나머지 값은 WIN 커밋 시점에 읽음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState])

  // ---- 진행(푼 문제) 영속화: localStorage 1차 + 닉네임 서버 동기화 ----
  const { hydratePlayed } = game.actions
  const { playedIds, cycles, category, level, quote } = game.state

  // (1) 마운트 시 localStorage 복원 — 같은 기기 재방문/익명 사용자 처리(서버 불필요).
  //     reducer 병합은 멱등이라 StrictMode 2중 실행도 안전.
  useEffect(() => {
    const local = loadLocalProgress()
    if (local) hydratePlayed(local)
  }, [hydratePlayed])

  // (2) 진행이 바뀔 때마다 localStorage 에 저장(진실의 원천 유지).
  //     playedIds/cycles 가 새 라운드 시작·병합으로 바뀌면 직렬화해 보존.
  //     ⚠ 첫 호출(마운트)은 건너뛴다 — 그 시점은 복원(1) 전의 빈 초기상태라, 저장하면
  //     실제 진행을 빈 값으로 덮어쓴다(이펙트는 선언순 실행이라 복원이 아직 커밋 안 됨).
  //     복원 dispatch 의 재렌더로 playedIds 가 바뀌면 그때(2번째 호출부터) 올바른 값 저장.
  const skipFirstSave = useRef(true)
  useEffect(() => {
    if (skipFirstSave.current) { skipFirstSave.current = false; return }
    saveLocalProgress(serializeProgress(game.state))
    // 진행 객체 참조가 바뀔 때만(라운드 시작/병합). 직렬화는 12칸이라 가벼움.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playedIds, cycles])

  // (3) 라운드 시작 시 닉네임 기준 서버 동기화 (있을 때만, 전부 fail-soft async).
  //     - 방금 뽑힌 문제를 서버에 마킹(postPlayed)
  //     - 그 (카테고리,레벨,사이클)의 서버 기록을 받아 union → 다음 NEXT_QUESTION 이 회피
  //     quote.id 가 바뀔 때마다(= 새 라운드) 발동. 네트워크는 라운드 시작을 막지 않음.
  const lastSyncedQuote = useRef(null)
  useEffect(() => {
    const nick = nickname.trim()
    if (gameState !== 'PLAYING' || !nick || !category || !level || quote == null) return
    // 닉네임을 키에 포함 → 라운드 중 로그인/닉 전환 시 새 정체성으로 재동기화.
    // (중복 동기화 방지 — StrictMode/리렌더)
    const key = `${nick}/${category}/${level}/${quote.id}`
    if (lastSyncedQuote.current === key) return
    lastSyncedQuote.current = key

    const cycle = cycles[category][level]
    postPlayed(nick, category, level, cycle, quote.id, token) // fire-and-forget (잠긴 닉이면 토큰 동봉)
    fetchPlayed(nick, category, level, cycle).then((ids) => {
      if (ids && ids.length) {
        hydratePlayed({ [category]: { [level]: { ids, cycle } } })
      }
    })
    // quote.id/닉네임 전환에 반응(라운드·정체성 단위). 나머지는 그 시점 값으로 읽음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id, gameState, nickname])

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
