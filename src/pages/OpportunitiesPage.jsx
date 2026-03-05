import { useState, useEffect } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { fetchOpportunities } from '../scraper/fetchOpportunities'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import FilterBar from '../components/FilterBar'
import SearchInput from '../components/SearchInput'
import BulkActionBar from '../components/BulkActionBar'

const emptyForm = { title: '', company: '', specializations: '', link: '', deadline: '', type: '' }

const typeOptions = [
  { value: 'تطوير خريجين', label: 'تطوير خريجين (GDP)' },
  { value: 'تدريب تعاوني', label: 'تدريب تعاوني (COOP)' },
]

function getTypeLabel(value) {
  return typeOptions.find(t => t.value === value)?.label || value || '-'
}

function safeStr(val) {
  if (val == null) return '-'
  if (typeof val === 'object') return val.repr || val.value || JSON.stringify(val)
  return String(val)
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fetching, setFetching] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const PAGE_SIZE = 10

  const colRef = collection(db, 'opportunities')

  async function loadData() {
    setLoading(true)
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setOpportunities([])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(opp) {
    setEditingId(opp.id)
    setForm({
      title: opp.title || '',
      company: opp.company || '',
      specializations: opp.specializations || '',
      link: opp.link || '',
      deadline: opp.deadline || '',
      type: opp.type || '',
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (editingId) {
      await updateDoc(doc(db, 'opportunities', editingId), { ...form })
    } else {
      await addDoc(colRef, { ...form, createdAt: Timestamp.now() })
    }
    setShowModal(false)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    await deleteDoc(doc(db, 'opportunities', id))
    loadData()
  }

  async function handleBulkDelete() {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} فرصة؟`)) return
    const batch = writeBatch(db)
    selectedIds.forEach(id => batch.delete(doc(db, 'opportunities', id)))
    await batch.commit()
    setSelectedIds([])
    loadData()
  }

  const [fetchStatus, setFetchStatus] = useState('')

  const GLIDE_FIELDS = ['title', 'company', 'specializations', 'link', 'deadline', 'type', 'status', 'logo', 'dot', 'source', 'city', 'notes']

  async function handleFetch() {
    setFetching(true)
    try {
      setFetchStatus('جاري الجلب من المصدر...')
      const freshData = await fetchOpportunities()
      if (freshData.length === 0) {
        alert('لم يتم العثور على فرص')
        setFetching(false)
        setFetchStatus('')
        return
      }

      setFetchStatus('جاري المقارنة...')
      const snap = await getDocs(colRef)
      const existingDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      const existingByLink = new Map()
      for (const existing of existingDocs) {
        if (existing.link) existingByLink.set(existing.link, existing)
      }

      const freshByLink = new Map()
      for (const item of freshData) {
        if (item.link) freshByLink.set(item.link, item)
      }

      const toAdd = []
      const toUpdate = []
      const toDelete = []

      for (const item of freshData) {
        if (!item.link) continue
        const existing = existingByLink.get(item.link)
        if (!existing) {
          toAdd.push(item)
        } else {
          const changed = GLIDE_FIELDS.some(field => {
            const oldVal = existing[field] ?? ''
            const newVal = item[field] ?? ''
            return String(oldVal) !== String(newVal)
          })
          if (changed) {
            toUpdate.push({ docId: existing.id, newData: item })
          }
        }
      }

      for (const existing of existingDocs) {
        if (existing.link && !freshByLink.has(existing.link)) {
          toDelete.push(existing.id)
        }
      }

      if (toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
        alert('لا توجد تغييرات — البيانات محدثة')
        setFetching(false)
        setFetchStatus('')
        return
      }

      setFetchStatus(`جاري التحديث... (${toAdd.length} جديد, ${toUpdate.length} تحديث, ${toDelete.length} حذف)`)

      const allOps = []
      for (const item of toAdd) {
        allOps.push({ type: 'add', data: { ...item, createdAt: Timestamp.now() } })
      }
      for (const { docId, newData } of toUpdate) {
        const updateFields = {}
        for (const field of GLIDE_FIELDS) {
          if (newData[field] !== undefined) updateFields[field] = newData[field]
        }
        allOps.push({ type: 'update', docId, data: updateFields })
      }
      for (const docId of toDelete) {
        allOps.push({ type: 'delete', docId })
      }

      for (let i = 0; i < allOps.length; i += 500) {
        const batch = writeBatch(db)
        allOps.slice(i, i + 500).forEach(op => {
          if (op.type === 'add') {
            batch.set(doc(colRef), op.data)
          } else if (op.type === 'update') {
            batch.update(doc(db, 'opportunities', op.docId), op.data)
          } else if (op.type === 'delete') {
            batch.delete(doc(db, 'opportunities', op.docId))
          }
        })
        await batch.commit()
      }

      alert(`تم: ${toUpdate.length} تحديث, ${toAdd.length} جديد, ${toDelete.length} محذوف`)
      loadData()
    } catch (err) {
      console.error('Fetch error:', err)
      alert('حدث خطأ أثناء جلب الفرص: ' + err.message)
    }
    setFetching(false)
    setFetchStatus('')
  }

  const filtered = opportunities.filter(opp => {
    if (statusFilter === 'open' && !(opp.status === 'Open' || opp.dot === '🟢')) return false
    if (statusFilter === 'closed' && !(opp.status === 'Closed' || opp.dot === '🔴')) return false
    if (typeFilter === 'gdp' && opp.source !== 'تطوير خريجين' && opp.type !== 'تطوير خريجين') return false
    if (typeFilter === 'coop' && opp.source !== 'تدريب تعاوني' && opp.type !== 'تدريب تعاوني') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const title = safeStr(opp.title).toLowerCase()
      const company = safeStr(opp.company).toLowerCase()
      const specs = safeStr(opp.specializations).toLowerCase()
      if (!title.includes(q) && !company.includes(q) && !specs.includes(q)) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const columns = [
    {
      key: 'logo',
      label: 'الشعار',
      align: 'center',
      render: (row) => row.logo
        ? <img src={row.logo} alt="" className="w-8 h-8 rounded object-contain inline-block" />
        : <span className="inline-block w-8 h-8 rounded bg-border" />,
    },
    { key: 'title', label: 'العنوان', render: (row) => <span className="font-medium text-textPrimary">{safeStr(row.title)}</span> },
    { key: 'company', label: 'الشركة', render: (row) => <span className="text-textSecondary">{safeStr(row.company)}</span> },
    { key: 'specializations', label: 'التخصصات', render: (row) => <span className="text-textSecondary">{safeStr(row.specializations)}</span> },
    { key: 'type', label: 'النوع', render: (row) => <span className="text-textSecondary">{getTypeLabel(row.type)}</span> },
    {
      key: 'status',
      label: 'الحالة',
      align: 'center',
      render: (row) =>
        row.status === 'Open' || row.dot === '🟢'
          ? <span className="text-success">🟢 مفتوح</span>
          : row.status === 'Closed' || row.dot === '🔴'
            ? <span className="text-danger">🔴 مغلق</span>
            : <span className="text-textSecondary">{safeStr(row.status)}</span>,
    },
    { key: 'deadline', label: 'الموعد النهائي', render: (row) => <span className="text-textSecondary">{safeStr(row.deadline)}</span> },
    {
      key: 'link',
      label: 'الرابط',
      render: (row) => row.link
        ? <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">فتح</a>
        : '-',
    },
    {
      key: 'actions',
      label: 'إجراءات',
      align: 'center',
      stopPropagation: true,
      render: (row) => (
        <>
          <button onClick={() => openEdit(row)} className="text-secondary hover:underline me-3 cursor-pointer">تعديل</button>
          <button onClick={() => handleDelete(row.id)} className="text-danger hover:underline cursor-pointer">حذف</button>
        </>
      ),
    },
  ]

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-1">إدارة الفرص</h2>
          <p className="text-textSecondary text-sm">{filtered.length} فرصة {statusFilter !== 'all' ? `(من ${opportunities.length})` : ''}</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-blue-600 transition disabled:opacity-50 cursor-pointer"
          >
            {fetching ? (fetchStatus || 'جاري الجلب...') : '🔄 جلب من المصدر'}
          </button>
          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition cursor-pointer"
          >
            + إضافة فرصة
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={searchQuery}
            onChange={v => { setSearchQuery(v); setCurrentPage(1) }}
            placeholder="بحث بالعنوان، الشركة، التخصصات..."
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <FilterBar
            filters={[
              { key: 'all', label: 'الكل' },
              { key: 'open', label: '🟢 مفتوح' },
              { key: 'closed', label: '🔴 مغلق' },
            ]}
            activeKey={statusFilter}
            onChange={k => { setStatusFilter(k); setCurrentPage(1) }}
          />
          <FilterBar
            filters={[
              { key: 'all', label: 'كل الأنواع' },
              { key: 'gdp', label: 'تطوير خريجين (GDP)' },
              { key: 'coop', label: 'تدريب تعاوني (COOP)' },
            ]}
            activeKey={typeFilter}
            onChange={k => { setTypeFilter(k); setCurrentPage(1) }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyIcon="🎯"
        emptyTitle="لا توجد فرص بعد"
        emptySubtitle="أضف فرصة جديدة أو اجلب من المصدر"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <BulkActionBar
        selectedCount={selectedIds.length}
        actions={[
          { label: `حذف (${selectedIds.length})`, onClick: handleBulkDelete, variant: 'danger' },
        ]}
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'تعديل الفرصة' : 'إضافة فرصة جديدة'}
      >
        <form onSubmit={handleSave}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">العنوان</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">الشركة</label>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">التخصصات</label>
              <input
                value={form.specializations}
                onChange={(e) => setForm({ ...form, specializations: e.target.value })}
                placeholder="مثال: هندسة برمجيات، تصميم"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">النوع</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر النوع</option>
                {typeOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">الرابط</label>
              <input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">الموعد النهائي</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer"
            >
              {editingId ? 'حفظ التعديل' : 'إضافة'}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2 bg-background text-textSecondary rounded-lg hover:bg-border transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
