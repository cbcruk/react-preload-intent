import { act, cleanup, render, renderHook } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test'

import {
  Preload,
  usePreload,
  usePreloadCallback,
  usePreloadIntent,
  usePreloadViewport,
} from '../src/index'
import { MockIntersectionObserver } from './setup'

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom')
  return {
    ...actual,
    preload: vi.fn(),
    default: (actual as unknown as { default: unknown }).default,
  }
})

const { preload: preloadSpy } = (await import('react-dom')) as unknown as {
  preload: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  preloadSpy.mockClear()
  MockIntersectionObserver.instances = []
})

afterEach(() => {
  cleanup()
})

describe('usePreloadCallback (manual trigger)', () => {
  test('returns a stable callback across renders', () => {
    const { result, rerender } = renderHook(() => usePreloadCallback())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  test('calls react-dom preload() with as=image and fetchPriority=high by default', () => {
    const { result } = renderHook(() => usePreloadCallback())
    act(() => {
      result.current('/foo.jpg')
    })

    expect(preloadSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = preloadSpy.mock.calls[0]!
    expect(url).toBe('/foo.jpg')
    expect(opts.as).toBe('image')
    expect(opts.fetchPriority).toBe('high')
  })

  test('passes user-provided options through', () => {
    const { result } = renderHook(() => usePreloadCallback())
    act(() => {
      result.current('/foo.jpg', {
        fetchPriority: 'low',
        crossOrigin: 'anonymous',
        referrerPolicy: 'no-referrer',
      })
    })

    const [, opts] = preloadSpy.mock.calls[0]!
    expect(opts.fetchPriority).toBe('low')
    expect(opts.crossOrigin).toBe('anonymous')
    expect(opts.referrerPolicy).toBe('no-referrer')
  })
})

describe('usePreload / <Preload> (render trigger)', () => {
  test('usePreload calls preload on render', () => {
    renderHook(() => usePreload('/hero.jpg'))
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    expect(preloadSpy.mock.calls[0]![0]).toBe('/hero.jpg')
  })

  test('usePreload skips when enabled=false', () => {
    renderHook(() => usePreload('/hero.jpg', { enabled: false }))
    expect(preloadSpy).not.toHaveBeenCalled()
  })

  test('usePreload fires when enabled flips from false to true', () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePreload('/hero.jpg', { enabled }),
      { initialProps: { enabled: false } },
    )
    expect(preloadSpy).not.toHaveBeenCalled()
    rerender({ enabled: true })
    expect(preloadSpy).toHaveBeenCalledTimes(1)
  })

  test('usePreload skips when url is nullish', () => {
    renderHook(() => usePreload(null))
    renderHook(() => usePreload(undefined))
    expect(preloadSpy).not.toHaveBeenCalled()
  })

  test('<Preload> renders null and triggers preload', () => {
    const { container } = render(<Preload href="/hero.jpg" />)
    expect(container.innerHTML).toBe('')
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    expect(preloadSpy.mock.calls[0]![0]).toBe('/hero.jpg')
  })
})

describe('usePreloadIntent (hover / touch / focus trigger)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('triggers preload 50ms after onMouseEnter', () => {
    const { result } = renderHook(() => usePreloadIntent('/hero.jpg'))
    act(() => {
      result.current.onMouseEnter()
    })
    expect(preloadSpy).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    expect(preloadSpy.mock.calls[0]![0]).toBe('/hero.jpg')
  })

  test('cancels pending preload on onMouseLeave within delay window', () => {
    const { result } = renderHook(() => usePreloadIntent('/hero.jpg'))
    act(() => {
      result.current.onMouseEnter()
    })
    act(() => {
      result.current.onMouseLeave()
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(preloadSpy).not.toHaveBeenCalled()
  })

  test('dedupes — same url only triggers once across multiple hovers', () => {
    const { result } = renderHook(() => usePreloadIntent('/hero.jpg'))
    act(() => {
      result.current.onMouseEnter()
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    act(() => {
      result.current.onMouseLeave()
    })
    act(() => {
      result.current.onMouseEnter()
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(1)
  })

  test('respects custom delay option', () => {
    const { result } = renderHook(() =>
      usePreloadIntent('/hero.jpg', { delay: 200 }),
    )
    act(() => {
      result.current.onMouseEnter()
    })
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(preloadSpy).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(1)
  })

  test('onTouchStart and onFocus also trigger after delay', () => {
    const touch = renderHook(() => usePreloadIntent('/a.jpg'))
    act(() => {
      touch.result.current.onTouchStart()
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(1)

    const focus = renderHook(() => usePreloadIntent('/b.jpg'))
    act(() => {
      focus.result.current.onFocus()
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(2)
  })

  test('unmount clears pending timer (no leak, no late call)', () => {
    const { result, unmount } = renderHook(() => usePreloadIntent('/x.jpg'))
    act(() => {
      result.current.onMouseEnter()
    })
    unmount()
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(preloadSpy).not.toHaveBeenCalled()
  })
})

describe('usePreloadViewport (IntersectionObserver trigger)', () => {
  test('registers an IntersectionObserver with default rootMargin=200px', () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>('/hero.jpg')
      return <div ref={ref} />
    }
    render(<Box />)
    expect(MockIntersectionObserver.instances.length).toBe(1)
    expect(MockIntersectionObserver.instances[0]!.rootMargin).toBe('200px')
  })

  test('triggers preload when entry becomes intersecting', () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>('/hero.jpg')
      return <div ref={ref} />
    }
    render(<Box />)
    expect(preloadSpy).not.toHaveBeenCalled()
    act(() => {
      MockIntersectionObserver.instances[0]!.trigger(true)
    })
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    expect(preloadSpy.mock.calls[0]![0]).toBe('/hero.jpg')
  })

  test('does not trigger when not intersecting', () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>('/hero.jpg')
      return <div ref={ref} />
    }
    render(<Box />)
    act(() => {
      MockIntersectionObserver.instances[0]!.trigger(false)
    })
    expect(preloadSpy).not.toHaveBeenCalled()
  })

  test('disconnects observer after first intersecting trigger (dedup)', () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>('/hero.jpg')
      return <div ref={ref} />
    }
    render(<Box />)
    const observer = MockIntersectionObserver.instances[0]!
    act(() => {
      observer.trigger(true)
    })
    expect(observer.disconnected).toBe(true)
  })

  test('threshold array does not re-create observer on each render (deps stability)', () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>('/hero.jpg', {
        threshold: [0, 0.5, 1],
      })
      return <div ref={ref} />
    }
    const { rerender } = render(<Box />)
    rerender(<Box />)
    rerender(<Box />)
    expect(MockIntersectionObserver.instances.length).toBe(1)
  })
})

describe('native preload options forwarded to react-dom', () => {
  test('imageSrcSet, imageSizes, crossOrigin, referrerPolicy reach preload()', () => {
    render(
      <Preload
        href="/hero.jpg"
        imageSrcSet="/s.jpg 1x, /l.jpg 2x"
        imageSizes="100vw"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />,
    )
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = preloadSpy.mock.calls[0]!
    expect(url).toBe('/hero.jpg')
    expect(opts.as).toBe('image')
    expect(opts.imageSrcSet).toBe('/s.jpg 1x, /l.jpg 2x')
    expect(opts.imageSizes).toBe('100vw')
    expect(opts.crossOrigin).toBe('anonymous')
    expect(opts.referrerPolicy).toBe('no-referrer')
  })
})
