import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, Clock, IndianRupee, MessageSquareWarning, Plus } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { Badge, Card, EmptyState, ErrorState, KeyValue, Loading, PageHeader, StatCard } from '../components/ui'
import { SimpleBarChart } from '../components/Charts'
import FoodPhoto from '../components/FoodPhoto'
import { mealMeta } from '../utils/foodImages'
import { formatDate, formatDateTime, money, num, weekday } from '../utils/format'

export default function StudentDashboard() {
  const { data, error, reload } = useApi('/api/dashboard/me')
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Loading />
  const { student: s, cards: c } = data

  return (
    <div className="stack">
      <PageHeader title={`Hi, ${s.student_name.split(' ')[0]} 👋`} subtitle={`Room ${s.room_no || '—'} · ${s.hostel_name || 'Hostel'}`}
        actions={<Link to="/complaints" className="btn btn-primary btn-sm"><Plus /> Raise complaint</Link>} />
      <div className="grid grid-stats">
        <StatCard icon={IndianRupee} label="Total paid" value={money(c.total_paid)} sub={<span>from <span className="fn-tag">TOTAL_PAID()</span></span>} tone="success" />
        <StatCard icon={ClipboardCheck} label="Meals attended" value={num(c.meals_attended)} sub={<span>from <span className="fn-tag">MEALS_ATTENDED()</span></span>} tone="primary" />
        <StatCard icon={Clock} label="Pending dues" value={money(c.pending_amount)} sub={`${num(c.pending_payments)} pending payment(s)`} tone="warning" />
        <StatCard icon={MessageSquareWarning} label="Open complaints" value={num(c.open_complaints)} sub={`${num(c.total_complaints)} raised in total`} tone="danger" />
      </div>
      <div className="grid grid-3">
        <Card title="My profile">
          <KeyValue items={[
            ['Student ID', s.student_id], ['Name', s.student_name], ['Room', s.room_no], ['Hostel', s.hostel_name],
            ['Phone', s.phone], ['Email', s.email], ['Status', s.status ? <Badge>{s.status}</Badge> : null],
          ]} />
        </Card>
        <Card title="Attendance by meal" className="span-2">
          <SimpleBarChart data={data.attendance_by_meal} xKey="meal_type" stacked
            bars={[{ key: 'present', label: 'Present', color: '#4f46e5' }, { key: 'absent', label: 'Absent', color: '#cbd5e1' }]} />
        </Card>
      </div>
      <div className="grid grid-2">
        <Card title="Latest menus" actions={<Link to="/menus" className="btn btn-ghost btn-sm">Full menu</Link>}>
          {data.latest_menus.length ? (
            <div className="list">
              {data.latest_menus.map((m) => (
                <div className="list-item" key={m.menu_id}>
                  <div className="stat-icon tone-violet" style={{ width: 36, height: 36 }}><CalendarDays size={17} /></div>
                  <div className="grow">
                    <b>{formatDate(m.menu_date)}</b> <span className="small muted">{weekday(m.menu_date)}</span>
                    {m.items.length ? (
                      <div className="mini-foods">
                        {m.items.map((i, n) => (
                          <span className="mini-food" key={i.menu_item_id ?? n} title={`${i.meal_type}: ${i.food_name}`}>
                            <FoodPhoto name={i.food_name} category={i.category || i.meal_type} size={28} rounded />
                            <span><b>{i.food_name}</b><small style={{ color: mealMeta(i.meal_type).color }}>{i.meal_type}</small></span>
                          </span>
                        ))}
                      </div>
                    ) : <div className="small muted">No items planned yet</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No menus yet" />}
        </Card>
        <Card title="Recent attendance" actions={<Link to="/attendance" className="btn btn-ghost btn-sm">View all</Link>}>
          {data.recent_attendance.length ? (
            <div className="list">
              {data.recent_attendance.map((a) => (
                <div className="list-item" key={a.attendance_id}>
                  <div className="grow">
                    <b>{a.meal_type}</b> <span className="small muted">· {formatDate(a.menu_date)}</span>
                    <div className="small muted">{formatDateTime(a.attendance_time)}</div>
                  </div>
                  <Badge>{a.status}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No attendance records yet" />}
        </Card>
      </div>
      <div className="grid grid-2">
        <Card title="My payments" actions={<Link to="/payments" className="btn btn-ghost btn-sm">View all</Link>}>
          {data.recent_payments.length ? (
            <div className="list">
              {data.recent_payments.map((p) => (
                <div className="list-item" key={p.payment_id}>
                  <div className="grow">
                    <b>{p.payment_month}</b>
                    <div className="small muted">{formatDate(p.payment_date)}</div>
                  </div>
                  <b>{money(p.amount)}</b>
                  <Badge>{p.payment_status}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No payments recorded" />}
        </Card>
        <Card title="My complaints" actions={<Link to="/complaints" className="btn btn-ghost btn-sm">View all</Link>}>
          {data.recent_complaints.length ? (
            <div className="list">
              {data.recent_complaints.map((cp) => (
                <div className="list-item" key={cp.complaint_id}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{cp.complaint_type}</b> <span className="small muted">· {formatDate(cp.complaint_date)}</span>
                    <div className="small muted">{cp.description}</div>
                  </div>
                  <Badge>{cp.status}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No complaints raised" />}
        </Card>
      </div>
    </div>
  )
}
