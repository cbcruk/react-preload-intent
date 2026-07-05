/**
 * 데모 전용 — 라이브러리가 실제로 하는 일(head에 `<link rel="preload">` 주입)을 눈으로 볼 수 있게
 * `document.head`를 MutationObserver로 관찰해서 화면에 실시간 표시.
 *
 * 라이브러리 코드에는 포함되지 않음 (examples 폴더는 배포 대상 아님).
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export interface PreloadEntry {
  /** dedup 키 겸 React key — href + imageSrcSet 조합이라 항목당 유일 */
  key: string
  href: string
  as: string | null
  fetchPriority: string | null
  imageSrcSet: string | null
  imageSizes: string | null
  /** 페이지 네비게이션 시작 이후 경과 ms */
  at: number
}

interface PreloadLog {
  entries: PreloadEntry[]
  clear: () => void
}

const PreloadLogContext = createContext<PreloadLog | null>(null)

function readLink(link: HTMLLinkElement): PreloadEntry {
  const href = link.getAttribute('href') ?? ''
  const imageSrcSet = link.getAttribute('imagesrcset')
  return {
    key: `${href}|${imageSrcSet ?? ''}`,
    href,
    as: link.getAttribute('as'),
    fetchPriority: link.getAttribute('fetchpriority'),
    imageSrcSet,
    imageSizes: link.getAttribute('imagesizes'),
    at: Math.round(performance.now()),
  }
}

function isPreloadLink(node: Node): node is HTMLLinkElement {
  return (
    node instanceof HTMLLinkElement &&
    node.rel === 'preload' &&
    node.getAttribute('as') === 'image'
  )
}

/**
 * head의 preload link를 관찰해서 자식 컴포넌트에 공급. 마운트 시점에 이미 존재하는 link(=render 트리거로 이미
 * 주입된 것)도 포함하고, 이후 주입되는 link는 MutationObserver로 잡는다.
 */
export function PreloadMonitorProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const [entries, setEntries] = useState<PreloadEntry[]>([])
  // ref로 유지해야 StrictMode의 effect 재실행 시 이미 본 link를 다시 추가하지 않음
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const seen = seenRef.current

    const push = (link: HTMLLinkElement) => {
      const entry = readLink(link)
      if (seen.has(entry.key)) return
      seen.add(entry.key)
      setEntries((prev) => [entry, ...prev])
    }

    // 이미 head에 들어와 있는 preload link (render 트리거 등)
    for (const link of document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="preload"][as="image"]',
    )) {
      push(link)
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (isPreloadLink(node)) push(node)
        }
      }
    })
    observer.observe(document.head, { childList: true })
    return () => observer.disconnect()
  }, [])

  const value = useMemo<PreloadLog>(
    () => ({ entries, clear: () => setEntries([]) }),
    [entries],
  )

  return (
    <PreloadLogContext.Provider value={value}>
      {children}
    </PreloadLogContext.Provider>
  )
}

function usePreloadLog(): PreloadLog {
  const ctx = useContext(PreloadLogContext)
  if (!ctx) {
    throw new Error(
      'usePreloadLog must be used within <PreloadMonitorProvider>',
    )
  }
  return ctx
}

/**
 * 특정 URL이 preload 됐는지 + 언제(ms) 됐는지. 섹션별 라이브 배지에 사용.
 *
 * imageSrcSet 기반 preload는 href 없이 imagesrcset만 주입되므로 srcset 문자열도 함께 매칭.
 */
export function useHasPreloaded(url: string): PreloadEntry | undefined {
  const { entries } = usePreloadLog()
  return entries.find(
    (e) => e.href === url || (e.imageSrcSet?.includes(url) ?? false),
  )
}

function fmtUrl(url: string): string {
  try {
    const u = new URL(url, window.location.href)
    const tail = u.pathname.split('/').filter(Boolean).slice(-2).join('/')
    return (u.hostname ? `${u.hostname}/…/` : '') + (tail || u.pathname)
  } catch {
    return url
  }
}

/** imageSrcSet 문자열에서 가장 큰(마지막) candidate URL만 뽑아 표시용으로 축약. */
function displayLabel(entry: PreloadEntry): string {
  if (!entry.imageSrcSet) return fmtUrl(entry.href)
  const candidates = entry.imageSrcSet.split(',')
  const last = candidates[candidates.length - 1]?.trim().split(/\s+/)[0] ?? ''
  return `srcset → ${fmtUrl(last)}`
}

const priorityColor: Record<string, string> = {
  high: '#c2410c',
  low: '#0369a1',
  auto: '#6b7280',
}

/**
 * 화면 우하단 고정 패널. head에 preload link가 주입될 때마다 최신순으로 쌓인다. 데모에서 각 트리거를 발동시키면 여기에
 * 실시간으로 항목이 추가되는 걸 볼 수 있다.
 */
export function PreloadMonitorPanel(): React.ReactNode {
  const { entries, clear } = usePreloadLog()

  return (
    <aside
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 320,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        overflow: 'hidden',
        zIndex: 1000,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
        }}
      >
        <strong style={{ fontSize: 12, letterSpacing: 0.3 }}>
          🛰️ &lt;head&gt; preload monitor
        </strong>
        <span
          style={{
            background: entries.length ? '#16a34a' : '#475569',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {entries.length}
        </span>
      </header>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {entries.length === 0 ? (
          <p style={{ padding: 16, margin: 0, color: '#94a3b8' }}>
            아직 preload 없음. 아래 트리거를 발동시켜 보세요 — head에{' '}
            <code>&lt;link rel="preload"&gt;</code>가 주입되면 여기 실시간으로
            나타납니다.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((e) => (
              <li
                key={e.key}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: '#38bdf8',
                      wordBreak: 'break-all',
                    }}
                    title={e.imageSrcSet || e.href}
                  >
                    {displayLabel(e)}
                  </span>
                  <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                    {e.at}ms
                  </span>
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                  <Chip label={`as=${e.as}`} color="#475569" />
                  {e.fetchPriority && (
                    <Chip
                      label={`priority=${e.fetchPriority}`}
                      color={priorityColor[e.fetchPriority] ?? '#475569'}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <button
          type="button"
          onClick={clear}
          style={{
            border: 'none',
            borderTop: '1px solid #334155',
            background: '#1e293b',
            color: '#e2e8f0',
            padding: '8px 12px',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          지우기 (log 비우기 — head의 link는 유지됨)
        </button>
      )}
    </aside>
  )
}

function Chip({
  label,
  color,
}: {
  label: string
  color: string
}): React.ReactNode {
  return (
    <span
      style={{
        background: color,
        color: '#fff',
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}
