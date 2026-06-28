// PIN 해싱 + 서명 토큰 — 의존성 없이 Node 내장 crypto 만 사용.
// (_ 접두사 파일은 Vercel 이 라우트로 노출하지 않으므로 공유 모듈로 안전.)
//
// 설계 요약:
//  - PIN 은 4자리 숫자(캐주얼). scrypt 로 솔트와 함께 해싱해 scores.pin_hash 에 저장.
//  - 로그인 1회만 PIN 을 검증(비쌈)하고, 이후 쓰기(score/played POST)는 HMAC 서명
//    토큰만 검증(쌈) — fire-and-forget 쓰기마다 scrypt 를 돌리지 않기 위함.
//  - 토큰은 닉네임과 만료시각을 담고 AUTH_SECRET 으로 서명. 위조 불가, 닉당 고정 아님.
//
// 환경변수:
//  - AUTH_SECRET (서버 전용, 절대 VITE_ 금지): 토큰 HMAC 키. 미설정 시 토큰 발급/검증
//    자체를 비활성(아래 isAuthEnabled). 그러면 "PIN 없던 시절"처럼 fail-soft 동작.
import crypto from 'node:crypto'

const SCRYPT_N = 16384 // 2^14 — 캐주얼 게임에 충분하고 serverless 콜드스타트에도 가벼움
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEYLEN = 32
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30일 — 학습 습관 주기를 덮는 넉넉한 창

// base64url (패딩 없는) — URL/JSON 어디에나 안전.
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// ---- PIN 정규화/검증 ----
// 4자리 숫자만 허용. UI 도 같은 규칙(빈/비숫자/길이≠4 거부).
export function normalizePin(pin) {
  const s = String(pin ?? '').trim()
  return /^\d{4}$/.test(s) ? s : null
}

// ---- PIN 해싱 (scrypt) ----
// 형식: "scrypt$<N>$<r>$<p>$<saltB64url>$<hashB64url>"  — 파라미터를 같이 저장해
// 나중에 N 등을 올려도 기존 해시를 그대로 검증할 수 있게 한다.
export function hashPin(pin) {
  const norm = normalizePin(pin)
  if (!norm) return null
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(norm, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p })
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${b64url(salt)}$${b64url(hash)}`
}

// 평문 PIN 이 저장된 해시와 일치하는가. 타이밍 안전 비교.
export function verifyPin(pin, stored) {
  const norm = normalizePin(pin)
  if (!norm || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  const salt = fromB64url(parts[4])
  const expected = fromB64url(parts[5])
  let actual
  try {
    actual = crypto.scryptSync(norm, salt, expected.length, { N, r, p })
  } catch {
    return false
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

// ---- 서명 토큰 (HMAC) ----
// 토큰 자체는 "이 닉네임으로 만료 전까지 서버에 쓸 권리" 증명서.
// 형식: "<payloadB64url>.<sigB64url>", payload = {n: nickname, exp: epochMs}
export function isAuthEnabled() {
  return typeof process.env.AUTH_SECRET === 'string' && process.env.AUTH_SECRET.length > 0
}

function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', process.env.AUTH_SECRET).update(payloadB64).digest())
}

// nowMs 를 주입받는 이유: 핸들러가 Date.now() 를 한 번만 읽어 발급/검증 시점을 명확히.
export function issueToken(nickname, nowMs) {
  if (!isAuthEnabled()) return null
  const payload = { n: String(nickname), exp: nowMs + TOKEN_TTL_MS }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${sign(payloadB64)}`
}

// 쓰기 게이트(score/played POST 공유): 이 닉이 PIN 으로 잠겨 있으면 유효 토큰을 요구.
// 반환: { allowed: boolean, reason?: 'pin_required'|'pin_invalid' }
//  - 닉이 잠기지 않음(pin_hash NULL/컬럼없음/레거시) → 항상 허용(토큰 무관).
//  - 닉이 잠김 + 토큰 유효 → 허용.  닉이 잠김 + 토큰 없음/무효 → 거부.
//  - sql/nickname/token/nowMs 를 받아 scores.pin_hash 를 직접 조회. 컬럼 부재(42703)는
//    "잠금 없음"으로 fail-soft 처리(스키마 미적용 DB 도 죽지 않음).
export async function checkWriteAuth(sql, nickname, token, nowMs) {
  // AUTH_SECRET 미설정이면 토큰 체계 자체가 꺼진 상태 → 잠금 개념이 없으니 항상 허용.
  // (auth.js 도 이 경우 PIN 잠금을 걸지 않으므로, 둘이 짝을 이뤄 "레거시 동작 그대로"가 됨.)
  if (!isAuthEnabled()) return { allowed: true }
  let pinHash = null
  try {
    const rows = await sql`SELECT pin_hash FROM scores WHERE nickname = ${nickname}`
    pinHash = rows[0]?.pin_hash ?? null
  } catch (err) {
    if (err?.code === '42703') return { allowed: true } // 컬럼 없음 → 잠금 개념 자체가 없음
    throw err
  }
  if (!pinHash) return { allowed: true } // 잠기지 않은 닉(레거시/익명) — 평소대로 허용
  if (verifyToken(token, nickname, nowMs)) return { allowed: true }
  return { allowed: false, reason: token ? 'pin_invalid' : 'pin_required' }
}

// 토큰이 유효하고(서명 OK + 미만료) 그 닉네임을 위한 것이면 true.
// 서명 검증도 timingSafeEqual 로(길이 다르면 즉시 false — timingSafeEqual 는 길이 같아야 함).
export function verifyToken(token, nickname, nowMs) {
  if (!isAuthEnabled() || typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expectedSig = sign(payloadB64)
  if (sig.length !== expectedSig.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false
  let payload
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'))
  } catch {
    return false
  }
  if (payload?.n !== String(nickname)) return false
  if (!Number.isFinite(payload?.exp) || payload.exp < nowMs) return false
  return true
}
