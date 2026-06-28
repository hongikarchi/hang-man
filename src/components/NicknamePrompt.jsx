import { useState } from 'react'
import styles from './NicknamePrompt.module.css'
import { MAX_NICK } from '../lib/leaderboard.js'

/**
 * 닉네임 입력 오버레이 (HowToPlay 미러).
 * 첫 실행 시 자동으로 뜨고, 이후엔 CategorySelect 의 닉네임 칩으로 다시 열 수 있다.
 *
 * 닉네임 + 선택적 4자리 PIN 으로 정체성을 만든다:
 *  - PIN 을 걸면 그 닉이 "잠겨" 사칭/덮어쓰기를 막고, 다른 기기에서 닉+PIN 으로 복구한다.
 *  - PIN 은 선택 — 비워두면 잠금 없이 진행(기존 캐주얼 동작 그대로, 랭킹엔 닉만 올라감).
 *  - 이미 잠긴 닉으로 들어가려면 PIN 이 맞아야 한다(틀리면 onSubmit 이 에러를 돌려줌).
 *
 * CTA(시작하기) 는 닉네임이 비어있을 때만 disabled. 이는 (1) 빈 닉네임 방지이자
 * (2) e2e 의 dismissOnboarding 이 "시작하기" 를 무시하고 "건너뛰기" 로 통과하게 하는 가드.
 * ⚠ PIN 유무로는 절대 disabled 하지 않는다 — PIN 은 선택이라 빈 PIN 도 정상 제출이며,
 *   PIN 으로 CTA 를 막으면 e2e 의 "건너뛰기" 경로가 아니라 여기서 멈출 수 있다.
 *
 * onSubmit(nickname, pin) 은 async 이고 실패할 수 있다(PIN 틀림 등).
 *  - 성공(또는 잠금 없는 통과)이면 부모가 오버레이를 닫는다(onSubmit 이 닫음).
 *  - 실패면 { error: '메시지' } 를 반환 → 여기서 그 메시지를 띄우고 오버레이는 유지한다.
 */
export default function NicknamePrompt({ initial = '', onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const trimmed = value.trim()

  // PIN 입력은 숫자만, 최대 4자리(빈 값 허용 — 선택이므로).
  function onPinChange(e) {
    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
    if (error) setError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!trimmed || busy) return
    // PIN 을 입력했다면 4자리를 채워야 한다(부분 입력 방지). 비웠으면 잠금 없이 진행.
    if (pin && pin.length !== 4) {
      setError('PIN 은 숫자 4자리예요')
      return
    }
    setBusy(true)
    setError('')
    const result = await onSubmit(trimmed, pin) // 성공 시 부모가 닫음 → 여기 코드는 더 안 보임
    // 실패로 돌아오면 오버레이를 유지하고 메시지를 띄운다.
    if (result?.error) setError(result.error)
    setBusy(false)
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
          onChange={(e) => { setValue(e.target.value); if (error) setError('') }}
          placeholder="예: 영어고수"
          maxLength={MAX_NICK}
          autoFocus
          aria-label="닉네임"
        />

        <input
          className={styles.input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={onPinChange}
          placeholder="PIN 4자리 (선택)"
          aria-label="PIN 4자리 (선택)"
        />
        <p className={styles.hint}>
          PIN 을 정하면 내 닉네임을 잠가 다른 기기에서도 점수를 이어가요. 비워도 괜찮아요.
        </p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button className={styles.cta} type="submit" disabled={!trimmed || busy}>
          {busy ? '확인 중…' : '시작하기'}
        </button>

        {/* 닉네임은 선택 — 없이도 플레이 가능(랭킹엔 안 올라감). 항상 노출. */}
        <button className={styles.skip} type="button" onClick={onClose} disabled={busy}>
          {initial ? '취소' : '건너뛰기'}
        </button>
      </form>
    </div>
  )
}
