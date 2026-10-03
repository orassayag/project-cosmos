import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/app.css';
import './styles/responsive.css';

import { App } from './App';
import { startCosmosFetch } from './api/cosmosClient';

// Started before React renders so the request overlaps the first paint; App subscribes to the
// same cached promise and handles its outcome, including failure.
void startCosmosFetch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
