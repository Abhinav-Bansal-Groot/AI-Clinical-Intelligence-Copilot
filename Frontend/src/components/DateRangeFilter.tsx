import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Filter } from 'lucide-react'

export type DateRangePreset =
  | 'last_7'
  | 'last_15'
  | 'last_30'
  | 'last_60'
  | 'all'

export type DateRangeValue = {
  preset: DateRangePreset
  startDate: string | null
  endDate: string | null
}

const PRESET_OPTIONS: { id: DateRangePreset; label: string; days?: number }[] = [
  { id: 'all', label: 'All time' },
  { id: 'last_7', label: 'Last week', days: 7 },
  { id: 'last_15', label: 'Last 15 days', days: 15 },
  { id: 'last_30', label: 'Last 30 days', days: 30 },
  { id: 'last_60', label: 'Last 60 days', days: 60 },
]

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

export function createPresetRange(preset: DateRangePreset): DateRangeValue {
  if (preset === 'all') {
    return { preset, startDate: null, endDate: null }
  }

  const option = PRESET_OPTIONS.find((item) => item.id === preset)
  const days = option?.days ?? 30
  const end = new Date()
  const start = addDays(end, -(days - 1))
  return {
    preset,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  }
}

export function formatRangeLabel(range: DateRangeValue) {
  return PRESET_OPTIONS.find((item) => item.id === range.preset)?.label ?? 'Date range'
}

type DateRangeFilterProps = {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const label = useMemo(() => formatRangeLabel(value), [value])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-slate-600 bg-slate-700/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-slate-600"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Filter className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-800 shadow-lg">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(createPresetRange(option.id))
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50"
            >
              <span>{option.label}</span>
              {value.preset === option.id ? (
                <Check className="h-4 w-4 text-teal-600" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
