import React from 'react';
import { Star, Trophy, Flame } from 'lucide-react';

const items = [
  { Icon: Star,   title: 'Система XP',        desc: 'Зарабатывайте опыт за каждый урок и тест.' },
  { Icon: Trophy, title: 'Достижения',         desc: 'Открывайте бейджи за сложные задания.' },
  { Icon: Flame,  title: 'Непрерывные серии',  desc: 'Поддерживайте стрик ежедневных занятий.' },
];

export const GamificationSection: React.FC = () => {
  return (
    <section style={{
      position: 'relative', zIndex: 10,
      padding: '80px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: '800px',
        padding: '40px 32px',
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 700,
            letterSpacing: '2px', textTransform: 'uppercase' as const,
            color: '#ff4444',
          }}>Мотивация</span>
          <h2 style={{
            marginTop: '8px',
            fontSize: 'clamp(22px, 4vw, 30px)',
            fontWeight: 800, color: '#fff',
          }}>Геймификация</h2>
          <p style={{
            marginTop: '8px', fontSize: '14px',
            color: 'rgba(255,255,255,0.35)',
            maxWidth: '400px', margin: '8px auto 0',
          }}>
            Превращайте занятия в увлекательный путь с наглядным прогрессом
          </p>
        </div>

        {/* Items */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', padding: '24px 16px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'rgba(255,34,34,0.1)',
                border: '1px solid rgba(255,51,51,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ff4444', marginBottom: '16px',
              }}>
                <it.Icon size={22} />
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                {it.title}
              </h4>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
