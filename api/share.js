/* =========================================================================
   GET /api/share?id=<quoteId> — 문장별 공유 랜딩(= /s/:id, vercel.json rewrite).
   카톡/트위터 크롤러에게: 문장별 og:title/description/image 를 담은 HTML.
   사람에게: 즉시 게임(/?quote=id)으로 리다이렉트(meta refresh + JS 이중).

   ⚠ HTTP 302 로 리다이렉트하면 안 됨 — 크롤러가 따라가서 홈 메타를 읽어버림.
   반드시 200 + HTML 로 응답하고 리다이렉트는 클라이언트 측에서.
   noindex — 얇은 리다이렉트 페이지가 색인되면 SEO 감점(doorway 취급).
   ========================================================================= */
import { findQuote, blankText } from './_teaser.js'

const ORIGIN = 'https://2602-hangman.vercel.app'
const TITLE = '이 문장, 맞혀볼래요?'
const DESC = '▶ 놀면서 배우는 영어'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default function handler(req, res) {
  const quote = findQuote(req.query?.id)
  if (!quote) {
    // 모르는 id → 홈으로(크롤러에게도 홈 메타면 충분)
    return res.redirect(302, '/')
  }

  const teaser = blankText(quote.text)
  const pageUrl = `${ORIGIN}/s/${quote.id}`
  const imgUrl = `${ORIGIN}/api/og?id=${quote.id}`
  const gameUrl = `/?quote=${quote.id}`

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(TITLE)} — ${esc(teaser)}</title>
  <meta name="description" content="${esc(DESC)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="영어 명언 행맨" />
  <meta property="og:title" content="${esc(TITLE)}" />
  <meta property="og:description" content="${esc(DESC)}" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="${esc(imgUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(TITLE)}" />
  <meta name="twitter:description" content="${esc(DESC)}" />
  <meta name="twitter:image" content="${esc(imgUrl)}" />
  <meta http-equiv="refresh" content="0;url=${esc(gameUrl)}" />
  <script>location.replace(${JSON.stringify(gameUrl)})</script>
</head>
<body>
  <p style="font-family:sans-serif;text-align:center;margin-top:40vh">
    게임으로 이동 중… <a href="${esc(gameUrl)}">바로 가기</a>
  </p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400')
  return res.status(200).send(html)
}
