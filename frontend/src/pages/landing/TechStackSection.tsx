import React from 'react';

const tech = ['React', 'Node.js', 'Fastify', 'Prisma', 'PostgreSQL', 'Google Gemini', 'Zod'];

export const TechStackSection: React.FC = () => {
  return (
    <section id="tech" style={{
      position: 'relative', zIndex: 10,
      padding: '80px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase' as const,
          color: '#ff4444',
        }}>Стек технологий</span>
        <h2 style={{
          marginTop: '8px',
          fontSize: 'clamp(22px, 4vw, 30px)',
          fontWeight: 800, color: '#fff',
        }}>Построено на передовых технологиях</h2>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px',
        maxWidth: '700px',
      }}>
        {tech.map((t) => (
          <div key={t} style={{
            padding: '10px 22px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '14px', fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
          }}>
            {t}
          </div>
        ))}
      </div>
    </section>
  );
};
