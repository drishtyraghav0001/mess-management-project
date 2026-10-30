import { useMemo, useState } from 'react'
import { CheckCircle2, Flame, LayoutGrid, List, Pencil, Plus, Salad, Search, Trash2, XCircle } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { clean, useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Input, Select } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, ErrorState, FilteredEmpty, Loading, PageHeader, StatCard } from '../components/ui'
import FoodPhoto from '../components/FoodPhoto'
import CategoryChips from '../components/CategoryChips'
import { mealMeta } from '../utils/foodImages'
import { num, unique } from '../utils/format'
import { rules } from '../utils/validate'

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Beverage', 'Dessert']

function FoodForm({ food, onClose, onSaved, categories }) {
  const toast = useToast()
  const editing = !!food?.food_id
  const f = useForm(
    { food_id: '', food_name: food?.food_name ?? '', category: food?.category ?? '', calories: food?.calories ?? '', availability: food?.availability ?? 'Available' },
    {
      food_name: [rules.required('Food name'), rules.minLen(2, 'Food name'), rules.maxLen(50, 'Food name')],
      category: [rules.required('Category'), rules.maxLen(20, 'Category')],
      calories: [rules.number('Calories'), rules.min(0, 'Calories')],
      food_id: [rules.number('Food ID'), rules.positive('Food ID')],
    },
  )
  const save = f.submit(async (v) => {
    const body = clean(v, { keepEmpty: editing })
    if (body.calories !== undefined && body.calories !== null) body.calories = Number(body.calories)
    if (editing) {
      delete body.food_id
      await api.put(`/api/food-items/${food.food_id}`, body)
    } else {
      if (body.food_id) body.food_id = Number(body.food_id)
      await api.post('/api/food-items', body)
    }
    toast.success(`${v.food_name} ${editing ? 'updated' : 'added'}.`)
    onSaved()
    onClose()
  })
  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${food.food_name}` : 'Add food item'} subtitle="FOOD_ITEM table"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="food-form" label={editing ? 'Save' : 'Add food'} />}>
      <form id="food-form" className="stack" onSubmit={save} noValidate>
        <FormError error={f.error} />
        <div className="food-form-preview">
          <FoodPhoto name={f.values.food_name || '?'} category={f.values.category} size={64} rounded />
          <div className="small muted">Photo preview. A matching photo is picked automatically from the food name
            (e.g. “Masala Dosa” → dosa); other foods get a coloured {f.values.category || 'category'} tile.</div>
        </div>
        <div className="form-grid">
          <Input label="Food name" required value={f.values.food_name} onChange={f.set('food_name')} error={f.errors.food_name} maxLength={50} full={editing} />
          {!editing && <Input label="Food ID" type="number" value={f.values.food_id} onChange={f.set('food_id')} error={f.errors.food_id} hint="Leave empty to auto-generate" />}
          <Field2 f={f} categories={categories} />
          <Input label="Calories (kcal)" type="number" min="0" value={f.values.calories} onChange={f.set('calories')} error={f.errors.calories} />
          <Select label="Availability" value={f.values.availability} onChange={f.set('availability')} options={['Available', 'Unavailable']} />
        </div>
      </form>
    </Modal>
  )
}

function Field2({ f, categories }) {
  return (
    <>
      <Input label="Category" required list="food-categories" value={f.values.category} onChange={f.set('category')} error={f.errors.category} maxLength={20} placeholder="Breakfast, Lunch…" />
      <datalist id="food-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  )
}

function FoodCard({ food, canEdit, onEdit, onDelete }) {
  const m = mealMeta(food.category)
  const off = food.availability === 'Unavailable'
  return (
    <article className={`food-card${off ? ' is-off' : ''}`} style={{ '--accent': m.color, '--accent-soft': m.soft }}>
      <div className="food-card-media">
        <FoodPhoto name={food.food_name} category={food.category} />
        <span className="food-card-cat"><m.icon size={13} /> {food.category || 'Other'}</span>
        {food.calories != null && <span className="food-card-kcal"><Flame size={13} /> {num(food.calories)} kcal</span>}
        {canEdit && (
          <div className="food-card-actions">
            <button className="icon-btn" title="Edit" onClick={() => onEdit(food)}><Pencil /></button>
            <button className="icon-btn danger" title="Delete" onClick={() => onDelete(food)}><Trash2 /></button>
          </div>
        )}
      </div>
      <div className="food-card-body">
        <div className="food-card-title">
          <h3>{food.food_name}</h3>
          <span className="mono muted">#{food.food_id}</span>
        </div>
        <div className="food-card-meta">
          <span className={`avail ${off ? 'off' : 'on'}`}>{off ? <XCircle size={14} /> : <CheckCircle2 size={14} />} {food.availability || '—'}</span>
          <span className="muted small">in {num(food.used_in_menus ?? 0)} menu{Number(food.used_in_menus) === 1 ? '' : 's'}</span>
        </div>
      </div>
    </article>
  )
}

export default function FoodItems() {
  const { can } = useAuth()
  const canEdit = can('admin', 'staff')
  const toast = useToast()
  const { data, loading, error, reload } = useApi('/api/food-items')
  const [view, setView] = useState('grid')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [avail, setAvail] = useState('')
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const categories = [...new Set([...CATEGORIES, ...unique(data, 'category')])]
  const q = query.trim().toLowerCase()
  const byAvail = (data || []).filter((r) => !avail || r.availability === avail)
  const counts = byAvail.reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category] || 0) + 1 }), {})
  const rows = byAvail.filter((r) => !category || r.category === category)
  const gridRows = rows.filter((r) => !q || [r.food_name, r.category, r.availability, r.food_id].some((v) => String(v ?? '').toLowerCase().includes(q)))
  const activeFilters = [
    ...(category ? [{ name: 'category', value: category }] : []),
    ...(avail ? [{ name: 'availability', value: avail }] : []),
  ]
  const clearAll = () => { setQuery(''); setCategory(''); setAvail('') }

  const columns = useMemo(() => [
    { key: 'food_id', label: 'ID', render: (r) => <span className="mono">#{r.food_id}</span> },
    { key: 'food_name', label: 'Food', render: (r) => <span className="row"><FoodPhoto name={r.food_name} category={r.category} size={36} rounded /><b>{r.food_name}</b></span> },
    { key: 'category', label: 'Category', render: (r) => <Badge plain tone="primary">{r.category}</Badge> },
    { key: 'calories', label: 'Calories', align: 'right', render: (r) => (r.calories != null ? `${num(r.calories)} kcal` : '—') },
    { key: 'used_in_menus', label: 'Used in menus', align: 'right' },
    { key: 'availability', label: 'Availability', render: (r) => <Badge>{r.availability}</Badge> },
    ...(canEdit ? [{ key: 'actions', label: '', render: (r) => (<>
      <button className="icon-btn" title="Edit" onClick={() => setForm(r)}><Pencil /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => setDel(r)}><Trash2 /></button>
    </>) }] : []),
  ], [canEdit])

  const remove = async () => {
    setBusy(true)
    try {
      await api.del(`/api/food-items/${del.food_id}`)
      toast.success(`${del.food_name} deleted.`)
      reload()
    } catch (e) {
      toast.error(e.message, 'Delete blocked')
    } finally {
      setBusy(false)
      setDel(null)
    }
  }

  const withCal = (data || []).filter((r) => r.calories != null)
  const avgCal = withCal.length ? withCal.reduce((s, r) => s + Number(r.calories || 0), 0) / withCal.length : 0

  return (
    <div className="stack">
      <PageHeader title="Food Items" subtitle="Dishes that can be placed on a menu"
        actions={canEdit && <button className="btn btn-primary" onClick={() => setForm({})}><Plus /> Add food item</button>} />
      <div className="grid grid-stats">
        <StatCard icon={Salad} label="Food items" value={num(data?.length)} loading={!data} />
        <StatCard icon={CheckCircle2} label="Available" value={num(data?.filter((r) => r.availability === 'Available').length)} tone="success" loading={!data} />
        <StatCard icon={Flame} label="Average calories" value={`${num(avgCal, 0)} kcal`} tone="warning" loading={!data} />
      </div>
      <Card bodyClass="">
        <div className="chips-bar">
          <CategoryChips values={unique(data, 'category')} counts={counts} total={byAvail.length} value={category} onChange={setCategory} label="Food category" />
        </div>
        <div className="toolbar">
          <div className="search">
            <Search />
            <input className="input" value={query} placeholder="Search food…" aria-label="Search food" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <FilterSelect value={category} onChange={setCategory} placeholder="All categories" options={unique(data, 'category')} />
          <FilterSelect value={avail} onChange={setAvail} placeholder="Any availability" options={unique(data, 'availability')} />
          {(q || activeFilters.length > 0) && <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>}
          <div className="grow" />
          <div className="view-toggle" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Photo cards"><LayoutGrid /> Cards</button>
            <button role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Table"><List /> Table</button>
          </div>
        </div>
        {view === 'grid' ? (
          error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : !gridRows.length ? (
            <FilteredEmpty query={query} filters={activeFilters} noun="food item" onClear={clearAll}
              emptyTitle="No food items yet" emptyMessage={canEdit ? 'Add your first dish with “Add food item”.' : undefined} />
          ) : (
            <div className="food-grid" key={category + avail}>
              {gridRows.map((r) => <FoodCard key={r.food_id} food={r} canEdit={canEdit} onEdit={setForm} onDelete={setDel} />)}
            </div>
          )
        ) : (
          <DataTable rows={data ? rows : null} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="food_id" exportName="food-items"
            searchable={false} query={query} onQueryChange={setQuery} noun="food item" extraFilters={activeFilters} onClearFilters={clearAll}
            searchKeys={['food_name']} />
        )}
      </Card>
      {form && <FoodForm food={form} categories={categories} onClose={() => setForm(null)} onSaved={reload} />}
      <ConfirmDialog open={!!del} busy={busy} title="Delete food item?" onCancel={() => setDel(null)} onConfirm={remove}
        message={del && <>Delete <b>{del.food_name}</b>? This is blocked while it is used in any menu ({del.used_in_menus} right now).</>} />
    </div>
  )
}
