import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { mobileTheme } from './theme/theme';
import { checkAndClearStaleData } from './lib/db';

// Register Service Worker with auto-reload on update
// When a new SW is installed and activated, it will reload automatically
registerSW({
  onNeedRefresh() {
    // New content is available, reload immediately
    console.log('[PWA] New content available, reloading...');
    window.location.reload();
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use');
  },
  onRegisteredSW(_swUrl, r) {
    // Check for updates every 5 minutes
    if (r) {
      setInterval(() => {
        r.update();
      }, 5 * 60 * 1000);
    }
  },
});

// Verificar versión de datos antes de iniciar la app
checkAndClearStaleData().then((wasCleared) => {
  if (wasCleared) {
    console.log('[App] Datos locales limpiados por cambio de versión');
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider theme={mobileTheme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  );
});
