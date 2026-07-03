/* 순수 로직 빠른 검증 (AC1, 토큰화). 실행: node scripts/sanity-logic.mjs */
import { buildCipherMap, uniqueLetters, SYMBOL_POOL } from '../src/lib/cipher.js'
import { tokenize, groupIntoWords } from '../src/lib/tokenize.js'
import { pickDecoyLetters } from '../src/lib/quotePicker.js'

let pass = 0
let fail = 0
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.error('  ✗ FAIL:', msg) }
}

console.log('--- cipher: "free" (스펙 §3.2 예시) ---')
const map = buildCipherMap('free')
console.log('  map =', map)
ok(Object.keys(map).length === 3, '고유 글자 3개(f,r,e)에 매핑')
ok(map.f && map.r && map.e, 'f,r,e 모두 심볼 보유')
ok(new Set(Object.values(map)).size === 3, 'AC1: 서로 다른 글자 → 서로 다른 암호')

const toks = tokenize('free', map)
const display = toks.map((t) => t.cipher).join(' ')
console.log('  cipher display =', display, '(같은 e는 같은 심볼이어야 함)')
ok(toks[2].cipher === toks[3].cipher, 'AC1: 같은 글자(e,e) → 같은 암호')
ok(toks.every((t) => t.type === 'letter'), '"free"는 전부 letter 토큰')

console.log('\n--- cipher: 실제 명언 (고유글자 다수) ---')
const long = 'The only limit to our realization of tomorrow is our doubts of today.'
const m2 = buildCipherMap(long)
const u2 = uniqueLetters(long)
console.log('  고유 글자 수 =', u2.length)
ok(u2.length <= SYMBOL_POOL.length, `고유글자(${u2.length}) ≤ 풀(${SYMBOL_POOL.length})`)
ok(new Set(Object.values(m2)).size === u2.length, 'AC1: 모든 고유글자가 고유 암호')

console.log('\n--- tokenize: 구두점/공백 처리 (AC2) ---')
const t3 = tokenize("don't stop.", buildCipherMap("don't stop."))
const apos = t3.find((t) => t.char === "'")
const dot = t3.find((t) => t.char === '.')
ok(apos && apos.type === 'punct', "아포스트로피 ' 는 punct (빈칸 아님)")
ok(dot && dot.type === 'punct', '마침표 . 는 punct')
ok(t3.some((t) => t.type === 'space'), '공백은 space 토큰')

console.log('\n--- tokenize: 미리 공개 글자(reveal letters, 난이도) ---')
const t4 = tokenize('letter', buildCipherMap('letter'), ['t'])
const tPositions = t4.filter((t) => t.letter === 't')
ok(tPositions.length === 2, '"letter"에 t 2개')
ok(tPositions.every((t) => t.status === 'correct' && t.isRevealed), 'reveal=[t] → 모든 t가 correct+isRevealed')
ok(t4.filter((t) => t.letter === 'e').every((t) => t.status === 'empty'), '공개 안 한 e는 empty')
// 다중 공개
const t5 = tokenize('letter', buildCipherMap('letter'), ['t', 'e'])
ok(t5.filter((t) => t.letter === 'e').every((t) => t.status === 'correct'), '다중 공개: e도 correct')
ok(t5.filter((t) => t.letter === 'l').every((t) => t.status === 'empty'), '공개 안 한 l은 empty')
ok(tokenize('letter', buildCipherMap('letter'), []).every((t) => t.type !== 'letter' || t.status === 'empty'), '빈 reveal → 전부 empty')

console.log('\n--- groupIntoWords ---')
const g = groupIntoWords(tokenize('a b', buildCipherMap('a b')))
ok(g.length === 3 && g[0].type === 'word' && g[1].type === 'space' && g[2].type === 'word',
   '"a b" → word, space, word')

console.log('\n--- pickDecoyLetters (더미 카드) ---')
{
  const seed = () => 0.5 // 결정적
  const text = 'Knowledge is power.'
  const used = new Set(uniqueLetters(text)) // k,n,o,w,l,e,d,g,i,s,p,r
  const d = pickDecoyLetters(text, 5, seed)
  ok(d.length === 5, `요청 5개 → 5개 반환 (실제 ${d.length})`)
  ok(d.every((ch) => !used.has(ch)), '★ 더미는 문장에 있는 글자와 절대 겹치지 않음')
  ok(d.every((ch) => ch >= 'a' && ch <= 'z'), '더미는 모두 a-z 소문자')
  ok(new Set(d).size === d.length, '더미끼리 중복 없음')
  // 결정적: 같은 seed → 같은 결과
  ok(pickDecoyLetters(text, 5, seed).join('') === d.join(''), 'seed 고정 시 결정적')
  // 캡: 26 - 실제고유수 초과 요청해도 그만큼만
  const cap = 26 - used.size
  const capped = pickDecoyLetters(text, 99, seed)
  ok(capped.length === cap, `★ 26-realCount(${cap}) 캡 준수 (99 요청 → ${capped.length})`)
  ok(capped.every((ch) => !used.has(ch)), '캡 상황에서도 문장 글자와 안 겹침')
  // n<=0 → []
  ok(pickDecoyLetters(text, 0, seed).length === 0, 'n=0 → 빈 배열')
  ok(pickDecoyLetters(text, -3, seed).length === 0, 'n<0 → 빈 배열')
  // 알파벳 거의 다 쓰는 문장: 더미 풀이 작아도 안전
  const pangram = 'The quick brown fox jumps over the lazy dog.' // 26자 전부
  ok(pickDecoyLetters(pangram, 5, seed).length === 0, '★ 팬그램(26자 전부) → 더미 0개(풀 없음)')
}

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
