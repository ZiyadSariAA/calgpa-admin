import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useTranslation } from '../context/LanguageContext'

const defaultConfig = {
  maintenanceMode: false,
  maintenanceMessage: '',
  minAppVersion: '1.0.0',
  cvEnabled: false,
  bannerEnabled: false,
  bannerType: 'text',
  bannerText: '',
  bannerBgColor: '#2D5A3D',
  bannerTextColor: '#FFFFFF',
  bannerImageUrl: '',
  bannerImagePath: '',
  bannerLink: '',
  rateIosLink: '',
  rateAndroidLink: '',
  aiDailyLimit: 0,
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Admin management state
  const [admins, setAdmins] = useState([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const currentEmail = localStorage.getItem('adminEmail') || ''
  const docRef = doc(db, 'settings', 'appConfig')
  const adminsRef = collection(db, 'admins')

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          setConfig({ ...defaultConfig, ...snap.data() })
        }
      } catch {
        // use defaults
      }
      setLoading(false)
    }
    load()
    loadAdmins()
  }, [])

  async function loadAdmins() {
    setAdminLoading(true)
    try {
      const snapshot = await getDocs(adminsRef)
      setAdmins(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setAdminError(t('adminLoadError'))
    }
    setAdminLoading(false)
  }

  async function handleAddAdmin(e) {
    e.preventDefault()
    const email = newAdminEmail.trim().toLowerCase()
    if (!email) return
    setAdminError('')

    // Check duplicate
    if (admins.some(a => a.email?.toLowerCase() === email)) {
      setAdminError(t('adminDuplicate'))
      return
    }

    try {
      await setDoc(doc(db, 'admins', email), { email, addedAt: serverTimestamp() })
      setNewAdminEmail('')
      await loadAdmins()
    } catch {
      setAdminError(t('adminAddError'))
    }
  }

  async function handleDeleteAdmin(admin) {
    if (admin.email?.toLowerCase() === currentEmail.toLowerCase()) {
      setAdminError(t('adminDeleteSelf'))
      return
    }
    try {
      await deleteDoc(doc(db, 'admins', admin.id))
      await loadAdmins()
    } catch {
      setAdminError(t('adminDeleteError'))
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `banners/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setConfig({ ...config, bannerImageUrl: url, bannerImagePath: path })
    } catch {
      alert(t('uploadError'))
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRemoveImage() {
    if (config.bannerImagePath) {
      try {
        const imageRef = ref(storage, config.bannerImagePath)
        await deleteObject(imageRef)
      } catch {
        // image might not exist in storage, continue
      }
    }
    setConfig({ ...config, bannerImageUrl: '', bannerImagePath: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(docRef, config, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert(t('saveError'))
    }
    setSaving(false)
  }

  if (loading) return <p className="text-textSecondary">{t('loading')}</p>

  const colorThemes = [
    { bg: '#2D5A3D', text: '#FFFFFF', label: t('colorGreen') },
    { bg: '#1E3D2A', text: '#E8F0EA', label: t('colorDarkGreen') },
    { bg: '#E8F0EA', text: '#2D5A3D', label: t('colorLightGreen') },
    { bg: '#3B82F6', text: '#FFFFFF', label: t('colorBlue') },
    { bg: '#DBEAFE', text: '#3B82F6', label: t('colorLightBlue') },
    { bg: '#F59E0B', text: '#FFFFFF', label: t('colorOrange') },
    { bg: '#1A1A1A', text: '#FFFFFF', label: t('colorDark') },
    { bg: '#FFFFFF', text: '#1A1A1A', label: t('colorLight') },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-primary mb-1">{t('settings')}</h2>
        <p className="text-textSecondary text-sm">{t('settingsSubtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 max-w-xl space-y-6">
        {/* Maintenance Mode */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-textPrimary">{t('maintenanceMode')}</p>
            <p className="text-textSecondary text-sm">{t('maintenanceModeDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
            className={`w-14 h-7 rounded-full transition relative cursor-pointer shrink-0 ${
              config.maintenanceMode ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                config.maintenanceMode ? 'left-0.5' : 'left-7'
              }`}
            />
          </button>
        </div>

        {/* Maintenance Message */}
        {config.maintenanceMode && (
          <div>
            <label className="block font-medium text-textPrimary mb-1">{t('maintenanceMessage')}</label>
            <p className="text-textSecondary text-sm mb-2">{t('maintenanceMessageDesc')}</p>
            <textarea
              value={config.maintenanceMessage}
              onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
              rows={2}
              placeholder={t('maintenancePlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {/* Min App Version */}
        <div>
          <label className="block font-medium text-textPrimary mb-1">{t('minAppVersion')}</label>
          <p className="text-textSecondary text-sm mb-2">{t('minAppVersionDesc')}</p>
          <input
            type="text"
            value={config.minAppVersion}
            onChange={(e) => setConfig({ ...config, minAppVersion: e.target.value })}
            placeholder="1.0.0"
            className="w-32 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            dir="ltr"
          />
        </div>

        {/* CV Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-textPrimary">{t('cvAI')}</p>
            <p className="text-textSecondary text-sm">{t('cvAIDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, cvEnabled: !config.cvEnabled })}
            className={`w-14 h-7 rounded-full transition relative cursor-pointer shrink-0 ${
              config.cvEnabled ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                config.cvEnabled ? 'left-0.5' : 'left-7'
              }`}
            />
          </button>
        </div>

        {/* AI Daily Limit */}
        <div>
          <label className="block font-medium text-textPrimary mb-1">{t('aiDailyLimit')}</label>
          <p className="text-textSecondary text-sm mb-2">{t('aiDailyLimitDesc')}</p>
          <input
            type="number"
            min="0"
            value={config.aiDailyLimit}
            onChange={(e) => setConfig({ ...config, aiDailyLimit: parseInt(e.target.value) || 0 })}
            placeholder="0"
            className="w-32 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            dir="ltr"
          />
        </div>

        {/* Banner */}
        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-textPrimary">{t('banner')}</p>
              <p className="text-textSecondary text-sm">{t('bannerDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, bannerEnabled: !config.bannerEnabled })}
              className={`w-14 h-7 rounded-full transition relative cursor-pointer shrink-0 ${
                config.bannerEnabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                  config.bannerEnabled ? 'left-0.5' : 'left-7'
                }`}
              />
            </button>
          </div>

          {config.bannerEnabled && (
            <div className="space-y-4 bg-background rounded-lg p-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-2">{t('bannerType')}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, bannerType: 'text' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                      config.bannerType === 'text'
                        ? 'bg-primary text-white'
                        : 'bg-surface border border-border text-textSecondary'
                    }`}
                  >
                    {t('bannerTextOnly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, bannerType: 'image' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                      config.bannerType === 'image'
                        ? 'bg-primary text-white'
                        : 'bg-surface border border-border text-textSecondary'
                    }`}
                  >
                    {t('bannerImage')}
                  </button>
                </div>
              </div>

              {/* Text content */}
              {config.bannerType === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-textPrimary mb-1">{t('bannerText')}</label>
                    <input
                      type="text"
                      value={config.bannerText}
                      onChange={(e) => setConfig({ ...config, bannerText: e.target.value })}
                      placeholder={t('bannerTextPlaceholder')}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>

                  {/* Color Theme */}
                  <div>
                    <label className="block text-sm font-medium text-textPrimary mb-2">{t('bannerColorTheme')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {colorThemes.map(pair => {
                        const isSelected = config.bannerBgColor === pair.bg && config.bannerTextColor === pair.text
                        return (
                          <button
                            key={pair.bg + pair.text}
                            type="button"
                            onClick={() => setConfig({ ...config, bannerBgColor: pair.bg, bannerTextColor: pair.text })}
                            className={`rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition border-2 ${
                              isSelected ? 'ring-2 ring-primary/40 border-primary' : 'border-border'
                            }`}
                            style={{ backgroundColor: pair.bg, color: pair.text }}
                          >
                            {pair.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Preview */}
                  {config.bannerText && (
                    <div>
                      <label className="block text-sm font-medium text-textPrimary mb-2">{t('bannerPreview')}</label>
                      <div
                        className="rounded-lg px-4 py-3 text-center text-sm font-medium"
                        style={{ backgroundColor: config.bannerBgColor, color: config.bannerTextColor }}
                      >
                        {config.bannerText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Upload */}
              {config.bannerType === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-textPrimary mb-2">{t('bannerImageLabel')}</label>

                  {config.bannerImageUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={config.bannerImageUrl}
                          alt={t('bannerImagePreview')}
                          className="w-full h-32 object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-2 text-sm bg-surface border border-border rounded-lg text-textSecondary hover:bg-background transition cursor-pointer"
                        >
                          {t('changeImage')}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-4 py-2 text-sm text-danger border border-border rounded-lg hover:bg-red-50 transition cursor-pointer"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-8 border-2 border-dashed border-border rounded-lg text-textSecondary hover:border-primary hover:text-primary transition cursor-pointer flex flex-col items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? (
                        <span className="text-sm">{t('uploading')}</span>
                      ) : (
                        <>
                          <span className="text-3xl">📷</span>
                          <span className="text-sm">{t('uploadImage')}</span>
                          <span className="text-xs text-textSecondary/60">PNG, JPG, WEBP</span>
                        </>
                      )}
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Link */}
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">{t('bannerLink')}</label>
                <input
                  type="url"
                  value={config.bannerLink}
                  onChange={(e) => setConfig({ ...config, bannerLink: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </div>

        {/* Rate Us Links */}
        <div className="border-t border-border pt-6">
          <p className="font-medium text-textPrimary">{t('rateApp')}</p>
          <p className="text-textSecondary text-sm mb-4">{t('rateAppDesc')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">{t('rateIos')}</label>
              <input
                type="url"
                value={config.rateIosLink}
                onChange={(e) => setConfig({ ...config, rateIosLink: e.target.value })}
                placeholder="https://apps.apple.com/app/..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">{t('rateAndroid')}</label>
              <input
                type="url"
                value={config.rateAndroidLink}
                onChange={(e) => setConfig({ ...config, rateAndroidLink: e.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? t('saving') : t('saveSettings')}
          </button>
          {saved && (
            <span className="text-success text-sm font-medium">{t('savedSuccess')}</span>
          )}
        </div>
      </form>

      {/* Admin Management Section */}
      <div className="mt-8 bg-surface rounded-xl shadow-sm p-4 sm:p-6 max-w-xl">
        <h3 className="text-lg font-bold text-primary mb-1">{t('adminManagement')}</h3>
        <p className="text-textSecondary text-sm mb-4">{t('adminManagementDesc')}</p>

        {adminError && (
          <div className="bg-red-50 text-danger text-sm rounded-lg p-3 mb-4">
            {adminError}
          </div>
        )}

        {/* Add admin form */}
        <form onSubmit={handleAddAdmin} className="flex gap-2 mb-4">
          <input
            type="email"
            placeholder={t('adminEmail')}
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            dir="ltr"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm cursor-pointer"
          >
            {t('addAdmin')}
          </button>
        </form>

        {/* Admin list */}
        {adminLoading ? (
          <p className="text-textSecondary text-sm">{t('loading')}</p>
        ) : admins.length === 0 ? (
          <p className="text-textSecondary text-sm">{t('noAdmins')}</p>
        ) : (
          <ul className="space-y-2">
            {admins.map(admin => (
              <li key={admin.id} className="flex items-center justify-between px-3 sm:px-4 py-3 bg-background rounded-lg gap-2">
                <span className="text-sm text-textPrimary truncate" dir="ltr">{admin.email}</span>
                {admin.email?.toLowerCase() === currentEmail.toLowerCase() ? (
                  <span className="text-xs text-textSecondary">{t('you')}</span>
                ) : (
                  <button
                    onClick={() => handleDeleteAdmin(admin)}
                    className="text-danger text-sm hover:text-red-700 transition cursor-pointer"
                  >
                    {t('delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
