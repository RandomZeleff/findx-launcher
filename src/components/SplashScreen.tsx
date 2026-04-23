import { useEffect, useState } from 'react'

interface Props {
  onDone: () => void
}

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'progress' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('progress'), 600)
    const t2 = setTimeout(() => setPhase('exit'), 1800)
    const t3 = setTimeout(() => onDone(), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0f161e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.4s ease-in' : undefined,
        pointerEvents: 'none',
      }}
    >
      {/* Logo */}
      <div
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.82)' : 'scale(1)',
          transition: 'opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#66c0f4',
            fontFamily: "'Inter', system-ui, sans-serif",
            userSelect: 'none',
          }}
        >
          findx
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 28,
          width: 120,
          height: 2,
          borderRadius: 2,
          background: 'rgba(102,192,244,0.15)',
          overflow: 'hidden',
          opacity: phase === 'progress' || phase === 'exit' ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        <div
          style={{
            height: '100%',
            background: '#66c0f4',
            borderRadius: 2,
            width: phase === 'progress' ? '100%' : '0%',
            transition: phase === 'progress' ? 'width 1.0s cubic-bezier(0.4,0,0.2,1)' : undefined,
          }}
        />
      </div>
    </div>
  )
}
