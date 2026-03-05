import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useTranslation } from '../context/LanguageContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function formatDate(ts, lang) {
  if (!ts) return '-'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const [stats, setStats] = useState({ opportunities: 0, notifications: 0, support: 0, supportNew: 0, admins: 0, loading: true })
  const [chartData, setChartData] = useState([])
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)

  const dayKeys = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat']

  function relativeTime(ts) {
    if (!ts) return ''
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    const diff = Date.now() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('now')
    if (mins < 60) return t('minutesAgo', { n: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    return t('daysAgo', { n: days })
  }

  useEffect(() => {
    async function loadStats() {
      try {
        const [oppSnap, notifSnap, supportSnap, supportNewSnap, adminsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'opportunities')),
          getCountFromServer(collection(db, 'notifications')),
          getCountFromServer(collection(db, 'supportMessages')),
          getCountFromServer(query(collection(db, 'supportMessages'), where('status', '==', 'new'))),
          getCountFromServer(collection(db, 'admins')).catch(() => ({ data: () => ({ count: 0 }) })),
        ])
        setStats({
          opportunities: oppSnap.data().count,
          notifications: notifSnap.data().count,
          support: supportSnap.data().count,
          supportNew: supportNewSnap.data().count,
          admins: adminsSnap.data().count,
          loading: false,
        })
      } catch {
        setStats(prev => ({ ...prev, loading: false }))
      }
    }

    async function loadChart() {
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const q = query(
          collection(db, 'supportMessages'),
          where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
          orderBy('createdAt', 'asc'),
        )
        const snap = await getDocs(q)

        const dayCounts = {}
        for (let i = 0; i < 7; i++) {
          const d = new Date()
          d.setDate(d.getDate() - 6 + i)
          dayCounts[d.toISOString().split('T')[0]] = { dayIndex: d.getDay(), count: 0 }
        }

        snap.docs.forEach(d => {
          const ts = d.data().createdAt
          if (!ts) return
          const date = ts.toDate ? ts.toDate() : new Date(ts)
          const key = date.toISOString().split('T')[0]
          if (dayCounts[key]) dayCounts[key].count++
        })

        setChartData(Object.values(dayCounts))
      } catch {
        setChartData([])
      }
    }

    async function loadActivity() {
      setActivityLoading(true)
      try {
        const [supportSnap, notifSnap] = await Promise.all([
          getDocs(query(collection(db, 'supportMessages'), orderBy('createdAt', 'desc'), limit(5))),
          getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(5))),
        ])

        const items = [
          ...supportSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: 'support' })),
          ...notifSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: 'notification' })),
        ]

        items.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
          return bTime - aTime
        })

        setActivity(items.slice(0, 10))
      } catch {
        setActivity([])
      }
      setActivityLoading(false)
    }

    loadStats()
    loadChart()
    loadActivity()
  }, [])

  const statCards = [
    { title: t('statOpportunities'), value: stats.opportunities, icon: '🎯', lightColor: 'bg-primary-light' },
    { title: t('statNotifications'), value: stats.notifications, icon: '🔔', lightColor: 'bg-secondary-light' },
    {
      title: t('statSupport'),
      value: stats.support,
      icon: '📩',
      lightColor: 'bg-yellow-50',
      badge: stats.supportNew > 0 ? stats.supportNew : null,
    },
    { title: t('statAdmins'), value: stats.admins, icon: '👥', lightColor: 'bg-green-50' },
  ]

  const quickActions = [
    { title: t('qaAddOpportunity'), icon: '🎯', path: '/opportunities' },
    { title: t('qaSendNotification'), icon: '🔔', path: '/notifications' },
    { title: t('qaSupport'), icon: '📩', path: '/support' },
    { title: t('qaSettings'), icon: '⚙️', path: '/settings' },
  ]

  // Build chart display data with translated day names
  const chartDisplayData = chartData.map(d => ({
    day: t(dayKeys[d.dayIndex]),
    count: d.count,
  }))

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">{t('dashboard')}</h2>
        <p className="text-textSecondary">{t('dashboardWelcome')}</p>
      </div>

      {/* Stats */}
      {stats.loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div key={card.title} className="bg-surface rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className={`w-14 h-14 ${card.lightColor} rounded-xl flex items-center justify-center text-2xl shrink-0`}>
                {card.icon}
              </div>
              <div>
                <p className="text-textSecondary text-sm">{card.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-textPrimary">{card.value}</p>
                  {card.badge && (
                    <span className="bg-danger text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {card.badge} {t('newBadge')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Chart */}
        <div className="bg-surface rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-textPrimary mb-4">{t('supportChart')}</h3>
          {chartDisplayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartDisplayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B6B6B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B6B6B' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E5', fontFamily: 'IBM Plex Sans Arabic' }}
                  labelFormatter={l => l}
                  formatter={v => [v, t('chartMessages')]}
                />
                <Bar dataKey="count" fill="#2D5A3D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-textSecondary text-center py-12">{t('noData')}</p>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-surface rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-textPrimary mb-4">{t('recentActivity')}</h3>
          {activityLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-textSecondary text-center py-12">{t('noRecentActivity')}</p>
          ) : (
            <div className="space-y-0">
              {activity.map(item => (
                <div
                  key={`${item._type}-${item.id}`}
                  className={`flex items-start gap-3 py-3 border-e-4 pe-3 ${
                    item._type === 'support' ? 'border-e-secondary' : 'border-e-warning'
                  } ${activity.indexOf(item) !== activity.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {item._type === 'support' ? '📩' : '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-textPrimary truncate">{item.title || t('noTitle')}</p>
                    <p className="text-xs text-textSecondary mt-0.5">{relativeTime(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-bold text-textPrimary mb-4">{t('quickActions')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickActions.map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="bg-surface rounded-xl shadow-sm p-6 text-center hover:shadow-md transition cursor-pointer group"
            >
              <span className="text-3xl block mb-2">{action.icon}</span>
              <span className="text-sm font-medium text-textSecondary group-hover:text-primary transition">{action.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
