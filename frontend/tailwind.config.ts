import type { Config } from 'tailwindcss';

// 디자인 기준: docs/design/mombridge-design/cream-editorial-v1.md (시안이 기준)
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F1E8',
        paper: '#FFFDF8',
        ink: { DEFAULT: '#211C16', 2: '#4A4238' },
        muted: '#6F665B',
        // strong: 입력칸 테두리. 크림 3.30:1 · paper 3.65:1 (WCAG 1.4.11 비텍스트 대비 3:1 이상)
        line: { DEFAULT: '#E6DCCD', soft: '#EFE7DA', strong: '#8F8373' },
        clay: { DEFAULT: '#A9572F', dark: '#7E3E1F', tint: '#F2E3D6' },
        sage: { DEFAULT: '#46533B', tint: '#E3E6D8' },
        // 사진이 없을 때 쓰는 자리 색 (미션 id로 고정 선택)
        photo: { 1: '#E4D3C1', 2: '#D9D5C3', 3: '#E8DACB', 4: '#DDD8C8' },
        // 자리 색 위에 올리는 글자 색
        'photo-ink': { 1: '#7E5E45', 2: '#5E5A46', 3: '#7E5E45', 4: '#5E5A46' },
      },
      // 움직임 토큰 — 값은 globals.css의 :root 변수 (움직임 줄이기 설정에서는 globals.css가 모두 끈다)
      transitionTimingFunction: { mb: 'var(--mb-ease)' },
      transitionDuration: {
        press: 'var(--mb-dur-press)',
        quick: 'var(--mb-dur-quick)',
        push: 'var(--mb-dur-push)',
        'sheet-in': 'var(--mb-dur-sheet-in)',
        'sheet-out': 'var(--mb-dur-sheet-out)',
      },
      fontFamily: {
        // app/fonts.css의 :root 변수와 연결된다 (저장소에 넣은 글꼴)
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
        accent: ['var(--font-accent)', 'serif'],
      },
      fontSize: {
        // 시안의 단계 (11~30)
        hero: ['30px', { lineHeight: '1.32', letterSpacing: '-0.03em' }],
        'title-lg': ['26px', { lineHeight: '1.35', letterSpacing: '-0.02em' }],
        title: ['24px', { lineHeight: '1.35', letterSpacing: '-0.02em' }],
        section: ['20px', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
        'section-sm': ['18px', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        card: '16px',
        box: '18px',
        photo: '14px',
        control: '12px',
        'control-lg': '14px',
      },
      maxWidth: {
        // 데스크톱 가운데 정렬 폭 (완료 기준 6번)
        shell: '1120px',
        // 고객사 화면은 모바일 우선 — 데스크톱에서도 720px 가운데 정렬 (문서 3번)
        client: '720px',
      },
    },
  },
  plugins: [],
};
export default config;
