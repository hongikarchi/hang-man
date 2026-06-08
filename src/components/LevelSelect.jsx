import styles from './LevelSelect.module.css'

const LEVELS = [
  { level: 1, name: 'Level 1', desc: '짧은 명언 · 글자 절반 미리 공개 · 시도 8회', tag: 'EASY' },
  { level: 2, name: 'Level 2', desc: '중간 길이 · 몇 글자만 공개 · 시도 7회', tag: 'MEDIUM' },
  { level: 3, name: 'Level 3', desc: '긴 명언 · 공개 없음 · 시도 6회', tag: 'HARD' },
]

export default function LevelSelect({ onSelectLevel, onHelp }) {
  return (
    <div className={styles.wrap}>
      <button className={styles.helpBtn} onClick={onHelp} aria-label="플레이 방법">
        ?
      </button>

      <header className={styles.header}>
        <h1 className={styles.title}>Quote Hangman</h1>
        <p className={styles.subtitle}>
          영어 명언을 숫자 힌트로 추론하며 맞춰보세요.
        </p>
      </header>

      <div className={styles.levels}>
        {LEVELS.map((l) => (
          <button
            key={l.level}
            className={styles.levelBtn}
            data-level={l.level}
            onClick={() => onSelectLevel(l.level)}
          >
            <span className={styles.levelTag}>{l.tag}</span>
            <span className={styles.levelName}>{l.name}</span>
            <span className={styles.levelDesc}>{l.desc}</span>
          </button>
        ))}
      </div>

      <button className={styles.howLink} onClick={onHelp}>
        💡 처음이신가요? <u>플레이 방법 보기</u>
      </button>
    </div>
  )
}
