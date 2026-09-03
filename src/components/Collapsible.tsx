/** Repli/dépli animé (grid-template-rows 0fr↔1fr) — contrairement à un simple
 * `{open && <...>}`, le contenu reste monté (juste caché visuellement), ce
 * qui permet la transition de hauteur au lieu d'un affichage/masquage instantané. */
export default function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}
