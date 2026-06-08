import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev -- --host` 로도 노출 가능하지만, 기본으로도 LAN 노출해
    // 폰 실기기 테스트를 쉽게 한다. (계획 검증 단계 참고)
    host: true,
    port: 5173,
  },
})
