import { useMemo, useState } from 'react'
import { Pencil, Percent, Plus, Scale, ShieldAlert, Trash2, Utensils } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useForm } from '../hooks/useForm'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Input, Select, Textarea } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, PageHeader, Progress, StatCard } from '../components/ui'
import { SimpleBarChart, TrendChart } from '../components/Charts'
import { formatDate, num, todayInput } from '../utils/format'
import { rules } from '../utils/validate'

function WastageForm({ record, menuItems, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!record?.wastage_id
  const f = useForm({
    menu_item_id: record?.menu_item_id ?? '', quantity_wasted: record?.quantity_wasted ?? '',
    wastage_date: record?.wastage_date?.slice(0, 10) ?? todayInput(), reason: record?.reason ?? '',
  }, {
    menu_item_id: [rules.required('Menu item')],
    quantity_wasted: [rules.required('Quantity wasted'), rules.number('Quantity wasted'), rules.min(0, 'Quantity wasted')],
    reason: [rules.maxLen(200, 'Reason')],
  })
  const item = menuItems.find((m) => String(m.menu_item_id) === String(f.values.menu_item_id))

  // NOTE: we deliberately do NOT block "wasted > planned" here.
  // The Oracle trigger CHECK_FOOD_WASTAGE is the rule, and its ORA-20001 error is shown below.
  const save = f.submit(async (v) => {
    const body = { menu_item_id: Number(v.menu_item_id), quantity_wasted: Number(v.quantity_wasted), wastage_date: v.wastage_date || null, reason: v.reason.trim() || null }
    if (editing) await api.put(`/api/wastage/${record.wastage_id}`, body)
    else await api.post('/api/wastage', body)
    toast.success(editing ? 'Wastage updated.' : 'Wastage recorded.')
    onSaved()
    onClose()
  })

  const triggerError = f.error?.oracleCode === 'ORA-20001'
  return (
    <Modal open onClose={onClose} title={editing ? `Edit wastage #${record.wastage_id}` : 'Record food wastage'} subtitle="WASTAGE table · validated by a BEFORE INSERT/UPDATE trigger"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="waste-form" label={editing ? 'Save' : 'Record wastage'} />}>
      <form id="waste-form" className="stack" onSubmit={save} noValidate>
        {triggerError ? (
          <div className="alert error" role="alert">
            <ShieldAlert />
            <div>
              <b>Blocked by the Oracle trigger ({f.error.oracleCode})</b>
              <div>{f.error.message}</div>
              {item && <div className="small" style={{ marginTop: 4 }}>Planned quantity for {item.food_name} ({item.meal_type}) is <b>{num(item.quantity_planned)}</b>, you entered <b>{num(f.values.quantity_wasted)}</b>.</div>}
            </div>
          </div>
        ) : <FormError error={f.error} />}
        <Select label="Menu item" required value={f.values.menu_item_id} onChange={f.set('menu_item_id')} error={f.errors.menu_item_id} placeholder="Select menu item…"
          options={menuItems.map((m) => ({ value: m.menu_item_id, label: `${formatDate(m.menu_date)} · ${m.meal_type} · ${m.food_name} (planned ${num(m.quantity_planned)})` }))} />
        <div className="form-grid">
          <Input label="Quantity wasted" type="number" min="0" step="any" required value={f.values.quantity_wasted} onChange={f.set('quantity_wasted')} error={f.errors.quantity_wasted}
            hint={item ? `Planned: ${num(item.quantity_planned)}` : 'Select a menu item first'} />
          <Input label="Wastage date" type="date" value={f.values.wastage_date} onChange={f.set('wastage_date')} />
          <Textarea label="Reason" full rows={3} maxLength={200} value={f.values.reason} onChange={f.set('reason')} error={f.errors.reason} placeholder="e.g. Cooked too much, low attendance…" />
        </div>
      </form>
    </Modal>
  )
}

export default function Wastage() {
  const toast = useToast()
  const [filters, setFilters] = useState({ food_id: '', date_from: '', date_to: '' })
  const { data, loading, error, reload } = useApi('/api/wastage', filters)
  const summary = useApi('/api/wastage/summary')
  const menuItems = useApi('/api/menu-items')
  const foods = useApi('/api/food-items')
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const setF = (k) => (v) => setFilters((s) => ({ ...s, [k]: v }))
  const reloadAll = () => { reload(); summary.reload(); menuItems.reload() }

  const columns = useMemo(() => [
    { key: 'wastage_id', label: 'ID', render: (r) => <span className="mono">#{r.wastage_id}</span> },
    { key: 'wastage_date', label: 'Date', render: (r) => formatDate(r.wastage_date) },
    { key: 'food_name', label: 'Food', render: (r) => <b>{r.food_name}</b> },
    { key: 'meal_type', label: 'Meal', render: (r) => <Badge>{r.meal_type}</Badge> },
    { key: 'quantity_planned', label: 'Planned', align: 'right', render: (r) => num(r.quantity_planned) },
    { key: 'quantity_wasted', label: 'Wasted', align: 'right', render: (r) => <b>{num(r.quantity_wasted)}</b> },
    { key: 'wasted_percent', label: '% wasted', render: (r) => (
      <div className="row" style={{ minWidth: 120 }}><div style={{ flex: 1 }}><Progress value={r.wasted_percent} max={100} /></div><span className="small">{num(r.wasted_percent)}%</span></div>
    ) },
    { key: 'reason', label: 'Reason', render: (r) => <span className="small muted">{r.reason || '—'}</span> },
    { key: 'actions', label: '', render: (r) => (<>
      <button className="icon-btn" title="Edit" onClick={() => setForm(r)}><Pencil /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => setDel(r)}><Trash2 /></button>
    </>) },
  ], [])

  const remove = async () => {
    setBusy(true)
    try {
      await api.del(`/api/wastage/${del.wastage_id}`)
      toast.success('Wastage record deleted.')
      reloadAll()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
      setDel(null)
    }
  }

  const s = summary.data
  const planned = s?.by_food.reduce((a, x) => a + Number(x.total_planned || 0), 0) || 0
  const top = s?.by_food[0]

  return (
    <div className="stack">
      <PageHeader title="Food Wastage" subtitle="The CHECK_FOOD_WASTAGE trigger rejects wastage greater than the planned quantity"
        actions={<button className="btn btn-primary" onClick={() => setForm({})} disabled={!menuItems.data}><Plus /> Record wastage</button>} />
      <div className="grid grid-stats">
        <StatCard icon={Scale} label="Total wasted" value={`${num(s?.total_wasted)} units`} loading={!s} tone="warning" />
        <StatCard icon={Percent} label="Of planned (wasted items)" value={planned ? `${num((s.total_wasted / planned) * 100)}%` : '—'} loading={!s} tone="danger" />
        <StatCard icon={Utensils} label="Most wasted" value={top ? top.food_name : '—'} sub={top ? `${num(top.total_wasted)} units` : undefined} loading={!s} tone="violet" />
      </div>
      <Card>
        <DataTable rows={data} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="wastage_id" exportName="food-wastage" noun="wastage entry"
          searchPlaceholder="Search food, reason…" searchKeys={['reason']}
          filters={<>
            <FilterSelect value={filters.food_id} onChange={setF('food_id')} placeholder="All foods" options={(foods.data || []).map((x) => ({ value: x.food_id, label: x.food_name }))} />
            <input className="input" type="date" style={{ width: 150 }} value={filters.date_from} onChange={(e) => setF('date_from')(e.target.value)} aria-label="From date" title="From" />
            <input className="input" type="date" style={{ width: 150 }} value={filters.date_to} onChange={(e) => setF('date_to')(e.target.value)} aria-label="To date" title="To" />
          </>} />
      </Card>
      <div className="grid grid-3">
        <Card title="By food item"><SimpleBarChart data={s?.by_food.slice(0, 8)} xKey="food_name" layout="vertical" bars={[{ key: 'total_wasted', label: 'Wasted', colorBy: true }]} /></Card>
        <Card title="By date"><TrendChart data={s?.by_date} xKey="wastage_date" xFormatter={(v) => formatDate(v).slice(0, 6)} areas={[{ key: 'total_wasted', label: 'Wasted', color: '#f59e0b' }]} /></Card>
        <Card title="By meal"><SimpleBarChart data={s?.by_meal} xKey="meal_type" bars={[{ key: 'total_wasted', label: 'Wasted', colorBy: true }]} /></Card>
      </div>
      {form && <WastageForm record={form} menuItems={menuItems.data || []} onClose={() => setForm(null)} onSaved={reloadAll} />}
      <ConfirmDialog open={!!del} busy={busy} title="Delete wastage record?" onCancel={() => setDel(null)} onConfirm={remove}
        message={del && <>Delete the wastage entry for <b>{del.food_name}</b> on {formatDate(del.wastage_date)}?</>} />
    </div>
  )
}
