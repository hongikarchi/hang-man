/* =========================================================================
   e2e.mjs — 실제 브라우저(헤드리스)로 코어 플레이 루프를 검증하는 회귀 게이트.
   dev 서버를 자동으로 띄우고/끄며, 탭·드래그·WIN·LOSE·라운드 루프를 확인한다.

   실행: npm run test:e2e   (또는 npm run verify 의 일부)
   옵션 env:
     E2E_BASE   기존에 떠 있는 dev 서버 URL (지정 시 서버 자동 기동 안 함)
     E2E_SHOTS  스크린샷 저장 디렉토리 (지정 시 각 화면 캡처)
     E2E_BROWSER 브라우저 실행파일 경로 강제
   ========================================================================= */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

// ---- 브라우저 실행파일 자동 탐지 (Chrome 우선, 그다음 Edge) ----
function findBrowser() {
  if (process.env.E2E_BROWSER && existsSync(process.env.E2E_BROWSER)) return process.env.E2E_BROWSER
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((p) => existsSync(p))
}

const tick = (ms = 200) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.error('  ✗ FAIL:', m) } }

const SHOTS = process.env.E2E_SHOTS
if (SHOTS && !existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true })
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch { /* not up yet */ }
    await tick(400)
  }
  return false
}

let viteProc = null
async function startDevServer() {
  if (process.env.E2E_BASE) return process.env.E2E_BASE
  const PORT = 5179 // verify 전용 포트 (개발용 5173과 충돌 회피)
  const url = `http://localhost:${PORT}/`
  viteProc = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(), shell: true, stdio: 'ignore',
  })
  const up = await waitForServer(url)
  if (!up) throw new Error('dev 서버 기동 실패')
  return url
}
function stopDevServer() {
  if (viteProc && !viteProc.killed) {
    try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F']) : viteProc.kill('SIGTERM') } catch {}
  }
}

// ---- 페이지 상태 읽기 헬퍼 (UI 구조가 바뀌어도 aria/텍스트 기반으로 견고) ----
const readState = (page) => page.evaluate(() => {
  const blanks = [...document.querySelectorAll('[role="button"][aria-label*="빈칸"]')]
  const filled = document.querySelectorAll('[aria-label*="채워짐"]').length
  // "남은 빈칸 N"(구) 또는 "남은 N"(신) 매칭. "남은 시도 N/N"(하트)는 제외.
  const remM = document.body.innerText.match(/남은\s+(?:빈칸\s+)?(\d+)(?!\s*\/)/)
  const hearts = document.querySelector('[aria-label*="남은 시도"]')?.getAttribute('aria-label')
  const heading = document.querySelector('h2')?.textContent || null
  return { blankCount: blanks.length, filled, remaining: remM ? Number(remM[1]) : null, hearts, heading }
})

// 카드 cipher->letter 매핑. cipher 가 카드에 숨겨진 레벨(L2/L3 추론 모드)도
// aria-label("글자 X, 힌트 N")에서 읽어 동작한다.
const cardMap = (page) => page.evaluate(() => {
  const m = {}
  ;[...document.querySelectorAll('button[aria-label^="글자 "]')].forEach((b) => {
    const lm = b.getAttribute('aria-label').match(/글자\s+([A-Z]).*힌트\s+(\S+)/)
    if (lm) m[lm[2]] = lm[1].toLowerCase()
  })
  return m
})

async function clickLevel(page, n) {
  await page.evaluate((lv) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(`Level\\s*${lv}|레벨\\s*${lv}|LV\\s*${lv}`, 'i').test(x.textContent))
    if (b) b.click()
  }, n)
}

// "시작/게임 시작/플레이" 등 온보딩 시작 버튼이 있으면 누른다(없으면 무시).
async function dismissOnboarding(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /시작|게임 시작|플레이|start|건너뛰기|확인|닫기/i.test(x.textContent))
    if (b) b.click()
  })
  await tick(200)
}

async function main() {
  const browserPath = findBrowser()
  if (!browserPath) { console.error('브라우저를 찾지 못함. E2E_BROWSER 로 경로 지정.'); process.exit(2) }
  const base = await startDevServer()
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath: browserPath, headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--no-first-run'],
  })
  const errors = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    await page.goto(base, { waitUntil: 'networkidle0', timeout: 20000 })
    await dismissOnboarding(page) // 첫 화면/튜토리얼이 있으면 통과

    // ===== L2: 탭-투-플레이스 + 오답 + LOSE + 다음문제 =====
    console.log('--- L2: 탭 배치 / 오답 / LOSE / 다음문제 ---')
    await clickLevel(page, 2); await tick(400); await dismissOnboarding(page); await tick(200)
    let s = await readState(page)
    ok(s.blankCount > 0, '게임 화면에 빈칸 렌더됨')
    await shot(page, 'game-start')
    const startRem = s.remaining

    const cm = await cardMap(page)
    const fb = await page.$('[role="button"][aria-label*="빈칸"]')
    const fbCipher = await page.evaluate((el) => (el.getAttribute('aria-label').match(/힌트\s+(\S+)/) || [])[1], fb)
    const correct = cm[fbCipher]
    ok(!!correct, `첫 빈칸 정답 글자 추론됨 (${correct})`)

    // 카드 탭 → (리렌더 대기) → 빈칸 탭
    await page.evaluate((lt) => {
      const c = [...document.querySelectorAll('button')].find((b) => !b.disabled &&
        /^[A-Z]$/.test(b.querySelector('span')?.textContent?.trim() || '') &&
        b.querySelector('span').textContent.trim().toLowerCase() === lt)
      c.click()
    }, correct)
    await tick(250)
    await page.evaluate(() => document.querySelector('[role="button"][aria-label*="빈칸"]').click())
    await tick(300)
    s = await readState(page)
    // 크립토그램 방식: 한 글자 정답이면 같은 글자 모든 칸이 채워짐 → 1개 이상 감소
    ok(s.remaining < startRem && s.remaining >= 0, `탭 배치로 남은 빈칸 ${startRem}→${s.remaining} (≥1 감소)`)
    ok(s.filled >= 1, '탭 배치로 빈칸 채워짐')

    // 양방향: 빈칸 먼저 탭 → (리렌더 대기) → 정답 카드 탭 → 채워짐
    {
      const remBefore = (await readState(page)).remaining
      // 남은 첫 빈칸의 cipher로 정답 글자 추론
      const info = await page.evaluate(() => {
        const blank = document.querySelector('[role="button"][aria-label*="빈칸"]')
        if (!blank) return null
        const cip = (blank.getAttribute('aria-label').match(/힌트\s+(\S+)/) || [])[1]
        const map = {}
        ;[...document.querySelectorAll('button[aria-label^="글자 "]')].forEach((b) => {
          const m = b.getAttribute('aria-label').match(/글자\s+([A-Z]).*힌트\s+(\S+)/)
          if (m) map[m[2]] = m[1].toLowerCase()
        })
        return { answer: map[cip] }
      })
      // 1) 빈칸 탭(선택)
      await page.evaluate(() => document.querySelector('[role="button"][aria-label*="빈칸"]').click())
      await tick(250) // React 커밋 대기 — 선택이 반영돼야 다음 탭이 배치가 됨
      const sel = await page.evaluate(() =>
        !!document.querySelector('[role="button"][aria-pressed="true"][aria-label*="빈칸"]'))
      ok(sel, '빈칸 탭 → 선택 표시(aria-pressed)')
      // 2) 정답 카드 탭(배치)
      await page.evaluate((ans) => {
        const c = [...document.querySelectorAll('button')].find((b) => !b.disabled &&
          /^[A-Z]$/.test(b.querySelector('span')?.textContent?.trim() || '') &&
          b.querySelector('span').textContent.trim().toLowerCase() === ans)
        if (c) c.click()
      }, info.answer)
      await tick(300)
      const remAfter = (await readState(page)).remaining
      ok(remAfter < remBefore, `★ 빈칸 우선 → 카드 탭으로 채워짐 ${remBefore}→${remAfter}`)
    }

    // 오답 → 시도 감소. 자동채움이 켜졌으므로, 남은 첫 빈칸의 "정답"을 구하고
    // 그와 다른 글자(확실한 오답)를 그 빈칸에 놓는다.
    const before = await readState(page)
    const wrongInfo = await page.evaluate(() => {
      const blank = document.querySelector('[role="button"][aria-label*="빈칸"]')
      if (!blank) return null
      const cip = (blank.getAttribute('aria-label').match(/힌트\s+(\S+)/) || [])[1]
      // cipher→정답글자 (카드 aria-label에서)
      const map = {}
      ;[...document.querySelectorAll('button[aria-label^="글자 "]')].forEach((b) => {
        const m = b.getAttribute('aria-label').match(/글자\s+([A-Z]).*힌트\s+(\S+)/)
        if (m) map[m[2]] = m[1].toLowerCase()
      })
      return { answer: map[cip] }
    })
    if (wrongInfo && wrongInfo.answer) {
      await page.evaluate((ans) => {
        const c = [...document.querySelectorAll('button')].find((b) => !b.disabled &&
          /^[A-Z]$/.test(b.querySelector('span')?.textContent?.trim() || '') &&
          b.querySelector('span').textContent.trim().toLowerCase() !== ans)
        if (c) c.click()
      }, wrongInfo.answer)
      await tick(250)
      await page.evaluate(() => { const b = document.querySelector('[role="button"][aria-label*="빈칸"]'); if (b) b.click() })
      await tick(300)
    }
    const afterWrong = await readState(page)
    ok(before.hearts !== afterWrong.hearts, '오답 → 시도(하트) 감소')

    // LOSE 까지: 매번 현재 첫 빈칸의 정답을 구해 "다른 글자"(확실한 오답)를 놓는다.
    for (let i = 0; i < 12; i++) {
      if ((await readState(page)).heading) break
      const placed = await page.evaluate(() => {
        const blank = document.querySelector('[role="button"][aria-label*="빈칸"]')
        if (!blank) return false
        const cip = (blank.getAttribute('aria-label').match(/힌트\s+(\S+)/) || [])[1]
        const map = {}
        ;[...document.querySelectorAll('button[aria-label^="글자 "]')].forEach((b) => {
          const m = b.getAttribute('aria-label').match(/글자\s+([A-Z]).*힌트\s+(\S+)/)
          if (m) map[m[2]] = m[1].toLowerCase()
        })
        const ans = map[cip]
        const wrong = [...document.querySelectorAll('button')].find((b) => !b.disabled &&
          /^[A-Z]$/.test(b.querySelector('span')?.textContent?.trim() || '') &&
          b.querySelector('span').textContent.trim().toLowerCase() !== ans)
        if (!wrong) return false
        wrong.click()
        return true
      })
      if (!placed) break
      await tick(160)
      await page.evaluate(() => { const b = document.querySelector('[role="button"][aria-label*="빈칸"]'); if (b) b.click() })
      await tick(160)
    }
    const lose = await readState(page)
    ok(lose.heading != null, 'LOSE → 결과 화면 마운트')
    await shot(page, 'result-lose')

    // 다음 문제 → PLAYING
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /다음 문제|next/i.test(x.textContent)); if (b) b.click() })
    await tick(400); await dismissOnboarding(page)
    const next = await readState(page)
    ok(next.heading == null && next.blankCount > 0, '다음 문제 → PLAYING 복귀')

    // ===== L1: 드래그-투-플레이스 + WIN =====
    console.log('--- L1: 드래그 배치 / WIN ---')
    // 화면 전환 의존성을 없애려 페이지를 새로 로드하고 L1을 처음부터 선택.
    await page.goto(base, { waitUntil: 'networkidle0', timeout: 20000 })
    await dismissOnboarding(page)
    await clickLevel(page, 1); await tick(450); await dismissOnboarding(page); await tick(200)

    let cm1 = await cardMap(page)
    async function dragLetterToFirstBlank() {
      const blank = await page.$('[role="button"][aria-label*="빈칸"]')
      if (!blank) return false
      const cipher = await page.evaluate((el) => (el.getAttribute('aria-label').match(/힌트\s+(\S+)/) || [])[1], blank)
      const letter = cm1[cipher]
      if (!letter) return false
      const card = (await page.evaluateHandle((lt) => {
        const c = [...document.querySelectorAll('button')].find((b) => !b.disabled &&
          /^[A-Z]$/.test(b.querySelector('span')?.textContent?.trim() || '') &&
          b.querySelector('span').textContent.trim().toLowerCase() === lt)
        if (c) c.scrollIntoView({ block: 'nearest' })
        return c
      }, letter)).asElement()
      if (!card) return false
      await tick(60)
      const cb = await card.boundingBox(); const bb = await blank.boundingBox()
      if (!cb || !bb) return false
      await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2)
      await page.mouse.down()
      await page.mouse.move(cb.x + cb.width / 2 + 12, cb.y - 12, { steps: 4 })
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 })
      await page.mouse.up()
      await tick(160)
      return true
    }

    const remBeforeDrag = (await readState(page)).remaining
    await dragLetterToFirstBlank()
    const remAfterDrag = (await readState(page)).remaining
    ok(remAfterDrag < remBeforeDrag && remAfterDrag >= 0, `드래그 배치로 남은 빈칸 ${remBeforeDrag}→${remAfterDrag} (≥1 감소)`)
    await shot(page, 'drag-placed')

    let guard = 0
    while (guard++ < 80) {
      if ((await readState(page)).heading) break
      if (!(await page.$('[role="button"][aria-label*="빈칸"]'))) break
      if (!(await dragLetterToFirstBlank())) break
    }
    const win = await readState(page)
    ok(win.heading != null && /정답/.test(win.heading || ''), '전부 정답 → WIN 결과 화면')
    await shot(page, 'result-win')

    ok(errors.length === 0, `런타임 에러 없음 (${errors.length})`)
    if (errors.length) errors.forEach((e) => console.error('   ', e))

    console.log(`\n결과: ${pass} passed, ${fail} failed`)
  } finally {
    await browser.close()
    stopDevServer()
  }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('e2e 실패:', e); stopDevServer(); process.exit(1) })
