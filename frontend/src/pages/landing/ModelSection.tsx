import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GeminiModel } from './GeminiModel';

export const ModelSection: React.FC = () => {
  return (
    <section id="model" style={{
      position: 'relative', zIndex: 10,
      padding: '80px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase' as const,
          color: '#ff4444',
        }}>
          Интерактивная 3D-модель
        </span>
        <h2 style={{
          marginTop: '8px',
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 800, color: '#fff',
        }}>
          Google Gemini — ядро платформы
        </h2>
        <p style={{
          marginTop: '8px',
          fontSize: '14px', color: 'rgba(255,255,255,0.35)',
        }}>
          Вращайте модель мышкой или пальцем
        </p>
      </div>

      <div style={{
        width: '100%', maxWidth: '500px',
        aspectRatio: '1',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <Canvas camera={{ position: [0, 0, 7], fov: 50 }}>
          <color attach="background" args={['#080000']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
          <pointLight position={[-4, -3, 2]} intensity={0.6} color="#ff2222" />
          <pointLight position={[3, 4, -2]} intensity={0.4} color="#ff6666" />
          <Suspense fallback={null}>
            <GeminiModel />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={1.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI * 3 / 4}
          />
        </Canvas>
        <div style={{
          position: 'absolute', bottom: '14px', left: '14px',
          fontSize: '11px', fontWeight: 600,
          color: 'rgba(255,255,255,0.2)',
          userSelect: 'none',
        }}>
          GEMINI STAR
        </div>
      </div>
    </section>
  );
};
