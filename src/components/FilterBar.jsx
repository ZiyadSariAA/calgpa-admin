export default function FilterBar({ filters, activeKey, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {filters.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
            activeKey === f.key
              ? 'bg-primary text-white'
              : 'bg-surface text-textSecondary hover:bg-primary-light hover:text-primary'
          }`}
        >
          {f.label}
          {f.count != null ? ` (${f.count})` : ''}
        </button>
      ))}
    </div>
  )
}
