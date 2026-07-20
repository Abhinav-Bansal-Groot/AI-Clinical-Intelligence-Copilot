import { Search } from 'lucide-react'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  dark?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search patients…',
  className = '',
  dark = false,
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
          dark ? 'text-slate-400' : 'text-slate-400'
        }`}
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={
          dark
            ? 'w-full rounded-xl border border-slate-600 bg-slate-900/40 py-2.5 pr-3.5 pl-9 text-sm text-white placeholder:text-slate-400 outline-none ring-teal-400/20 transition focus:border-teal-400 focus:ring-4'
            : 'w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-9 text-sm text-slate-800 placeholder:text-slate-400 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4'
        }
      />
    </div>
  )
}
