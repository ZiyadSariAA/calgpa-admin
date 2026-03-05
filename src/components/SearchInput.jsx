import { useTranslation } from '../context/LanguageContext'

export default function SearchInput({ value, onChange, placeholder }) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <span className="absolute inset-y-0 start-0 ps-3 flex items-center text-textSecondary pointer-events-none">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || t('search')}
        className="w-full ps-10 pe-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-textSecondary/60"
      />
    </div>
  )
}
