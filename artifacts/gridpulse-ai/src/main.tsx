import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import App from './App';
import './index.css';

if (window.location.hostname.includes('.app.github.dev')) {
  const backendHost = window.location.hostname.replace('-5173.', '-5000.');
  setBaseUrl(`https://${backendHost}`);
} else if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL);
}

createRoot(document.getElementById('root')!).render(<App />);

