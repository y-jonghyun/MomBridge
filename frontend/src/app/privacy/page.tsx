import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/LegalPage';
import { BACKUP_RETENTION_DAYS, BUSINESS_INFO, PRIVACY_EFFECTIVE_DATE, PRIVACY_OFFICER } from '@/lib/legal';

export const metadata: Metadata = { title: '개인정보처리방침 — 맘브릿지' };


const th = 'border border-gray-200 bg-stone-50 px-3 py-2 text-left font-semibold';
const td = 'border border-gray-200 px-3 py-2 align-top';

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" effectiveDate={PRIVACY_EFFECTIVE_DATE}>
      <p>{BUSINESS_INFO.name}(이하 &quot;회사&quot;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 처리하기 위해 다음과 같이 개인정보처리방침을 둡니다.</p>

      <Section title="1. 수집하는 항목과 이용 목적">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead><tr><th className={th}>구분</th><th className={th}>항목</th><th className={th}>목적</th></tr></thead>
            <tbody>
              <tr><td className={td}>가입(필수)</td><td className={td}>이메일, 비밀번호(암호화 저장), 이름, 회원 유형, <b>휴대폰 번호</b></td><td className={td}>회원 식별, 로그인, 공지, <b>선정·정산 안내, 중복 가입 방지</b></td></tr>
              <tr><td className={td}>고객사(선택)</td><td className={td}>상호, 사업장 주소·지역, 업종, 사업자등록번호</td><td className={td}>미션 등록·공개, 결제 안내 문자 발송</td></tr>
              <tr><td className={td}>체험단원</td><td className={td}>활동 지역, SNS 계정 주소, 제출한 콘텐츠 주소</td><td className={td}>미션 매칭·선정, 콘텐츠 확인</td></tr>
              <tr><td className={td}>보상 지급</td><td className={td}>은행명, 계좌번호, 예금주. 보상이 원천징수 대상인 경우에는 첫 지급 전에 <b>주민등록번호</b>를 별도 동의를 받아 추가로 수집하고 암호화해 보관합니다(「소득세법」 근거)</td><td className={td}>보상 지급, 세금 신고</td></tr>
              <tr><td className={td}>결제(고객사)</td><td className={td}>주문번호, 결제 금액·일시 (카드 정보는 결제대행사가 처리하며 회사는 저장하지 않음)</td><td className={td}>결제 확인, 환불</td></tr>
              <tr><td className={td}>마케팅(선택)</td><td className={td}>이메일, 연락처</td><td className={td}>이벤트·새 미션 안내 (동의한 경우만)</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="2. 자동으로 생성·수집되는 정보">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>추적 링크 방문 집계</b>: 체험단원 콘텐츠 속 추적 링크로 들어온 방문자에 대해 방문 시각, 기기 종류(모바일·PC), 유입 사이트 도메인을 기록합니다. 같은 사람의 중복 방문을 거르기 위해 IP 주소와 브라우저 정보를 <b>날짜별 일방향 암호화 값</b>으로 바꿔 쓰며, <b>IP 주소 원본은 저장하지 않습니다</b>. 원본 기록은 90일 후 삭제하고 일별 합계만 남깁니다.</li>
          <li><b>로그인 상태</b>: 로그인 정보(인증 토큰)를 이용자 브라우저 저장소에 보관합니다. 로그아웃하면 지워집니다.</li>
          <li><b>오류 기록</b>: 서비스 오류를 고치기 위해 오류 내용, 발생 화면 주소(검색어 등 주소 뒤 값은 제외), 브라우저 종류, 회원 식별번호를 오류 모니터링 서비스에 보냅니다. 입력 내용·비밀번호·인증 정보는 보내지 않습니다.</li>
        </ul>
      </Section>

      <Section title="3. 보유 기간">
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 정보: 탈퇴 시까지. 탈퇴하면 바로 파기합니다(아래 법정 보관 정보 제외).</li>
          <li>「전자상거래 등에서의 소비자보호에 관한 법률」: 계약·청약철회·대금결제 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
          <li>「국세기본법」·「소득세법」: 보상 지급·원천징수 관련 기록 5년. 주민등록번호는 위와 같이 원천징수 대상이 되어 수집한 경우에만 보관하며, 이때에도 같은 5년이 지나면 파기합니다.</li>
          <li>「통신비밀보호법」: 서비스 접속 기록 3개월</li>
          <li>추적 링크 방문 원본 기록: 90일 (이후 개인을 알아볼 수 없는 일별 합계만 보관)</li>
        </ul>
      </Section>

      <Section title="4. 제3자 제공">
        <p>회사는 이용자의 개인정보를 1번의 목적 밖으로 쓰거나 제3자에게 제공하지 않습니다. 다만 미션을 진행하기 위해 <b>해당 미션의 고객사</b>에게 아래 정보를 제공합니다. 법령에 근거가 있는 경우는 예외입니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead><tr><th className={th}>시점</th><th className={th}>고객사에게 제공되는 체험단원 정보</th></tr></thead>
            <tbody>
              <tr><td className={td}>미션 지원</td><td className={td}>제공하지 않습니다 — 고객사에게는 지원 건수와 승인 건수만 보입니다</td></tr>
              <tr><td className={td}>콘텐츠 제출</td><td className={td}>이름, 제출한 게시글 주소(SNS·블로그)와 설명, 검수 상태</td></tr>
              <tr><td className={td}>성과 리포트</td><td className={td}>이름, 게시글 주소, 대가 표시 확인 결과, 추적 링크 클릭 수·방문자 수</td></tr>
            </tbody>
          </table>
        </div>
        <p>고객사에게 체험단원의 <b>이메일, 연락처(전화번호), 활동 지역, 자기소개, 지원 메시지, 누적 보상 금액, 수행한 미션 수, 평점, 계좌 정보, SNS 계정 정보, 접속 기록은 제공하지 않습니다.</b> 제출물에 올린 사진·파일과 운영자의 검수 메모도 제공하지 않습니다. 고객사가 발급한 공개 공유 링크로 성과 리포트를 보는 경우에는 체험단원의 이름이 가려진 상태(예: 홍*동)로 표시됩니다.</p>
      </Section>

      <Section title="5. 처리 위탁과 국외 이전">
        <p>서비스 운영을 위해 다음 업체에 처리를 맡깁니다. 일부는 해외에 서버가 있어 서비스 이용 시 네트워크를 통해 이전됩니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead><tr><th className={th}>업체</th><th className={th}>업무</th><th className={th}>위치</th></tr></thead>
            <tbody>
              <tr><td className={td}>Supabase Inc.</td><td className={td}>데이터베이스·사진 파일 보관</td><td className={td}>일본(도쿄)</td></tr>
              <tr><td className={td}>Render Services, Inc.</td><td className={td}>서버 운영</td><td className={td}>싱가포르</td></tr>
              <tr><td className={td}>Vercel Inc.</td><td className={td}>웹 화면 제공</td><td className={td}>미국 등</td></tr>
              <tr><td className={td}>(주)토스페이먼츠</td><td className={td}>결제 처리</td><td className={td}>대한민국</td></tr>
              <tr><td className={td}>(주)솔라피</td><td className={td}>문자·알림톡 발송</td><td className={td}>대한민국</td></tr>
              <tr><td className={td}>Functional Software, Inc. (Sentry)</td><td className={td}>오류 모니터링</td><td className={td}>미국</td></tr>
              <tr><td className={td}>Cloudflare, Inc.</td><td className={td}>암호화된 데이터베이스 백업 보관</td><td className={td}>아시아·태평양</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-500">국외 이전을 원하지 않으면 가입하지 않거나 탈퇴할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.</p>
      </Section>

      <Section title="6. 파기 절차와 방법">
        <p>보유 기간이 끝나거나 목적을 이룬 개인정보는 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로 지우고, 백업본은 보관 기간({BACKUP_RETENTION_DAYS}일)이 지나면 자동 삭제됩니다.</p>
      </Section>

      <Section title="7. 이용자의 권리">
        <p>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지와 동의 철회(마케팅 수신 동의 포함)를 요청할 수 있습니다. 아래 개인정보 보호책임자에게 이메일로 요청하면 10일 안에 처리합니다.</p>
      </Section>

      <Section title="8. 안전성 확보 조치">
        <ul className="list-disc pl-5 space-y-1">
          <li>비밀번호 일방향 암호화(bcrypt), 전 구간 HTTPS 통신</li>
          <li>데이터베이스 접근 통제(외부 공개 API 차단), 관리자 계정 분리</li>
          <li>백업 파일 암호화 후 보관</li>
        </ul>
      </Section>

      <Section title="9. 만 14세 미만 아동">
        <p>회사는 만 14세 미만 아동의 가입을 받지 않습니다.</p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
        <p>책임자 {PRIVACY_OFFICER.name}({PRIVACY_OFFICER.title}) · 이메일 {PRIVACY_OFFICER.email} · 전화 {PRIVACY_OFFICER.phone}</p>
        <p className="text-gray-500">개인정보 침해 신고·상담: 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)</p>
      </Section>

      <Section title="11. 방침 변경">
        <p>이 방침은 {PRIVACY_EFFECTIVE_DATE}부터 적용됩니다. 내용이 바뀌면 시행 7일 전부터 서비스 화면에 알립니다.</p>
      </Section>
    </LegalPage>
  );
}
