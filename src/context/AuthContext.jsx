import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)
const SEED_EMAIL = (import.meta.env.VITE_SEED_ADMIN_EMAIL || '').toLowerCase()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email?.toLowerCase()
        if (email) {
          // Seed the first admin if needed
          if (SEED_EMAIL) {
            const seedRef = doc(db, 'admins', SEED_EMAIL)
            const seedSnap = await getDoc(seedRef)
            if (!seedSnap.exists()) {
              await setDoc(seedRef, { email: SEED_EMAIL, addedAt: serverTimestamp() })
            }
          }

          const adminDoc = await getDoc(doc(db, 'admins', email))
          if (adminDoc.exists()) {
            setUser(firebaseUser)
            setIsAdmin(true)
            setLoading(false)
            return
          }
        }
        // Signed in but not admin — sign out
        await signOut(auth)
        setUser(null)
        setIsAdmin(false)
      } else {
        setUser(null)
        setIsAdmin(false)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
