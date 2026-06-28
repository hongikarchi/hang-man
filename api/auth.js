// POST /api/auth — 닉네임 로그인/등록. PIN 으로 닉네임을 "잠그고" 서명 토큰을 발급한다.
// body: { nickname: string, pin?: "1234" }
// 반환(성공): { nickname, score, token?, locked: boolean }
//   - token: 이후 score/played 쓰기에 실어 보냄(있으면). locked: 이 닉이 PIN 으로 잠겼는지.
//
// 분기(닉의 현재 pin_hash 기준):
//   ┌ pin_hash 있음(잠긴 닉)
//   │   ├ PIN 일치        → OK + 토큰
//   │   ├ PIN 불일치      → 401 pin_mismatch
//   │   └ PIN 미제공      → 401 pin_required
//   └ pin_hash 없음(신규/레거시)
//       ├ PIN 제공        → 등록(선점, TOFU) → OK + 토큰, locked:true
//       └ PIN 미제공      → 레거시 통과(토큰 없음), locked:false
//
// fail-soft 규약(score.js 와 동일): DB/컬럼 문제는 내부 숨김. 단 "PIN 검증이 필요한데
// 검증할 수 없는" 상황(pin_hash 조회 실패)에서는 토큰을 발급하지 않는다(보안 우선).
// DATABASE_URL / AUTH_SECRET 은 서버 전용. VITE_ 접두사 금지.
import { neon } from '@neondatabase/serverless'
import { normalizePin, hashPin, verifyPin, issueToken, isAuthEnabled } from './_auth.js'

const MAX_NICK = 24

// scores 행을 닉네임으로 읽되, pin_hash 컬럼이 아직 없는 DB(ALTER 미적용)도 견딘다.
// 컬럼 부재(42703)면 pin_hash 를 null 로 간주(= 레거시, PIN 미설정)하고 score 만 읽는다.
async function readRow(sql, nickname) {
  try {
    const rows = await sql`SELECT score, pin_hash FROM scores WHERE nickname = ${nickname}`
    return rows[0] ?? { score: 0, pin_hash: null, _new: true }
  } catch (err) {
    if (err?.code === '42703') {
      const rows = await sql`SELECT score FROM scores WHERE nickname = ${nickname}`
      return rows[0] ? { score: rows[0].score, pin_hash: null } : { score: 0, pin_hash: null, _new: true }
    }
    throw err
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'invalid_json' }) }
  }
  body = body || {}

  const nickname = String(body.nickname ?? '').trim().slice(0, MAX_NICK)
  if (!nickname) return res.status(400).json({ error: 'nickname_required' })

  // PIN 은 선택. 보냈다면 형식(4자리 숫자)은 맞아야 한다.
  const hasPinInput = body.pin != null && String(body.pin).length > 0
  const pin = hasPinInput ? normalizePin(body.pin) : null
  if (hasPinInput && !pin) return res.status(400).json({ error: 'pin_invalid' })

  const now = Date.now()

  try {
    const sql = neon(process.env.DATABASE_URL)
    const row = await readRow(sql, nickname)
    const locked = !!row.pin_hash

    // ── 잠긴 닉: PIN 검증이 반드시 필요 ──
    if (locked) {
      if (!pin) return res.status(401).json({ error: 'pin_required', locked: true })
      if (!verifyPin(pin, row.pin_hash)) {
        return res.status(401).json({ error: 'pin_mismatch', locked: true })
      }
      return res.status(200).json({
        nickname, score: row.score ?? 0, locked: true,
        token: issueToken(nickname, now), // AUTH_SECRET 없으면 null(토큰 없이도 동작)
      })
    }

    // ── 잠기지 않은 닉(신규/레거시) + PIN 제공: 선점 등록(TOFU) ──
    // ⚠ AUTH_SECRET 미설정이면 잠그지 않는다. 잠그면 토큰을 발급 못 해(issueToken→null)
    //   이후 쓰기가 영영 401 로 막히는 사일런트 브릭이 된다. PIN 을 무시하고 레거시 통과시켜
    //   checkWriteAuth 의 isAuthEnabled 가드와 짝을 맞춘다(= 토큰 체계가 켜질 때까지 PIN 무효).
    if (pin && isAuthEnabled()) {
      const ph = hashPin(pin)
      // 동시 선점 경쟁 방지: pin_hash 가 여전히 NULL 일 때만 건다(이미 잠겼으면 안 덮어씀).
      // 컬럼이 없으면(레거시 DB) 잠금 자체가 불가 → 아래 catch 에서 레거시 통과로 강등.
      try {
        await sql`
          INSERT INTO scores (nickname, score, pin_hash, updated_at)
          VALUES (${nickname}, ${row.score ?? 0}, ${ph}, now())
          ON CONFLICT (nickname) DO UPDATE
            SET pin_hash = ${ph}, updated_at = now()
            WHERE scores.pin_hash IS NULL
        `
        // 방금 선점이 실제로 됐는지 재확인 — 경쟁에서 졌으면(다른 PIN 으로 이미 잠김)
        // 그 PIN 으로 검증해야 한다.
        const after = await readRow(sql, nickname)
        if (after.pin_hash && after.pin_hash !== ph) {
          if (!verifyPin(pin, after.pin_hash)) {
            return res.status(401).json({ error: 'pin_mismatch', locked: true })
          }
        }
        return res.status(200).json({
          nickname, score: after.score ?? row.score ?? 0, locked: true,
          token: issueToken(nickname, now),
        })
      } catch (err) {
        if (err?.code === '42703') {
          // pin_hash 컬럼 없음(ALTER 미적용): 잠금 불가 → 레거시처럼 통과(토큰 없음).
          console.warn('POST /api/auth: pin_hash column missing — running unlocked (apply db/schema.sql)')
          return res.status(200).json({ nickname, score: row.score ?? 0, locked: false })
        }
        throw err
      }
    }

    // ── 잠기지 않은 닉 + PIN 미제공: 레거시 통과(토큰 없음) ──
    // (AUTH_SECRET 미설정이면 토큰 체계가 꺼져 있어 어차피 평소처럼 동작.)
    return res.status(200).json({ nickname, score: row.score ?? 0, locked: false })
  } catch (err) {
    console.error('POST /api/auth failed:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
