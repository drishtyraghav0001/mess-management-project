// Thin wrappers around recharts so every chart shares colours and styling.
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { EmptyState } from './ui'

export const COLORS = {
  Paid: '#10b981', Pending: '#f59e0b', Failed: '#ef4444',
  Open: '#ef4444', 'In Progress': '#f59e0b', Resolved: '#10b981',
  High: '#ef4444', Medium: '#f59e0b', Low: '#0ea5e9',
  present: '#4f46e5', absent: '#cbd5e1',
}
export const PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#ec4899']

const axis = { fontSize: 12, fill: '#64748b' }
const tooltipStyle = { borderRadius: 10, border: '1px solid #e6e8f0', boxShadow: '0 8px 24px -8px rgba(15,23,42,.2)', fontSize: 12.5 }

const NoData = () => <EmptyState title="No data yet" message="Add some records to see this chart." />
const isEmpty = (data) => !Array.isArray(data) || !data.length

function Empty({ children, height }) {
  return <div className="chart-box" style={{ height }}>{children}</div>
}

export function DonutChart({ data, nameKey, valueKey, height = 260, colors = COLORS }) {
  if (isEmpty(data)) return <NoData />
  return (
    <Empty data={data} height={height}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={colors[d[nameKey]] || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Empty>
  )
}

export function SimpleBarChart({ data, xKey, bars, height = 260, layout = 'horizontal', stacked, formatter }) {
  if (isEmpty(data)) return <NoData />
  const vertical = layout === 'vertical'
  return (
    <Empty data={data} height={height}>
      <ResponsiveContainer>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: vertical ? 10 : -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={vertical} horizontal={!vertical} />
          {vertical ? (
            <>
              <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey={xKey} tick={axis} axisLine={false} tickLine={false} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(79,70,229,.06)' }} formatter={formatter} />
          {bars.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color || PALETTE[i]} stackId={stacked ? 's' : undefined}
              radius={stacked && i < bars.length - 1 ? 0 : vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false}>
              {b.colorBy && data.map((d, j) => <Cell key={j} fill={PALETTE[j % PALETTE.length]} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Empty>
  )
}

export function TrendChart({ data, xKey, areas, height = 260, xFormatter }) {
  if (isEmpty(data)) return <NoData />
  return (
    <Empty data={data} height={height}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            {areas.map((a, i) => (
              <linearGradient key={a.key} id={`g-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.color || PALETTE[i]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={a.color || PALETTE[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
          <XAxis dataKey={xKey} tick={axis} axisLine={false} tickLine={false} tickFormatter={xFormatter} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={xFormatter} />
          {areas.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {areas.map((a, i) => (
            <Area key={a.key} type="monotone" dataKey={a.key} name={a.label} stroke={a.color || PALETTE[i]} strokeWidth={2.2}
              fill={`url(#g-${a.key})`} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Empty>
  )
}
