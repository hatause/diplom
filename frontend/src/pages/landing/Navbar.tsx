import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Sparkles, ArrowRight, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', justifyContent: 'center',
      padding: '16px 16px 0',
    }}>
      <nav style={{
        width: '100%', maxWidth: '900px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px',
        borderRadius: '16px',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #ff3333, #990000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(255,50,50,0.4)',
          }}>
            <Sparkles size={15} color="#fff" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>AI Tutor</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 700,
              background: '#ff2222', color: '#fff',
              padding: '8px 18px', borderRadius: '10px',
              textDecoration: 'none',
              boxShadow: '0 0 15px rgba(255,34,34,0.3)',
            }}>
              <LayoutDashboard size={14} />
              Главное меню ({user?.firstName || 'Кабинет'})
            </Link>
          ) : (
            <>
              <Link to="/login" style={{
                fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                textDecoration: 'none', padding: '6px 14px',
              }}>Войти</Link>
              <Link to="/register" style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '13px', fontWeight: 700,
                background: '#ff2222', color: '#fff',
                padding: '7px 16px', borderRadius: '10px',
                textDecoration: 'none',
              }}>
                Начать <ArrowRight size={13} />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};
