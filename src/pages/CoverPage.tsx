import { useState } from 'react'
import { Apple, Dumbbell, Footprints, HeartPulse } from 'lucide-react'

const MODULES = [
  { icon: Dumbbell, label: 'Gym', color: '#ff5a30' },
  { icon: Footprints, label: 'Endurance', color: '#7d93ea' },
  { icon: HeartPulse, label: 'Récup', color: '#a78bfa' },
  { icon: Apple, label: 'Diet', color: '#ff9466' },
]

/** Écran de garde plein cadre — toucher n'importe où pour entrer. */
export default function CoverPage({ onEnter }: { onEnter: () => void }) {
  const [out, setOut] = useState(false)

  function enter() {
    if (out) return
    setOut(true)
    window.setTimeout(onEnter, 320)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Toucher pour continuer"
      onClick={enter}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') enter()
      }}
      className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 22%, #1a1246 0%, #0b0a1f 48%, #050509 100%)',
        opacity: out ? 0 : 1,
        transform: out ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 320ms ease, transform 320ms ease',
      }}
    >
      <div className="cv-grid" />
      <div className="cv-scan" />
      <div className="cv-orb cv-orb-a" />
      <div className="cv-orb cv-orb-b" />
      <div className="cv-orb cv-orb-c" />

      <div className="relative flex flex-col items-center gap-5 px-6 pb-10 text-center">
        <div className="cv-mark">
          <span className="cv-ring cv-ring-outer" />
          <span className="cv-ring cv-ring-mid" />
          <Dumbbell size={40} strokeWidth={2.2} className="relative z-10 text-zinc-950" />
        </div>

        <svg className="cv-ecg" viewBox="0 0 240 40" fill="none" aria-hidden="true">
          <path
            d="M0 22 H70 L80 22 L88 6 L98 36 L108 14 L114 22 H240"
            stroke="#ff5a30"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div>
          <h1 className="cv-title">Fit2Be</h1>
          <p className="cv-subtitle">Gym, sport &amp; longévité — ton carnet d&apos;entraînement tout-en-un</p>
        </div>

        <div className="cv-modules">
          {MODULES.map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="cv-module-icon" style={{ color, borderColor: `${color}33`, background: `${color}14` }}>
                <Icon size={19} />
              </div>
              <span className="text-[11px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        <div className="cv-tag">
          <span className="cv-tag-dot" />
          PaLaMa · Sync privée sur ton VPS
        </div>
      </div>

      <div
        className="cv-prompt absolute flex flex-col items-center gap-2 text-[#ff9466]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
      >
        <span className="text-[13px] font-medium tracking-wide opacity-80">Touchez pour continuer</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="cv-chevron">
          <path d="M4 7l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <style>{`
        .cv-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(125,147,234,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125,147,234,.06) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 0%, transparent 70%);
        }
        .cv-scan {
          position: absolute; left: 0; right: 0; height: 100px;
          background: linear-gradient(180deg, transparent, rgba(255,90,48,.06), transparent);
          animation: cv-scan 6s linear infinite;
        }
        .cv-orb { position: absolute; border-radius: 50%; filter: blur(60px); }
        .cv-orb-a { width: 300px; height: 300px; background: #e2361c; opacity: .28; top: 4%; left: -12%; animation: cv-drift-a 10s ease-in-out infinite; }
        .cv-orb-b { width: 260px; height: 260px; background: #2f4bd6; opacity: .32; bottom: 8%; right: -10%; animation: cv-drift-b 13s ease-in-out infinite; }
        .cv-orb-c { width: 190px; height: 190px; background: #5b3fc4; opacity: .2; bottom: 32%; left: 8%; animation: cv-drift-c 16s ease-in-out infinite; }
        .cv-mark {
          position: relative; width: 108px; height: 108px; border-radius: 30px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #ff5a30, #4a63d8);
          box-shadow: 0 0 60px rgba(226,54,28,.5);
          animation: cv-breathe 3s ease-in-out infinite;
        }
        .cv-ring { position: absolute; border-radius: 38px; border: 1px solid rgba(255,148,102,.35); animation: cv-ring 3s ease-out infinite; }
        .cv-ring-outer { inset: -18px; }
        .cv-ring-mid { inset: -9px; animation-delay: .4s; border-color: rgba(125,147,234,.3); }
        .cv-ecg { width: 220px; height: 36px; overflow: visible; filter: drop-shadow(0 0 6px rgba(255,90,48,.7)); }
        .cv-ecg path { stroke-dasharray: 340; stroke-dashoffset: 340; animation: cv-ecg 2.6s ease-in-out infinite; }
        .cv-title {
          font-size: 44px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.05;
          background: linear-gradient(90deg, #fff1ec 0%, #ff8a63 45%, #fff1ec 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: cv-shimmer 4s linear infinite;
        }
        .cv-subtitle {
          max-width: 260px; margin: 8px auto 0; font-size: 14px; line-height: 1.5; color: #9aa6d8;
          opacity: 0; animation: cv-fade 1s ease both .2s;
        }
        .cv-modules { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; opacity: 0; animation: cv-fade 1s ease both .45s; }
        .cv-module-icon {
          display: flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; border-radius: 16px; border: 1px solid;
        }
        .cv-tag {
          display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; color: #ff9466;
          background: rgba(255,90,48,.1); border: 1px solid rgba(255,148,102,.22);
          border-radius: 999px; padding: 5px 14px;
          opacity: 0; animation: cv-fade 1s ease both .7s;
        }
        .cv-tag-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff5a30; animation: cv-blink 1.8s ease-in-out infinite; }
        .cv-prompt { opacity: 0; animation: cv-fade 1s ease both 1s; }
        .cv-chevron { animation: cv-bounce 1.8s ease-in-out infinite; }

        @keyframes cv-scan { 0% { top: -100px; } 100% { top: 100%; } }
        @keyframes cv-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(28px,22px) scale(1.05); } }
        @keyframes cv-drift-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-22px,-18px) scale(1.08); } }
        @keyframes cv-drift-c { 0%,100% { transform: translate(0,0); } 50% { transform: translate(16px,-12px); } }
        @keyframes cv-breathe { 0%,100% { box-shadow: 0 0 60px rgba(226,54,28,.5); } 50% { box-shadow: 0 0 84px rgba(226,54,28,.75); } }
        @keyframes cv-ring { 0% { opacity: .55; transform: scale(.92); } 100% { opacity: 0; transform: scale(1.15); } }
        @keyframes cv-ecg { 0% { stroke-dashoffset: 340; } 55%,100% { stroke-dashoffset: 0; } }
        @keyframes cv-shimmer { to { background-position: -200% center; } }
        @keyframes cv-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cv-bounce { 0%,100% { transform: translateY(0); opacity: .6; } 50% { transform: translateY(6px); opacity: 1; } }
        @keyframes cv-blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        @media (prefers-reduced-motion: reduce) {
          .cv-scan, .cv-orb, .cv-mark, .cv-ring, .cv-title, .cv-chevron, .cv-tag-dot { animation: none !important; }
          .cv-ecg path { animation: none !important; stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}
