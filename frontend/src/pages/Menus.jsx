import { useMemo, useState } from 'react'
import { CalendarPlus, Check, CheckCircle2, Flame, LayoutGrid, List, Package, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { clean, useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import FoodPhoto from '../components/FoodPhoto'
import CategoryChips from '../components/CategoryChips'
import { Field, FilterSelect, Input, Select } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, ErrorState, FilteredEmpty, Loading, PageHeader, Tabs } from '../components/ui'
import { formatDate, num, titleCase, todayInput, weekday } from '../utils/format'
import { mealMeta, orderGroups } from '../utils/foodImages'
import { rules } from '../utils/validate'

export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

function MenuForm({ menu, columns, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!menu?.menu_id
  const extra = columns.filter((c) => !['menu_id', 'menu_date'].includes(c.name))
  const init = { menu_id: '', menu_date: todayInput(), ...Object.fromEntries(extra.map((c) => [c.name, ''])) }
  const f = useForm(editing ? { ...init, ...Object.fromEntries(Object.entries(menu).filter(([k]) => k in init).map(([k, v]) => [k, v ?? ''])) } : init, {
    menu_date: [rules.required('Menu date')],
    menu_id: [rules.number('Menu ID'), rules.positive('Menu ID')],
  })
  const save = f.submit(async (v) => {
    const body = clean(v, { keepEmpty: editing })
    if (editing) {
      delete body.menu_id
      await api.put(`/api/menus/${menu.menu_id}`, body)
      toast.success('Menu updated.')
    } else {
      if (body.menu_id) body.menu_id = Number(body.menu_id)
      const r = await api.post('/api/menus', body)
      toast.success(`Menu #${r.menu_id} for ${formatDate(r.menu_date)} created.`)
    }
    onSaved()
    onClose()
  })
  return (
    <Modal open onClose={onClose} title={editing ? `Edit menu #${menu.menu_id}` : 'New menu'} size="sm"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="menu-form" label={editing ? 'Save' : 'Create menu'} />}>
      <form id="menu-form" className="stack" onSubmit={save} noValidate>
        <FormError error={f.error} />
        {!editing && <Input label="Menu ID" type="number" value={f.values.menu_id} onChange={f.set('menu_id')} error={f.errors.menu_id} hint="Leave empty to auto-generate" />}
        <Input label="Menu date" type="date" required value={f.values.menu_date?.slice(0, 10)} onChange={f.set('menu_date')} error={f.errors.menu_date} />
        {extra.map((c) => (
          <Input key={c.name} label={titleCase(c.name)} required={!c.nullable && !c.has_default} value={f.values[c.name]} onChange={f.set(c.name)}
            type={c.data_type === 'NUMBER' ? 'number' : 'text'} hint={`${c.data_type} column in MENU`} />
        ))}
      </form>
    </Modal>
  )
}

// Visual food picker: searchable grid of photo tiles. Foods whose category matches the
// chosen meal type are listed first.
function FoodPicker({ foods, value, onChange, mealType, error }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const match = (f) => String(f.category || '').toLowerCase() === String(mealType || '').toLowerCase()
    return foods
      .filter((f) => !t || `${f.food_name} ${f.category}`.toLowerCase().includes(t))
      .sort((x, y) => Number(match(y)) - Number(match(x)) || String(x.food_name).localeCompare(String(y.food_name)))
  }, [foods, q, mealType])
  return (
    <Field label="Food item" required error={error} full>
      <div className={`food-picker${error ? ' has-error' : ''}`}>
        <div className="search">
          <Search />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes…" aria-label="Search dishes" />
        </div>
        <div className="food-picker-grid" role="listbox" aria-label="Food item">
          {list.map((f) => {
            const sel = String(value) === String(f.food_id)
            const off = f.availability === 'Unavailable'
            return (
              <button type="button" key={f.food_id} role="option" aria-selected={sel} title={off ? `${f.food_name} is marked unavailable` : f.food_name}
                className={`pick${sel ? ' selected' : ''}${off ? ' is-off' : ''}`} onClick={() => onChange(String(f.food_id))}>
                <FoodPhoto name={f.food_name} category={f.category} />
                {sel && <span className="pick-check"><Check size={14} /></span>}
                <span className="pick-name">{f.food_name}</span>
                <span className="pick-sub">{f.category}{f.calories != null ? ` · ${num(f.calories)} kcal` : ''}{off ? ' · unavailable' : ''}</span>
              </button>
            )
          })}
          {!list.length && <div className="muted small" style={{ padding: 12 }}>No dishes match “{q}”.</div>}
        </div>
      </div>
    </Field>
  )
}

function ItemForm({ item, menus, foods, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!item?.menu_item_id
  const f = useForm({
    menu_id: item?.menu_id ?? '', food_id: item?.food_id ?? '', meal_type: item?.meal_type ?? 'Breakfast', quantity_planned: item?.quantity_planned ?? '',
  }, {
    menu_id: [rules.required('Menu')], food_id: [rules.required('Food item')], meal_type: [rules.required('Meal type')],
    quantity_planned: [rules.required('Planned quantity'), rules.number('Planned quantity'), rules.min(0, 'Planned quantity')],
  })
  const save = f.submit(async (v) => {
    const body = { menu_id: Number(v.menu_id), food_id: Number(v.food_id), meal_type: v.meal_type, quantity_planned: Number(v.quantity_planned) }
    if (editing) await api.put(`/api/menu-items/${item.menu_item_id}`, body)
    else await api.post('/api/menu-items', body)
    const food = foods.find((x) => String(x.food_id) === String(v.food_id))
    toast.success(editing ? 'Menu item updated.' : `${food?.food_name || 'Food'} added to ${v.meal_type}.`)
    onSaved()
    onClose()
  })
  const m = mealMeta(f.values.meal_type)
  return (
    <Modal open onClose={onClose} title={editing ? 'Edit menu item' : `Add food to ${f.values.meal_type || 'menu'}`} subtitle="Saved in MENU_ITEM"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="item-form" label={editing ? 'Save' : 'Add item'} />}>
      <form id="item-form" className="stack" onSubmit={save} noValidate>
        <FormError error={f.error} />
        <div className="form-grid">
          <Select label="Menu" required value={f.values.menu_id} onChange={f.set('menu_id')} error={f.errors.menu_id} placeholder="Select a menu…"
            options={menus.map((x) => ({ value: x.menu_id, label: `#${x.menu_id} · ${formatDate(x.menu_date)}` }))} />
          <Field label="Meal type" required error={f.errors.meal_type}>
            <div className="meal-seg" role="radiogroup" aria-label="Meal type">
              {MEALS.map((meal) => {
                const mm = mealMeta(meal)
                const on = f.values.meal_type === meal
                return (
                  <button type="button" key={meal} role="radio" aria-checked={on} className={on ? 'active' : ''}
                    style={{ '--chip': mm.color, '--chip-soft': mm.soft }} onClick={() => f.set('meal_type')(meal)}>
                    <mm.icon size={14} /> {meal}
                  </button>
                )
              })}
            </div>
          </Field>
          <FoodPicker foods={foods} value={f.values.food_id} onChange={f.set('food_id')} mealType={f.values.meal_type} error={f.errors.food_id} />
          <Input label="Planned quantity" type="number" min="0" step="any" required value={f.values.quantity_planned} onChange={f.set('quantity_planned')}
            error={f.errors.quantity_planned} hint="Wastage can never exceed this (trigger)" />
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="small" style={{ color: m.color }}><m.icon size={13} style={{ verticalAlign: -2 }} /> Foods in the {f.values.meal_type} category are listed first.</span>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function DishCard({ item, canEdit, onEdit, onDelete }) {
  const off = item.availability === 'Unavailable'
  const cm = mealMeta(item.category)
  return (
    <div className={`dish${off ? ' is-off' : ''}`}>
      <div className="dish-media">
        <FoodPhoto name={item.food_name} category={item.category} />
        {canEdit && (
          <div className="dish-actions">
            <button className="icon-btn" title="Edit item" onClick={() => onEdit(item)}><Pencil size={14} /></button>
            <button className="icon-btn danger" title="Remove from menu" onClick={() => onDelete(item)}><Trash2 size={14} /></button>
          </div>
        )}
        {item.category && <span className="dish-cat" style={{ background: cm.color }}>{item.category}</span>}
      </div>
      <div className="dish-body">
        <b className="dish-name">{item.food_name}</b>
        <div className="dish-meta">
          {item.calories != null && <span title="Calories"><Flame size={12} /> {num(item.calories)} kcal</span>}
          <span title="Planned quantity"><Package size={12} /> {num(item.quantity_planned)} planned</span>
        </div>
        <span className={`avail ${off ? 'off' : 'on'}`}>{off ? <XCircle size={13} /> : <CheckCircle2 size={13} />} {item.availability || '—'}</span>
      </div>
    </div>
  )
}

function MealSection({ meal, items, canEdit, onAdd, onEditItem, onDeleteItem }) {
  const m = mealMeta(meal)
  return (
    <section className="meal-section" style={{ '--accent': m.color, '--accent-soft': m.soft }}>
      <div className="meal-section-head">
        <div className="meal-badge"><m.icon size={16} /></div>
        <h3>{meal}</h3>
        <span className="meal-count">{items.length} {items.length === 1 ? 'dish' : 'dishes'}</span>
        <div className="grow" />
        {canEdit && <button className="btn btn-sm meal-add" onClick={onAdd}><Plus /> Add food to {meal}</button>}
      </div>
      {items.length ? (
        <div className="dish-grid">
          {items.map((i) => <DishCard key={i.menu_item_id} item={i} canEdit={canEdit} onEdit={onEditItem} onDelete={onDeleteItem} />)}
        </div>
      ) : (
        <button type="button" className="meal-empty" onClick={canEdit ? onAdd : undefined} disabled={!canEdit}>
          {canEdit ? <><Plus size={16} /> Nothing planned for {meal.toLowerCase()} yet. Click to add a dish.</> : `Nothing planned for ${meal.toLowerCase()} yet.`}
        </button>
      )}
    </section>
  )
}

function relDay(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((d - t) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : null
}

function MenuBlock({ menu, meals, missing = [], canEdit, onEdit, onDelete, onAddItem, onEditItem, onDeleteItem }) {
  return (
    <div className="card menu-block">
      <div className="menu-block-head">
        <div>
          <b>Menu #{menu.menu_id}</b>
          <span className="small muted"> · {num(menu.item_count)} item(s) · {num(menu.total_planned)} planned</span>
        </div>
        {canEdit && (
          <div className="row" style={{ gap: 2 }}>
            <button className="icon-btn" title="Edit menu" onClick={onEdit}><Pencil /></button>
            <button className="icon-btn danger" title="Delete menu" onClick={onDelete}><Trash2 /></button>
          </div>
        )}
      </div>
      {meals.length ? (
        <div className={`menu-block-meals${meals.length === 1 ? ' single' : ''}`}>
          {meals.map(([meal, items]) => (
            <MealSection key={meal} meal={meal} items={items} canEdit={canEdit} onAdd={() => onAddItem(meal)}
              onEditItem={onEditItem} onDeleteItem={onDeleteItem} />
          ))}
        </div>
      ) : !missing.length && <div className="meal-section muted small">The mess has not added food to this menu yet.</div>}
      {missing.length > 0 && (
        <div className="quick-add">
          <span className="small muted">{meals.length ? 'Not planned yet:' : 'No food on this menu yet. Add to:'}</span>
          {missing.map((mt) => {
            const mm = mealMeta(mt)
            return (
              <button key={mt} className="quick-add-btn" style={{ '--chip': mm.color, '--chip-soft': mm.soft }} onClick={() => onAddItem(mt)}>
                <Plus size={14} /> <mm.icon size={14} /> {mt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Menus() {
  const { can } = useAuth()
  const canEdit = can('admin', 'staff')
  const toast = useToast()
  const [tab, setTab] = useState('cards')
  const [filters, setFilters] = useState({ date_from: '', date_to: '', meal_type: '' })
  const dateParams = { date_from: filters.date_from, date_to: filters.date_to }
  const menus = useApi('/api/menus', dateParams)
  const allMenus = useApi('/api/menus')
  const foods = useApi('/api/food-items')
  const cols = useApi('/api/meta/columns/MENU')
  const [menuForm, setMenuForm] = useState(null)
  const [itemForm, setItemForm] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const reloadAll = () => { menus.reload(); allMenus.reload(); foods.reload() }
  const setF = (k) => (v) => setFilters((s) => ({ ...s, [k]: v }))
  const meal = filters.meal_type

  const allItems = useMemo(() => (menus.data || []).flatMap((m) => m.items || []), [menus.data])
  const mealValues = orderGroups([...MEALS, ...allItems.map((i) => i.meal_type)])
  const counts = allItems.reduce((acc, i) => ({ ...acc, [i.meal_type]: (acc[i.meal_type] || 0) + 1 }), {})
  const tableRows = menus.data ? allItems.filter((i) => !meal || i.meal_type === meal) : null

  // Group menus by date; within each menu, the meal sections to show.
  const days = useMemo(() => {
    const out = []
    for (const m of menus.data || []) {
      const items = m.items || []
      const shown = (meal ? [meal] : mealValues).map((mt) => [mt, items.filter((i) => i.meal_type === mt)])
      // A selected meal tab always shows its section (empty ones get a big "add" box for admin/staff).
      // In "All meals", empty meals collapse into a compact quick-add bar to keep the page short.
      const meals = meal && canEdit ? shown : shown.filter(([, l]) => l.length)
      const missing = !meal && canEdit ? shown.filter(([, l]) => !l.length).map(([mt]) => mt) : []
      if (meal && !canEdit && !meals.length) continue
      const key = String(m.menu_date).slice(0, 10)
      let day = out.find((d) => d.key === key)
      if (!day) out.push((day = { key, date: m.menu_date, menus: [] }))
      day.menus.push({ menu: m, meals, missing })
    }
    return out
  }, [menus.data, meal, canEdit, mealValues.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilters = [
    ...(filters.date_from ? [{ name: 'from', value: formatDate(filters.date_from) }] : []),
    ...(filters.date_to ? [{ name: 'to', value: formatDate(filters.date_to) }] : []),
    ...(meal ? [{ name: 'meal', value: meal }] : []),
  ]
  const clearFilters = () => setFilters({ date_from: '', date_to: '', meal_type: '' })

  const doDelete = async () => {
    setBusy(true)
    try {
      if (confirm.type === 'menu') await api.del(`/api/menus/${confirm.row.menu_id}`)
      else await api.del(`/api/menu-items/${confirm.row.menu_item_id}`)
      toast.success(confirm.type === 'menu' ? 'Menu deleted.' : 'Item removed from menu.')
      reloadAll()
    } catch (e) {
      toast.error(e.message, 'Delete blocked')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const itemCols = useMemo(() => [
    { key: 'menu_item_id', label: 'Item ID', render: (r) => <span className="mono">#{r.menu_item_id}</span> },
    { key: 'menu_date', label: 'Menu date', render: (r) => <span>{formatDate(r.menu_date)} <span className="small muted">#{r.menu_id}</span></span> },
    { key: 'meal_type', label: 'Meal', render: (r) => <Badge>{r.meal_type}</Badge> },
    { key: 'food_name', label: 'Food', render: (r) => <span className="row"><FoodPhoto name={r.food_name} category={r.category} size={34} rounded /><span><b>{r.food_name}</b> <span className="small muted">{r.category}</span></span></span> },
    { key: 'calories', label: 'Calories', align: 'right', render: (r) => num(r.calories) },
    { key: 'quantity_planned', label: 'Planned', align: 'right', render: (r) => num(r.quantity_planned) },
    { key: 'total_wasted', label: 'Wasted', align: 'right', render: (r) => num(r.total_wasted) },
    ...(canEdit ? [{ key: 'actions', label: '', render: (r) => (<>
      <button className="icon-btn" title="Edit" onClick={() => setItemForm(r)}><Pencil /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => setConfirm({ type: 'item', row: r })}><Trash2 /></button>
    </>) }] : []),
  ], [canEdit])

  return (
    <div className="stack">
      <PageHeader title={canEdit ? 'Menus' : 'Mess Menu'} subtitle="Daily menus and the food planned for each meal"
        actions={canEdit && <>
          <button className="btn btn-secondary" onClick={() => setItemForm({ meal_type: meal || 'Breakfast' })} disabled={!allMenus.data || !foods.data}><Plus /> Add food to menu</button>
          <button className="btn btn-primary" onClick={() => setMenuForm({})} disabled={!cols.data}><CalendarPlus /> New menu</button>
        </>} />
      <div className="card">
        <div className="chips-bar">
          <CategoryChips values={mealValues} counts={counts} total={allItems.length} value={meal} onChange={setF('meal_type')} allLabel="All meals" label="Meal type" />
        </div>
        <div className="toolbar" style={{ borderBottom: 0 }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'cards', label: 'Menu cards', icon: LayoutGrid }, { value: 'items', label: 'All menu items', icon: List }]} />
          <div className="grow" />
          <input className="input" type="date" style={{ width: 160 }} value={filters.date_from} onChange={(e) => setF('date_from')(e.target.value)} aria-label="From date" title="From date" />
          <input className="input" type="date" style={{ width: 160 }} value={filters.date_to} onChange={(e) => setF('date_to')(e.target.value)} aria-label="To date" title="To date" />
          <FilterSelect value={meal} onChange={setF('meal_type')} placeholder="All meals" options={mealValues} />
          {activeFilters.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>}
        </div>
      </div>
      {tab === 'cards' ? (
        menus.error ? <ErrorState error={menus.error} onRetry={menus.reload} /> : !menus.data ? <Loading /> : !days.length ? (
          <div className="card">
            <FilteredEmpty filters={activeFilters} noun="menu" onClear={clearFilters} emptyTitle="No menus found"
              emptyMessage={canEdit ? 'Create a menu, then add food items to it.' : 'The mess has not published a menu yet.'} />
          </div>
        ) : (
          <div className="menu-days" key={meal}>
            {days.map((day) => {
              const d = new Date(`${day.key}T00:00:00`)
              const ok = !Number.isNaN(d.getTime())
              const rel = relDay(day.key)
              return (
                <section className="menu-day" key={day.key}>
                  <header className="day-head">
                    <div className="date-chip big"><b>{ok ? d.getDate() : '?'}</b><span>{ok ? d.toLocaleString('en', { month: 'short' }) : ''}</span></div>
                    <div>
                      <h2>{weekday(day.date) || formatDate(day.date)} {rel && <span className="day-rel">{rel}</span>}</h2>
                      <div className="small muted">{formatDate(day.date)} · {day.menus.length} menu{day.menus.length > 1 ? 's' : ''}</div>
                    </div>
                  </header>
                  {day.menus.map(({ menu: m, meals, missing }) => (
                    <MenuBlock key={m.menu_id} menu={m} meals={meals} missing={missing} canEdit={canEdit}
                      onEdit={() => setMenuForm(m)} onDelete={() => setConfirm({ type: 'menu', row: m })}
                      onAddItem={(mt) => setItemForm({ menu_id: m.menu_id, meal_type: mt })} onEditItem={setItemForm}
                      onDeleteItem={(i) => setConfirm({ type: 'item', row: i })} />
                  ))}
                </section>
              )
            })}
          </div>
        )
      ) : (
        <Card>
          <DataTable rows={tableRows} loading={menus.loading} error={menus.error} onRetry={menus.reload} columns={itemCols} rowKey="menu_item_id" exportName="menu-items"
            searchPlaceholder="Search food, meal…" noun="menu item" extraFilters={activeFilters} onClearFilters={clearFilters} />
        </Card>
      )}
      {menuForm && <MenuForm menu={menuForm} columns={cols.data || []} onClose={() => setMenuForm(null)} onSaved={reloadAll} />}
      {itemForm && <ItemForm item={itemForm} menus={allMenus.data || []} foods={foods.data || []} onClose={() => setItemForm(null)} onSaved={reloadAll} />}
      <ConfirmDialog open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={doDelete}
        title={confirm?.type === 'menu' ? 'Delete menu?' : 'Remove menu item?'}
        message={confirm?.type === 'menu'
          ? <>Delete menu #{confirm.row.menu_id} ({formatDate(confirm.row.menu_date)})? Oracle blocks this if items, attendance or complaints still reference it.</>
          : confirm && <>Remove <b>{confirm.row.food_name}</b> from {confirm.row.meal_type}? Blocked if wastage has been recorded for it.</>} />
    </div>
  )
}
