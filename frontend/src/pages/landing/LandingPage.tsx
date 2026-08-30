import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeuralBackground } from './NeuralBackground';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { FeaturesSection } from './FeaturesSection';
import { ModelSection } from './ModelSection';
import { GamificationSection } from './GamificationSection';
import { TechStackSection } from './TechStackSection';
import { FooterSection } from './FooterSection';

export const LandingPage: React.FC = () => {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: '#050505',
      color: '#ffffff',
      overflowX: 'hidden',
      /* Reset the global font-size 115% on landing page only */
      fontSize: '16px',
    }}>
      {/* Background neural canvas */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }} gl={{ alpha: true, antialias: true }}>
          <color attach="background" args={['#050505']} />
          <Suspense fallback={null}>
            <NeuralBackground />
          </Suspense>
        </Canvas>
      </div>

      {/* Subtle red glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '500px',
          background: 'radial-gradient(ellipse at center, rgba(255,30,30,0.06) 0%, transparent 70%)',
        }} />
      </div>

      <Navbar />

      <main style={{ position: 'relative', zIndex: 10, width: '100%' }}>
        <HeroSection />
        <FeaturesSection />
        <ModelSection />
        <GamificationSection />
        <TechStackSection />
        <FooterSection />
      </main>
    </div>
  );
};

export default LandingPage;
