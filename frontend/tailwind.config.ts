import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#faf7f1',
        ink: '#1f1c18',
        muted: '#8a8378',
        line: '#e6e0d4',
        sand: '#f3efe6',
      },
      fontFamily: {
        script: ['"Pinyon Script"', 'cursive'],
        serif: ['"Cormorant Garamond"', '"Noto Sans KR"', 'serif'],
        sans: ['"Noto Sans KR"', '-apple-system', '"Malgun Gothic"', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.18em',
      },
    },
  },
  plugins: [],
};
export default config;
