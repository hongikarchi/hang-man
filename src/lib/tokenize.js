/* =========================================================================
   tokenize.js — 명언을 "위치(position) 단위 토큰 배열"로 변환
   게임의 핵심 데이터 구조.

   스펙의 런타임 객체는 placedLetters 를 글자 단위 키로 두지만, 이 게임은
   각 빈칸이 독립적이다(AC4: 같은 글자가 여러 위치에 있어도 자동 공개 안 됨).
   따라서 상태는 글자가 아니라 "위치"마다 관리해야 한다.
   ========================================================================= */

/**
 * @typedef {Object} Token
 * @property {number} index   문장 내 위치 (= 빈칸 id, 안정적)
 * @property {string} char    원본 소문자 문자
 * @property {'letter'|'space'|'punct'} type
 * @property {string|null} letter   type==='letter'이면 a-z, 아니면 null
 * @property {string|null} cipher   letter면 cipherMap[letter], 아니면 null
 * @property {'empty'|'correct'} status   letter 토큰의 채움 상태
 * @property {boolean} isRevealed   L1 무료 공개 글자면 true (시작부터 correct)
 */

// 화면에 그대로 표시되는 허용 구두점 (스펙 §3.1). 그 외 문자는 space로 처리.
const PUNCT = new Set(['.', ',', "'", '?', '!', '-', ';', ':'])

/**
 * 한 문자의 종류를 판별한다.
 * @param {string} ch 소문자 1글자
 * @returns {'letter'|'space'|'punct'}
 */
function classify(ch) {
  if (ch >= 'a' && ch <= 'z') return 'letter'
  if (ch === ' ') return 'space'
  if (PUNCT.has(ch)) return 'punct'
  // 알 수 없는 문자(숫자 등)는 그대로 보여주되 비상호작용 → punct 취급
  return 'punct'
}

/**
 * 명언 텍스트를 토큰 배열로 변환.
 *
 * 주의:
 *  - 아포스트로피 `'` 와 하이픈 `-` 은 punct 로 그대로 표시(빈칸 아님).
 *    예) "don't" → d,o,n 빈칸 + `'` 그대로 + t 빈칸.  "self-made" 동일.
 *  - revealLetters 에 포함된 글자들은 미리 공개(난이도) — 모든 위치를 correct 로 시작.
 *
 * @param {string} text 명언 원문
 * @param {Record<string,string>} cipherMap buildCipherMap 결과
 * @param {string[]|Set<string>} [revealLetters] 미리 공개할 글자들 (없으면 빈 배열)
 * @returns {Token[]}
 */
export function tokenize(text, cipherMap, revealLetters = []) {
  const lower = text.toLowerCase()
  const revealSet = new Set([...revealLetters].map((l) => l.toLowerCase()))
  const tokens = []

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    const type = classify(ch)

    if (type === 'letter') {
      const isRevealed = revealSet.has(ch)
      tokens.push({
        index: i,
        char: ch,
        type: 'letter',
        letter: ch,
        cipher: cipherMap[ch] ?? '?',
        status: isRevealed ? 'correct' : 'empty',
        isRevealed,
      })
    } else {
      tokens.push({
        index: i,
        char: ch,
        type,
        letter: null,
        cipher: null,
        status: 'empty',
        isRevealed: false,
      })
    }
  }

  return tokens
}

/**
 * 토큰 배열을 "단어 그룹"으로 묶는다 (space 기준 분리).
 * QuoteBoard에서 단어 단위 줄바꿈(한 단어의 빈칸+암호가 줄 사이로 쪼개지지 않음)에 사용.
 * space 토큰 자체는 단어 사이 구분자로 별도 보관.
 *
 * @param {Token[]} tokens
 * @returns {Array<{type:'word', tokens:Token[]} | {type:'space', token:Token}>}
 */
export function groupIntoWords(tokens) {
  const groups = []
  let current = null

  for (const t of tokens) {
    if (t.type === 'space') {
      if (current) {
        groups.push({ type: 'word', tokens: current })
        current = null
      }
      groups.push({ type: 'space', token: t })
    } else {
      if (!current) current = []
      current.push(t)
    }
  }
  if (current) groups.push({ type: 'word', tokens: current })

  return groups
}
