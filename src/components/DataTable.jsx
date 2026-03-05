import { useTranslation } from '../context/LanguageContext'

export default function DataTable({
  columns,
  data,
  loading,
  emptyIcon = '📭',
  emptyTitle,
  emptySubtitle = '',
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
}) {
  const { t } = useTranslation()
  const allSelected = data.length > 0 && data.every(row => selectedIds.includes(row.id))

  function handleSelectAll() {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(selectedIds.filter(id => !data.find(r => r.id === id)))
    } else {
      const newIds = [...new Set([...selectedIds, ...data.map(r => r.id)])]
      onSelectionChange(newIds)
    }
  }

  function handleSelectRow(id) {
    if (!onSelectionChange) return
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-xl shadow-sm p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-textSecondary">{t('tableLoading')}</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface rounded-xl shadow-sm p-12 text-center">
        <p className="text-4xl mb-3">{emptyIcon}</p>
        <p className="text-textSecondary text-lg">{emptyTitle || t('tableEmpty')}</p>
        {emptySubtitle && <p className="text-textSecondary text-sm mt-2">{emptySubtitle}</p>}
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-primary-light text-primary">
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-border cursor-pointer accent-primary"
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium ${col.align === 'center' ? 'text-center' : 'text-start'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.id}
              className={`border-t border-border hover:bg-background/50 ${onRowClick ? 'cursor-pointer' : ''} ${selectedIds.includes(row.id) ? 'bg-primary-light/50' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {selectable && (
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => handleSelectRow(row.id)}
                    className="rounded border-border cursor-pointer accent-primary"
                  />
                </td>
              )}
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 ${col.align === 'center' ? 'text-center' : ''} ${col.className || ''}`}
                  onClick={col.stopPropagation ? e => e.stopPropagation() : undefined}
                >
                  {col.render ? col.render(row) : row[col.key] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
