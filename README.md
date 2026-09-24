# react-preload-intent

> React 19의 `react-dom/preload()`를 트리거 단위로 노출하는 hooks.

**아직 렌더되지 않은 이미지**를 hover, viewport 진입, 이벤트 같은 트리거 시점에 미리 받아 둡니다. 다음 화면에 쓸 이미지가 필요해지기 전에 캐시에 올려 두는 용도입니다. 트리거 명명은 [TanStack Router](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)에서 차용.

## React가 이미 해주는 것

SSR에서 React는 렌더되는 `<img>`에 대해 [preload hint를 자동 생성](https://react.dev/reference/react-dom/components/img#controlling-image-preloading-during-server-rendering)합니다. 이미 렌더하는 `<img>`에 `usePreload`를 덧붙일 필요는 없습니다.

```tsx
// SSR: React가 <link rel="preload" as="image" href="/hero.jpg">를 자동 생성
<img src="/hero.jpg" alt="" />
```

이 라이브러리가 필요한 경우:

- **아직 렌더되지 않은 이미지**: 다음 화면, 모달, hover 대상 → intent / viewport / manual 트리거
- **React가 자동 preload하지 않는 `<img>`**: `<picture>` / `<noscript>` 안의 이미지 → [Modern formats](#modern-formats-picture) 참조
- **CSR 전용 앱**: 자동 hint는 서버 렌더링에서만 생성됨
- **`loading="lazy"` / `fetchPriority="low"`인데 특정 시점에는 받아 두고 싶은 이미지**: 이 두 속성이 붙으면 React가 hint를 생성하지 않음

## Install

```sh
pnpm add react-preload-intent
```

Requires React 19+ (`react-dom/preload` 사용).

## Demo

[**cbcruk.github.io/react-preload-intent**](https://cbcruk.github.io/react-preload-intent/) — 또는 로컬에서:

```sh
pnpm install
pnpm demo
```

4가지 트리거를 인터랙티브하게 발동시켜 볼 수 있는 데모. 우하단 **`<head>` preload
monitor** 패널이 `ReactDOM.preload()`로 주입되는 `<link rel="preload">`를 실시간으로
보여주고, 각 섹션 배지가 해당 이미지의 preload 시점(ms)을 표시 — DevTools 없이 결과물을
바로 확인할 수 있습니다. (`examples/`)

## Triggers

| Trigger      | Hook                      | When                       |
| ------------ | ------------------------- | -------------------------- |
| **render**   | `usePreload`, `<Preload>` | 컴포넌트 렌더 중           |
| **intent**   | `usePreloadIntent`        | hover / touchstart / focus |
| **viewport** | `usePreloadViewport`      | IntersectionObserver       |
| **manual**   | `usePreloadCallback`      | 이벤트 핸들러에서 직접     |

## Usage

### Render

```tsx
import { Preload, usePreload } from 'react-preload-intent'

function ProductPage() {
  usePreload('/hero.jpg')
  // 또는: <Preload href="/hero.jpg" />
  // 또는: usePreload(url, { enabled: modalOpen })
}
```

### Intent — hover / touch / focus

```tsx
import { usePreloadIntent } from 'react-preload-intent'

function ArticleCard({ href, heroUrl }) {
  const intent = usePreloadIntent(heroUrl)
  return (
    <a href={href} {...intent}>
      ...
    </a>
  )
}
```

TanStack Router와 동일하게 50ms 지연이 디폴트(실수 hover 필터). 마우스가 떠나면 취소.

### Intent + `<ViewTransition>`

React는 `<ViewTransition>` 안에서 transition으로 새 `<img>`를 렌더할 때 [이미지 로드/디코드를 기다린 뒤](https://react.dev/reference/react-dom/components/img#waiting-for-an-image-during-a-view-transition) 애니메이션을 시작합니다(React 19.3+). hover 시점에 미리 받아 두면 클릭 후 대기가 거의 사라집니다:

```tsx
import { startTransition, useState, ViewTransition } from 'react'
import { usePreloadIntent } from 'react-preload-intent'

function Reveal({ imageUrl }) {
  const [shown, setShown] = useState(false)
  const intent = usePreloadIntent(imageUrl)
  return (
    <>
      <button {...intent} onClick={() => startTransition(() => setShown(true))}>
        Show
      </button>
      {shown && (
        <ViewTransition>
          <img src={imageUrl} alt="" />
        </ViewTransition>
      )}
    </>
  )
}
```

- 이미지가 느리면 React는 타임아웃 후 기다리지 않고 진행합니다. 미리 받아 두면 이미지 없이 전환되는 경우도 줄어듭니다.
- `<img>`에 `onLoad`를 넘기거나 `loading="lazy"`를 쓰면 React가 기다리지 않습니다.

### Viewport — IntersectionObserver

```tsx
import { usePreloadViewport } from 'react-preload-intent'

function GalleryItem({ thumbUrl, fullUrl }) {
  const ref = usePreloadViewport<HTMLDivElement>(fullUrl, {
    rootMargin: '200px',
  })
  return (
    <div ref={ref}>
      <img src={thumbUrl} />
    </div>
  )
}
```

### Manual — 이벤트 핸들러

```tsx
import { usePreloadCallback } from 'react-preload-intent'

function CommentBox() {
  const preload = usePreloadCallback()
  const onPaste = async (e) => {
    const url = await uploadImage(e.clipboardData.files[0])
    preload(url) // submit 시 <img />가 즉시 표시됨
  }
  return <textarea onPaste={onPaste} />
}
```

### Responsive images

`imageSrcSet` / `imageSizes`로 srcset variant 중 *정확히 사용될 것*만 프리로드:

```tsx
<Preload
  href="/hero-large.jpg"
  imageSrcSet="/hero-small.jpg 480w, /hero-large.jpg 1200w"
  imageSizes="(max-width: 600px) 480px, 1200px"
/>
```

### Modern formats (`<picture>`)

React는 `<picture>` 안의 `<img>`를 자동 preload하지 않습니다. `type`을 지정하면 브라우저가 지원하지 않는 포맷의 다운로드를 건너뜁니다:

```tsx
<Preload href="/hero.avif" type="image/avif" />

<picture>
  <source srcSet="/hero.avif" type="image/avif" />
  <img src="/hero.jpg" alt="" />
</picture>
```

AVIF 미지원 브라우저는 preload를 무시하고 `<img>`의 JPEG를 받습니다. 이 경우 fallback인 JPEG는 preload 효과를 보지 못합니다.

## ⚠️ Suspense + streaming 함정

Suspense boundary **안에서** `await` 후 `<Preload>` / `usePreload`를 호출하면, 생성된 `<link>`가 HTML stream 끝에 붙어 무의미해집니다. boundary **밖, await 이전**에 호출하세요.

자세한 설명: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/).

## Scope

이미지 **로딩 상태**(`loading | loaded | error`) 추적이나 Suspense 페인팅 제어는 다루지 않습니다. 그쪽은 [`react-image`](https://github.com/mbrevda/react-image) 또는 [`use-image`](https://github.com/konvajs/use-image)와 함께 쓰세요 — 책임이 겹치지 않습니다.

## Credits

- Trigger taxonomy: [TanStack Router preloading](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)
- Origin: [Alex MacArthur — Your options for preloading images with JavaScript](https://macarthur.me/posts/preloading-images)
