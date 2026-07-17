type MarkdownTextProps = {
  content: string
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={`${keyPrefix}-t-${index}`}>{part}</span>
  })
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const lines = content.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)

        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          const sizeClass =
            level <= 2
              ? 'text-base font-semibold mt-2 mb-1'
              : level === 3
                ? 'text-sm font-semibold mt-2 mb-0.5'
                : 'text-sm font-semibold mt-1.5 mb-0.5'

          return (
            <p key={`h-${index}`} className={sizeClass}>
              {renderInline(text, `h-${index}`)}
            </p>
          )
        }

        if (!line.trim()) {
          return <div key={`sp-${index}`} className="h-2" />
        }

        return (
          <p key={`p-${index}`} className="leading-6">
            {renderInline(line, `p-${index}`)}
          </p>
        )
      })}
    </div>
  )
}
