import { useState } from 'react'
import { signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase/config'
import { useTranslation } from '../context/LanguageContext'
import logo from '../../assets/logo.avif'

const SEED_EMAIL = import.meta.env.VITE_SEED_ADMIN_EMAIL || ''

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { t, lang, setLang } = useTranslation()

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const userEmail = result.user.email.toLowerCase()

      // Seed: if seed admin doc doesn't exist, create it
      if (SEED_EMAIL) {
        const seedRef = doc(db, 'admins', SEED_EMAIL.toLowerCase())
        const seedSnap = await getDoc(seedRef)
        if (!seedSnap.exists()) {
          await setDoc(seedRef, { email: SEED_EMAIL.toLowerCase(), addedAt: serverTimestamp() })
        }
      }

      // Check if this user is an admin
      const adminDoc = await getDoc(doc(db, 'admins', userEmail))

      if (!adminDoc.exists()) {
        // Delete unauthorized user from Firebase Auth, then sign out
        await result.user.delete()
        await signOut(auth)
        setError(t('loginUnauthorized'))
      }
      // If admin exists, onAuthStateChanged in AuthContext handles the rest
    } catch (err) {
      console.error('Sign-in error:', err)
      if (err.code === 'auth/popup-closed-by-user') {
        // user closed popup, do nothing
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(t('loginDomainError'))
      } else {
        setError(t('loginError') + (err.code || err.message))
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm bg-surface rounded-xl shadow-lg p-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-primary-light text-primary hover:bg-primary hover:text-white transition cursor-pointer"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
        <div className="text-center mb-8">
          <img src={logo} alt="CalGPA" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-primary mb-1">{t('loginTitle')}</h1>
          <p className="text-textSecondary text-sm">{t('loginSubtitle')}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-danger text-sm rounded-lg p-3 mb-4 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white border border-border text-textPrimary font-medium rounded-lg hover:bg-gray-50 transition cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? t('loginLoading') : t('loginButton')}
        </button>
      </div>
    </div>
  )
}
