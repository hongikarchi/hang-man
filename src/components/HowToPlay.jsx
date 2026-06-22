import styles from './HowToPlay.module.css'

/**
 * 플레이 방법 안내 오버레이.
 * 사용자 #1 불만("어떻게 하는지 모르겠다")을 직접 해결.
 * 숫자 힌트의 핵심(같은 숫자=같은 글자)을 작은 예시로 보여준다.
 */
export default function HowToPlay({ onClose }) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="플레이 방법">
      <div className={styles.sheet}>
        <h2 className={styles.title}>플레이 방법</h2>

        {/* 핵심 시각 예시: 같은 숫자 = 같은 글자 */}
        <div className={styles.example} aria-hidden="true">
          <div className={styles.exRow}>
            <Slot letter="F" n="5" filled />
            <Slot letter="R" n="2" filled />
            <Slot letter="E" n="3" filled />
            <Slot letter="E" n="3" filled />
          </div>
          <p className={styles.exCaption}>
            같은 숫자는 <b>같은 글자</b> · 위 두 칸은 모두 <b>3</b> → 같은 글자 <b>E</b>
          </p>
        </div>

        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <span>
              아래 <b>글자 카드</b>를 탭해서 고르세요. (또는 드래그)
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <span>
              빈칸에 놓으면 <b>같은 숫자 칸이 모두 자동으로</b> 채워져요.
              (예: 3=A로 정하면 모든 3칸에 A)
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <span>
              칸 아래 <b>숫자</b>는 단서예요. 같은 숫자끼리 같은 글자!
              쉬운 레벨은 <b>몇 글자가 미리 채워져</b> 있어요.
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>4</span>
            <span>
              라운드당 <b>힌트 2번</b>! <b>💡 힌트</b>는 글자 1종을,
              <b> 뜻 보기</b>는 한글 해석을 공개해요. 어디에 쓸지 선택!
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>!</span>
            <span>
              틀리면 <b>하트</b>가 줄어요. 하트가 다 떨어지기 전에 맞히세요.
            </span>
          </li>
        </ol>

        <button className={styles.cta} onClick={onClose}>
          시작하기
        </button>
      </div>
    </div>
  )
}

function Slot({ letter, n, filled }) {
  return (
    <span className={`${styles.slot} ${filled ? styles.slotFilled : ''}`}>
      <span className={styles.slotLetter}>{letter}</span>
      <span className={styles.slotNum}>{n}</span>
    </span>
  )
}
