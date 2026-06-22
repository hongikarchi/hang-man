/* =========================================================================
   categories.js — 카테고리 매니페스트.
   새 카테고리 추가 = 데이터 JSON 1개 + 여기 항목 1개.
   ========================================================================= */

import quotes from './quotes.json' with { type: 'json' }
import travel from './travel.json' with { type: 'json' }
import business from './business.json' with { type: 'json' }
import movies from './movies.json' with { type: 'json' }

export const CATEGORIES = [
  {
    id: 'quotes',
    label: '명언',
    emoji: '📜',
    desc: '세계 명사들의 영어 명언',
    data: quotes,
    levelDesc: {
      1: '짧은 명언 · 글자 절반 미리 공개 · 시도 8회',
      2: '중간 길이 · 몇 글자만 공개 · 시도 7회',
      3: '긴 명언 · 공개 없음 · 시도 6회',
    },
  },
  {
    id: 'travel',
    label: '여행 회화',
    emoji: '✈️',
    desc: '여행지에서 바로 쓰는 영어 한마디',
    data: travel,
    levelDesc: {
      1: '짧은 표현 · 글자 절반 미리 공개 · 시도 8회',
      2: '중간 길이 · 몇 글자만 공개 · 시도 7회',
      3: '긴 표현 · 공개 없음 · 시도 6회',
    },
  },
  {
    id: 'business',
    label: '비즈니스 영어',
    emoji: '💼',
    desc: '회의·이메일에서 쓰는 영어 표현',
    data: business,
    levelDesc: {
      1: '짧은 표현 · 글자 절반 미리 공개 · 시도 8회',
      2: '중간 길이 · 몇 글자만 공개 · 시도 7회',
      3: '긴 표현 · 공개 없음 · 시도 6회',
    },
  },
  {
    id: 'movies',
    label: '영화 명대사',
    emoji: '🎬',
    desc: '유명 영화 속 잊지 못할 한마디',
    data: movies,
    levelDesc: {
      1: '짧은 대사 · 글자 절반 미리 공개 · 시도 8회',
      2: '중간 길이 · 몇 글자만 공개 · 시도 7회',
      3: '긴 대사 · 공개 없음 · 시도 6회',
    },
  },
]

export const DEFAULT_CATEGORY = 'quotes'

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id)
