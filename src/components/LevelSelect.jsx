import styles from './LevelSelect.module.css'

const LEVELS = [
  { level: 1, name: 'Level 1', tag: 'EASY' },
  { level: 2, name: 'Level 2', tag: 'MEDIUM' },
  { level: 3, name: 'Level 3', tag: 'HARD' },
]

export default function LevelSelect({ category, onSelectLevel, onBack, onHelp }) {
  return (
    <div className={styles.wrap}>
      <button className={styles.backBtn} onClick={onBack} aria-label="카테고리 선택으로">
        ‹
      </button>
      <button className={styles.helpBtn} onClick={onHelp} aria-label="플레이 방법">
        ?
      </button>

      <header className={styles.header}>
        <h1 className={styles.title}>Quote Hangman</h1>
        <p className={styles.catBadge}>
          {category.emoji} {category.label}
        </p>
        <p className={styles.subtitle}>레벨을 골라 시작하세요.</p>
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
            <span className={styles.levelDesc}>{category.levelDesc[l.level]}</span>
          </button>
        ))}
      </div>

      <button className={styles.howLink} onClick={onHelp}>
        💡 처음이신가요? <u>플레이 방법 보기</u>
      </button>
    </div>
  )
}
