export default function SearchInput({ value, onChange, placeholder = 'بحث...' }) {
  return (
    <div className="relative">
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        dir="rtl"
        className="w-full pe-10 ps-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-textSecondary/60"
      />
    </div>
  )
}
