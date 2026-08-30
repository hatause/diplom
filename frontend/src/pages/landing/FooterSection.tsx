import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const FooterSection: React.FC = () => {
  return (
    <footer style={{
      position: 'relative', zIndex: 10,
      padding: '80px 24px 40px',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '550px' }}>
        <h2 style={{
          fontSize: 'clamp(22px, 4vw, 30px)',
          fontWeight: 800, color: '#fff',
          marginBottom: '14px',
        }}>
          Готовы начать?
        </h2>
        <p style={{
          fontSize: '14px', color: 'rgba(255,255,255,0.35)',
          maxWidth: '420px', margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          Присоединяйтесь к AI Tutor и используйте мощь ИИ для обучения.
        </p>
        <Link to="/register" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '14px 32px',
          background: '#ff2222', color: '#fff',
          fontSize: '15px', fontWeight: 700,
          borderRadius: '14px', textDecoration: 'none',
        }}>
          Зарегистрироваться <ArrowRight size={16} />
        </Link>
      </div>

      <div style={{
        marginTop: '60px', paddingTop: '20px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        width: '100%', maxWidth: '550px',
        display: 'flex', justifyContent: 'center',
        fontSize: '12px', color: 'rgba(255,255,255,0.2)',
      }}>
        &copy; {new Date().getFullYear()} AI Tutor. Все права защищены.
      </div>
    </footer>
  );
};
