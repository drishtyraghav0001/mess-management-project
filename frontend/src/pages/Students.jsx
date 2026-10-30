import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { clean, useForm } from '../hooks/useForm'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DataTable from '../components/DataTable'
import FormError from '../components/FormError'
import { FilterSelect, Input, Select } from '../components/Form'
import { ConfirmDialog, FormFooter, Modal } from '../components/Modal'
import { Badge, Card, KeyValue, Loading, PageHeader } from '../components/ui'
import { money, num, titleCase, unique } from '../utils/format'
import { rules } from '../utils/validate'

// Columns we know from the project PDF. Any OTHER column found in the real
// STUDENT table (read from /api/meta/columns/STUDENT) is shown automatically.
const KNOWN = ['student_id', 'student_name', 'room_no', 'phone', 'gender', 'hostel_name', 'email', 'status']

function StudentForm({ open, onClose, student, columns, onSaved }) {
  const toast = useToast()
  const editing = !!student
  const extra = columns.filter((c) => !KNOWN.includes(c.name))
  const has = (n) => columns.some((c) => c.name === n)
  const empty = Object.fromEntries(columns.map((c) => [c.name, '']))
  const f = useForm(editing ? { ...empty, ...Object.fromEntries(Object.entries(student).map(([k, v]) => [k, v ?? ''])) } : { ...empty, status: has('status') ? 'Active' : '' }, {
    student_name: [rules.required('Name'), rules.minLen(2, 'Name'), rules.maxLen(50, 'Name')],
    email: [rules.email],
    phone: [rules.phone],
    student_id: [rules.number('Student ID'), rules.positive('Student ID')],
  })

  const save = f.submit(async (v) => {
    const body = clean(Object.fromEntries(Object.entries(v).filter(([k]) => columns.some((c) => c.name === k))), { keepEmpty: editing })
    if (editing) {
      delete body.student_id
      await api.put(`/api/students/${student.student_id}`, body)
      toast.success(`${v.student_name} updated.`)
    } else {
      if (body.student_id) body.student_id = Number(body.student_id)
      const res = await api.post('/api/students', body)
      toast.success(`Student #${res.student_id} ${res.student_name} added.`)
    }
    onSaved()
    onClose()
  })

  const inputType = (c) => (c.data_type === 'NUMBER' ? 'number' : c.data_type === 'DATE' || c.data_type.startsWith('TIMESTAMP') ? 'date' : 'text')

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit student #${student.student_id}` : 'Add student'} size="lg"
      footer={<FormFooter onCancel={onClose} busy={f.busy} formId="student-form" label={editing ? 'Save changes' : 'Add student'} />}>
      <form id="student-form" onSubmit={save} noValidate className="stack">
        <FormError error={f.error} />
        <div className="form-grid">
          {!editing && (
            <Input label="Student ID" type="number" min="1" value={f.values.student_id} onChange={f.set('student_id')} error={f.errors.student_id} hint="Leave empty to auto-generate" />
          )}
          <Input label="Full name" required value={f.values.student_name} onChange={f.set('student_name')} error={f.errors.student_name} maxLength={50} full={editing} />
          {has('room_no') && <Input label="Room no." value={f.values.room_no} onChange={f.set('room_no')} error={f.errors.room_no} maxLength={10} placeholder="A-101" />}
          {has('phone') && <Input label="Phone" value={f.values.phone} onChange={f.set('phone')} error={f.errors.phone} maxLength={15} placeholder="98765 43210" />}
          {has('gender') && <Select label="Gender" value={f.values.gender} onChange={f.set('gender')} error={f.errors.gender} placeholder="Select…" options={['Male', 'Female', 'Other']} />}
          {has('hostel_name') && <Input label="Hostel" value={f.values.hostel_name} onChange={f.set('hostel_name')} error={f.errors.hostel_name} maxLength={50} placeholder="Mens Hostel A" />}
          {has('email') && <Input label="Email" type="email" value={f.values.email} onChange={f.set('email')} error={f.errors.email} maxLength={100} />}
          {has('status') && <Select label="Status" value={f.values.status} onChange={f.set('status')} error={f.errors.status} placeholder="Select…" options={['Active', 'Inactive']} />}
          {extra.map((c) => (
            <Input key={c.name} label={titleCase(c.name)} required={!c.nullable && !c.has_default} type={inputType(c)} value={f.values[c.name]} onChange={f.set(c.name)} error={f.errors[c.name]}
              maxLength={c.data_type.includes('CHAR') ? c.length : undefined} hint={`${c.data_type} column`} />
          ))}
        </div>
      </form>
    </Modal>
  )
}

function StudentDetails({ id, onClose }) {
  const { data, loading, error } = useApi(id ? `/api/students/${id}` : null)
  return (
    <Modal open={!!id} onClose={onClose} title="Student details" subtitle="Totals come from the TOTAL_PAID and MEALS_ATTENDED functions">
      {loading || !data ? (error ? <FormError error={error} /> : <Loading />) : (
        <div className="stack">
          <div className="grid grid-2">
            <div className="highlight"><div className="small muted">Total paid <span className="fn-tag">TOTAL_PAID({data.student_id})</span></div><div className="big">{money(data.total_paid)}</div></div>
            <div className="highlight"><div className="small muted">Meals attended <span className="fn-tag">MEALS_ATTENDED({data.student_id})</span></div><div className="big">{num(data.meals_attended)}</div></div>
          </div>
          <KeyValue items={Object.entries(data).filter(([k]) => !['total_paid', 'meals_attended', 'related'].includes(k))
            .map(([k, v]) => [titleCase(k), k === 'status' && v ? <Badge>{v}</Badge> : v])} />
          <div className="small muted">
            Linked records: {Object.entries(data.related || {}).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(' · ')}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Students() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [hostel, setHostel] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useApi('/api/students', { hostel, status })
  const all = useApi('/api/students')
  const cols = useApi('/api/meta/columns/STUDENT')
  const [form, setForm] = useState(null) // null | {} (new) | student
  const [view, setView] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const columns = cols.data || []
  const has = (n) => columns.some((c) => c.name === n)
  const extra = columns.filter((c) => !KNOWN.includes(c.name))

  const tableCols = useMemo(() => {
    const list = [
      { key: 'student_id', label: 'ID', render: (r) => <span className="mono">#{r.student_id}</span> },
      { key: 'student_name', label: 'Name', render: (r) => <div><b>{r.student_name}</b>{r.email && <div className="small muted">{r.email}</div>}</div>, csv: (r) => r.student_name },
    ]
    if (has('room_no')) list.push({ key: 'room_no', label: 'Room' })
    if (has('hostel_name')) list.push({ key: 'hostel_name', label: 'Hostel' })
    if (has('phone')) list.push({ key: 'phone', label: 'Phone' })
    if (has('gender')) list.push({ key: 'gender', label: 'Gender' })
    extra.forEach((c) => list.push({ key: c.name, label: titleCase(c.name) }))
    if (has('status')) list.push({ key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> })
    list.push({
      key: 'actions', label: '', render: (r) => (
        <>
          <button className="icon-btn" title="View details" onClick={() => setView(r.student_id)}><Eye /></button>
          {isAdmin && <button className="icon-btn" title="Edit" onClick={() => setForm(r)}><Pencil /></button>}
          {isAdmin && <button className="icon-btn danger" title="Delete" onClick={() => setDel(r)}><Trash2 /></button>}
        </>
      ),
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, isAdmin])

  const remove = async () => {
    setBusy(true)
    try {
      await api.del(`/api/students/${del.student_id}`)
      toast.success(`${del.student_name} deleted.`)
      setDel(null)
      reload(); all.reload()
    } catch (e) {
      toast.error(e.message, 'Cannot delete student')
      setDel(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Students" subtitle={`${num(all.data?.length ?? 0)} students registered in the mess`}
        actions={isAdmin && <button className="btn btn-primary" onClick={() => setForm({})} disabled={!cols.data}><UserPlus /> Add student</button>} />
      <Card bodyClass="card-body">
        <DataTable rows={data} loading={loading || cols.loading} error={error || cols.error} onRetry={reload} columns={tableCols} rowKey="student_id"
          searchPlaceholder="Search name, room, phone, email…" exportName="students" noun="student" onRowClick={(r) => setView(r.student_id)}
          searchKeys={['email']}
          filters={<>
            {has('hostel_name') && <FilterSelect value={hostel} onChange={setHostel} placeholder="All hostels" options={unique(all.data, 'hostel_name')} />}
            {has('status') && <FilterSelect value={status} onChange={setStatus} placeholder="Any status" options={unique(all.data, 'status')} />}
          </>}
          emptyMessage={isAdmin ? 'Click “Add student” to register the first one.' : undefined}
          emptyTitle="No students found" />
      </Card>
      {form && <StudentForm open onClose={() => setForm(null)} student={form.student_id ? form : null} columns={columns} onSaved={() => { reload(); all.reload() }} />}
      <StudentDetails id={view} onClose={() => setView(null)} />
      <ConfirmDialog open={!!del} title="Delete student?" busy={busy} onCancel={() => setDel(null)} onConfirm={remove}
        message={del && <>This will permanently delete <b>{del.student_name}</b> (#{del.student_id}). Students with payments, attendance or complaints cannot be deleted — Oracle's foreign keys protect that data.</>} />
      {!isAdmin && <p className="small muted"><Plus size={12} /> Only admins can add or edit students.</p>}
    </div>
  )
}
