import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/LegalPage';
import { BUSINESS_INFO, GOVERNING_COURT, TERMS_EFFECTIVE_DATE, businessInfoLine } from '@/lib/legal';

export const metadata: Metadata = { title: '이용약관 — 맘브릿지' };


export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effectiveDate={TERMS_EFFECTIVE_DATE}>
      <Section title="제1조 (목적)">
        <p>이 약관은 {BUSINESS_INFO.name}(이하 &quot;회사&quot;)가 운영하는 맘브릿지 서비스(이하 &quot;서비스&quot;)의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다.</p>
      </Section>

      <Section title="제2조 (정의)">
        <ol className="list-decimal pl-5 space-y-1">
          <li>&quot;회원&quot;은 이 약관에 동의하고 가입한 자로, 체험단원과 고객사로 나뉩니다.</li>
          <li>&quot;체험단원&quot;은 미션에 지원해 체험하고 후기 등 콘텐츠를 작성하는 회원입니다.</li>
          <li>&quot;고객사&quot;는 자신의 사업장·상품을 알리기 위해 미션을 등록하고 대금을 결제하는 회원입니다.</li>
          <li>&quot;미션&quot;은 고객사가 등록하고 회사가 공개하는 체험·홍보 과제입니다.</li>
          <li>&quot;추적 링크&quot;는 체험단원 콘텐츠를 통한 방문 수를 집계하기 위해 회사가 발급하는 링크입니다.</li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 효력과 변경)">
        <p>회사는 이 약관을 서비스 화면에 게시합니다. 관련 법령을 위반하지 않는 범위에서 약관을 바꿀 수 있으며, 바꿀 때에는 시행일 7일 전(회원에게 불리한 변경은 30일 전)부터 바뀌는 내용과 시행일을 알립니다. 회원이 변경에 동의하지 않으면 이용을 멈추고 탈퇴할 수 있습니다.</p>
      </Section>

      <Section title="제4조 (회원가입)">
        <p>만 14세 이상인 자가 이 약관과 개인정보 수집·이용에 동의하고 가입 정보를 입력하면 가입됩니다. 다른 사람의 정보를 쓰거나 허위 정보를 입력한 경우 회사는 가입을 거절하거나 이용을 제한할 수 있습니다.</p>
      </Section>

      <Section title="제5조 (서비스 내용)">
        <ul className="list-disc pl-5 space-y-1">
          <li>미션 등록·공개와 체험단원 모집·선정 지원</li>
          <li>키워드 추천, 추적 링크 발급, 방문 성과 리포트 제공</li>
          <li>체험단원 콘텐츠 제출·확인과 보상 지급 처리</li>
          <li>회원 커뮤니티</li>
        </ul>
        <p>회사는 체험단원과 고객사를 연결하는 플랫폼이며, 고객사가 제공하는 상품·서비스의 품질은 해당 고객사가 책임집니다.</p>
      </Section>

      <Section title="제6조 (체험단원의 의무)">
        <ul className="list-disc pl-5 space-y-1">
          <li>콘텐츠에는 고객사로부터 대가(무상 제공·보상 등)를 받았다는 사실을 「추천·보증 등에 관한 표시·광고 심사지침」에 따라 잘 보이게 밝혀야 합니다.</li>
          <li>실제로 체험하지 않은 내용, 사실과 다른 내용, 타인의 저작물을 무단으로 쓴 콘텐츠를 제출해서는 안 됩니다.</li>
          <li>추적 링크를 반복 클릭하거나 자동화 도구로 방문 수를 부풀려서는 안 됩니다.</li>
        </ul>
      </Section>

      <Section title="제7조 (고객사의 의무와 결제)">
        <ul className="list-disc pl-5 space-y-1">
          <li>고객사는 미션 내용(제공 상품, 방문 조건 등)을 사실대로 입력하고, 선정된 체험단원에게 약속한 체험을 제공해야 합니다.</li>
          <li>미션 대금은 미션 등록 시 결제하며, 결제가 확인된 미션만 공개됩니다.</li>
          <li>
            환불 기준은 미션의 진행 단계에 따릅니다.
            <ol className="list-decimal pl-5 mt-1 space-y-1">
              <li>미션 공개 전 취소: 전액 환불</li>
              <li>모집 중 취소: 선정된 체험단원이 없으면 전액 환불, 이미 선정된 경우 선정 인원분을 뺀 나머지를 환불</li>
              <li>모집 마감 후 정원 미달: 미달 인원분 환불</li>
              <li>선정된 체험단원이 콘텐츠를 제출하지 않거나 최종 반려된 경우: 해당 인원분 환불</li>
              <li>콘텐츠가 승인된 인원분: 환불 불가</li>
              <li>고객사 귀책(약속한 체험을 제공하지 않거나 미션 내용이 사실과 다른 경우): 환불 불가. 회사는 이용을 제한할 수 있습니다.</li>
              <li>회사 귀책이나 서비스 장애로 미션을 진행할 수 없는 경우: 전액 환불</li>
              <li>환불은 요청일로부터 영업일 7일 이내에 결제한 수단으로 취소합니다.</li>
            </ol>
          </li>
        </ul>
      </Section>

      <Section title="제8조 (체험단원 보상)">
        <p>회사는 고객사가 확인 기준을 충족한 콘텐츠를 승인하면 체험단원에게 보상을 지급합니다. 지급액, 지급 시기·방법, 세금 처리는 다음과 같습니다.</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>지급액은 미션 보상금에서 플랫폼 수수료 10%와 세금(사업소득 3.3% 원천징수)을 뺀 금액입니다.</li>
          <li>매월 말일까지 승인된 건을 다음 달 10일에 체험단원이 등록한 계좌로 지급합니다. 지급일이 휴일이면 다음 영업일에 지급합니다.</li>
          <li>계좌를 등록하지 않았거나 계좌 정보가 잘못된 경우, 바르게 수정될 때까지 지급을 보류합니다.</li>
          <li>승인된 콘텐츠는 최소 6개월 동안 유지해야 합니다. 지급 전에 삭제하면 지급이 취소되고, 지급 후 6개월 안에 삭제하면 회사는 지급액의 반환을 요청할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (게시물)">
        <p>회원이 작성한 게시물의 저작권은 작성자에게 있습니다. 회사는 서비스 운영·홍보에 필요한 범위에서 게시물을 표시할 수 있습니다. 법령이나 이 약관을 위반한 게시물은 알리지 않고 숨기거나 삭제할 수 있습니다.</p>
      </Section>

      <Section title="제10조 (이용 제한과 탈퇴)">
        <p>회원은 언제든지 탈퇴를 요청할 수 있습니다. 회원이 이 약관을 위반하면 회사는 경고, 이용 정지, 계약 해지 순으로 이용을 제한할 수 있으며, 부정 클릭·허위 콘텐츠 등 중대한 위반은 바로 해지할 수 있습니다.</p>
      </Section>

      <Section title="제11조 (서비스 중단과 책임 제한)">
        <p>회사는 시스템 점검·장애·천재지변 등으로 서비스를 일시 중단할 수 있으며, 계획된 중단은 미리 알립니다. 회사는 고의나 중대한 과실이 없는 한 회원 사이의 거래나 회원이 게시한 정보로 생긴 손해에 책임을 지지 않습니다.</p>
      </Section>

      <Section title="제12조 (분쟁 해결)">
        <p>이 약관은 대한민국 법률에 따릅니다. 서비스 이용과 관련한 분쟁은 {GOVERNING_COURT}을 관할 법원으로 합니다.</p>
      </Section>

      <Section title="부칙">
        <p>이 약관은 {TERMS_EFFECTIVE_DATE}부터 시행합니다.</p>
        <p className="text-gray-500">
          사업자 정보: {businessInfoLine()}
        </p>
      </Section>
    </LegalPage>
  );
}
