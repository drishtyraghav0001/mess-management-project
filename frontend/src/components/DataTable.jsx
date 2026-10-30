import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { downloadCSV } from '../utils/format'
import { ErrorState, FilteredEmpty, Loading } from './ui'
import { FilterRegistry } from './Form'

/**
 * Reusable table with search, column sorting, pagination and CSV export.
 * columns: [{ key, label, render?(row), sortable?, align?, sortValue?(row), csv?(row) }]
 * Any <FilterSelect> passed in `filters` registers itself, so the empty state can say which
 * filters are active and offer "Clear filters". Filters that live outside the table can be
 * described with extraFilters=[{ name, value }] + onClearFilters.
 */
export default function DataTable({
  columns, rows, loading, error, onRetry, rowKey, searchable = true, searchPlaceholder = 'Search…',
  filters, toolbarRight, pageSize = 10, emptyTitle = 'No records found', emptyMessage, onRowClick,
  exportName, initialSort, searchKeys = [], noun = 'record', extraFilters = [], onClearFilters,
  query: controlledQuery, onQueryChange,
}) {
  const [ownQuery, setOwnQuery] = useState('')
  const query = controlledQuery ?? ownQuery
  const setQuery = onQueryChange || setOwnQuery
  const [registered, setRegistered] = useState({})
  const setFilter = useCallback((id, entry) => setRegistered((m) => {
    if (!entry && !(id in m)) return m
    const next = { ...m }
    if (entry) next[id] = entry
    else delete next[id]
    return next
  }), [])
  const registry = useMemo(() => ({ set: setFilter }), [setFilter])
  const active = [...extraFilters, ...Object.values(registered)]
  const clearAll = () => {
    setQuery('')
    Object.values(registered).forEach((f) => f.clear())
    onClearFilters?.()
    setPage(1)
  }
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'asc' })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const list = rows || []
    if (!query.trim()) return list
    const q = query.toLowerCase()
    const hit = (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q)
    return list.filter(
      (r) => columns.some((c) => hit(c.searchValue ? c.searchValue(r) : r[c.key])) || searchKeys.some((k) => hit(r[k])),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, columns])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    const get = col?.sortValue || ((r) => r[sort.key])
    return [...filtered].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x === y) return 0
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages)
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const exportCsv = () =>
    downloadCSV(
      `${exportName}.csv`,
      sorted.map((r) => Object.fromEntries(columns.filter((c) => c.key !== 'actions').map((c) => [c.key, c.csv ? c.csv(r) : r[c.key]]))),
      columns.filter((c) => c.key !== 'actions').map((c) => ({ key: c.key, label: c.label })),
    )

  return (
    <div>
      {(searchable || filters || toolbarRight || exportName) && (
        <div className="toolbar">
          {searchable && (
            <div className="search">
              <Search />
              <input className="input" value={query} placeholder={searchPlaceholder} aria-label="Search"
                onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
            </div>
          )}
          <FilterRegistry.Provider value={registry}>{filters}</FilterRegistry.Provider>
          <div className="grow" />
          {exportName && rows?.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={exportCsv} title="Download as CSV">
              <Download /> CSV
            </button>
          )}
          {toolbarRight}
        </div>
      )}
      {loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !sorted.length ? (
        <FilteredEmpty query={query} filters={active.map(({ name, value }) => ({ name, value }))} noun={noun}
          emptyTitle={emptyTitle} emptyMessage={emptyMessage} onClear={clearAll} />
      ) : (
        <>
          <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            <table className="table">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const sortable = c.sortable !== false && c.key !== 'actions'
                    const active = sort.key === c.key
                    return (
                      <th key={c.key} className={`${sortable ? 'sortable' : ''} ${active ? 'sorted' : ''}`}
                        style={{ textAlign: c.align || 'left' }} onClick={sortable ? () => toggleSort(c.key) : undefined}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {c.label}
                        {sortable && (
                          <span className="sort">
                            {active ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} />}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={rowKey ? r[rowKey] : i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.key === 'actions' ? 'actions' : c.className} style={{ textAlign: c.align || undefined }}
                        onClick={c.key === 'actions' ? (e) => e.stopPropagation() : undefined}>
                        {c.render ? c.render(r) : r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>
              Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}
              {rows && sorted.length !== rows.length ? ` (filtered from ${rows.length})` : ''}
            </span>
            {pages > 1 && (
              <div className="pager">
                <button className="icon-btn" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
                  <ChevronLeft />
                </button>
                <span>Page {current} of {pages}</span>
                <button className="icon-btn" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page">
                  <ChevronRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
