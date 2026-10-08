import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
export function AuthLayout(){const {isAuthenticated,isLoading}=useAuthStore();if(isLoading)return null;if(isAuthenticated)return <Navigate to="/dashboard" replace/>;return <main className="auth-page"><Link className="brand" to="/">aituto<span>.</span></Link><p className="muted">Твой AI School Companion</p><div className="panel auth-card"><Outlet/></div><Link className="text-link" to="/">На главную</Link></main>;}
