import { useState } from 'react'
import { foodEmoji, foodImage, mealMeta } from '../utils/foodImages'

/**
 * Food photo with a guaranteed fallback: if there is no bundled photo for this
 * name (or it fails to load) a category-coloured gradient tile with an emoji is shown,
 * so the UI never shows a broken image.
 */
export default function FoodPhoto({ name, category, size, className = '', rounded }) {
  const src = foodImage(name)
  const [failed, setFailed] = useState(false)
  const m = mealMeta(category)
  const style = size ? { width: size, height: size, flex: `0 0 ${size}px` } : undefined
  const cls = `food-photo${size ? ' thumb' : ''}${rounded ? ' rounded' : ''} ${className}`
  if (!src || failed) {
    return (
      <div className={`${cls} fallback`} style={{ ...style, background: `linear-gradient(135deg, ${m.from}, ${m.to})` }} role="img" aria-label={name}>
        <span className="food-emoji" style={size ? { fontSize: Math.max(14, size * 0.5) } : undefined}>{foodEmoji(name, category)}</span>
      </div>
    )
  }
  return (
    <div className={cls} style={style}>
      <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  )
}
