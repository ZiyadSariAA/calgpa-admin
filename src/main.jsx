import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import logo from '../assets/logo.avif'

// Use logo as tab favicon (works even when logo is not in public/)
;(function setFavicon() {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/avif'
  link.href = logo
  if (!link.parentNode) document.head.appendChild(link)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
