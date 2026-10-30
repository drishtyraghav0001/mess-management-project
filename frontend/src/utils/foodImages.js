// Maps a FOOD_ITEM.FOOD_NAME to a bundled photo in /public/food (see public/food/CREDITS.md).
// Matching is case-insensitive and fuzzy: "Masala Dosa" -> dosa, "Chapatti" -> chapati,
// "Veg Biriyani" -> biryani. Unknown foods get a category-coloured gradient with an emoji.
import { Cookie, CupSoda, IceCreamCone, Moon, Sun, Sunrise, UtensilsCrossed } from 'lucide-react'

const BASE = `${import.meta.env.BASE_URL || '/'}food/`

// Order matters: specific dishes first, generic words (rice, curry, roti) last.
const RULES = [
  ['egg-curry', ['egg curry', 'anda curry', 'egg masala', 'anda', 'egg', 'eggs', 'omelette', 'omelet', 'bhurji']],
  ['chicken-curry', ['chicken', 'murgh', 'mutton', 'fish curry', 'meat', 'kadhai chicken']],
  ['biryani', ['biryani', 'biriyani', 'briyani', 'dum biryani']],
  ['pulao', ['pulao', 'pulav', 'pilaf', 'pilau', 'fried rice', 'jeera rice', 'veg rice', 'lemon rice', 'tamarind rice']],
  ['rajma', ['rajma', 'rajmah', 'kidney beans']],
  ['chole', ['chole', 'chhole', 'chana', 'channa', 'chickpea', 'chickpeas', 'bhature', 'bhatura', 'kulche', 'kulcha']],
  ['khichdi', ['khichdi', 'khichadi', 'khichri', 'khichuri', 'pongal']],
  ['pav-bhaji', ['pav bhaji', 'pav', 'pao']],
  ['aloo-paratha', ['paratha', 'parantha', 'parotta', 'thepla']],
  ['puri', ['puri', 'poori', 'luchi']],
  ['dosa', ['dosa', 'dosai', 'dose', 'uttapam', 'uthappam']],
  ['idli', ['idli', 'idly', 'iddli']],
  ['vada', ['vada', 'wada', 'vadai', 'medu']],
  ['sambar', ['sambar', 'sambhar', 'rasam']],
  ['upma', ['upma', 'uppittu', 'rava', 'suji']],
  ['poha', ['poha', 'pohe', 'aval', 'chivda']],
  ['paneer', ['paneer', 'panir', 'kofta', 'shahi', 'butter masala', 'malai', 'kadai', 'matar', 'palak', 'curry', 'sabzi', 'sabji', 'mix veg', 'korma']],
  ['gulab-jamun', ['gulab jamun', 'gulab', 'jamun', 'rasgulla', 'rasogolla']],
  ['kheer', ['kheer', 'payasam', 'payesh', 'rice pudding', 'halwa', 'sheera', 'custard']],
  ['jalebi', ['jalebi', 'jilebi', 'imarti']],
  ['samosa', ['samosa', 'samosas', 'kachori', 'pakora', 'pakoda', 'bajji', 'bhaji', 'cutlet']],
  ['fruit-salad', ['fruit salad', 'fruit', 'fruits', 'salad', 'banana', 'apple']],
  ['curd', ['curd', 'dahi', 'raita', 'yogurt', 'yoghurt', 'lassi', 'buttermilk', 'chaas', 'chhaas']],
  ['coffee', ['coffee', 'kaapi', 'cappuccino', 'espresso']],
  ['tea', ['tea', 'chai', 'chay', 'masala chai']],
  ['thali', ['thali', 'meal', 'meals', 'combo', 'platter']],
  ['dal', ['dal', 'daal', 'dhal', 'dahl', 'lentil', 'lentils', 'tadka', 'makhani']],
  ['rice', ['rice', 'chawal', 'steamed rice', 'plain rice']],
  ['chapati', ['chapati', 'chapathi', 'chappati', 'roti', 'rotis', 'phulka', 'fulka', 'naan', 'tandoori roti', 'bread']],
]

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

const close = (token, kw) => token === kw || (kw.length >= 5 && token.length >= 4 && lev(token, kw) <= (kw.length >= 7 ? 2 : 1))

const cache = new Map()
export function foodImageKey(name) {
  const n = norm(name)
  if (!n) return null
  if (cache.has(n)) return cache.get(n)
  const padded = ` ${n} `
  const tokens = n.split(' ')
  let found = null
  // pass 1: exact word / phrase matches
  for (const [key, kws] of RULES) {
    if (kws.some((k) => padded.includes(` ${k} `))) { found = key; break }
  }
  // pass 2: typo-tolerant single-word matches ("chapatti", "biriyani")
  if (!found) {
    for (const [key, kws] of RULES) {
      if (kws.some((k) => !k.includes(' ') && tokens.some((t) => close(t, k)))) { found = key; break }
    }
  }
  cache.set(n, found)
  return found
}

export function foodImage(name) {
  const key = foodImageKey(name)
  return key ? `${BASE}${key}.webp` : null
}

// ---- Meal type / category look & feel (icons, colours, emoji fallback) ----
const META = {
  breakfast: { icon: Sunrise, color: '#d97706', soft: '#fff7ed', from: '#fbbf24', to: '#f97316', emoji: '🍳' },
  lunch: { icon: Sun, color: '#059669', soft: '#ecfdf5', from: '#34d399', to: '#0d9488', emoji: '🍛' },
  snack: { icon: Cookie, color: '#7c3aed', soft: '#f5f3ff', from: '#c084fc', to: '#7c3aed', emoji: '🥪' },
  snacks: null,
  dinner: { icon: Moon, color: '#4f46e5', soft: '#eef2ff', from: '#818cf8', to: '#4338ca', emoji: '🍲' },
  beverage: { icon: CupSoda, color: '#0284c7', soft: '#f0f9ff', from: '#38bdf8', to: '#0369a1', emoji: '☕' },
  dessert: { icon: IceCreamCone, color: '#db2777', soft: '#fdf2f8', from: '#f9a8d4', to: '#db2777', emoji: '🍨' },
}
META.snacks = META.snack
META.beverages = META.beverage
META.drinks = META.beverage
META.desserts = META.dessert
META.sweet = META.dessert
META.sweets = META.dessert
const DEFAULT_META = { icon: UtensilsCrossed, color: '#64748b', soft: '#f1f5f9', from: '#94a3b8', to: '#475569', emoji: '🍽️' }

export function mealMeta(value) {
  return META[norm(value)] || DEFAULT_META
}

// Emoji for the fallback tile: a hint from the name first, then the category.
const NAME_EMOJI = [
  [/egg|omelet/, '🥚'], [/fish|prawn/, '🐟'], [/noodle|chowmein|maggi/, '🍜'], [/pasta|macaroni/, '🍝'],
  [/sandwich|toast|bread/, '🥪'], [/pizza/, '🍕'], [/burger/, '🍔'], [/soup/, '🥣'], [/milk|shake/, '🥛'],
  [/juice/, '🧃'], [/ice ?cream/, '🍨'], [/cake|pastry/, '🍰'], [/corn/, '🌽'], [/potato|aloo|fries/, '🥔'],
]
export function foodEmoji(name, category) {
  const n = norm(name)
  const hit = NAME_EMOJI.find(([re]) => re.test(n))
  return hit ? hit[1] : mealMeta(category).emoji
}

// Standard meal order; any extra values from the data are appended alphabetically.
export const MEAL_ORDER = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Beverage', 'Dessert']
export function orderGroups(values) {
  const uniq = [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ''))]
  const idx = (v) => {
    const i = MEAL_ORDER.findIndex((m) => m.toLowerCase() === String(v).toLowerCase())
    return i === -1 ? 99 : i
  }
  return uniq.sort((a, b) => idx(a) - idx(b) || String(a).localeCompare(String(b)))
}
