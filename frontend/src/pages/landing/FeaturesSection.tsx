import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Target, Brain, MessageSquareCode } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    title: 'Адаптивное тестирование',
    desc: 'ИИ анализирует слабые темы и генерирует персональные вопросы нужной сложности.',
    Icon: Target,
  },
  {
    title: 'Метод Фейнмана',
    desc: 'Объясните тему своими словами — алгоритм выявит пробелы и оценит глубину понимания.',
    Icon: Brain,
  },
  {
    title: 'Дебаты с ИИ',
    desc: 'Защищайте тезисы перед виртуальным оппонентом, развивая критическое мышление.',
    Icon: MessageSquareCode,
  },
];

export const FeaturesSection: React.FC = () => {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current.forEach((el) => {
      if (!el) return;
      gsap.fromTo(el, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
      });
    });
  }, []);

  return (
    <section id="features" style={{
      position: 'relative', zIndex: 10,
      padding: '80px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase' as const,
          color: '#ff4444',
        }}>Ключевые возможности</span>
        <h2 style={{
          marginTop: '8px',
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 800, color: '#fff',
        }}>Инструменты нового поколения</h2>
      </div>

      {/* Cards */}
      <div style={{
        width: '100%', maxWidth: '900px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
      }}>
        {features.map((f, i) => (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            style={{
              padding: '28px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              width: '46px', height: '46px', borderRadius: '14px',
              background: 'rgba(255,34,34,0.1)',
              border: '1px solid rgba(255,51,51,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ff4444',
              marginBottom: '20px',
            }}>
              <f.Icon size={22} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
