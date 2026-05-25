# react-preload-intent

> React 19's `react-dom/preload()` with trigger taxonomy.

이 문서는 Claude Code 세션의 부트스트랩 컨텍스트입니다. 코드를 수정하기 전에 **핵심 결정**과 **스코프 밖** 섹션을 반드시 확인하세요.

---

## 프로젝트

Next.js의 `<Image priority>`가 내부적으로 호출하는 `ReactDOM.preload()` 패턴을 standalone 라이브러리로 분리한 것. 트리거 명명은 TanStack Router에서 차용 (`intent` / `viewport` / `render` / `manual`).

기존 이미지 프리로딩 라이브러리(`react-image`, `use-image`, `react-preload` 등)는 전부 pre-React-19 패턴(`new Image()` 또는 DOM 직접 주입) 기반. 이 라이브러리는 **React 19의 공식 `preload()` API를 트리거 단위로 노출**하는 점이 차별 포인트.

---

## 핵심 결정 (Decision Log)

각 결정의 *이유*가 더 중요합니다. 결정을 뒤집고 싶을 때는 이유부터 확인.

### 1. `react-dom/preload`만 사용한다 (직접 DOM 주입 금지)

- React 19가 dedup + head hoist + streaming 통합을 자동 처리
- 렌더 중 호출 가능 → effect 1 tick 지연 없음
- SSR / Server Component에서도 그대로 동작
- → 직접 `document.head.append(<link>)` 하는 코드는 추가하지 않음

### 2. 트리거 단위로만 분리한다 (이미지 로딩 상태는 다루지 않는다)

- `usePreloadedImage` / Suspense hook은 의도적으로 **제거됨** (v1에 있었음)
- 이유: `react-image`(Suspense + fallback 체인)와 `use-image`(react-konva 생태계) 가 이미 그 자리를 차지
- 이 라이브러리는 **"언제 프리로드를 트리거할지"** 만 다룸
- 사용자가 로딩 상태가 필요하면 위 두 라이브러리와 *함께* 쓰면 됨 (책임이 겹치지 않음)

### 3. 트리거 작명은 TanStack Router 컨벤션을 따른다

| Trigger | Hook | When |
|---|---|---|
| `render` | `usePreload`, `<Preload>` | 컴포넌트 렌더 중 |
| `intent` | `usePreloadIntent` | hover / touchstart / focus |
| `viewport` | `usePreloadViewport` | IntersectionObserver |
| `manual` | `usePreloadCallback` | 이벤트 핸들러에서 직접 |

TanStack Router는 라우트 프리로딩에 같은 taxonomy를 씀. 다른 작명(`usePreloadOnHover` 등)은 의도적으로 *기각*. 컨벤션 통일이 학습 비용을 낮춤.

### 4. Intent trigger는 50ms 지연 (TanStack 디폴트와 동일)

- 실수 hover 필터링
- 마우스가 떠나면 (`onMouseLeave`) 타이머 취소
- URL당 1회만 트리거 (Set으로 dedup)

### 5. 4가지 전략 (Image / Link / Cache / Fetch) 라이브러리는 폐기

- 초기 디자인에는 `preloader.ts`에 4가지 strategy가 있었음
- React 레이어에서 `react-dom/preload`만 쓰게 되면서 vanilla 레이어는 불필요해짐
- `preloadCache` / `preloadFetch`는 어떤 기존 라이브러리에도 없는 패턴이었지만, 이 라이브러리의 정체성을 흐리므로 제외
- → vanilla JS 환경 지원은 **스코프 밖**

### 6. 단일 파일 (`index.tsx`) 유지

- 5개 export, 200줄 미만 → 다중 파일로 쪼갤 이득 없음
- 단일 파일이 tree-shaking에 손해가 아님 (named exports이므로)
- 라이브러리 사이즈를 작게 유지하는 것이 명시적 목표

---

## 공개 API

```ts
// hooks
function usePreload(url, options?): void
function usePreloadCallback(): (url, options?) => void
function usePreloadIntent(url, options?): PreloadIntentHandlers
function usePreloadViewport<T>(url, options?): RefObject<T | null>

// component
function Preload(props: PreloadProps): null

// types
type FetchPriority = "high" | "low" | "auto"
interface PreloadOptions { fetchPriority?, crossOrigin?, imageSrcSet?, imageSizes?, referrerPolicy? }
interface UsePreloadOptions extends PreloadOptions { enabled? }
interface UsePreloadIntentOptions extends PreloadOptions { delay? }
interface UsePreloadViewportOptions extends PreloadOptions { rootMargin?, threshold?, root? }
interface PreloadIntentHandlers { onMouseEnter, onMouseLeave, onTouchStart, onFocus }
interface PreloadProps extends UsePreloadOptions { href }
```

**디폴트값**
- `fetchPriority`: `"high"` (JS 주입 시 브라우저 디폴트가 `"low"`라서 보정)
- `Intent delay`: `50ms`
- `Viewport rootMargin`: `"200px"`

---

## 알려진 함정

### Suspense + streaming

`preload()`는 호출 시점의 React render tree에서 head로 hoist됨. Suspense boundary 안에서 `await` 후 호출되면 stream 끝에 붙어 무의미해짐.

❌ 안티패턴:
```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent>      {/* await가 길면... */}
    <Preload href={url} />
    <img src={url} />
  </SlowComponent>
</Suspense>
```

✅ 올바른 패턴:
```tsx
<>
  <Preload href={url} />   {/* head에 즉시 hoist */}
  <Suspense fallback={<Skeleton />}>
    <SlowComponent><img src={url} /></SlowComponent>
  </Suspense>
</>
```

자세히: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/)

**코드 레벨에서는 막을 방법이 없음** — 사용 위치 문제이므로 README/JSDoc 경고로만 대응. 만약 lint rule 형태로 잡을 방법이 보이면 검토 가치 있음 (Open Question).

---

## 스코프 밖 (NOT to add)

다음은 *고려했고 의도적으로 빼기로 결정한* 것들. 추가하기 전에 결정사항을 다시 읽으세요.

- ❌ **이미지 로딩 상태 hook** (`usePreloadedImage`) — `react-image` / `use-image`와 중복
- ❌ **Suspense hook** (`usePreloadedImageSuspense`) — `react-image`가 그 자리
- ❌ **vanilla JS layer** (`preloader.ts`의 4가지 strategy) — React 외 환경 지원 안 함
- ❌ **Cache API / Fetch strategy** — 라이브러리 정체성과 무관
- ❌ **이미지 외 리소스 프리로드** (`font`, `script` 등) — 별도 라이브러리가 더 자연스러움
- ❌ **prefetch** (`<link rel="prefetch">`) — 의미가 다름 (다음 내비게이션용). 별도 모듈로 분리
- ❌ **자동 lazy loading** — `loading="lazy"` 속성으로 해결됨, 라이브러리 책임 아님
- ❌ **이미지 그룹 일괄 프리로드 API** — 호출자가 map으로 반복하면 충분

새 기능 요청이 들어오면, 위 목록과 비교해서 **기존 결정과 일관성**이 있는지부터 검토.

---

## 디렉토리 구조

```
.
├── src/
│   └── index.tsx          # 모든 export
├── examples/
│   └── examples.tsx       # 7가지 사용 패턴 (테스트 케이스 후보)
├── tests/
│   └── index.test.tsx     # TODO
├── README.md
├── CLAUDE.md              # 이 파일
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 개발 환경

- **Node**: 20+ (`react-dom@19`의 peer dependency)
- **Package manager**: pnpm 권장 (다른 매니저도 가능)
- **React**: 19+ (peerDependency)
- **TypeScript**: 5.x, strict mode

### `package.json` 초안

```jsonc
{
  "name": "react-preload-intent",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "node --test --experimental-test-module-mocks",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "knip": "knip"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^24.0.0",
    "knip": "^5.0.0",
    "@biomejs/biome": "^1.8.0"
  }
}
```

### Tooling 결정

- **빌드**: `tsup` — 단일 파일 라이브러리에 가장 단순. ESM only.
- **테스트**: `node:test` + `@testing-library/react` + `jsdom` — 별도 러너 도입 없이 Node 내장 사용
- **린트**: Biome — eslint + prettier 통합, 설정 단순
- **Dead code 감지**: `knip` — public API 외 export 누수 확인

---

## 코드 컨벤션

- 모든 export는 `src/index.tsx` 한 파일에서. 분리 금지 (결정 #6).
- Hook 옵션은 `optionsRef` 패턴으로 deps 안정화. effect는 의미 있는 의존성만 재실행.
- 강제 cleanup: `setTimeout` / `IntersectionObserver` 등 모든 리소스는 unmount에서 해제.
- 모든 트리거는 URL당 1회 dedup. (브라우저/React가 추가로 dedup 하지만 명시적으로도 처리)
- `fetchPriority` 디폴트는 항상 `"high"`. JS 주입의 브라우저 기본값(`"low"`) 보정 목적.
- JSDoc은 *왜* 인지 *어떻게* 보다 우선 기록.

---

## 테스트 전략

`examples/examples.tsx`의 7가지 패턴이 사실상 테스트 시나리오입니다. 각각을 단위 테스트로 변환:

1. **Manual** (`usePreloadCallback`)
   - 이벤트 핸들러에서 호출하면 `preload()`가 정확한 옵션으로 호출됨
   - 다중 호출 시 dedup (브라우저 책임이긴 하나 mock으로 검증)
2. **Intent** (`usePreloadIntent`)
   - hover → 50ms 후 트리거 (fake timers)
   - 50ms 내 mouseleave → 트리거 안 됨
   - 같은 URL 2번째 hover → 1회만 트리거
   - 언마운트 시 타이머 cleanup (메모리 누수 방지)
3. **Viewport** (`usePreloadViewport`)
   - IntersectionObserver 등록 / disconnect
   - intersecting=true → 트리거, intersecting=false → 트리거 안 됨
   - URL당 1회 트리거 후 observer disconnect
   - `threshold` 배열 변경 시 effect 재실행 (안정화 로직 검증)
4. **Render** (`usePreload`, `<Preload>`)
   - 렌더 시 1회 호출
   - `enabled: false` → 호출 안 됨, `true` 변경 → 호출됨
5. **공통**
   - `imageSrcSet` / `imageSizes` 등 native 옵션이 `preload()`에 그대로 전달됨

**Mock 전략**: `react-dom`의 `preload` export를 mock해서 호출 인자 검증.

---

## 빌드 / 배포

### `tsup.config.ts` 초안

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom"],
});
```

### Publish 체크리스트

- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과
- [ ] `npm run knip` — 죽은 export 없음
- [ ] `npm run build` → `dist/` 생성 확인
- [ ] `dist/index.d.ts`에서 타입 export 누락 없는지 확인
- [ ] `npm pack --dry-run` → 패키지 사이즈 확인 (예상: < 5KB gzip)
- [ ] README의 모든 예시 코드가 실제 API와 일치

---

## 로드맵 / Open Questions

### v0.1.0 (최소 출시)
- [ ] `package.json` / `tsconfig.json` / `tsup.config.ts` 셋업
- [ ] 테스트 작성 (위 7가지 시나리오)
- [ ] CI 셋업 (typecheck + test + build)
- [ ] README 예시 코드를 실제로 동작하는 예제로 검증

### v0.2.0 후보
- [ ] Suspense + streaming 함정을 lint rule로 잡을 수 있을까? (eslint plugin)
- [ ] `usePreloadIntent`에서 native PointerEvent 활용 검토 (`onPointerEnter`)
- [ ] `<Preload trigger="intent">` 같은 통합 컴포넌트 — 필요성 있을지 사용자 피드백 후 결정

### 평가 보류
- 멀티 이미지 일괄 프리로드 (스코프 외로 결정했으나, 요청이 많으면 재고)
- 우선순위 조정 API (`fetchPriority`를 동적으로 변경하는 hook) — 유스 케이스 불분명

---

## Credits & References

- 출발점: [Alex MacArthur — Your options for preloading images with JavaScript](https://macarthur.me/posts/preloading-images)
- 트리거 taxonomy: [TanStack Router preloading](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)
- Suspense 함정 분석: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/)
- React 공식 문서: [react-dom/preload](https://react.dev/reference/react-dom/preload)
- 참고 라이브러리 (포지셔닝 비교용): [react-image](https://github.com/mbrevda/react-image), [use-image](https://github.com/konvajs/use-image)
