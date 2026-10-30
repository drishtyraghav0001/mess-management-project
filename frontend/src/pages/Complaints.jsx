import { useMemo, useState } from 'react'
import { CheckCircle2, CircleDot, Eye, Loader, MessageSquarePlus, MessageSquareWarning, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Select, Textarea, Input } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, KeyValue, PageHeader, StatCard } from '../components/ui'
import { DonutChart } from '../components/Charts'
import { formatDate, num } from '../utils/format'
import { rules } from '../utils/validate'

const TYPES = ['Food Quality', 'Hygiene', 'Cleanliness', 'Quantity', 'Taste', 'Service', 'Timing', 'Other']
const SEVERITIES = ['Low', 'Medium', 'High']

function ComplaintForm({ isStudent, students, menus, onClose, onSaved }) {
  const toast = useToast()
  const f = useForm({ student_id: '', menu_id: '', complaint_type: 'Food Quality', description: '', severity: 'Medium' }, {
    ...(isStudent ? {} : { student_id: [rules.required('Student')] }),
    complaint_type: [rules.required('Type'), rules.minLen(2, 'Type'), rules.maxLen(30, 'Type')],
    description: [rules.required('Description'), rules.minLen(5, 'Description'), rules.maxLen(200, 'Description')],
  })
  const save = f.submit(async (v) => {
    const body = { complaint_type: v.complaint_type.trim(), description: v.description.trim(), severity: v.severity }
    if (v.menu_id) body.menu_id = Number(v.menu_id)
    if (!isStudent) body.student_id = Number(v.student_id)
    const r = await api.post('/api/complaints', body)
    toast.success(`Complaint #${r.complaint_id} submitted. Status: ${r.status}.`)
    onSaved()
    onClose()
  })
  return (
    <Modal open onClose={onClose} title={isStudent ? 'Raise a complaint' : 'Log a complaint'} subtitle="Saved in COMPLAINT with status Open"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="cmp-form" label="Submit complaint" />}>
      <form id="cmp-form" className="stack" onSubmit={save} noValidate>
        <FormError error={f.error} />
        <div className="form-grid">
          {!isStudent && (
            <Select label="Student" required full value={f.values.student_id} onChange={f.set('student_id')} error={f.errors.student_id} placeholder="Select student…"
              options={students.map((s) => ({ value: s.student_id, label: `#${s.student_id} · ${s.student_name}` }))} />
          )}
          <Select label="Related menu" value={f.values.menu_id} onChange={f.set('menu_id')} placeholder="Not about a specific menu"
            options={menus.map((m) => ({ value: m.menu_id, label: `#${m.menu_id} · ${formatDate(m.menu_date)}` }))} />
          <Select label="Severity" value={f.values.severity} onChange={f.set('severity')} options={SEVERITIES} />
          <Input label="Complaint type" required full list="cmp-types" value={f.values.complaint_type} onChange={f.set('complaint_type')} error={f.errors.complaint_type} maxLength={30} />
          <datalist id="cmp-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          <Textarea label="Description" required full rows={4} maxLength={200} value={f.values.description} onChange={f.set('description')} error={f.errors.description}
            hint={`${f.values.description.length}/200 characters`} placeholder="What went wrong?" />
        </div>
      </form>
    </Modal>
  )
}

export default function Complaints() {
  const { isAdmin, isStudent } = useAuth()
  const toast = useToast()
  const [filters, setFilters] = useState({ severity: '', status: '', complaint_type: '' })
  const { data, loading, error, reload } = useApi('/api/complaints', filters)
  const summary = useApi('/api/complaints/summary')
  const students = useApi(isStudent ? null : '/api/students', undefined, { skip: isStudent })
  const menus = useApi('/api/menus')
  const [form, setForm] = useState(false)
  const [view, setView] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const setF = (k) => (v) => setFilters((s) => ({ ...s, [k]: v }))
  const reloadAll = () => { reload(); summary.reload() }

  const act = async () => {
    setBusy(true)
    const { type, row } = confirm
    try {
      if (type === 'resolve') {
        const r = await api.post(`/api/complaints/${row.complaint_id}/resolve`)
        toast.success(r.message, 'Resolved')
      } else if (type === 'delete') {
        await api.del(`/api/complaints/${row.complaint_id}`)
        toast.success(`Complaint #${row.complaint_id} deleted.`)
      } else {
        await api.patch(`/api/complaints/${row.complaint_id}/status`, { status: type })
        toast.success(`Complaint #${row.complaint_id} marked ${type}.`)
      }
      reloadAll()
      setView(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const columns = useMemo(() => [
    { key: 'complaint_id', label: 'ID', render: (r) => <span className="mono">#{r.complaint_id}</span> },
    ...(isStudent ? [] : [{ key: 'student_name', label: 'Student', render: (r) => <b>{r.student_name}</b> }]),
    { key: 'complaint_type', label: 'Type' },
    { key: 'description', label: 'Description', render: (r) => <span className="small" style={{ display: 'block', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.description}>{r.description}</span> },
    { key: 'complaint_date', label: 'Date', render: (r) => formatDate(r.complaint_date) },
    { key: 'severity', label: 'Severity', sortValue: (r) => SEVERITIES.indexOf(r.severity), render: (r) => <Badge plain>{r.severity}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r) => (<>
      <button className="icon-btn" title="View" onClick={() => setView(r)}><Eye /></button>
      {isAdmin && r.status !== 'Resolved' && (
        <button className="btn btn-success btn-sm" onClick={() => setConfirm({ type: 'resolve', row: r })} title="Resolve with RESOLVE_COMPLAINT"><CheckCircle2 /> Resolve</button>
      )}
      {isAdmin && <button className="icon-btn danger" title="Delete" onClick={() => setConfirm({ type: 'delete', row: r })}><Trash2 /></button>}
    </>) },
  ], [isAdmin, isStudent])

  const s = summary.data
  const count = (list, key, val) => list?.find((x) => x[key] === val)?.count || 0

  return (
    <div className="stack">
      <PageHeader title={isStudent ? 'My Complaints' : 'Complaints'} subtitle={isStudent ? 'Tell the mess what went wrong' : 'Feedback from students about food and service'}
        actions={<button className="btn btn-primary" onClick={() => setForm(true)}><MessageSquarePlus /> {isStudent ? 'Raise complaint' : 'Log complaint'}</button>} />
      <div className="grid grid-stats">
        <StatCard icon={MessageSquareWarning} label="Total" value={num(s?.by_status.reduce((a, x) => a + x.count, 0))} loading={!s} />
        <StatCard icon={CircleDot} label="Open" value={num(count(s?.by_status, 'status', 'Open'))} tone="danger" loading={!s} />
        <StatCard icon={Loader} label="In progress" value={num(count(s?.by_status, 'status', 'In Progress'))} tone="warning" loading={!s} />
        <StatCard icon={CheckCircle2} label="Resolved" value={num(count(s?.by_status, 'status', 'Resolved'))} tone="success" loading={!s} />
      </div>
      <Card>
        <DataTable rows={data} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="complaint_id" exportName="complaints" noun="complaint"
          searchPlaceholder="Search description, student…" onRowClick={setView}
          filters={<>
            <FilterSelect value={filters.status} onChange={setF('status')} placeholder="Any status" options={['Open', 'In Progress', 'Resolved']} />
            <FilterSelect value={filters.severity} onChange={setF('severity')} placeholder="Any severity" options={SEVERITIES} />
            <FilterSelect value={filters.complaint_type} onChange={setF('complaint_type')} placeholder="All types" options={(s?.by_type || []).map((t) => t.complaint_type)} />
          </>}
          emptyMessage={isStudent ? 'You have not raised any complaints. Great!' : undefined} />
      </Card>
      {!isStudent && s && (
        <div className="grid grid-2">
          <Card title="By severity"><DonutChart data={s.by_severity} nameKey="severity" valueKey="count" /></Card>
          <Card title="By type"><DonutChart data={s.by_type} nameKey="complaint_type" valueKey="count" colors={{}} /></Card>
        </div>
      )}
      {form && <ComplaintForm isStudent={isStudent} students={students.data || []} menus={menus.data || []} onClose={() => setForm(false)} onSaved={reloadAll} />}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Complaint #${view.complaint_id}` : ''}
        footer={view && isAdmin && view.status !== 'Resolved' && (
          <>
            {view.status !== 'In Progress' && <button className="btn btn-secondary" onClick={() => setConfirm({ type: 'In Progress', row: view })}>Mark in progress</button>}
            {view.status !== 'Open' && <button className="btn btn-secondary" onClick={() => setConfirm({ type: 'Open', row: view })}>Re-open</button>}
            <button className="btn btn-success" onClick={() => setConfirm({ type: 'resolve', row: view })}><CheckCircle2 /> Resolve</button>
          </>
        )}>
        {view && (
          <KeyValue items={[
            ['Student', `${view.student_name} (#${view.student_id})`], ['Type', view.complaint_type], ['Description', view.description],
            ['Menu', view.menu_id ? `#${view.menu_id} · ${formatDate(view.menu_date)}` : null], ['Date', formatDate(view.complaint_date)],
            ['Severity', <Badge plain key="s">{view.severity}</Badge>], ['Status', <Badge key="st">{view.status}</Badge>],
          ]} />
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={act}
        tone={confirm?.type === 'delete' ? 'danger' : confirm?.type === 'resolve' ? 'success' : 'primary'}
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : confirm?.type === 'resolve' ? 'Resolve' : 'Update'}
        title={confirm?.type === 'delete' ? 'Delete complaint?' : confirm?.type === 'resolve' ? 'Resolve complaint?' : `Mark as ${confirm?.type}?`}
        message={confirm && (confirm.type === 'resolve'
          ? <>This calls <span className="fn-tag">RESOLVE_COMPLAINT({confirm.row.complaint_id})</span> which sets the status to Resolved.</>
          : confirm.type === 'delete' ? <>Permanently delete complaint #{confirm.row.complaint_id}?</>
          : <>Change complaint #{confirm.row.complaint_id} to “{confirm.type}”.</>)} />
    </div>
  )
}
