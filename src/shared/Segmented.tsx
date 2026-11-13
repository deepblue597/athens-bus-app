import { useId } from 'react'
import './Segmented.css'

interface SegmentedProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

/** A row of pill-shaped radio buttons: one choice, arrow keys move between options */
export function Segmented({ label, value, options, onChange }: SegmentedProps) {
  const name = useId()
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{label}</legend>
      <div className="segmented-options">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
