import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

function subscribeToNavigation(onNavigate) {
  window.addEventListener('hashchange', onNavigate);
  window.addEventListener('popstate', onNavigate);
  return () => {
    window.removeEventListener('hashchange', onNavigate);
    window.removeEventListener('popstate', onNavigate);
  };
}

function Pages() {
  const page = React.useSyncExternalStore(subscribeToNavigation, () => window.location.hash);
  React.useEffect(() => { window.scrollTo(0, 0); }, [page]);
  return <>
    <App panorama={page === '#/panorama'} archive={page === '#/archivio'} runway={page === '#/pista'} />
    <footer className="projects-footer container">
      <a href="https://links-page-bennibeni.vercel.app/">← ALLLINKS</a>
      <span>Radar Terrazzo Ciampino</span>
    </footer>
  </>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Pages />
  </React.StrictMode>
);
