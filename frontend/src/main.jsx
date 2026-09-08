import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'sonner'
import { initTheme, getTheme } from './lib/theme.js'
import { Provider } from 'react-redux'
import { PersistGate } from "redux-persist/integration/react";
import store from './redux/store.js'
import persistStore from 'redux-persist/es/persistStore'
import { registerServiceWorker } from './lib/push.js'

// Register the push service worker only where it can actually work:
// production builds (HTTPS) or localhost dev. Best-effort — never blocks boot.
if (navigator.serviceWorker && (import.meta.env.PROD || location.hostname === 'localhost')) {
  registerServiceWorker();
}

// Apply the saved theme before first paint (no light/dark flash)
initTheme()

// Toasts follow the app theme (updates live when the toggle fires)
function ThemedToaster() {
  const [theme, setTheme] = useState(getTheme())
  useEffect(() => {
    const onChange = (e) => setTheme(e.detail)
    window.addEventListener('sastagram-theme', onChange)
    return () => window.removeEventListener('sastagram-theme', onChange)
  }, [])
  return <Toaster theme={theme} />
}

let persistor = persistStore(store)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
      <App />
      <ThemedToaster />
      </PersistGate>
    </Provider>
  </StrictMode>,
)
