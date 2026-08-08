import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// In GitHub Codespaces, frontend and backend run on different forwarded
// ports/origins (e.g. ...-5173.app.github.dev vs ...-5000.app.github.dev).
// Derive the backend's origin from the current one by swapping the port.
if (window.location.hostname.includes('.app.github.dev')) {
  const backendHost = window.location.hostname.replace('-5173.', '-5000.');
  setBaseUrl(`https://${backendHost}`);
}

createRoot(document.getElementById('root')!).render(<App />);