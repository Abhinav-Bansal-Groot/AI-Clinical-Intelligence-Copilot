export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">This screen will be built in the next step.</p>
    </div>
  )
}
