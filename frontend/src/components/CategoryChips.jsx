import { LayoutGrid } from 'lucide-react'
import { mealMeta, orderGroups } from '../utils/foodImages'

/**
 * Clickable pill tabs: All · Breakfast · Lunch · Snack · Dinner (+ any extra values found in the data).
 * counts: { [value]: number }. value '' means "All".
 */
export default function CategoryChips({ values, counts = {}, total, value, onChange, allLabel = 'All', label = 'Filter' }) {
  const list = orderGroups(values)
  return (
    <div className="chips" role="tablist" aria-label={label}>
      <button type="button" role="tab" aria-selected={!value} className={`chip${!value ? ' active' : ''}`}
        style={{ '--chip': 'var(--primary)', '--chip-soft': 'var(--primary-50)' }} onClick={() => onChange('')}>
        <LayoutGrid /> {allLabel}
        <span className="chip-count">{total ?? Object.values(counts).reduce((s, n) => s + n, 0)}</span>
      </button>
      {list.map((v) => {
        const m = mealMeta(v)
        const Icon = m.icon
        const active = String(value).toLowerCase() === String(v).toLowerCase()
        return (
          <button key={v} type="button" role="tab" aria-selected={active} className={`chip${active ? ' active' : ''}`}
            style={{ '--chip': m.color, '--chip-soft': m.soft }} onClick={() => onChange(active ? '' : v)}>
            <Icon /> {v}
            <span className="chip-count">{counts[v] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
