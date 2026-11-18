import { createRoot } from 'react-dom/client';
import { Pricing } from './Pricing';

createRoot(document.getElementById('root')!).render(
  <main>
    <Pricing plan="Pro" />
  </main>
);
