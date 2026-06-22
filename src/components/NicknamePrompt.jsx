import { useState } from 'react'
import styles from './NicknamePrompt.module.css'
import { MAX_NICK } from '../lib/leaderboard.js'

/**
 * 닉네임 입력 오버레이 (HowToPlay 미러).
 * 첫 실행 시 자동으로 뜨고, 이후엔 CategorySelect 의 닉네임 칩으로 다시 열 수 있다.
 * 닉네임이 곧 정체성 — 비밀번호 없음, 충돌 허용(캐주얼 학습 게임).
 *
 * CTA 는 입력이 비어있으면 disabled. 이는 (1) 빈 닉네임 방지이자
 * (2) e2e 의 dismissOnboarding 이 "시작하기" 버튼을 눌러도 무시되게 하는 가드.
 */
export default function NicknamePrompt({ initial = '', onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()

  function submit(e) {
    e.preventDefault()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="닉네임 입력">
      <form className={styles.sheet} onSubmit={submit}>
        <div className={styles.emoji} aria-hidden="true">👋</div>
        <h2 className={styles.title}>닉네임을 정해주세요</h2>
        <p className={styles.sub}>
          맞힌 문제로 점수가 쌓이고, 랭킹에 닉네임으로 표시돼요.
        </p>

        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="예: 영어고수"
          maxLength={MAX_NICK}
          autoFocus
          aria-label="닉네임"
        />

        <button className={styles.cta} type="submit" disabled={!trimmed}>
          시작하기
        </button>

        {/* 닉네임은 선택 — 없이도 플레이 가능(랭킹엔 안 올라감). 항상 노출. */}
        <button className={styles.skip} type="button" onClick={onClose}>
          {initial ? '취소' : '건너뛰기'}
        </button>
      </form>
    </div>
  )
}
