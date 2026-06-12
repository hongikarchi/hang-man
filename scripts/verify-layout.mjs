/* =========================================================================
   verify-layout.mjs — 모바일 레이아웃 회귀 게이트.
   사용자 피드백 "폰에서 위아래/좌우가 잘린다"를 어서션으로 고정한다.

   검증 항목 (최악 케이스 quote 304 — 12자 단어 "disappointed" 포함 L3):
    1. 가로: 문서/보드에 가로 오버플로 없음, 모든 칸이 화면 안
    2. 세로: 보드 위쪽이 스크롤로 도달 가능(align-items:center 클리핑 회귀 방지)
    3. 터치 드래그로 보드 스크롤 (dnd 드래그 오발동 없음)
    4. 헤더/트레이 상시 가시 + 카드 탭 가능
    5. dvh 캐스케이드(100dvh 가 100vh 를 이겨야 함) + 뷰포트 축소 프록시
    6. 결과 화면: 작은 뷰포트에서 문서 스크롤로 버튼 도달 가능
    7. 폰트 캡: 긴 단어에서만 발동, 짧은 문장은 기존 크기 유지

   실행: node scripts/verify-layout.mjs
   옵션 env: E2E_BASE(외부 dev 서버), E2E_BROWSER(브라우저 경로),
             LAYOUT_SHOTS(스크린샷 디렉토리, 기본 .verify-shots)
   ========================================================================= */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

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

const SHOTS = process.env.LAYOUT_SHOTS || '.verify-shots'
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true })
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` })

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true } catch { /* not up yet */ }
    await tick(400)
  }
  return false
}

let viteProc = null
async function startDevServer() {
  if (process.env.E2E_BASE) return process.env.E2E_BASE
  const PORT = 5181 // e2e(5179)/dev(5173)와 충돌 회피
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

const clickCategory = (page, label = '명언') => page.evaluate((lb) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(lb))
  if (b) b.click()
}, label)

const clickLevel = (page, n) => page.evaluate((lv) => {
  const b = [...document.querySelectorAll('button')].find((x) => new RegExp(`Level\\s*${lv}`, 'i').test(x.textContent))
  if (b) b.click()
}, n)

/** ?quote=<id> (DEV 훅)로 특정 문장을 강제하고 게임 화면까지 진입 */
async function setupGame(page, base, quoteId, level) {
  await page.goto(`${base}?quote=${quoteId}`, { waitUntil: 'networkidle0', timeout: 20000 })
  await clickCategory(page); await tick(300)
  await clickLevel(page, level); await tick(450)
}

const SLOT_SEL = '[aria-label*="빈칸"], [aria-label*="채워짐"]'

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
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    // 온보딩 모달은 레이아웃 검증과 무관하므로 본 적 있는 것으로 처리.
    // (about:blank 등 localStorage 접근이 막힌 문서에서도 주입되므로 try/catch)
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('qh_seen_howto', '1') } catch { /* ignore */ }
    })

    for (const vp of [{ width: 375, height: 667 }, { width: 360, height: 740 }]) {
      console.log(`--- ${vp.width}x${vp.height}: 최장 문장(quote 304, L3) ---`)
      await page.setViewport({ ...vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
      await setupGame(page, base, 304, 3)

      // 1) 가로: 오버플로 전혀 없음
      const h = await page.evaluate((sel) => {
        const m = document.querySelector('main')
        const mr = m.getBoundingClientRect()
        const slots = [...document.querySelectorAll(sel)].map((s) => s.getBoundingClientRect())
        return {
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          boardOverflow: m.scrollWidth - m.clientWidth,
          slotCount: slots.length,
          outOfBounds: slots.filter((r) => r.left < mr.left - 0.5 || r.right > mr.right + 0.5).length,
        }
      }, SLOT_SEL)
      ok(h.docOverflow <= 0, `문서 가로 오버플로 없음 (${h.docOverflow}px)`)
      ok(h.boardOverflow <= 0, `보드 가로 오버플로 없음 (${h.boardOverflow}px)`)
      ok(h.slotCount > 50 && h.outOfBounds === 0, `모든 칸(${h.slotCount})이 화면 폭 안 (이탈 ${h.outOfBounds})`)

      // 2) 세로: 내용이 넘치고, 맨 위(한국어 힌트)부터 맨 아래 칸까지 스크롤로 도달
      const v = await page.evaluate((sel) => {
        const m = document.querySelector('main')
        const mr = m.getBoundingClientRect()
        const overflows = m.scrollHeight > m.clientHeight
        m.scrollTop = 0
        const hint = document.querySelector('[role="note"]')
        const topReachable = hint && hint.getBoundingClientRect().top >= mr.top - 0.5
        m.scrollTop = m.scrollHeight
        const slots = [...document.querySelectorAll(sel)]
        const last = slots[slots.length - 1].getBoundingClientRect()
        const bottomReachable = last.bottom <= mr.bottom + 1
        m.scrollTop = 0
        return { overflows, topReachable, bottomReachable }
      }, SLOT_SEL)
      ok(v.overflows, '보드 내용이 세로로 넘침(스크롤 검증 유효)')
      ok(v.topReachable, '★ scrollTop=0 에서 맨 위(힌트)가 보임 — 센터링 클리핑 없음')
      ok(v.bottomReachable, '★ 끝까지 스크롤 시 마지막 칸 보임')

      // 3) 터치 드래그 스크롤 (빠른 스와이프 → dnd 드래그가 아니라 스크롤)
      const boardMid = await page.evaluate(() => {
        const r = document.querySelector('main').getBoundingClientRect()
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
      })
      await page.touchscreen.touchStart(boardMid.x, boardMid.y + 60)
      await page.touchscreen.touchMove(boardMid.x, boardMid.y)
      await page.touchscreen.touchMove(boardMid.x, boardMid.y - 60)
      await page.touchscreen.touchEnd()
      await tick(250)
      const t = await page.evaluate(() => ({
        scrolled: document.querySelector('main').scrollTop > 0,
        ghost: !!document.querySelector('[class*="dragGhost"]'),
      }))
      ok(t.scrolled, '★ 터치 드래그로 보드 스크롤됨')
      ok(!t.ghost, '스와이프가 dnd 드래그로 오발동하지 않음')

      // 4) 헤더/트레이 상시 가시 + 카드 탭 가능
      const fixed = await page.evaluate(() => {
        const header = document.querySelector('header').getBoundingClientRect()
        const tray = document.querySelector('footer').getBoundingClientRect()
        const card = [...document.querySelectorAll('button[aria-label^="글자 "]')].pop()
        const cr = card.getBoundingClientRect()
        const hit = document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2)
        return {
          headerVisible: header.top >= -0.5 && header.bottom > 0,
          trayVisible: tray.bottom <= window.innerHeight + 0.5 && tray.top < window.innerHeight,
          cardTappable: !!(hit && hit.closest('button[aria-label^="글자 "]')),
        }
      })
      ok(fixed.headerVisible, '헤더 상시 가시')
      ok(fixed.trayVisible, '★ 트레이(카드)가 화면 하단 안에 보임')
      ok(fixed.cardTappable, '마지막 글자 카드가 가려지지 않고 탭 가능')
      await shot(page, `game-304-${vp.width}x${vp.height}`)
    }

    // 5) dvh 캐스케이드 + 뷰포트 높이 축소(URL바 등장 프록시)
    console.log('--- dvh 캐스케이드 / 뷰포트 축소 ---')
    const cascade = await page.evaluate(() => {
      let screenH = null, appMinH = null
      for (const sheet of document.styleSheets) {
        let rules
        try { rules = sheet.cssRules } catch { continue }
        for (const r of rules) {
          if (!r.selectorText || !r.style) continue
          if (/_screen_/.test(r.selectorText) && r.style.height) screenH = r.style.height
          if (/_app_/.test(r.selectorText) && r.style.minHeight) appMinH = r.style.minHeight
        }
      }
      return { screenH, appMinH }
    })
    ok(cascade.screenH === '100dvh', `.screen height 승자 = 100dvh (실제: ${cascade.screenH})`)
    ok(cascade.appMinH === '100dvh', `.app min-height 승자 = 100dvh (실제: ${cascade.appMinH})`)
    await page.setViewport({ width: 375, height: 600, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await tick(300)
    const shrunk = await page.evaluate(() => {
      const tray = document.querySelector('footer').getBoundingClientRect()
      return tray.bottom <= window.innerHeight + 0.5
    })
    ok(shrunk, '★ 뷰포트 축소(667→600) 후에도 트레이가 화면 안 (URL바 프록시)')

    // 6) 결과 화면: 작은 뷰포트에서 문서 스크롤로 모든 버튼 도달
    console.log('--- 결과 화면(375x450): 문서 스크롤 ---')
    await page.setViewport({ width: 375, height: 450, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await setupGame(page, base, 301, 3) // L3 = 시도 6회 → LOSE 빠름
    for (let i = 0; i < 10; i++) {
      if (await page.evaluate(() => !!document.querySelector('h2'))) break
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
    const res = await page.evaluate(() => !!document.querySelector('h2'))
    ok(res, 'LOSE → 결과 화면 도달')
    const rscroll = await page.evaluate(() => {
      const before = {
        docOverflowX: document.documentElement.scrollWidth - window.innerWidth,
        needsScroll: document.scrollingElement.scrollHeight > window.innerHeight,
      }
      window.scrollTo(0, 1e6)
      const btn = [...document.querySelectorAll('button')].find((b) => /레벨 선택/.test(b.textContent))
      const r = btn.getBoundingClientRect()
      return { ...before, scrolledY: window.scrollY, btnVisible: r.bottom <= window.innerHeight + 1 && r.top >= -1 }
    })
    ok(rscroll.docOverflowX <= 0, `결과 화면 가로 오버플로 없음 (${rscroll.docOverflowX}px)`)
    ok(rscroll.needsScroll, '결과 카드가 뷰포트보다 김(스크롤 검증 유효)')
    ok(rscroll.scrolledY > 0 && rscroll.btnVisible, '★ 문서 스크롤로 "레벨 선택" 버튼 도달 가능')
    await shot(page, 'result-375x450')

    // 7) 폰트 캡: 긴 단어에서만 발동
    console.log('--- 폰트 캡: 긴 단어에서만 축소 ---')
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const fontOf = async () => page.evaluate((sel) => {
      const slot = document.querySelector(sel)
      return parseFloat(getComputedStyle(slot.closest('[class*="board"]')).fontSize)
    }, SLOT_SEL)
    await setupGame(page, base, 304, 3) // "disappointed" 12자 → 캡 발동
    const fsLong = await fontOf()
    ok(fsLong > 14 && fsLong < 18, `긴 단어: 폰트 캡 발동 ≈16px (실제 ${fsLong.toFixed(1)}px)`)
    await setupGame(page, base, 101, 1) // "Knowledge is power." → 캡 미발동
    const fsShort = await fontOf()
    ok(fsShort >= 19.5, `짧은 문장: 기존 크기 유지 ≥20px (실제 ${fsShort.toFixed(1)}px)`)
    await shot(page, 'game-101-375x667')

    // 시작 화면 2종 스크린샷 (시각 QA용 — 어서션 없음)
    await page.goto(base, { waitUntil: 'networkidle0', timeout: 20000 })
    await shot(page, 'category-select-375x667')
    await clickCategory(page); await tick(300)
    await shot(page, 'level-select-375x667')

    ok(errors.length === 0, `런타임 에러 없음 (${errors.length})`)
    if (errors.length) errors.forEach((e) => console.error('   ', e))

    console.log(`\n결과: ${pass} passed, ${fail} failed`)
  } finally {
    await browser.close()
    stopDevServer()
  }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('verify-layout 실패:', e); stopDevServer(); process.exit(1) })
