// GET /api/leaderboard?limit=10 — 점수 내림차순 top-N.
// 동점은 먼저 도달한 사람(updated_at 오름차순)이 위.
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const raw = Number(req.query?.limit)
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), 100) : 10

  try {
    const sql = neon(process.env.DATABASE_URL)
    const leaderboard = await sql`
      SELECT nickname, score
      FROM scores
      ORDER BY score DESC, updated_at ASC
      LIMIT ${limit}
    `
    return res.status(200).json({ leaderboard })
  } catch (err) {
    console.error('GET /api/leaderboard failed:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
