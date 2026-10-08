import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export const HeroSection: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  return (
    <section style={{
      position: 'relative', zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      minHeight: '85vh',
      padding: '120px 24px 60px',
    }}>
      {/* Badge */}
      <div style={{
        marginBottom: '28px',
        padding: '6px 18px',
        borderRadius: '999px',
        border: '1px solid rgba(255,51,51,0.3)',
        background: 'rgba(255,34,34,0.1)',
        fontSize: '12px', fontWeight: 700,
        letterSpacing: '1.5px',
        textTransform: 'uppercase' as const,
        color: '#ff6666',
      }}>
        Образовательная AI-платформа
      </div>

      {/* Title */}
      <h1 style={{
        maxWidth: '700px',
        fontSize: 'clamp(32px, 6vw, 56px)',
        fontWeight: 800,
        lineHeight: 1.15,
        color: '#ffffff',
        margin: '0 0 20px',
      }}>
        AI Tutor.{' '}
        <span style={{
          background: 'linear-gradient(90deg, #ff4444, #ff8888)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Обучение, которое подстраивается под тебя
        </span>
      </h1>

      {/* Subtitle */}
      <p style={{
        maxWidth: '520px',
        fontSize: 'clamp(15px, 2.5vw, 19px)',
        color: 'rgba(255,255,255,0.45)',
        lineHeight: 1.6,
        margin: '0 0 36px',
      }}>
        Адаптивные тесты, Метод Фейнмана и Дебаты с ИИ — всё на одной платформе
      </p>

      {/* CTA */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
        <Link to={isAuthenticated ? "/dashboard" : "/register"} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '14px 32px',
          background: '#ff2222', color: '#fff',
          fontSize: '15px', fontWeight: 700,
          borderRadius: '14px', textDecoration: 'none',
        }}>
          {isAuthenticated ? (
            <>Перейти в главное меню <LayoutDashboard size={17} /></>
          ) : (
            <>Начать обучение <ArrowRight size={17} /></>
          )}
        </Link>
        <a href="#features" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '14px 28px',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '15px', fontWeight: 600,
          borderRadius: '14px', textDecoration: 'none',
        }}>
          Подробнее
        </a>
      </div>
    </section>
  );
};
