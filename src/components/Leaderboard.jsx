import { useEffect, useState } from 'react'
import styles from './Leaderboard.module.css'
import { fetchLeaderboard } from '../lib/leaderboard.js'

/**
 * 랭킹 모달 (HowToPlay 미러). 열릴 때만 lazy fetch.
 * fetchLeaderboard 는 어떤 실패에서도 [] 를 돌려주므로 여기선 크래시가 없다.
 * (서버 미설정/오프라인이면 빈 목록 안내만 뜬다.)
 *
 * @param myNickname  내 행을 강조하기 위한 현재 닉네임
 */
export default function Leaderboard({ myNickname = '', onClose }) {
  const [rows, setRows] = useState(null) // null = 로딩 중, [] = 비었음

  useEffect(() => {
    let alive = true
    fetchLeaderboard(20).then((list) => {
      if (alive) setRows(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="랭킹">
      <div className={styles.sheet}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <h2 className={styles.title}>🏆 랭킹</h2>

        {rows === null && <p className={styles.state}>불러오는 중…</p>}

        {rows !== null && rows.length === 0 && (
          <p className={styles.state}>
            아직 랭킹이 없어요. 첫 점수의 주인공이 되어보세요!
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <ol className={styles.list}>
            {rows.map((r, i) => {
              const me = myNickname && r.nickname === myNickname
              return (
                <li
                  key={`${r.nickname}-${i}`}
                  className={`${styles.row} ${me ? styles.me : ''}`}
                >
                  <span className={styles.rank}>{medal(i)}</span>
                  <span className={styles.nick}>
                    {r.nickname}
                    {me && <span className={styles.youTag}>나</span>}
                  </span>
                  <span className={styles.score}>{r.score}점</span>
                </li>
              )
            })}
          </ol>
        )}

        <button className={styles.doneBtn} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
