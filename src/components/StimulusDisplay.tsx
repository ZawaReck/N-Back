import type { StimulusColor } from '../types/nback'
import { colorLabel } from '../utils/nback'

type StimulusDisplayProps = {
  color: StimulusColor | null
  visible: boolean
}

const colorMap: Record<StimulusColor, string> = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
}

export function StimulusDisplay({ color, visible }: StimulusDisplayProps) {
  const fillColor = color ? colorMap[color] : '#d7dbe4'
  const label = color ? colorLabel(color) : '待機中'

  return (
    <section className="panel stimulus-panel">
      <h2>刺激表示</h2>
      <div className={`stimulus-stage ${visible ? 'visible' : 'hidden'}`}>
        <div className="stimulus-circle" style={{ backgroundColor: fillColor }} aria-label={label} role="img" />
      </div>
      <p className="stimulus-caption">{visible && color ? `${label} の円` : '待機中'}</p>
    </section>
  )
}
