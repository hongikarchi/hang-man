-- =============================================================================
-- Quote Hangman — Neon Postgres 스키마
-- 이 파일의 SQL 을 Neon 콘솔(SQL Editor)에서 한 번 실행하면 테이블이 만들어진다.
-- 마이그레이션 툴은 없다(수동 실행). 코드는 fail-soft 라 테이블이 없어도 앱은
-- 동작하며, 단지 그 기능(랭킹/진행 동기화)만 비활성 상태로 둔다.
-- 환경변수: DATABASE_URL (Neon 연동이 자동 주입, 서버 전용 — VITE_ 접두사 금지).
-- =============================================================================

-- ---- 누적 점수 / 리더보드 (api/score.js, api/leaderboard.js) ----
-- 닉네임당 한 행. score 는 GREATEST 로만 올라간다(역행 방지).
CREATE TABLE IF NOT EXISTS scores (
  nickname    text PRIMARY KEY,
  score       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_rank_idx ON scores (score DESC, updated_at ASC);

-- ---- 닉네임 잠금 PIN (api/auth.js, api/_auth.js) ----
-- scores 행에 선택적 PIN 해시를 붙여 닉네임을 "잠근다". NULL 이면 PIN 미설정(레거시/익명).
--  - 목적: 사칭/덮어쓰기 방지 + 중복 닉 선점 잠금 + 기기 간 안전한 불러오기.
--  - TOFU(trust-on-first-use): 처음 PIN 을 거는 사람이 그 닉의 주인이 된다.
--    기존(PIN NULL) 닉은 누구나 선점 가능 — 단 점수는 GREATEST 라 빼앗아도 깎이진 않음.
--  - 해시 형식은 api/_auth.js 의 scrypt 규약("scrypt$N$r$p$salt$hash", base64url).
--  - fail-soft 핵심: 이 컬럼이 아직 없어도(ALTER 미적용) 코드가 죽으면 안 된다.
--    score.js/played.js 는 컬럼 부재를 "PIN 미설정(=레거시, 통과)"으로 취급한다.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS pin_hash text;

-- ---- 푼 문제 진행 동기화 (api/played.js) ----
-- 닉네임별로 "어떤 문제를 풀었는지"를 기기 간 동기화한다.
-- localStorage 가 1차 저장소이고, 이 테이블은 닉네임 기준 동기화 레이어다.
--
-- cycle 이 PK 의 일부인 이유: 한 레벨(20문제)을 전부 풀어 "소진"되면 새 사이클로
-- 넘어가 같은 quote_id 를 다시 풀 수 있다. cycle 을 빼면 두 번째 사이클의 같은
-- quote_id 가 ON CONFLICT 로 무시돼 사라진다. 사이클별로 분리해 보관한다.
CREATE TABLE IF NOT EXISTS played (
  nickname    text NOT NULL,
  category    text NOT NULL,         -- 'quotes' | 'travel' | 'business' | 'movies'
  level       smallint NOT NULL,     -- 1 | 2 | 3
  quote_id    integer NOT NULL,
  cycle       integer NOT NULL DEFAULT 0,
  played_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nickname, category, level, quote_id, cycle)
);

-- GET /api/played 의 조회 패턴: (nickname, category, level, cycle) 로 quote_id 목록.
CREATE INDEX IF NOT EXISTS played_scope_idx
  ON played (nickname, category, level, cycle);
