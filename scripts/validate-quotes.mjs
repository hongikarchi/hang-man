/* 데이터 검증: 카테고리별(명언/여행 회화) 길이 범위 + 허용 문자 + ko 번역 필수.
   실행: node scripts/validate-quotes.mjs   (npm run validate-quotes) */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { uniqueLetters, SYMBOL_POOL } from '../src/lib/cipher.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const load = (file) =>
  JSON.parse(readFileSync(join(__dirname, `../src/data/${file}`), 'utf-8'))

// 카테고리별 레벨 길이 범위 (disjoint).
const DATASETS = [
  {
    name: '명언(quotes)',
    data: load('quotes.json'),
    requireAuthor: true,
    range: {
      1: { min: 0, max: 60 },
      2: { min: 61, max: 99 },
      3: { min: 100, max: Infinity },
    },
  },
  {
    // 여행 회화는 짧은 실용 표현이 본질(대부분 15~50자). movies 처럼 이 카테고리만
    // 밴드를 데이터 실제 분포에 맞춰 낮춘다(원래 L3 76자+ 하한은 회화엔 비현실적 →
    // L3 가 비어 검증 실패). 24/31 경계로 L1/L2/L3 균형(54/86/60).
    name: '여행 회화(travel)',
    data: load('travel.json'),
    requireAuthor: false,
    range: {
      1: { min: 14, max: 24 },
      2: { min: 25, max: 31 },
      3: { min: 32, max: 115 },
    },
  },
  {
    name: '비즈니스 영어(business)',
    data: load('business.json'),
    requireAuthor: false,
    range: {
      1: { min: 14, max: 40 },
      2: { min: 41, max: 75 },
      3: { min: 76, max: 115 },
    },
  },
  {
    // 영화 명대사는 본질적으로 짧다(예: Jaws "You're gonna need a bigger boat" 32자).
    // 여행/명언 기준 L3 하한(76자+)을 쓰면 길이를 맞추려 채우기 단어를 넣어 '가짜 대사'가
    // 되므로, 이 카테고리만 L3 하한을 낮춰(61자+) 짧은 진짜 명대사를 패딩 없이 담는다.
    name: '영화 명대사(movies)',
    data: load('movies.json'),
    requireAuthor: true,
    range: {
      1: { min: 14, max: 40 },
      2: { min: 41, max: 56 },
      3: { min: 57, max: 115 },
    },
  },
]

// 텍스트에 허용되는 비알파벳 문자 (스펙 §3.1 + 안전 구두점).
// 암호 심볼 풀과 겹치면 화면에서 혼동되므로, 겹치는 문자가 없어야 한다.
const ALLOWED_NONALPHA = new Set([' ', '.', ',', "'", '?', '!', '-', ';', ':'])
const poolSet = new Set(SYMBOL_POOL)

// 한 단어 최대 글자 수 — QuoteBoard 폰트 캡이 과도하게 작아지지 않게 데이터에서 차단.
// (14자+ 단어는 360px 화면에서 폰트가 ~13px 이하로 떨어진다.)
const MAX_WORD_LETTERS = 13

let errors = 0
const err = (msg) => { errors++; console.error('  ✗', msg) }

const ids = new Set() // 카테고리 통틀어 전역 유일해야 함

for (const ds of DATASETS) {
  console.log(`\n=== ${ds.name} ===`)
  const counts = { 1: 0, 2: 0, 3: 0 }

  for (const q of ds.data) {
    // 스키마
    if (typeof q.id !== 'number') err(`id 누락/형식: ${JSON.stringify(q)}`)
    if (ids.has(q.id)) err(`중복 id(전역): ${q.id}`)
    ids.add(q.id)
    if (typeof q.text !== 'string' || !q.text) err(`text 누락: id ${q.id}`)
    if (![1, 2, 3].includes(q.level)) err(`level 범위 밖: id ${q.id}`)
    if (ds.requireAuthor && typeof q.author !== 'string') err(`author 누락: id ${q.id}`)
    if (!ds.requireAuthor && 'author' in q) err(`author 키가 있으면 안 됨: id ${q.id}`)

    // 한국어 뜻 (학습용 — 게임 중/결과 화면에 표시)
    if (typeof q.ko !== 'string' || !q.ko.trim()) err(`ko 번역 누락: id ${q.id}`)
    // e2e readState가 body 텍스트에서 "남은 N"을 파싱하므로 ko에 그 패턴이 있으면 안 됨.
    if (typeof q.ko === 'string' && /남은\s*\d/.test(q.ko)) {
      err(`ko에 "남은 <숫자>" 패턴 금지(e2e 파서 충돌): id ${q.id}`)
    }

    counts[q.level] = (counts[q.level] || 0) + 1

    // 길이 범위
    const len = q.text.length
    const r = ds.range[q.level]
    if (r && (len < r.min || len > r.max)) {
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

    // 단어 길이 가드 (모바일 가로 맞춤 — 단어는 줄 중간에서 안 쪼개지므로)
    for (const w of q.text.toLowerCase().split(/\s+/)) {
      const n = (w.match(/[a-z]/g) || []).length
      if (n > MAX_WORD_LETTERS) {
        err(`단어가 너무 긺(${n}자 > ${MAX_WORD_LETTERS}): "${w}" (id ${q.id})`)
      }
    }

    // 글자 다양성(너무 적으면 패턴 추론이 무의미)
    const u = uniqueLetters(q.text)
    if (u.length < 6) err(`고유 글자 너무 적음(${u.length}): id ${q.id} "${q.text}"`)
    if (u.length > SYMBOL_POOL.length) err(`고유 글자(${u.length}) > 풀(${SYMBOL_POOL.length}): id ${q.id}`)
  }

  console.log('레벨별 문장 수:', counts)
  console.log('총:', ds.data.length, '개')

  for (const lvl of [1, 2, 3]) {
    if (counts[lvl] < 5) err(`${ds.name} L${lvl} 문장이 5개 미만(${counts[lvl]}) — 반복 플레이 곤란`)
  }
}

if (errors === 0) {
  console.log('\n✓ 모든 데이터 검증 통과')
  process.exit(0)
} else {
  console.error(`\n✗ ${errors}개 오류`)
  process.exit(1)
}
