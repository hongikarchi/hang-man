/* =========================================================================
   gen-seo.mjs — 카테고리별 정적 SEO 랜딩 HTML + sitemap.xml + robots.txt 생성.
   빌드 전에 실행(package.json build). categories.js + JSON 을 읽어 항상 동기화.

   ⭐ 핵심: 문장+한글뜻이 "본문에 실제로 존재"하는 완전한 정적 HTML.
      SPA(#root)는 크롤러가 빈 화면만 보므로, 검색 노출용 콘텐츠를 여기서 별도 emit.
      합격 조건: JS 를 꺼도 페이지 콘텐츠가 보여야 한다.
   ========================================================================= */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CATEGORIES } from '../src/data/categories.js'
import { SITE, absUrl } from './seo/site.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')
const LEARN = join(PUBLIC, 'learn')

// HTML 이스케이프 — 명언에 따옴표/부등호가 섞여도 안전.
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 공통 head(카테고리별 title/desc/canonical/og). index.html 과 같은 소셜 메타 형태.
function head({ title, description, canonical }) {
  return `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#f7f8fa" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${esc(SITE.name)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(absUrl(SITE.ogImage))}" />
  <meta property="og:locale" content="${SITE.locale}" />
  <meta name="twitter:card" content="${SITE.twitterCard}" />
  <meta name="twitter:image" content="${esc(absUrl(SITE.ogImage))}" />`
}

// 최소 인라인 CSS(의존성 0) — 게임 톤(인디고/오프화이트)과 일관.
const CSS = `  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      background: #f7f8fa; color: #1f2933; line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
    header { text-align: center; margin-bottom: 32px; }
    .emoji { font-size: 44px; }
    h1 { font-size: 30px; font-weight: 800; margin-top: 8px; }
    .desc { color: #5b6470; margin-top: 8px; font-size: 16px; }
    .cta {
      display: inline-block; margin-top: 20px; padding: 13px 26px;
      background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff;
      border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 16px;
    }
    .levels { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
    .lvl { background: #eef0fe; color: #4338ca; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; }
    h2 { font-size: 20px; font-weight: 800; margin: 36px 0 14px; }
    ul { list-style: none; }
    li {
      background: #fff; border: 1px solid #e2e6ea; border-radius: 12px;
      padding: 16px 18px; margin-bottom: 10px;
    }
    .en { font-size: 17px; font-weight: 700; color: #1f2933; }
    .ko { display: block; margin-top: 6px; font-size: 15px; color: #5b6470; word-break: keep-all; }
    .cite { display: block; margin-top: 6px; font-size: 13px; color: #6b7480; }
    nav { text-align: center; margin-top: 40px; font-size: 14px; }
    nav a { color: #4f46e5; text-decoration: none; margin: 0 8px; }
    footer { text-align: center; margin-top: 48px; color: #6b7480; font-size: 13px; }
  </style>`

function levelLabel(n) {
  return { 1: '레벨 1 (쉬움)', 2: '레벨 2 (보통)', 3: '레벨 3 (어려움)' }[n] || `레벨 ${n}`
}

function categoryPage(cat, otherCats) {
  const canonical = absUrl(`/learn/${cat.id}.html`)
  const title = `${cat.label} 영어 표현 모음 — ${SITE.name}`
  const description = `${cat.desc}. ${cat.data.length}개 문장을 한글 뜻과 함께. 행맨 게임으로 놀면서 무료로 배우세요.`

  // 레벨별로 묶어 렌더(레벨 오름차순).
  const byLevel = { 1: [], 2: [], 3: [] }
  for (const q of cat.data) if (byLevel[q.level]) byLevel[q.level].push(q)

  const sections = [1, 2, 3]
    .filter((lv) => byLevel[lv].length)
    .map((lv) => {
      const items = byLevel[lv]
        .map((q) => {
          const cite = q.author ? `<span class="cite">— ${esc(q.author)}</span>` : ''
          return `      <li><span class="en">${esc(q.text)}</span><span class="ko">${esc(q.ko)}</span>${cite}</li>`
        })
        .join('\n')
      return `    <h2>${esc(levelLabel(lv))} · ${cat.levelDesc[lv] ? esc(cat.levelDesc[lv]) : ''}</h2>\n    <ul>\n${items}\n    </ul>`
    })
    .join('\n')

  const navLinks = otherCats
    .map((c) => `<a href="/learn/${c.id}.html">${esc(c.emoji)} ${esc(c.label)}</a>`)
    .join('')

  return `<!doctype html>
<html lang="ko">
<head>
${head({ title, description, canonical })}
${CSS}
</head>
<body>
  <div class="wrap">
    <header>
      <div class="emoji">${esc(cat.emoji)}</div>
      <h1>${esc(cat.label)} 영어 표현</h1>
      <p class="desc">${esc(cat.desc)} · 총 ${cat.data.length}개 · 한글 뜻과 함께</p>
      <div class="levels">
        <span class="lvl">${esc(levelLabel(1))}</span>
        <span class="lvl">${esc(levelLabel(2))}</span>
        <span class="lvl">${esc(levelLabel(3))}</span>
      </div>
      <div><a class="cta" href="/">▶ 행맨 게임으로 풀어보기</a></div>
    </header>

${sections}

    <nav>다른 카테고리: ${navLinks}</nav>
    <footer>
      ${esc(SITE.name)} — 놀면서 배우는 영어. <a href="/" style="color:#4f46e5">게임 시작하기</a>
    </footer>
  </div>
</body>
</html>
`
}

function sitemap(cats) {
  const urls = [
    { loc: absUrl('/'), priority: '1.0' },
    ...cats.map((c) => ({ loc: absUrl(`/learn/${c.id}.html`), priority: '0.8' })),
  ]
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('/sitemap.xml')}\n`
}

// ---- 실행 ----
mkdirSync(LEARN, { recursive: true })

let count = 0
for (const cat of CATEGORIES) {
  const others = CATEGORIES.filter((c) => c.id !== cat.id)
  writeFileSync(join(LEARN, `${cat.id}.html`), categoryPage(cat, others), 'utf8')
  count++
}
writeFileSync(join(PUBLIC, 'sitemap.xml'), sitemap(CATEGORIES), 'utf8')
writeFileSync(join(PUBLIC, 'robots.txt'), robots(), 'utf8')

console.log(`✓ SEO 생성 완료: 카테고리 ${count}개 + sitemap.xml + robots.txt (public/)`)
