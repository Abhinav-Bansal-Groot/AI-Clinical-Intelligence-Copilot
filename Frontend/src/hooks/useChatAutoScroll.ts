import { useCallback, useEffect, useRef } from 'react'

const IGNORE_SCROLL_MS = 120
const AWAY_FROM_BOTTOM_PX = 64

/**
 * Auto-scrolls a chat transcript while content grows.
 * Stops when the user scrolls manually (wheel, touch, or scrollbar).
 * Call `pinToBottom()` on each new send to re-enable auto-scroll.
 */
export function useChatAutoScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const ignoreScrollUntilRef = useRef(0)

  const pinToBottom = useCallback(() => {
    stickToBottomRef.current = true
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
      return
    }

    // Ignore scroll events caused by this programmatic update.
    ignoreScrollUntilRef.current = performance.now() + IGNORE_SCROLL_MS
    el.scrollTop = el.scrollHeight
  }, [])

  /** Wheel / touch = clear user intent to leave auto-follow. */
  const handleUserScrollIntent = useCallback(() => {
    stickToBottomRef.current = false
  }, [])

  /**
   * Scrollbar dragging also fires scroll without wheel.
   * Only treat it as manual when the user has moved clearly away from the bottom.
   */
  const handleScroll = useCallback(() => {
    if (performance.now() < ignoreScrollUntilRef.current) return

    const el = containerRef.current
    if (!el) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom > AWAY_FROM_BOTTOM_PX) {
      stickToBottomRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return

    // Wait a frame so DOM/layout from the latest message paint is ready.
    const frame = requestAnimationFrame(() => {
      scrollToBottom()
    })

    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes explicit scroll deps
  }, deps)

  return {
    containerRef,
    bottomRef,
    handleScroll,
    handleUserScrollIntent,
    pinToBottom,
  }
}
