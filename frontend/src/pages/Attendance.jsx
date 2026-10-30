import { useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, ClipboardCheck, List, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Input, Select } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, PageHeader, StatCard, Tabs } from '../components/ui'
import { SimpleBarChart, TrendChart } from '../components/Charts'
import { formatDate, formatDateTime, num } from '../utils/format'
import { rules } from '../utils/validate'
import { MEALS } from './Menus'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function AttendanceForm({ record, students, menus, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!record?.attendance_id
  const f = useForm({
    student_id: record?.student_id ?? '', menu_id: record?.menu_id ?? '', meal_type: record?.meal_type ?? 'Breakfast',
    status: record?.status ?? 'Present', attendance_time: record?.attendance_time ? record.attendance_time.replace(' ', 'T').slice(0, 16) : nowLocal(),
  }, { student_id: [rules.required('Student')], menu_id: [rules.required('Menu')], meal_type: [rules.required('Meal type')] })

  const save = f.submit(async (v) => {
    const body = { ...v, student_id: Number(v.student_id), menu_id: Number(v.menu_id), attendance_time: v.attendance_time || null }
    if (editing) await api.put(`/api/attendance/${record.attendance_id}`, body)
    else await api.post('/api/attendance', body)
    toast.success(editing ? 'Attendance updated.' : 'Attendance marked.')
    onSaved()
    onClose()
  })

  return (
    <Modal open onClose={onClose} title={editing ? `Edit attendance #${record.attendance_id}` : 'Mark attendance'} subtitle="ATTENDANCE table"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="att-form" label={editing ? 'Save' : 'Mark attendance'} />}>
      <form id="att-form" className="stack" onSubmit={save} noValidate>
        <FormError error={f.error} />
        <div className="form-grid">
          <Select label="Student" required full value={f.values.student_id} onChange={f.set('student_id')} error={f.errors.student_id} placeholder="Select student…"
            options={students.map((s) => ({ value: s.student_id, label: `#${s.student_id} · ${s.student_name}${s.room_no ? ` (${s.room_no})` : ''}` }))} />
          <Select label="Menu" required value={f.values.menu_id} onChange={f.set('menu_id')} error={f.errors.menu_id} placeholder="Select menu…"
            options={menus.map((m) => ({ value: m.menu_id, label: `#${m.menu_id} · ${formatDate(m.menu_date)}` }))} />
          <Select label="Meal type" required value={f.values.meal_type} onChange={f.set('meal_type')} options={MEALS} />
          <Select label="Status" value={f.values.status} onChange={f.set('status')} options={['Present', 'Absent']} />
          <Input label="Attendance time" type="datetime-local" value={f.values.attendance_time} onChange={f.set('attendance_time')} />
        </div>
        <p className="small muted">Only “Present” rows are counted by the <span className="fn-tag">MEALS_ATTENDED</span> function.</p>
      </form>
    </Modal>
  )
}

export default function Attendance() {
  const { can, isStudent } = useAuth()
  const canEdit = can('admin', 'staff')
  const toast = useToast()
  const [tab, setTab] = useState('records')
  const [filters, setFilters] = useState({ student_id: '', date_from: '', date_to: '', meal_type: '', status: '' })
  const { data, loading, error, reload } = useApi('/api/attendance', filters)
  const summary = useApi('/api/attendance/summary')
  const students = useApi(canEdit ? '/api/students' : null, undefined, { skip: !canEdit })
  const menus = useApi('/api/menus')
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const setF = (k) => (v) => setFilters((s) => ({ ...s, [k]: v }))
  const reloadAll = () => { reload(); summary.reload() }

  const columns = useMemo(() => [
    { key: 'attendance_id', label: 'ID', render: (r) => <span className="mono">#{r.attendance_id}</span> },
    ...(isStudent ? [] : [{ key: 'student_name', label: 'Student', render: (r) => <span><b>{r.student_name}</b> <span className="small muted">#{r.student_id}</span></span> }]),
    { key: 'menu_date', label: 'Menu date', render: (r) => formatDate(r.menu_date) },
    { key: 'meal_type', label: 'Meal', render: (r) => <Badge>{r.meal_type}</Badge> },
    { key: 'attendance_time', label: 'Time', render: (r) => formatDateTime(r.attendance_time) },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    ...(canEdit ? [{ key: 'actions', label: '', render: (r) => (<>
      <button className="icon-btn" title="Edit" onClick={() => setForm(r)}><Pencil /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => setDel(r)}><Trash2 /></button>
    </>) }] : []),
  ], [canEdit, isStudent])

  const remove = async () => {
    setBusy(true)
    try {
      await api.del(`/api/attendance/${del.attendance_id}`)
      toast.success('Attendance record deleted.')
      reloadAll()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
      setDel(null)
    }
  }

  const s = summary.data
  const present = s?.by_meal.reduce((a, r) => a + r.present, 0) ?? 0
  const absent = s?.by_meal.reduce((a, r) => a + r.absent, 0) ?? 0

  const summaryCols = [
    { key: 'student_name', label: 'Student', render: (r) => <span><b>{r.student_name}</b> <span className="small muted">#{r.student_id}</span></span> },
    { key: 'total_records', label: 'Records', align: 'right' },
    { key: 'present', label: 'Present', align: 'right' },
    { key: 'absent', label: 'Absent', align: 'right' },
    { key: 'meals_attended', label: 'MEALS_ATTENDED()', align: 'right', render: (r) => <b>{r.meals_attended}</b> },
    { key: 'attendance_percent', label: 'Attendance %', render: (r) => (
      <div className="row" style={{ minWidth: 140 }}>
        <div className="progress" style={{ flex: 1 }}><span style={{ width: `${r.attendance_percent || 0}%`, background: r.attendance_percent < 75 ? 'var(--warning)' : undefined }} /></div>
        <span className="small" style={{ width: 42, textAlign: 'right' }}>{num(r.attendance_percent)}%</span>
      </div>
    ) },
  ]

  return (
    <div className="stack">
      <PageHeader title={isStudent ? 'My Attendance' : 'Attendance'} subtitle={isStudent ? 'Meals you attended in the mess' : 'Meal attendance of every student'}
        actions={canEdit && <button className="btn btn-primary" onClick={() => setForm({})} disabled={!students.data || !menus.data}><Plus /> Mark attendance</button>} />
      <div className="grid grid-stats">
        <StatCard icon={ClipboardCheck} label="Total records" value={num(present + absent)} loading={!s} />
        <StatCard icon={CheckCircle2} label="Present" value={num(present)} tone="success" loading={!s} />
        <StatCard icon={XCircle} label="Absent" value={num(absent)} tone="danger" loading={!s} />
        <StatCard icon={BarChart3} label="Attendance rate" value={present + absent ? `${Math.round((present / (present + absent)) * 100)}%` : '—'} tone="info" loading={!s} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'records', label: 'Records', icon: List }, { value: 'summary', label: 'Summary', icon: BarChart3 }]} />
      {tab === 'records' ? (
        <Card>
          <DataTable rows={data} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="attendance_id" exportName="attendance" noun="attendance record"
            searchPlaceholder="Search…"
            filters={<>
              {!isStudent && <FilterSelect value={filters.student_id} onChange={setF('student_id')} placeholder="All students"
                options={(students.data || []).map((x) => ({ value: x.student_id, label: x.student_name }))} />}
              <input className="input" type="date" style={{ width: 150 }} value={filters.date_from} onChange={(e) => setF('date_from')(e.target.value)} title="From" aria-label="From date" />
              <input className="input" type="date" style={{ width: 150 }} value={filters.date_to} onChange={(e) => setF('date_to')(e.target.value)} title="To" aria-label="To date" />
              <FilterSelect value={filters.meal_type} onChange={setF('meal_type')} placeholder="All meals" options={MEALS} />
              <FilterSelect value={filters.status} onChange={setF('status')} placeholder="Any status" options={['Present', 'Absent']} />
            </>} />
        </Card>
      ) : (
        <>
          <div className="grid grid-2">
            <Card title="By meal type">
              <SimpleBarChart data={s?.by_meal} xKey="meal_type" stacked bars={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#cbd5e1' }]} />
            </Card>
            <Card title="By date">
              <TrendChart data={s?.by_date} xKey="menu_date" xFormatter={(v) => formatDate(v).slice(0, 6)} areas={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#f43f5e' }]} />
            </Card>
          </div>
          <Card title={isStudent ? 'My summary' : 'Per-student summary'} subtitle="MEALS_ATTENDED is computed by the Oracle function">
            <DataTable rows={s?.by_student} loading={summary.loading} error={summary.error} columns={summaryCols} rowKey="student_id" exportName="attendance-summary" />
          </Card>
        </>
      )}
      {form && <AttendanceForm record={form} students={students.data || []} menus={menus.data || []} onClose={() => setForm(null)} onSaved={reloadAll} />}
      <ConfirmDialog open={!!del} busy={busy} title="Delete attendance record?" onCancel={() => setDel(null)} onConfirm={remove}
        message={del && <>Delete the {del.meal_type} record for <b>{del.student_name}</b> on {formatDate(del.menu_date)}?</>} />
    </div>
  )
}
