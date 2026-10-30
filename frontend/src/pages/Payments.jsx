import { useMemo, useState } from 'react'
import { Clock, CreditCard, History, IndianRupee, Plus, RefreshCcw, Users, XCircle } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Input, Select } from '../components/Form'
import { FormFooter, Modal } from '../components/Modal'
import { Alert, Badge, Card, EmptyState, Loading, PageHeader, StatCard, Tabs } from '../components/ui'
import { DonutChart, SimpleBarChart } from '../components/Charts'
import { currentMonthInput, formatDateTime, money, monthInputToLabel, num } from '../utils/format'
import { rules } from '../utils/validate'

const STATUSES = ['Paid', 'Pending', 'Failed']

function AddPayment({ students, onClose, onSaved }) {
  const toast = useToast()
  const [result, setResult] = useState(null)
  const f = useForm({ student_id: '', month: currentMonthInput(), amount: '' }, {
    student_id: [rules.required('Student')], month: [rules.required('Month')],
    amount: [rules.required('Amount'), rules.number('Amount'), rules.positive('Amount')],
  })
  const save = f.submit(async (v) => {
    const res = await api.post('/api/payments', { student_id: Number(v.student_id), payment_month: monthInputToLabel(v.month), amount: Number(v.amount) })
    toast.success(res.message, 'Payment added')
    setResult(res)
    onSaved()
  })
  return (
    <Modal open onClose={onClose} title="Add payment" subtitle="Calls the ADD_MESS_PAYMENT stored procedure"
      footer={result ? <button className="btn btn-primary" onClick={onClose}>Done</button> : <FormFooter onCancel={onClose} busy={f.busy} formId="pay-form" label="Add payment" />}>
      {result ? (
        <div className="stack">
          <Alert type="success" title={`Payment #${result.payment_id} saved`}>
            {result.student_name} · {result.payment_month} · {money(result.amount)} · status <b>{result.payment_status}</b>
          </Alert>
          <div className="highlight">
            <div className="small muted">New total for this student <span className="fn-tag">TOTAL_PAID({result.student_id})</span></div>
            <div className="big">{money(result.total_paid)}</div>
          </div>
        </div>
      ) : (
        <form id="pay-form" className="stack" onSubmit={save} noValidate>
          <FormError error={f.error} />
          <Select label="Student" required value={f.values.student_id} onChange={f.set('student_id')} error={f.errors.student_id} placeholder="Select student…"
            options={students.map((s) => ({ value: s.student_id, label: `#${s.student_id} · ${s.student_name}` }))} />
          <div className="form-grid">
            <Input label="Payment month" type="month" required value={f.values.month} onChange={f.set('month')} error={f.errors.month || f.errors.payment_month}
              hint={f.values.month ? `Saved as “${monthInputToLabel(f.values.month)}”` : undefined} />
            <Input label="Amount (₹)" type="number" min="1" step="any" required value={f.values.amount} onChange={f.set('amount')} error={f.errors.amount} placeholder="3000" />
          </div>
        </form>
      )}
    </Modal>
  )
}

function ChangeStatus({ payment, onClose, onSaved }) {
  const toast = useToast()
  const [status, setStatus] = useState(STATUSES.find((s) => s !== payment.payment_status))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.patch(`/api/payments/${payment.payment_id}/status`, { payment_status: status })
      setResult(res)
      toast.success(res.message, 'Status changed')
      onSaved()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={`Change status of payment #${payment.payment_id}`} subtitle="The UPDATE fires PAYMENT_STATUS_AUDIT_TRG"
      footer={result ? <button className="btn btn-primary" onClick={onClose}>Done</button> : (
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>Update status</button>
        </>
      )}>
      {result ? (
        <div className="stack">
          <Alert type="success">{result.message}</Alert>
          <AuditList rows={result.audit} />
        </div>
      ) : (
        <div className="stack">
          <FormError error={error} />
          <div className="highlight row" style={{ justifyContent: 'space-between' }}>
            <div><b>{payment.student_name}</b><div className="small muted">{payment.payment_month} · {money(payment.amount)}</div></div>
            <Badge>{payment.payment_status}</Badge>
          </div>
          <Select label="New status" value={status} onChange={(e) => setStatus(e.target.value)}
            options={STATUSES.map((s) => ({ value: s, label: s === payment.payment_status ? `${s} (current)` : s }))} />
        </div>
      )}
    </Modal>
  )
}

function AuditList({ rows }) {
  if (!rows?.length) return <EmptyState icon={History} title="No status changes yet" message="Change the status to see the trigger write an audit row." />
  return (
    <div className="list">
      {rows.map((a) => (
        <div className="list-item" key={a.audit_id}>
          <div className="stat-icon tone-violet" style={{ width: 34, height: 34 }}><History size={16} /></div>
          <div className="grow">
            <div className="row" style={{ gap: 6 }}><Badge>{a.old_status}</Badge> → <Badge>{a.new_status}</Badge></div>
            <div className="small muted" style={{ marginTop: 4 }}>Audit #{a.audit_id} · {formatDateTime(a.change_date)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditHistoryModal({ payment, onClose }) {
  const { data, loading } = useApi('/api/payments/audit', { payment_id: payment.payment_id })
  return (
    <Modal open onClose={onClose} title={`Audit history · payment #${payment.payment_id}`} subtitle="Rows in PAYMENT_AUDIT written by the trigger" size="sm">
      {loading && !data ? <Loading /> : <AuditList rows={data} />}
    </Modal>
  )
}

function StudentPayments({ studentId }) {
  const { data, loading, error, reload } = useApi('/api/payments')
  const total = useApi(`/api/students/${studentId}/total-paid`)
  const pending = (data || []).filter((p) => p.payment_status === 'Pending')
  const columns = [
    { key: 'payment_id', label: 'ID', render: (r) => <span className="mono">#{r.payment_id}</span> },
    { key: 'payment_month', label: 'Month', render: (r) => <b>{r.payment_month}</b> },
    { key: 'payment_date', label: 'Date', render: (r) => formatDateTime(r.payment_date) },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
    { key: 'payment_status', label: 'Status', render: (r) => <Badge>{r.payment_status}</Badge> },
  ]
  return (
    <div className="stack">
      <PageHeader title="My Payments" subtitle="Your mess fee payments" />
      <div className="grid grid-stats">
        <StatCard icon={IndianRupee} label="Total paid" value={money(total.data?.total_paid)} sub={<span className="fn-tag">TOTAL_PAID({studentId})</span>} tone="success" loading={!total.data} />
        <StatCard icon={CreditCard} label="Payments" value={num(data?.length)} loading={!data} />
        <StatCard icon={Clock} label="Pending" value={money(pending.reduce((s, p) => s + Number(p.amount), 0))} sub={`${pending.length} payment(s)`} tone="warning" loading={!data} />
      </div>
      <Card>
        <DataTable rows={data} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="payment_id" exportName="my-payments" noun="payment" searchable={false}
          emptyMessage="No payments have been recorded for you yet. Payments are added by the mess admin." />
      </Card>
    </div>
  )
}

export default function Payments() {
  const { user, isStudent } = useAuth()
  if (isStudent) return <StudentPayments studentId={user.student_id} />
  return <AdminPayments />
}

function AdminPayments() {
  const [tab, setTab] = useState('payments')
  const [filters, setFilters] = useState({ status: '', month: '', student_id: '' })
  const { data, loading, error, reload } = useApi('/api/payments', filters)
  const summary = useApi('/api/payments/summary')
  const audit = useApi('/api/payments/audit')
  const totals = useApi('/api/reports/payment-summary')
  const students = useApi('/api/students')
  const [adding, setAdding] = useState(false)
  const [changing, setChanging] = useState(null)
  const [history, setHistory] = useState(null)
  const setF = (k) => (v) => setFilters((s) => ({ ...s, [k]: v }))
  const reloadAll = () => { reload(); summary.reload(); audit.reload(); totals.reload() }

  const byStatus = Object.fromEntries((summary.data?.by_status || []).map((r) => [r.status, r]))

  const columns = useMemo(() => [
    { key: 'payment_id', label: 'ID', render: (r) => <span className="mono">#{r.payment_id}</span> },
    { key: 'student_name', label: 'Student', render: (r) => <span><b>{r.student_name}</b> <span className="small muted">#{r.student_id}</span></span> },
    { key: 'payment_month', label: 'Month' },
    { key: 'payment_date', label: 'Paid on', render: (r) => formatDateTime(r.payment_date) },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => <b>{money(r.amount)}</b> },
    { key: 'payment_status', label: 'Status', render: (r) => <Badge>{r.payment_status}</Badge> },
    { key: 'actions', label: '', render: (r) => (<>
      <button className="btn btn-ghost btn-sm" onClick={() => setChanging(r)} title="Change status"><RefreshCcw /> Status</button>
      <button className="icon-btn" onClick={() => setHistory(r)} title="Audit history"><History /></button>
    </>) },
  ], [])

  const auditCols = [
    { key: 'audit_id', label: 'Audit ID', render: (r) => <span className="mono">#{r.audit_id}</span> },
    { key: 'payment_id', label: 'Payment', render: (r) => <span className="mono">#{r.payment_id}</span> },
    { key: 'student_name', label: 'Student' },
    { key: 'payment_month', label: 'Month' },
    { key: 'old_status', label: 'Old status', render: (r) => <Badge>{r.old_status}</Badge> },
    { key: 'new_status', label: 'New status', render: (r) => <Badge>{r.new_status}</Badge> },
    { key: 'change_date', label: 'Changed at', render: (r) => formatDateTime(r.change_date) },
  ]

  const totalCols = [
    { key: 'student_id', label: 'ID', render: (r) => <span className="mono">#{r.student_id}</span> },
    { key: 'student_name', label: 'Student', render: (r) => <b>{r.student_name}</b> },
    { key: 'hostel_name', label: 'Hostel' },
    { key: 'payments', label: 'Payments', align: 'right' },
    { key: 'total_paid', label: 'TOTAL_PAID()', align: 'right', render: (r) => <b>{money(r.total_paid)}</b> },
    { key: 'pending_amount', label: 'Pending', align: 'right', render: (r) => (Number(r.pending_amount) ? <span style={{ color: 'var(--warning-700, #b45309)' }}>{money(r.pending_amount)}</span> : '—') },
  ]

  return (
    <div className="stack">
      <PageHeader title="Payments" subtitle="Mess fees — added through ADD_MESS_PAYMENT, every status change audited by a trigger"
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)} disabled={!students.data}><Plus /> Add payment</button>} />
      <div className="grid grid-stats">
        <StatCard icon={IndianRupee} label="Collected" value={money(byStatus.Paid?.amount)} sub={`${num(byStatus.Paid?.count || 0)} paid`} tone="success" loading={!summary.data} />
        <StatCard icon={Clock} label="Pending" value={money(byStatus.Pending?.amount)} sub={`${num(byStatus.Pending?.count || 0)} payments`} tone="warning" loading={!summary.data} />
        <StatCard icon={XCircle} label="Failed" value={money(byStatus.Failed?.amount)} sub={`${num(byStatus.Failed?.count || 0)} payments`} tone="danger" loading={!summary.data} />
        <StatCard icon={History} label="Audit entries" value={num(audit.data?.length)} sub="PAYMENT_AUDIT rows" tone="violet" loading={!audit.data} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'payments', label: 'Payments', icon: CreditCard },
        { value: 'audit', label: 'Audit trail', icon: History },
        { value: 'totals', label: 'Student totals', icon: Users },
      ]} />
      {tab === 'payments' && (
        <>
          <Card>
            <DataTable rows={data} loading={loading} error={error} onRetry={reload} columns={columns} rowKey="payment_id" exportName="payments" noun="payment"
              searchPlaceholder="Search student, month…"
              filters={<>
                <FilterSelect value={filters.status} onChange={setF('status')} placeholder="Any status" options={STATUSES} />
                <FilterSelect value={filters.month} onChange={setF('month')} placeholder="All months" options={summary.data?.months || []} />
                <FilterSelect value={filters.student_id} onChange={setF('student_id')} placeholder="All students"
                  options={(students.data || []).map((s) => ({ value: s.student_id, label: s.student_name }))} />
              </>} />
          </Card>
          <div className="grid grid-2">
            <Card title="By status"><DonutChart data={summary.data?.by_status} nameKey="status" valueKey="amount" /></Card>
            <Card title="By month" subtitle="Paid vs pending amount">
              <SimpleBarChart data={summary.data?.by_month} xKey="payment_month" stacked formatter={(v) => money(v)}
                bars={[{ key: 'paid_amount', label: 'Paid', color: '#10b981' }, { key: 'pending_amount', label: 'Pending', color: '#f59e0b' }, { key: 'failed_amount', label: 'Failed', color: '#ef4444' }]} />
            </Card>
          </div>
        </>
      )}
      {tab === 'audit' && (
        <Card title="PAYMENT_AUDIT" subtitle="Written automatically by PAYMENT_STATUS_AUDIT_TRG whenever PAYMENT_STATUS changes">
          <DataTable rows={audit.data} loading={audit.loading} error={audit.error} onRetry={audit.reload} columns={auditCols} rowKey="audit_id" exportName="payment-audit"
            emptyTitle="No audit rows yet" emptyMessage="Change a payment's status on the Payments tab and the trigger will add a row here." />
        </Card>
      )}
      {tab === 'totals' && (
        <Card title="Total paid per student" subtitle="Each total is calculated by the TOTAL_PAID function">
          <DataTable rows={totals.data?.by_student} loading={totals.loading} error={totals.error} onRetry={totals.reload} columns={totalCols} rowKey="student_id" exportName="student-totals" />
        </Card>
      )}
      {adding && <AddPayment students={students.data || []} onClose={() => setAdding(false)} onSaved={reloadAll} />}
      {changing && <ChangeStatus payment={changing} onClose={() => setChanging(null)} onSaved={reloadAll} />}
      {history && <AuditHistoryModal payment={history} onClose={() => setHistory(null)} />}
    </div>
  )
}
