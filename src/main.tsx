import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

const root = createRoot(document.getElementById('root')!);

// The chess proof portfolio is the site. The previous portfolio stays reachable at ?legacy
// and is loaded (with its own CSS) only on that route.
if (new URLSearchParams(location.search).has('legacy')) {
  Promise.all([import('./App.tsx'), import('./index.css')]).then(([{default: App}]) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
} else {
  document.documentElement.style.background = '#0a0a0a'; // no white flash while the chunk loads
  import('./chess/ChessPortfolio').then(({default: ChessPortfolio}) => {
    root.render(
      <StrictMode>
        <ChessPortfolio />
      </StrictMode>,
    );
  });
}
