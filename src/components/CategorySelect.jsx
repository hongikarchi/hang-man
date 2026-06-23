import styles from './CategorySelect.module.css'
import { CATEGORIES } from '../data/categories.js'

/**
 * 시작 화면: 카테고리(명언 / 여행 회화) 선택.
 * 선택하면 해당 카테고리의 레벨 선택 화면(LevelSelect)으로 넘어간다.
 */
export default function CategorySelect({
  onSelectCategory,
  onHelp,
  onRank,
  nickname = '',
  total = 0,
  onEditNickname,
  onLogout,
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <button className={styles.rankBtn} onClick={onRank} aria-label="랭킹 보기">
          🏆 랭킹
        </button>
        <button className={styles.helpBtn} onClick={onHelp} aria-label="플레이 방법">
          ?
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Quote Hangman</h1>
        <p className={styles.subtitle}>
          영어 문장을 숫자 힌트로 추론하며 맞춰보세요.
        </p>
        {nickname && (
          <div className={styles.nickRow}>
            <button className={styles.nickChip} onClick={onEditNickname} aria-label="닉네임 변경">
              <span className={styles.nickName}>👤 {nickname}</span>
              <span className={styles.nickTotal}>{total}점</span>
            </button>
            {onLogout && (
              <button className={styles.logoutBtn} onClick={onLogout} aria-label="로그아웃">
                로그아웃
              </button>
            )}
          </div>
        )}
      </header>

      <div className={styles.categories}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={styles.catBtn}
            data-category={c.id}
            onClick={() => onSelectCategory(c.id)}
          >
            <span className={styles.catEmoji} aria-hidden="true">{c.emoji}</span>
            <span className={styles.catName}>{c.label}</span>
            <span className={styles.catDesc}>{c.desc}</span>
          </button>
        ))}
      </div>

      <button className={styles.howLink} onClick={onHelp}>
        💡 처음이신가요? <u>플레이 방법 보기</u>
      </button>
    </div>
  )
}
