import { useCallback, useEffect, useRef } from 'react'

/**
 * Auto-scrolls a chat transcript while content grows.
 * Stops if the user scrolls manually; call `pinToBottom()` on each new send
 * to re-enable auto-scroll for that reply.
 */
export function useChatAutoScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const programmaticRef = useRef(false)

  const pinToBottom = useCallback(() => {
    stickToBottomRef.current = true
  }, [])

  const handleScroll = useCallback(() => {
    if (programmaticRef.current) return
    // Any user-driven scroll pauses auto-follow until the next send.
    stickToBottomRef.current = false
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return

    const el = containerRef.current
    programmaticRef.current = true

    if (el) {
      el.scrollTop = el.scrollHeight
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        programmaticRef.current = false
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes explicit scroll deps
  }, deps)

  return { containerRef, bottomRef, handleScroll, pinToBottom }
}
