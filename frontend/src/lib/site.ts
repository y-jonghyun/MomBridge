/**
 * 사이트 주소. 공유 카드(openGraph)의 절대 주소를 만들 때 쓴다.
 *
 * 비워 두면 Next가 배포마다 달라지는 Vercel 주소를 쓰므로, 공개 주소를 기본값으로 둔다.
 * 도메인을 새로 연결하면 NEXT_PUBLIC_SITE_URL 환경 변수로 덮어쓰면 된다.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mombridge-frontend.vercel.app';

/**
 * 브라우저 상단·설치 앱 상태바 색. 디자인 토큰 cream(#F6F1E8, 페이지 배경)과 같게 두어 화면과 이어 보이게 한다.
 * app/manifest.ts(theme_color·background_color)와 app/layout.tsx(viewport.themeColor)가 함께 쓴다.
 */
export const THEME_COLOR = '#F6F1E8';
