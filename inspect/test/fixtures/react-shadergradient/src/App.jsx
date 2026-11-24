import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

export function App() {
  return (
    <section id="hero" style={{ position: 'relative', height: 480, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <ShaderGradient control="props" type="plane" animate="on" uSpeed={0.2} uStrength={4} uDensity={1.3} uFrequency={5.5} brightness={1.2} grain="off" color1="#ff5005" color2="#dbba95" color3="#d0bce1" cAzimuthAngle={180} cPolarAngle={90} cDistance={3.6} rotationX={0} rotationY={10} rotationZ={50} />
      </ShaderGradientCanvas>
      <h1 style={{ position: 'relative', margin: 48, color: 'white' }}>Aurora</h1>
    </section>
  );
}
