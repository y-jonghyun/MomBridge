'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { LandingCta } from './pieces';

/**
 * /about 히어로의 버튼 두 개.
 * 이미 로그인한 사람에게는 '가입하기'를 보여 주지 않는다.
 * (persist 복원 전에는 서버와 같은 화면을 그려 hydration 불일치를 막는다 — SiteHeader와 같은 방식)
 */
export default function AboutHeroActions() {
  const user = useAuthStore(s => s.user);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const signedIn = ready && !!user;

  return (
    <div className="mt-[22px] flex gap-2">
      <LandingCta href="/missions" className="flex-1">우리 동네 미션 보기</LandingCta>
      {!signedIn && (
        <LandingCta href="/register" tone="outline" className="w-[110px] shrink-0">가입하기</LandingCta>
      )}
    </div>
  );
}
