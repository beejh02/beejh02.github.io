# 나의 책상

밝은 원목 책상 위에 놓인, 내용 없는 3D 책입니다. React, TypeScript, Three.js, Vite로 구성했습니다.

책상 위 비닐 레코드는 홈과 중앙 라벨을 코드로 생성합니다. 책을 펼치면 전환이 끝난 뒤 레코드의 모델·재질·텍스처를 해제하고, 책상으로 돌아올 때 다시 생성합니다.

[The Book of Qbject](https://github.com/Qbject/the-book-of-qbject)의 책 곡면과 넘김 코드를 적용했습니다. 원본 글·그림·영상은 포함하지 않으며, 원목·종이·천 표지 질감은 코드로 생성합니다. 라이선스는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 있습니다.

## 실행

```sh
npm install
npm run dev
```

## 확인

```sh
npm run typecheck
npm run lint
npm run build
```

## 조작

- 레코드를 누르면 프로젝트 페이지(`#projects`)로 이동합니다. 아래로 스크롤하면 카드가 원호를 따라 위로 회전하면서 01 → 02 → 03 → 01 순서로 끝없이 전환됩니다. 위로 스크롤하면 역방향으로 돌아가며, 카드를 눌러 이동할 수도 있습니다. 카드와 레코드판이 같은 회전축을 공유합니다. `책상으로 돌아가기` 또는 `Esc`로 복귀할 수 있습니다.
- 닫힌 책을 클릭하면 표지가 펼쳐지면서 책 중심 화면으로 전환됩니다.
- 책 화면 오른쪽 위의 `책상으로 돌아가기` 버튼을 누르면 책이 닫히면서 책상 화면으로 돌아갑니다.
- 오른쪽 책장 클릭 또는 `→`: 다음 책장
- 왼쪽 책장 클릭 또는 `←`: 이전 책장
- `Esc`: 책을 덮고 처음 책상 화면으로 돌아가기
- 모바일: 책장 터치 또는 좌우 스와이프
- 움직임 줄이기 설정을 켜면 애니메이션 없이 이동합니다.

## 수정 위치

- `src/App.tsx`: 책상 / 프로젝트 페이지 전환과 필요한 화면만 로딩
- `src/Desk.tsx`: 책상 화면과 책상으로 돌아가기 버튼
- `src/projects/ProjectsPage.tsx`: 프로젝트 카드와 상세 영역
- `src/projects/projects.ts`: 프로젝트 정보·이미지·사이트 및 GitHub 링크 입력
- `src/projects/projects.css`: 프로젝트 페이지 스타일
- `src/study/scene.ts`: 책상, 조명, 카메라, 책 조립, 입력 처리
- `src/study/Page.ts`: 종이 곡면과 넘김
- `src/study/Record.ts`: 비닐 레코드 모델과 질감
- `src/study/materials.ts`: 원목·종이·표지 질감
- `src/style.css`: 화면 배치와 반응형 스타일
