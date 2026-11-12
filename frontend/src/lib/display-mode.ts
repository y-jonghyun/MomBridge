/**
 * 홈 화면에 설치해 연 앱(standalone)인지 알아내 <html data-display="standalone">으로 표시한다.
 *
 * CSS만으로는 @media (display-mode: standalone)으로 충분하지만, iOS의 예전 방식(navigator.standalone)은
 * 미디어 쿼리로 잡히지 않아 스크립트로 한 번 더 확인한다. 첫 화면이 그려지기 전에 돌아야
 * 숨길 장식이 깜빡이지 않으므로 layout의 <head>에 그대로 넣는다(외부 파일 아님).
 *
 * 설치 앱에서만 바꾸는 것(globals.css)
 * - .web-only: 사이트 장식(머리글의 영문 "MomBridge" 줄)을 숨긴다
 */
export const DISPLAY_MODE_SCRIPT = `(function(){try{var s=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;if(s)document.documentElement.setAttribute('data-display','standalone');}catch(e){}})();`;
