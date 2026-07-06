/* =========================================================================
   GET /api/og?id=<quoteId> — 문장별 OG 미리보기 이미지(1200×630 PNG).
   빈칸 뚫린 영어(볼드) + 한글 뜻(흐리게)만 — 심플 카드(사용자 스펙).
   제목/설명 텍스트는 /s/:id 의 og:title/og:description 이 담당.

   폰트: satori 는 시스템 폰트를 못 쓴다 → Google Fonts 에서 "이 문장에 쓰인
   글자만" 서브셋 TTF 를 받아 사용(css2 text= + 구형 UA 트릭). 모듈 캐시로
   웜 인스턴스 재사용. 폰트 실패 시 정적 /og.png 로 302 (fail-soft).
   결정적 티저(랜덤 없음) → 장기 CDN 캐시 안전.
   ========================================================================= */
import { ImageResponse } from '@vercel/og'
import { findQuote, blankText } from './_teaser.js'

// css2 가 TTF url 을 주도록 구형 UA 를 쓴다(기본 UA 면 satori 가 못 읽는 woff2).
const OLD_UA =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'

async function fetchFont(text, weight) {
  const url =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@' +
    weight +
    '&text=' +
    encodeURIComponent(text)
  const css = await (await fetch(url, { headers: { 'User-Agent': OLD_UA } })).text()
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/)
  if (!m) throw new Error('font url not found in css')
  const buf = await (await fetch(m[1])).arrayBuffer()
  return buf
}

function fontSizeFor(len) {
  if (len <= 30) return 62
  if (len <= 60) return 50
  if (len <= 90) return 42
  return 36
}

export default async function handler(req, res) {
  const quote = findQuote(req.query?.id)
  if (!quote) return res.status(404).json({ error: 'not_found' })

  const teaser = blankText(quote.text)

  try {
    // 서브셋 = 실제 그릴 글자들만(영문 티저 + 한글 뜻). 요청 2회(굵기별).
    const chars = teaser + (quote.ko || '')
    const [bold, regular] = await Promise.all([
      fetchFont(chars, 800),
      fetchFont(chars, 400),
    ])

    const img = new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          },
          children: {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 1020,
                minHeight: 330,
                background: '#ffffff',
                borderRadius: 28,
                padding: '48px 56px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontFamily: 'NotoSansKR',
                      fontWeight: 800,
                      fontSize: fontSizeFor(teaser.length),
                      lineHeight: 1.3,
                      color: '#1f2933',
                      textAlign: 'center',
                      letterSpacing: '0.02em',
                    },
                    children: teaser,
                  },
                },
                quote.ko
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          fontFamily: 'NotoSansKR',
                          fontWeight: 400,
                          fontSize: 30,
                          lineHeight: 1.5,
                          color: '#6b7480',
                          textAlign: 'center',
                          marginTop: 26,
                        },
                        children: quote.ko,
                      },
                    }
                  : null,
              ],
            },
          },
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'NotoSansKR', data: bold, weight: 800, style: 'normal' },
          { name: 'NotoSansKR', data: regular, weight: 400, style: 'normal' },
        ],
      },
    )

    const buf = Buffer.from(await img.arrayBuffer())
    res.setHeader('Content-Type', 'image/png')
    // 결정적 이미지 → CDN 1년 캐시(문장 데이터가 바뀌면 id 도 바뀌는 운영 관행 전제)
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000')
    return res.status(200).send(buf)
  } catch (err) {
    console.error('GET /api/og failed:', err)
    // 폰트/렌더 실패 → 정적 티저로 강등(fail-soft). 미리보기는 항상 뜬다.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300')
    return res.redirect(302, '/og.png')
  }
}
