import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SubdomainProvider } from './contexts/SubdomainContext.tsx';
import './utils/env';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SubdomainProvider>
      <App />
    </SubdomainProvider>
  </StrictMode>,
);
