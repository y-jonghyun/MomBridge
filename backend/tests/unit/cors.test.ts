import { isAllowedOrigin } from '../../src/config/cors';

// setup-env.ts가 CORS_ORIGIN을 지정하지 않으므로 기본값(http://localhost:3000)이 쓰인다
describe('CORS 허용 주소', () => {
  it('설정된 주소와 Origin 없는 요청은 허용한다', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    // 브라우저가 아닌 호출(서버 간, 헬스체크)에는 Origin이 없다
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('우리 팀의 Vercel 미리보기 주소를 허용한다', () => {
    for (const origin of [
      'https://mombridge-frontend-abc123def-yjh900424-4773s-projects.vercel.app',
      'https://mombridge-frontend-git-design-cream-home-yjh900424-4773s-projects.vercel.app',
      'https://mombridge-frontend-1a2b3c-yjh900424-4773s-projects.vercel.app',
    ]) {
      expect(isAllowedOrigin(origin)).toBe(true);
    }
  });

  it('다른 vercel.app 주소는 허용하지 않는다', () => {
    for (const origin of [
      // 우리 팀 접미사가 없는 주소
      'https://mombridge-frontend-abc123.vercel.app',
      'https://mombridge-frontend.vercel.app',
      'https://evil.vercel.app',
      // 다른 팀 접미사
      'https://mombridge-frontend-abc123-someone-else-projects.vercel.app',
      // 접미사를 흉내 낸 다른 도메인
      'https://mombridge-frontend-abc-yjh900424-4773s-projects.vercel.app.evil.com',
      'https://evil.com/mombridge-frontend-abc-yjh900424-4773s-projects.vercel.app',
      // 앞에 뭔가 더 붙은 주소
      'https://evil-mombridge-frontend-abc-yjh900424-4773s-projects.vercel.app',
      // https가 아닌 경우
      'http://mombridge-frontend-abc123-yjh900424-4773s-projects.vercel.app',
      // 포트를 붙인 경우
      'https://mombridge-frontend-abc123-yjh900424-4773s-projects.vercel.app:8080',
    ]) {
      expect(isAllowedOrigin(origin)).toBe(false);
    }
  });
});
