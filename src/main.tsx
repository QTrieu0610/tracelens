import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TraceStoreProvider } from './store/traceStore';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TraceStoreProvider>
      <App />
    </TraceStoreProvider>
  </React.StrictMode>
);
