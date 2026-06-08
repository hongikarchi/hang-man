/* quotes.json 검증: 레벨별 길이 범위 + 허용 문자 집합.
   실행: node scripts/validate-quotes.mjs   (npm run validate-quotes) */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { uniqueLetters, SYMBOL_POOL } from '../src/lib/cipher.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const quotes = JSON.parse(
  readFileSync(join(__dirname, '../src/data/quotes.json'), 'utf-8'),
)

// 레벨별 길이 범위 (disjoint). 계획 §F.
const RANGE = {
  1: { min: 0, max: 60 },
  2: { min: 61, max: 99 },
  3: { min: 100, max: Infinity },
}

// 명언 텍스트에 허용되는 비알파벳 문자 (스펙 §3.1 + 안전 구두점).
// 암호 심볼 풀과 겹치면 화면에서 혼동되므로, 겹치는 문자가 없어야 한다.
const ALLOWED_NONALPHA = new Set([' ', '.', ',', "'", '?', '!', '-', ';', ':'])
const poolSet = new Set(SYMBOL_POOL)

let errors = 0
const err = (msg) => { errors++; console.error('  ✗', msg) }

const counts = { 1: 0, 2: 0, 3: 0 }
const ids = new Set()

for (const q of quotes) {
  // 스키마
  if (typeof q.id !== 'number') err(`id 누락/형식: ${JSON.stringify(q)}`)
  if (ids.has(q.id)) err(`중복 id: ${q.id}`)
  ids.add(q.id)
  if (typeof q.text !== 'string' || !q.text) err(`text 누락: id ${q.id}`)
  if (![1, 2, 3].includes(q.level)) err(`level 범위 밖: id ${q.id}`)
  if (typeof q.author !== 'string') err(`author 누락: id ${q.id}`)

  counts[q.level] = (counts[q.level] || 0) + 1

  // 길이 범위
  const len = q.text.length
  const r = RANGE[q.level]
  if (len < r.min || len > r.max) {
    err(`길이 불일치: id ${q.id} (L${q.level}, ${len}자, 허용 ${r.min}~${r.max}) "${q.text}"`)
  }

  // 허용 문자 검사 + 암호 풀 충돌 검사
  for (const ch of q.text.toLowerCase()) {
    const isLetter = ch >= 'a' && ch <= 'z'
    if (!isLetter && !ALLOWED_NONALPHA.has(ch)) {
      err(`허용되지 않은 문자 '${ch}' (id ${q.id}) "${q.text}"`)
    }
    if (poolSet.has(ch) && !isLetter) {
      err(`암호 풀과 충돌하는 문자 '${ch}' (id ${q.id})`)
    }
  }

  // 글자 다양성(너무 적으면 패턴 추론이 무의미)
  const u = uniqueLetters(q.text)
  if (u.length < 6) err(`고유 글자 너무 적음(${u.length}): id ${q.id} "${q.text}"`)
  if (u.length > SYMBOL_POOL.length) err(`고유 글자(${u.length}) > 풀(${SYMBOL_POOL.length}): id ${q.id}`)
}

console.log('레벨별 명언 수:', counts)
console.log('총:', quotes.length, '개')

for (const lvl of [1, 2, 3]) {
  if (counts[lvl] < 5) err(`L${lvl} 명언이 5개 미만(${counts[lvl]}) — 반복 플레이 곤란`)
}

if (errors === 0) {
  console.log('\n✓ 모든 명언 검증 통과')
  process.exit(0)
} else {
  console.error(`\n✗ ${errors}개 오류`)
  process.exit(1)
}
