import { Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Clock, CreditCard, IndianRupee, MessageSquareWarning, RefreshCw, Salad, Trash2, Users,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, StatCard } from '../components/ui'
import { DonutChart, SimpleBarChart, TrendChart } from '../components/Charts'
import { formatDate, money, num } from '../utils/format'

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi('/api/dashboard')
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Loading />
  const c = data.cards
  const ch = data.charts
  const admin = user.role === 'admin'
  const attTotal = (c.attendance_present || 0) + (c.attendance_absent || 0)

  return (
    <div className="stack">
      <PageHeader
        title={`Hello, ${user.username} 👋`}
        subtitle={`Here's what's happening in the mess today · ${formatDate(new Date().toISOString().slice(0, 10))}`}
        actions={<button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}><RefreshCw /> Refresh</button>}
      />
      <div className="grid grid-stats">
        <StatCard icon={Users} label="Total students" value={num(c.total_students)} sub={`${num(c.active_students)} active`} />
        <StatCard icon={CalendarDays} label="Menus planned" value={num(c.total_menus)} tone="violet" />
        <StatCard icon={Salad} label="Food items" value={num(c.total_food_items)} sub={`${num(c.available_food_items)} available`} tone="success" />
        <StatCard icon={ClipboardCheck} label="Meals attended" value={num(c.attendance_present)}
          sub={attTotal ? `${Math.round((c.attendance_present / attTotal) * 100)}% of ${attTotal} records` : 'No records'} tone="info" />
        {admin && (
          <>
            <StatCard icon={IndianRupee} label="Collected (Paid)" value={money(c.paid_amount)} sub={`${num(c.paid_payments)} payments`} tone="success" />
            <StatCard icon={Clock} label="Pending payments" value={num(c.pending_payments)} sub={money(c.pending_amount) + ' due'} tone="warning" />
          </>
        )}
        <StatCard icon={MessageSquareWarning} label="Open complaints" value={num(c.open_complaints)} sub={`${num(c.resolved_complaints)} resolved of ${num(c.total_complaints)}`} tone="danger" />
        <StatCard icon={Trash2} label="Food wasted" value={`${num(c.total_wastage)} units`} sub={`${num(c.wastage_entries)} entries`} tone="warning" />
      </div>

      <div className="grid grid-2">
        <Card title="Attendance trend" subtitle="Present vs absent by menu date">
          <TrendChart data={ch.attendance_by_date} xKey="menu_date" xFormatter={(v) => formatDate(v).slice(0, 6)}
            areas={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#f43f5e' }]} />
        </Card>
        {admin && ch.payment_status ? (
          <Card title="Payment status" subtitle="Number of PAYMENT rows by status">
            <DonutChart data={ch.payment_status} nameKey="status" valueKey="count" />
          </Card>
        ) : (
          <Card title="Attendance by meal" subtitle="Present vs absent per meal type">
            <SimpleBarChart data={ch.attendance_by_meal} xKey="meal_type" stacked
              bars={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#cbd5e1' }]} />
          </Card>
        )}
      </div>

      <div className="grid grid-3">
        <Card title="Top wasted foods" subtitle="Total quantity wasted">
          <SimpleBarChart data={ch.wastage_by_food.slice(0, 6)} xKey="food_name" layout="vertical" bars={[{ key: 'total_wasted', label: 'Wasted', colorBy: true }]} />
        </Card>
        <Card title="Complaints by severity">
          <DonutChart data={ch.complaints_by_severity} nameKey="severity" valueKey="count" />
        </Card>
        {admin ? (
          <Card title="Attendance by meal">
            <SimpleBarChart data={ch.attendance_by_meal} xKey="meal_type" stacked
              bars={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#cbd5e1' }]} />
          </Card>
        ) : (
          <Card title="Complaints by status">
            <DonutChart data={ch.complaints_by_status} nameKey="status" valueKey="count" />
          </Card>
        )}
      </div>

      <div className="grid grid-2">
        {admin && data.recent_payments && (
          <Card title="Recent payments" actions={<Link to="/payments" className="btn btn-ghost btn-sm">View all</Link>}>
            {data.recent_payments.length ? (
              <div className="list">
                {data.recent_payments.map((p) => (
                  <div className="list-item" key={p.payment_id}>
                    <div className="stat-icon tone-success" style={{ width: 36, height: 36 }}><CreditCard size={17} /></div>
                    <div className="grow">
                      <b>{p.student_name}</b>
                      <div className="small muted">{p.payment_month} · {formatDate(p.payment_date)}</div>
                    </div>
                    <div className="right">
                      <b>{money(p.amount)}</b>
                      <div><Badge>{p.payment_status}</Badge></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No payments yet" />}
          </Card>
        )}
        <Card title="Recent complaints" actions={<Link to="/complaints" className="btn btn-ghost btn-sm">View all</Link>} className={admin ? '' : 'span-2'}>
          {data.recent_complaints.length ? (
            <div className="list">
              {data.recent_complaints.map((cp) => (
                <div className="list-item" key={cp.complaint_id}>
                  <div className={`stat-icon tone-${cp.status === 'Resolved' ? 'success' : 'danger'}`} style={{ width: 36, height: 36 }}>
                    {cp.status === 'Resolved' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{cp.complaint_type}</b> <span className="small muted">by {cp.student_name}</span>
                    <div className="small muted">{cp.description}</div>
                  </div>
                  <div className="right stack-sm" style={{ alignItems: 'flex-end' }}>
                    <Badge>{cp.status}</Badge>
                    <Badge plain>{cp.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No complaints" message="Nobody has complained. Nice!" />}
        </Card>
      </div>
    </div>
  )
}
