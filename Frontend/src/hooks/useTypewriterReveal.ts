import { useCallback, useEffect, useRef } from 'react'

type ContentUpdater = (messageId: string, visibleText: string) => void

type TypewriterControls = {
  /** Begin revealing into the given assistant message id. */
  start: (messageId: string, onUpdate: ContentUpdater) => void
  /** Append newly streamed tokens to the reveal buffer. */
  push: (token: string) => void
  /** Mark the network stream finished and wait until the UI has caught up. */
  finish: () => Promise<void>
  /** Cancel any in-flight reveal (abort / unmount). */
  reset: () => void
}

/**
 * Smooth high-speed typewriter reveal for streamed chat tokens.
 * Tokens can arrive in bursts; the UI paints them steadily like ChatGPT.
 */
export function useTypewriterReveal(charsPerFrame = 10): TypewriterControls {
  const targetRef = useRef('')
  const visibleRef = useRef('')
  const messageIdRef = useRef<string | null>(null)
  const onUpdateRef = useRef<ContentUpdater | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamDoneRef = useRef(false)
  const finishResolveRef = useRef<(() => void) | null>(null)
  const charsPerFrameRef = useRef(charsPerFrame)
  charsPerFrameRef.current = charsPerFrame

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const resolveFinish = useCallback(() => {
    const resolve = finishResolveRef.current
    finishResolveRef.current = null
    resolve?.()
  }, [])

  const tick = useCallback(() => {
    rafRef.current = null
    const messageId = messageIdRef.current
    const onUpdate = onUpdateRef.current
    if (!messageId || !onUpdate) {
      resolveFinish()
      return
    }

    const target = targetRef.current
    let visible = visibleRef.current

    if (visible.length < target.length) {
      const nextLen = Math.min(
        target.length,
        visible.length + Math.max(1, charsPerFrameRef.current),
      )
      visible = target.slice(0, nextLen)
      visibleRef.current = visible
      onUpdate(messageId, visible)
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    if (streamDoneRef.current) {
      resolveFinish()
      return
    }

    // Stream still open but buffer caught up — wait for more tokens.
    rafRef.current = requestAnimationFrame(tick)
  }, [resolveFinish])

  const ensureTicking = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  const reset = useCallback(() => {
    stopRaf()
    targetRef.current = ''
    visibleRef.current = ''
    messageIdRef.current = null
    onUpdateRef.current = null
    streamDoneRef.current = false
    resolveFinish()
  }, [resolveFinish, stopRaf])

  const start = useCallback(
    (messageId: string, onUpdate: ContentUpdater) => {
      stopRaf()
      resolveFinish()
      messageIdRef.current = messageId
      onUpdateRef.current = onUpdate
      targetRef.current = ''
      visibleRef.current = ''
      streamDoneRef.current = false
      ensureTicking()
    },
    [ensureTicking, resolveFinish, stopRaf],
  )

  const push = useCallback(
    (token: string) => {
      if (!token || !messageIdRef.current) return
      targetRef.current += token
      ensureTicking()
    },
    [ensureTicking],
  )

  const finish = useCallback(() => {
    streamDoneRef.current = true
    ensureTicking()

    if (visibleRef.current.length >= targetRef.current.length) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      finishResolveRef.current = resolve
    })
  }, [ensureTicking])

  useEffect(() => () => reset(), [reset])

  return { start, push, finish, reset }
}
