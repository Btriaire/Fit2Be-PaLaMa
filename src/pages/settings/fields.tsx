export function Field({
  label,
  value,
  onChange,
  suffix,
  onBlur,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix: string
  onBlur?: () => void
  /** Une phrase sur ce que le réglage change dans l'app (P2). */
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p>}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none"
      />
    </div>
  )
}

