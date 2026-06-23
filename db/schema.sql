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
