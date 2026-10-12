export default function Footer() {
  return (
    <footer className="border-t border-line py-12 px-5 text-center mt-auto">
      <p className="text-[13px] font-serif italic text-muted mb-4">slow walk, local bridge</p>
      <p className="text-[11px] leading-loose text-muted max-w-2xl mx-auto">
        맘브릿지 . 대표: 홍길동 . 주소: 00000 서울특별시 어딘가 1층 . 문의: hello@mombridge.example
        <br />
        &copy; {new Date().getFullYear()} MomBridge. All rights reserved.
      </p>
    </footer>
  );
}
