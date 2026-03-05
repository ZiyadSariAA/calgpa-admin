import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import logo from '../../assets/logo.avif'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeNotifCount, setActiveNotifCount] = useState(0)

  const navItems = [
    { path: '/', label: t('navDashboard'), icon: '📊' },
    { path: '/opportunities', label: t('navOpportunities'), icon: '🎯' },
    { path: '/notifications', label: t('navNotifications'), icon: '🔔' },
    { path: '/support', label: t('navSupport'), icon: '📩' },
    { path: '/settings', label: t('navSettings'), icon: '⚙️' },
  ]

  const adminName = user?.displayName || ''
  const adminEmail = user?.email || ''

  useEffect(() => {
    getCountFromServer(collection(db, 'notifications')).then(snap => setActiveNotifCount(snap.data().count)).catch(() => {})
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-screen bg-background">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} z-50 w-56 bg-surface shadow-md flex flex-col py-4 px-3 gap-1 transform transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')
        }`}
      >
        {/* Close button - mobile only */}
        <button
          onClick={closeSidebar}
          className={`md:hidden absolute top-3 ${lang === 'ar' ? 'left-3' : 'right-3'} text-textSecondary hover:text-textPrimary text-lg cursor-pointer`}
        >
          ✕
        </button>

        <div className="mb-4 px-3 flex items-center gap-2">
          <img src={logo} alt="CalGPA" className="h-9 w-auto object-contain" />
          <span className="text-lg font-bold text-primary">Admin</span>
        </div>

        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-textSecondary hover:bg-primary-light hover:text-primary'
              }`
            }
          >
            <span className="text-base relative">
              {item.icon}
              {item.path === '/notifications' && activeNotifCount > 0 && (
                <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-surface" />
              )}
            </span>
            {item.label}
          </NavLink>
        ))}

        <div className="mt-auto">
          {adminEmail && (
            <div className="px-3 py-2 mb-1 border-t border-border pt-3">
              <p className="text-xs font-medium text-textPrimary truncate">{adminName}</p>
              <p className="text-[11px] text-textSecondary truncate">{adminEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-lg text-sm text-danger hover:bg-red-50 text-start flex items-center gap-2 cursor-pointer"
          >
            <span>🚪</span>
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden bg-surface shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <img src={logo} alt="CalGPA" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary-light text-primary hover:bg-primary hover:text-white transition cursor-pointer"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-textPrimary text-2xl cursor-pointer"
            >
              ☰
            </button>
          </div>
        </header>

        {/* Desktop top bar with language toggle */}
        <header className="hidden md:flex bg-surface shadow-sm px-6 py-3 items-center justify-end sticky top-0 z-30">
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-primary-light text-primary hover:bg-primary hover:text-white transition cursor-pointer"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
