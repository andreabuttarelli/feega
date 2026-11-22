import { Navbar } from './components/Navbar.tsx';
import { HeroBento } from './components/HeroBento.tsx';
import { TeamGrid } from './components/TeamGrid.tsx';
import { CtaBand } from './components/CtaBand.tsx';

export function App() {
  return (
    <>
      <Navbar />
      <HeroBento />
      <TeamGrid />
      <CtaBand />
    </>
  );
}
