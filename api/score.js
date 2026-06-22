// POST /api/score — 닉네임의 누적 총점을 upsert.
// body: { nickname: string, score: number }  (score = 클라가 보낸 "새 누적 총점")
// GREATEST(기존, 제출)로 합쳐 stale/낮은 재시도가 보드를 역행시키지 않음(idempotent).
//
// DATABASE_URL 은 서버 전용 환경변수(Neon 연동이 자동 주입). 절대 VITE_ 접두사 금지.
import { neon } from '@neondatabase/serverless'

const MAX_NICK = 24
const MAX_SCORE = 10_000_000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  // body 는 Vercel 이 JSON 으로 파싱해 주지만, 문자열로 올 수도 있어 방어적으로 처리.
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'invalid_json' })
    }
  }
  body = body || {}

  const nickname = String(body.nickname ?? '').trim().slice(0, MAX_NICK)
  if (!nickname) return res.status(400).json({ error: 'nickname_required' })

  const raw = Number(body.score)
  if (!Number.isFinite(raw)) return res.status(400).json({ error: 'score_invalid' })
  const score = Math.min(Math.max(Math.round(raw), 0), MAX_SCORE)

  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`
      INSERT INTO scores (nickname, score, updated_at)
      VALUES (${nickname}, ${score}, now())
      ON CONFLICT (nickname)
      DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score), updated_at = now()
      RETURNING nickname, score
    `
    return res.status(200).json(rows[0])
  } catch (err) {
    // DB 에러/연결문자열을 클라에 노출하지 않는다.
    console.error('POST /api/score failed:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
