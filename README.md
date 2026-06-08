# Quote Hangman 🎯

영어 명언을 **행맨(Hangman)** 방식으로 맞추는 학습 게임.
같은 알파벳은 같은 **암호 기호**로 표시돼, 초보자도 패턴을 추론하며 풀 수 있습니다.

- **React + Vite (바닐라 JS)** · 서버/DB 없이 브라우저에서만 동작
- **모바일 우선** UI/UX — 탭으로 글자를 골라 빈칸에 놓고, 데스크톱에선 드래그도 가능
- 3개 난이도 · 레벨당 10개 명언(총 30개) · 다음 문제로 계속 이어서 플레이

> 원본 명세: [`docs/MVP_Spec.md`](docs/MVP_Spec.md)
> 명세는 네이티브 Drag&Drop API를 명시했지만, **터치 기기에서 동작하지 않아** 모바일 우선
> 요구에 맞춰 탭-투-플레이스(주) + @dnd-kit 드래그(보조)로 구현했습니다.

---

## 빠른 시작 (localhost)

```bash
npm install      # 최초 1회
npm run dev      # 개발 서버 (http://localhost:5173)
```

브라우저에서 **http://localhost:5173** 접속 → 레벨 선택 → 플레이.

### 📱 폰(실기기)에서 테스트하기

dev 서버는 LAN에 자동 노출됩니다. **PC와 폰이 같은 Wi-Fi**에 있어야 합니다.

1. `npm run dev` 실행 시 터미널에 표시되는 **Network 주소**를 확인
   (예: `http://192.168.219.171:5173/` — IP는 환경마다 다름)
2. 폰 브라우저에서 그 주소 접속
3. ⚠️ 첫 실행 시 **Windows Defender 방화벽 허용** 프롬프트가 뜨면 반드시 **허용**
   (안 하면 폰이 접속 불가). IP는 PowerShell `ipconfig` 의 IPv4 주소로도 확인 가능.

> 데스크톱 DevTools의 기기 에뮬레이션(iPhone SE 375px)으로도 1차 확인 가능하지만,
> 터치 동작은 실기기 확인이 정확합니다.

---

## 게임 규칙

- 명언의 모든 알파벳이 빈칸(`_`)으로 시작. 공백·구두점은 그대로 표시됩니다.
- 각 빈칸 아래 **암호 기호**가 있습니다. **같은 글자 = 같은 기호** → 패턴으로 추론!
- 하단 **카드**(문장에 등장하는 글자만)를 탭해 선택한 뒤, 빈칸을 탭해 배치합니다.
  데스크톱에선 카드를 빈칸으로 **드래그**할 수도 있습니다.
- 같은 글자라도 위치마다 직접 놓아야 합니다(자동 채움 없음).
- 한 글자의 **모든 위치**를 맞히면 그 카드는 회색이 됩니다.
- **오답** → 빈칸이 빨갛게 흔들리고 **시도 1 감소** (카드는 그대로).
- 모든 빈칸을 맞히면 **승리**, 시도가 0이면 **패배**.

| 레벨 | 길이 | 무료 공개 | 시도 |
|------|------|-----------|------|
| 1 | ≤ 60자 | 1글자(모든 위치) | 8회 |
| 2 | 61–99자 | 없음 | 7회 |
| 3 | ≥ 100자 | 없음 | 6회 |

---

## 프로젝트 구조

```
src/
├─ main.jsx                 진입점
├─ App.jsx                  화면 라우팅 (INIT → 게임 → 결과)
├─ hooks/useGame.js         게임 상태(두뇌): useReducer + 파생값
├─ lib/
│  ├─ cipher.js             암호 심볼 풀 + 매핑 생성
│  ├─ tokenize.js           명언 → 위치 단위 토큰 배열
│  └─ quotePicker.js        레벨별 명언 선택 + 진행 + 무료 공개 글자
├─ data/quotes.json         명언 30개 (레벨별 10개)
├─ components/              LevelSelect / GameScreen / QuoteBoard /
│                           BlankSlot / CardTray / LetterCard /
│                           AttemptsCounter / ResultScreen
└─ styles/globals.css       디자인 토큰 + 리셋
```

---

## 스크립트

```bash
npm run dev              # 개발 서버 (LAN 노출)
npm run build            # 프로덕션 빌드 → dist/
npm run preview          # 빌드 결과 미리보기
npm run validate-quotes  # 명언 데이터 검증(레벨별 길이/문자 규칙)

# 로직 검증(헤드리스, 선택)
node scripts/sanity-logic.mjs     # cipher/tokenize (AC1, AC2)
node scripts/sanity-reducer.mjs   # 게임 로직 (AC4~AC9)
```

---

## 명언 추가/수정

`src/data/quotes.json` 에 `{ id, text, level, author }` 형태로 추가한 뒤
`npm run validate-quotes` 로 검증하세요. 규칙:
- 길이: L1 ≤60 / L2 61–99 / L3 ≥100자 (공백·구두점 포함)
- 텍스트 구두점은 `. , ' ? ! - : ;` 만 사용 (암호 기호와 겹치지 않도록)
- 고유 글자 6개 이상 (패턴 추론이 의미 있도록)

---

## 배포 (Deploy)

순수 클라이언트 SPA(서버·DB 없음)라 정적 호스팅이면 끝납니다.

- **Vercel / Netlify (권장)**: 저장소를 연결하면 Vite를 자동 감지 → 추가 설정 불필요.
  빌드 명령 `npm run build`, 출력 디렉토리 `dist/`.
- **수동/기타 호스팅**: `npm run build` 후 `dist/` 폴더를 업로드. 로컬 미리보기는 `npm run preview`.

## 모바일 앱으로 전환 (같은 코드베이스)

순수 클라이언트라 웹과 앱을 한 코드베이스로 갑니다 (지금은 아무것도 추가 안 해도 됨):

1. **PWA** (가장 쉬운 첫 단계 — "폰에 설치 가능"한 웹앱):
   `vite-plugin-pwa` + `public/manifest` 추가. 구조 변경 없음.
2. **Capacitor** (앱스토어 네이티브 배포):
   웹 프로젝트 루트를 래핑하고 `android/`·`ios/`를 루트에 생성.
   현재 **루트 레이아웃이 Capacitor 기대 구조**라 그대로 쓸 수 있음.

## 향후 개선 후보 (우선순위)

리서치(Wordle·크립토그램 앱 UX) 기반 후보. 각 항목은 회귀 게이트(`npm run verify`)를 통과시키며 추가:

1. **물리 키보드 입력**(데스크톱) — 안전하고 체감 큼.
2. **힌트 버튼** — 막힘 해소(시도 차감 등 밸런스 규칙 필요).
3. **통계 / 스트릭** — 재방문 유도(영속 데이터·새 화면 필요).
4. **명언 풀 확장** — 반복 플레이 신선도.
5. 결과 공유 / 데일리 모드 — 그 다음.
