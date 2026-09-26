import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getGoogleFitDays } from '../lib/googleFit'
import { assessFitHealth, type FitIssue } from '../lib/fitHealth'

/** Avertit quand Google Fit ne transmet plus (données périmées, sommeil absent). Invisible quand tout va bien. */
export default function FitStatusLine({ refreshKey = 0 }: { refreshKey?: number }) {
  const [issues, setIssues] = useState<FitIssue[]>([])

  useEffect(() => {
    getGoogleFitDays(7).then((days) => setIssues(assessFitHealth(days)))
  }, [refreshKey])

  if (issues.length === 0) return null
  return (
    <div role="status" className="space-y-1.5 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3">
      {issues.map((i) => (
        <p key={i.id} className="flex items-start gap-2 text-xs leading-snug text-orange-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {i.text}
        </p>
      ))}
    </div>
  )
}
