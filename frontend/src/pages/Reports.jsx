import { useState } from 'react'
import { AlertTriangle, BookOpen, ClipboardCheck, CreditCard, MessageSquareWarning, Printer, Trash2 } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/DataTable'
import { FilterSelect } from '../components/Form'
import { Badge, Card, ErrorState, Loading, PageHeader, Progress, Tabs } from '../components/ui'
import { DonutChart, SimpleBarChart } from '../components/Charts'
import { formatDate, formatDateTime, money, num, weekday } from '../utils/format'

const REPORTS = [
  { value: 'attendance', label: 'Student attendance', icon: ClipboardCheck, roles: ['admin'] },
  { value: 'payments', label: 'Payment summary', icon: CreditCard, roles: ['admin'] },
  { value: 'pending', label: 'Pending payments', icon: AlertTriangle, roles: ['admin'] },
  { value: 'complaints', label: 'Complaint status', icon: MessageSquareWarning, roles: ['admin'] },
  { value: 'wastage', label: 'Food wastage', icon: Trash2, roles: ['admin', 'staff'] },
  { value: 'menus', label: 'Menu-wise food', icon: BookOpen, roles: ['admin', 'staff'] },
]

const idCol = (key, label = 'ID') => ({ key, label, render: (r) => <span className="mono">#{r[key]}</span> })

function Wrap({ q, children }) {
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />
  if (!q.data) return <Loading />
  return children(q.data)
}

function AttendanceReport() {
  const q = useApi('/api/reports/student-attendance')
  return <Wrap q={q}>{(d) => (
    <div className="stack">
      <Card title="Student-wise attendance" subtitle="meals_attended is computed by MEALS_ATTENDED(student_id)">
        <DataTable rows={d.by_student} rowKey="student_id" exportName="report-student-attendance" pageSize={25} columns={[
          idCol('student_id'), { key: 'student_name', label: 'Student', render: (r) => <b>{r.student_name}</b>, csv: (r) => r.student_name },
          { key: 'total_records', label: 'Records', align: 'right' }, { key: 'present', label: 'Present', align: 'right' }, { key: 'absent', label: 'Absent', align: 'right' },
          { key: 'meals_attended', label: 'MEALS_ATTENDED()', align: 'right' },
          { key: 'attendance_percent', label: 'Attendance %', align: 'right', render: (r) => `${num(r.attendance_percent)}%` },
        ]} />
      </Card>
      <Card title="Attendance by meal">
        <SimpleBarChart data={d.by_meal} xKey="meal_type" stacked bars={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#cbd5e1' }]} />
      </Card>
    </div>
  )}</Wrap>
}

function PaymentReport() {
  const q = useApi('/api/reports/payment-summary')
  return <Wrap q={q}>{(d) => (
    <div className="stack">
      <div className="grid grid-2">
        <Card title="Amount by status"><DonutChart data={d.by_status} nameKey="status" valueKey="amount" /></Card>
        <Card title="By month">
          <DataTable rows={d.by_month} rowKey="payment_month" exportName="report-payments-by-month" searchable={false} columns={[
            { key: 'payment_month', label: 'Month', render: (r) => <b>{r.payment_month}</b>, csv: (r) => r.payment_month },
            { key: 'payments', label: 'Payments', align: 'right' },
            { key: 'paid_amount', label: 'Paid', align: 'right', render: (r) => money(r.paid_amount) },
            { key: 'pending_amount', label: 'Pending', align: 'right', render: (r) => money(r.pending_amount) },
            { key: 'failed_amount', label: 'Failed', align: 'right', render: (r) => money(r.failed_amount) },
          ]} />
        </Card>
      </div>
      <Card title="Total paid per student" subtitle="Uses the TOTAL_PAID function">
        <DataTable rows={d.by_student} rowKey="student_id" exportName="report-total-paid" pageSize={25} columns={[
          idCol('student_id'), { key: 'student_name', label: 'Student' }, { key: 'hostel_name', label: 'Hostel' },
          { key: 'payments', label: 'Payments', align: 'right' },
          { key: 'total_paid', label: 'TOTAL_PAID()', align: 'right', render: (r) => <b>{money(r.total_paid)}</b> },
          { key: 'pending_amount', label: 'Pending', align: 'right', render: (r) => money(r.pending_amount) },
        ]} />
      </Card>
    </div>
  )}</Wrap>
}

function PendingReport() {
  const [month, setMonth] = useState('')
  const q = useApi('/api/reports/pending-payments', { month })
  return <Wrap q={q}>{(d) => (
    <div className="stack">
      <Card title="Pending & failed payments" subtitle="Students who still owe money">
        <DataTable rows={[...d.pending, ...d.failed]} rowKey="payment_id" exportName="report-pending-payments" columns={[
          idCol('payment_id'), { key: 'student_name', label: 'Student', render: (r) => <b>{r.student_name}</b>, csv: (r) => r.student_name },
          { key: 'payment_month', label: 'Month' }, { key: 'payment_date', label: 'Date', render: (r) => formatDateTime(r.payment_date) },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
          { key: 'payment_status', label: 'Status', render: (r) => <Badge>{r.payment_status}</Badge> },
        ]} emptyTitle="No pending payments" emptyMessage="Everyone is paid up." />
      </Card>
      <Card title={`Students with no payment for ${d.month || 'the month'}`} subtitle="Found with a NOT EXISTS subquery on PAYMENT"
        actions={<FilterSelect value={month || d.month || ''} onChange={setMonth} placeholder="Latest month" options={d.months} label="Month" />}>
        <DataTable rows={d.students_without_payment} rowKey="student_id" exportName="report-students-without-payment" columns={[
          idCol('student_id'), { key: 'student_name', label: 'Student' }, { key: 'hostel_name', label: 'Hostel' }, { key: 'room_no', label: 'Room' },
        ]} emptyTitle="Every student has a payment for this month" />
      </Card>
    </div>
  )}</Wrap>
}

function ComplaintReport() {
  const q = useApi('/api/reports/complaint-status')
  return <Wrap q={q}>{(d) => (
    <div className="stack">
      <div className="grid grid-3">
        <Card title="By status"><DonutChart data={d.by_status} nameKey="status" valueKey="count" height={220} /></Card>
        <Card title="By severity"><DonutChart data={d.by_severity} nameKey="severity" valueKey="count" height={220} /></Card>
        <Card title="By type"><SimpleBarChart data={d.by_type} xKey="complaint_type" layout="vertical" height={220} bars={[{ key: 'count', label: 'Complaints', colorBy: true }]} /></Card>
      </div>
      <Card title="Unresolved complaints">
        <DataTable rows={d.unresolved} rowKey="complaint_id" exportName="report-unresolved-complaints" columns={[
          idCol('complaint_id'), { key: 'student_name', label: 'Student' }, { key: 'complaint_type', label: 'Type' },
          { key: 'description', label: 'Description', render: (r) => <span className="small">{r.description}</span>, csv: (r) => r.description },
          { key: 'complaint_date', label: 'Date', render: (r) => formatDate(r.complaint_date) },
          { key: 'severity', label: 'Severity', render: (r) => <Badge plain>{r.severity}</Badge> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]} emptyTitle="All complaints are resolved" />
      </Card>
    </div>
  )}</Wrap>
}

function WastageReport() {
  const q = useApi('/api/reports/food-wastage')
  return <Wrap q={q}>{(d) => (
    <div className="stack">
      <div className="grid grid-2">
        <Card title={`Wastage by food · total ${num(d.total_wasted)} units`}>
          <SimpleBarChart data={d.by_food} xKey="food_name" layout="vertical" height={300} bars={[{ key: 'total_wasted', label: 'Wasted', colorBy: true }]} />
        </Card>
        <Card title="By meal type"><DonutChart data={d.by_meal} nameKey="meal_type" valueKey="total_wasted" height={300} colors={{}} /></Card>
      </div>
      <Card title="Wastage vs planned quantity" subtitle="Per menu item">
        <DataTable rows={d.vs_planned} rowKey="menu_item_id" exportName="report-wastage-vs-planned" initialSort={{ key: 'wasted_percent', dir: 'desc' }} columns={[
          idCol('menu_item_id', 'Item'), { key: 'food_name', label: 'Food', render: (r) => <b>{r.food_name}</b>, csv: (r) => r.food_name },
          { key: 'meal_type', label: 'Meal' }, { key: 'menu_id', label: 'Menu', render: (r) => `#${r.menu_id}` },
          { key: 'quantity_planned', label: 'Planned', align: 'right', render: (r) => num(r.quantity_planned) },
          { key: 'total_wasted', label: 'Wasted', align: 'right', render: (r) => num(r.total_wasted) },
          { key: 'wasted_percent', label: '% wasted', render: (r) => <div className="row" style={{ minWidth: 120 }}><div style={{ flex: 1 }}><Progress value={r.wasted_percent} /></div><span className="small">{num(r.wasted_percent)}%</span></div> },
        ]} />
      </Card>
    </div>
  )}</Wrap>
}

function MenuReport() {
  const q = useApi('/api/reports/menu-food')
  return <Wrap q={q}>{(d) => (
    <Card title="Menu-wise food information" subtitle="MENU joined with MENU_ITEM and FOOD_ITEM">
      <DataTable rows={d} rowKey="menu_id" exportName="report-menu-food" pageSize={25} columns={[
        idCol('menu_id', 'Menu'),
        { key: 'menu_date', label: 'Date', render: (r) => <span>{formatDate(r.menu_date)} <span className="small muted">{weekday(r.menu_date)}</span></span>, csv: (r) => r.menu_date },
        { key: 'meal_types', label: 'Meals', sortable: false, render: (r) => <span className="row wrap" style={{ gap: 4 }}>{r.meal_types.map((m) => <Badge key={m}>{m}</Badge>)}</span>, csv: (r) => r.meal_types.join(' / ') },
        { key: 'items', label: 'Food items', sortable: false, searchValue: (r) => r.items.map((i) => i.food_name).join(' '),
          render: (r) => <span className="small">{r.items.length ? r.items.map((i) => `${i.food_name} (${num(i.quantity_planned)})`).join(', ') : '—'}</span>,
          csv: (r) => r.items.map((i) => `${i.meal_type}: ${i.food_name} x${i.quantity_planned}`).join('; ') },
        { key: 'item_count', label: 'Items', align: 'right' },
        { key: 'total_planned', label: 'Planned qty', align: 'right', render: (r) => num(r.total_planned) },
        { key: 'total_calories', label: 'Calories', align: 'right', render: (r) => num(r.total_calories) },
      ]} />
    </Card>
  )}</Wrap>
}

const VIEWS = { attendance: AttendanceReport, payments: PaymentReport, pending: PendingReport, complaints: ComplaintReport, wastage: WastageReport, menus: MenuReport }

export default function Reports() {
  const { user } = useAuth()
  const tabs = REPORTS.filter((r) => r.roles.includes(user.role))
  const [tab, setTab] = useState(tabs[0].value)
  const View = VIEWS[tab]
  const current = tabs.find((t) => t.value === tab)
  return (
    <div className="stack">
      <PageHeader title="Reports" subtitle={`${current.label} · generated ${formatDateTime(new Date().toISOString())}`}
        actions={<button className="btn btn-secondary no-print" onClick={() => window.print()}><Printer /> Print</button>} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <View key={tab} />
      {user.role === 'staff' && <p className="small muted">Staff can view wastage and menu reports. Financial and student reports are admin-only.</p>}
    </div>
  )
}
