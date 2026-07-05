import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import {
  ArticleCard,
  CommentBox,
  GalleryItem,
  ProductPage,
  ProductThumbnail,
  ResponsiveHero,
} from './examples'
import {
  PreloadMonitorPanel,
  PreloadMonitorProvider,
  useHasPreloaded,
} from './PreloadMonitor'

const HERO_INTENT = 'https://picsum.photos/seed/hero-intent/1200/600'
const THUMB = 'https://picsum.photos/seed/thumb/240/240'
const FULL_VIEWPORT = 'https://picsum.photos/seed/viewport/1600/900'
const FULL_COND = 'https://picsum.photos/seed/conditional/1600/900'

// 아래 두 예시(ProductPage / ResponsiveHero)는 examples.tsx 안에서 URL을 하드코딩한다.
// 데모에서 배지가 매칭할 수 있도록 그 값을 그대로 참조.
const PRODUCT_HERO = '/api/products/demo/hero.jpg'
const RESPONSIVE_HERO = '/hero-large.jpg'

const fakeUpload = async (file: File): Promise<string> =>
  URL.createObjectURL(file)

/** 섹션 헤더의 라이브 배지 — 해당 URL이 head에 preload되면 초록불 + 시각(ms). */
function StatusBadge({ url }: { url: string }): React.ReactNode {
  const entry = useHasPreloaded(url)
  const done = Boolean(entry)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 12,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        verticalAlign: 'middle',
        background: done ? '#dcfce7' : '#f1f5f9',
        color: done ? '#166534' : '#64748b',
        border: `1px solid ${done ? '#86efac' : '#e2e8f0'}`,
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: done ? '#22c55e' : '#cbd5e1',
        }}
      />
      {done ? `preload됨 · ${entry?.at}ms` : '대기 중'}
    </span>
  )
}

function Section({
  title,
  hint,
  watchUrl,
  children,
}: {
  title: string
  hint: string
  watchUrl?: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <section
      style={{
        marginBlock: 24,
        padding: 20,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 8,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {title}
        {watchUrl ? <StatusBadge url={watchUrl} /> : null}
      </h2>
      <p style={{ color: '#64748b', fontSize: 14, marginTop: 0 }}>{hint}</p>
      <div
        style={{
          padding: 16,
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #f1f5f9',
        }}
      >
        {children}
      </div>
    </section>
  )
}

function App(): React.ReactNode {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '24px 24px 40vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1.5,
        color: '#0f172a',
      }}
    >
      <h1 style={{ marginBottom: 4 }}>react-preload-intent</h1>
      <p style={{ marginTop: 0, color: '#475569' }}>
        4가지 트리거(render / intent / viewport / manual)를 발동시키면, 각
        섹션의 <strong>배지가 초록색</strong>으로 바뀌고 우하단{' '}
        <strong>monitor 패널</strong>에 head로 주입된{' '}
        <code>&lt;link rel="preload"&gt;</code>가 실시간으로 쌓입니다. 이게
        라이브러리의 실제 결과물 — DevTools 없이 페이지에서 바로 확인.
      </p>
      <p
        style={{
          fontSize: 13,
          color: '#64748b',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        더 자세히 보려면 DevTools <strong>Network</strong> 탭도 함께: Initiator
        컬럼이 <code>Preload</code>면 정상. (일부 섹션은 placeholder 경로라 요청
        자체는 404 — 핵심은 head에 <code>link</code>가 주입됐다는 것.)
      </p>

      <Section
        title="1. Render — <ProductPage>"
        hint="마운트 즉시 preload 주입. 페이지 로드 시점(≈0ms)에 배지가 이미 초록불. src는 placeholder 경로라 이미지는 404지만, link 주입은 monitor에서 확인 가능."
        watchUrl={PRODUCT_HERO}
      >
        <ProductPage productId="demo" />
        <code style={{ fontSize: 12, color: '#64748b' }}>
          &lt;Preload href="{PRODUCT_HERO}" fetchPriority="high" /&gt;
        </code>
      </Section>

      <Section
        title="2. Render + srcset — <ResponsiveHero>"
        hint="imageSrcSet/imageSizes로 viewport에 맞는 variant만 preload. monitor에 'srcset →' 표시로 나타남."
        watchUrl={RESPONSIVE_HERO}
      >
        <ResponsiveHero />
        <code style={{ fontSize: 12, color: '#64748b' }}>
          imageSrcSet="…480w, …800w, …1200w"
        </code>
      </Section>

      <Section
        title="3. Intent — <ArticleCard>"
        hint="아래 링크에 50ms 이상 hover(또는 focus) → preload. 빠르게 떼면 트리거되지 않음. 발동되면 배지가 초록불로 바뀜."
        watchUrl={HERO_INTENT}
      >
        <ArticleCard
          href="#"
          heroImageUrl={HERO_INTENT}
          title="👉 여기에 hover 하세요 (50ms+)"
        />
      </Section>

      <Section
        title="4. 응용 — <ProductThumbnail> (조건부)"
        hint="thumbnail에 hover 또는 클릭 시점에만 풀 사이즈 preload. 클릭하면 풀 사이즈가 (preload 덕에) 즉시 표시됨."
        watchUrl={FULL_COND}
      >
        <ProductThumbnail thumbnailUrl={THUMB} fullSizeUrl={FULL_COND} />
      </Section>

      <Section
        title="5. Manual — <CommentBox>"
        hint="textarea에 이미지 클립보드 붙여넣기 → object URL을 preload + 표시. (로컬 URL이라 네트워크 요청은 없지만 link rel=preload는 head에 주입됨.)"
      >
        <CommentBox uploadImage={fakeUpload} />
        <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
          이미지를 복사해서 위 입력창에 붙여넣기(Ctrl/Cmd+V) 하면 monitor에
          object URL preload가 추가됩니다.
        </p>
      </Section>

      <div
        style={{
          height: '90vh',
          color: '#94a3b8',
          textAlign: 'center',
          paddingTop: 60,
          fontSize: 14,
        }}
      >
        ↓ viewport 트리거 데모를 보려면 스크롤 ↓
        <br />
        (스크롤하면서 우하단 monitor에 갤러리 이미지가 미리 preload되는 걸
        확인하세요)
      </div>

      <Section
        title="6. Viewport — <GalleryItem>"
        hint="이 섹션이 viewport 200px 이내로 진입하면 풀 사이즈를 미리 preload. 스크롤로 다가오는 순간 monitor에 항목이 추가됨."
        watchUrl={FULL_VIEWPORT}
      >
        <GalleryItem thumbnailUrl={THUMB} fullSizeUrl={FULL_VIEWPORT} />
        <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
          위 thumbnail이 화면에 들어오기 <em>전에</em> 풀 사이즈가 이미
          preload됨.
        </p>
      </Section>
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')
createRoot(root).render(
  <StrictMode>
    <PreloadMonitorProvider>
      <App />
      <PreloadMonitorPanel />
    </PreloadMonitorProvider>
  </StrictMode>,
)
