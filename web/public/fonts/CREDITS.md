# 번들된 웹 글꼴 출처

설치본은 오프라인이라 CDN 을 쓰지 않는다. `fonts.css` 가 두 글꼴과 폴백의
`@font-face` 를 선언하고 `index.html` 이 그 파일을 `<link>` 로 받는다.

이 폴더의 파일은 `CREDITS.md` 와 `manifest.json` 을 빼고 전부
`scripts/build_fonts.py` 가 만든다. 손으로 고치지 말 것 — `manifest.json` 의 sha256 과
어긋나면 `tests/contract/test_fonts_bundle.py` 가 잡는다.

## pretendard-1.3.9/ — Pretendard Variable

- 글꼴: Pretendard Variable 1.3.9 (가변, wght 45–920)
- 저작권: Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name Pretendard
- 라이선스: SIL Open Font License 1.1 (`pretendard-1.3.9/OFL.txt`)
- 출처: npm `pretendard@1.3.9` 타르볼의 `dist/web/variable/woff2-dynamic-subset/` 92조각과
  `pretendardvariable-dynamic-subset.css` 를 **수정 없이** 복사했다(경로만 바꿈).
  Reserved Font Name 이 있어 직접 서브셋하면 이름을 바꿔야 한다 — 그래서 패키지가 만든
  파일을 그대로 쓴다.
- 용도: 한글·본문·표제·UI 전부. 숫자·코드처럼 모노를 명시적으로 건 자리만 Geist Mono 로
  간다. 브라우저가 화면에 쓰인 글자가 든 조각만 내려받는다.

## geist-mono-1.7.2/ — Geist Mono

- 글꼴: Geist Mono 1.7.2 (가변, wght 100–900; Vercel 과 basement.studio 가 만들었다)
- 저작권: Copyright (c) 2023 Vercel, in collaboration with basement.studio (`OFL.txt` 머리말).
  글꼴 파일 안의 name 테이블은 "Copyright 2024 The Geist Project Authors
  (https://github.com/vercel/geist-font.git)" 라고 적혀 있고, 서브셋에서도 그대로 남겼다.
- 라이선스: SIL Open Font License 1.1 (`geist-mono-1.7.2/OFL.txt`). Reserved Font Name 선언이
  없어 수정본에 원래 이름을 써도 된다.
- 출처: npm `geist@1.7.2` 타르볼의 `dist/fonts/geist-mono/GeistMono-Variable.ttf` 와
  `LICENSE.txt`(여기서는 `OFL.txt`).
- 수정: fontTools `subset` 으로 라틴·숫자·문장부호·화살표·기호 범위만 남기고 woff2 로
  압축했다(약 34KB). 가변 축은 인스턴스화하지 않고 그대로 뒀다. 한글은 들어 있지 않고,
  범위에 넣었지만 원본에 글립이 없는 ₩(U+20A9)·■(U+25A0)·□(U+25A1) 도 빠져 있어
  그 글자는 Pretendard 로 떨어진다.
- 용도: 숫자·연도·순위·건수·코드·파일명·키처럼 모노를 명시적으로 건 자리만. 한글이 섞인
  자리는 Pretendard 로 떨어진다.

## 'Pretendard Fallback' — 글꼴 파일이 아니다

Windows 의 Malgun Gothic 을 가리키는 `local()` 선언에 `size-adjust`·`ascent-override`·
`descent-override` 를 붙여 Pretendard 의 글자 폭·행높이에 맞춘 것이다. Pretendard 가
내려오기 전에 그려진 줄이 글꼴 교체 뒤에도 같은 자리에서 끊어지게 한다(레이아웃 이동
방지). 파일이 없으므로 라이선스 표기 대상이 아니다.
