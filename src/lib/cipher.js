/* =========================================================================
   cipher.js — 암호 힌트(cipher hint) 매핑 생성
   스펙 §3.2: 문장에 등장하는 고유 알파벳을 각각 고유 심볼에 매핑.
   같은 글자 = 같은 심볼. 매 라운드마다 새로 생성.
   ========================================================================= */

/**
 * 암호 숫자 풀 (1~26).
 *
 * 설계 근거:
 *  - 사용자 피드백: 특수기호(@ # $ %)는 "무슨 의미인지 감이 안 온다"(비직관적).
 *    → 크립토그램 장르 표준인 **숫자(1~26)** 로 교체. "같은 숫자 = 같은 글자"가
 *    훨씬 직관적이고 깔끔하다(AC1 메커니즘은 그대로 유지).
 *  - 알파벳은 26자뿐이라 1~26이면 항상 고유 매핑이 가능하다.
 *  - 명언 텍스트에는 숫자가 등장하지 않으므로(검증됨) 표시 혼동 없음.
 */
export const SYMBOL_POOL = Array.from({ length: 26 }, (_, i) => String(i + 1))

/**
 * Fisher-Yates 셔플 — 원본을 변형하지 않고 새 배열을 반환.
 * @param {Array} arr
 * @param {() => number} [rand] 0~1 난수 생성기 (테스트 주입용)
 * @returns {Array}
 */
export function fisherYates(arr, rand = Math.random) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 문장 텍스트에서 고유 알파벳(a-z)을 추출한다. 정렬된 배열로 반환.
 * 대소문자 구분 없음(소문자 처리). 비알파벳은 무시.
 * @param {string} text
 * @returns {string[]}
 */
export function uniqueLetters(text) {
  const set = new Set()
  for (const ch of text.toLowerCase()) {
    if (ch >= 'a' && ch <= 'z') set.add(ch)
  }
  return [...set].sort()
}

/**
 * 라운드용 암호 매핑 생성.
 * 고유 알파벳을 추출하고, 풀을 셔플한 뒤 앞에서부터 (중복 없이) 하나씩 배정한다.
 * @param {string} text 명언 텍스트
 * @param {() => number} [rand] 난수 생성기 (테스트 주입용)
 * @returns {Record<string, string>} 예: { e: '3', f: '5', r: '2' }
 */
export function buildCipherMap(text, rand = Math.random) {
  const letters = uniqueLetters(text)
  if (letters.length > SYMBOL_POOL.length) {
    // 풀(32)을 넘는 일은 알파벳이 26자뿐이라 실제로는 불가능하지만, 방어적으로 경고.
    console.warn(
      `[cipher] uniqueLetters(${letters.length}) > SYMBOL_POOL(${SYMBOL_POOL.length})`,
    )
  }
  const shuffled = fisherYates(SYMBOL_POOL, rand)
  const map = {}
  letters.forEach((letter, i) => {
    map[letter] = shuffled[i]
  })
  return map
}
