// /api/played — 닉네임별 "푼 문제" 진행을 기기 간 동기화.
//  GET  ?nickname&category&level&cycle  → { played: number[] }  (그 사이클에 푼 quote_id 들)
//  POST { nickname, category, level, cycle, quoteId }            → 한 문제를 푼 것으로 마킹
//
// 설계 노트:
//  - localStorage 가 진실의 원천(같은 기기 재방문 + 익명 사용자 처리). 서버는 닉네임 기준
//    "기기 간" 동기화 레이어다. 그래서 닉네임이 없으면 이 API 는 애초에 호출되지 않는다.
//  - cycle 이 PK 의 일부다. 한 레벨을 소진하면 새 사이클(cycle+1)에서 같은 quote_id 를
//    다시 풀 수 있으므로, (nickname, category, level, quote_id) 만으로는 두 번째 사이클
//    기록이 ON CONFLICT 로 무시돼 사라진다. cycle 을 PK 에 넣어 사이클별로 분리한다.
//  - 모든 에러는 숨기고 절대 연결문자열/내부를 노출하지 않음(score.js 와 동일 규약).
//
// DATABASE_URL 은 서버 전용 환경변수(Neon). VITE_ 접두사 금지.
import { neon } from '@neondatabase/serverless'

const MAX_NICK = 24
const CATEGORIES = new Set(['quotes', 'travel', 'business', 'movies'])
const MAX_CYCLE = 100_000 // 방어적 상한 (정상 플레이로는 도달 불가)
const MAX_QUOTE_ID = 100_000_000

// 공통 파라미터 검증. 유효하면 정규화된 값을, 아니면 null 을 반환.
function parseScope({ nickname, category, level, cycle }) {
  const nick = String(nickname ?? '').trim().slice(0, MAX_NICK)
  if (!nick) return null
  const cat = String(category ?? '').trim()
  if (!CATEGORIES.has(cat)) return null
  const lvl = Number(level)
  if (![1, 2, 3].includes(lvl)) return null
  const cyc = Number(cycle)
  if (!Number.isInteger(cyc) || cyc < 0 || cyc > MAX_CYCLE) return null
  return { nick, cat, lvl, cyc }
}

export default async function handler(req, res) {
  // ---- GET: 그 (닉네임, 카테고리, 레벨, 사이클)에 푼 quote_id 목록 ----
  if (req.method === 'GET') {
    const scope = parseScope(req.query ?? {})
    if (!scope) return res.status(400).json({ error: 'invalid_params' })
    try {
      const sql = neon(process.env.DATABASE_URL)
      const rows = await sql`
        SELECT quote_id FROM played
        WHERE nickname = ${scope.nick}
          AND category = ${scope.cat}
          AND level = ${scope.lvl}
          AND cycle = ${scope.cyc}
      `
      return res.status(200).json({ played: rows.map((r) => Number(r.quote_id)) })
    } catch (err) {
      console.error('GET /api/played failed:', err)
      return res.status(500).json({ error: 'internal' })
    }
  }

  // ---- POST: 한 문제를 푼 것으로 마킹 (idempotent) ----
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'invalid_json' })
    }
  }
  body = body || {}

  const scope = parseScope(body)
  if (!scope) return res.status(400).json({ error: 'invalid_params' })
  const quoteId = Number(body.quoteId)
  if (!Number.isInteger(quoteId) || quoteId < 0 || quoteId > MAX_QUOTE_ID) {
    return res.status(400).json({ error: 'quote_id_invalid' })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)
    await sql`
      INSERT INTO played (nickname, category, level, quote_id, cycle, played_at)
      VALUES (${scope.nick}, ${scope.cat}, ${scope.lvl}, ${quoteId}, ${scope.cyc}, now())
      ON CONFLICT (nickname, category, level, quote_id, cycle) DO NOTHING
    `
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('POST /api/played failed:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
