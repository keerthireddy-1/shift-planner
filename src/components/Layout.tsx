import React from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Calendar, 
  Users, 
  Clock, 
  LayoutDashboard, 
  LogOut, 
  Repeat, 
  Bell, 
  Settings,
  ShieldCheck,
  Zap,
  Box
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Core Roster', path: '/roster', icon: Calendar },
    { name: 'My Protocol', path: '/my-schedule', icon: Clock },
    { name: 'Shift Swaps', path: '/swaps', icon: Repeat },
  ];

  if (user?.role === 'admin') {
    navItems.unshift(
      { name: 'Operations Hub', path: '/admin', icon: ShieldCheck }
    );
  }

  return (
    <div className="flex h-screen bg-bg-deep text-slate-300 font-sans overflow-hidden">
      {/* Sidebar - Glass Rail */}
      <aside className="w-80 glass-morphism border-r border-white/5 flex flex-col relative z-20 m-6 rounded-[2.5rem] shadow-2xl">
        <div className="p-10">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Box className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-black tracking-tighter text-white uppercase">Shift<span className="text-indigo-400">Master</span></h1>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-slate-600">v4.0.2-ALPHA</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-4">
          <p className="px-6 text-[9px] font-black uppercase tracking-[0.5em] text-slate-700 mb-4">Command Center</p>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group",
                isActive 
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-4 h-4", "group-hover:scale-110 transition-transform")} />
                  {item.name}
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-pill"
                      className="absolute left-1 w-1 h-6 bg-indigo-500 rounded-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5 mt-auto">
          <div className="bg-slate-950/50 rounded-3xl p-6 border border-white/5 relative group">
             <div className="absolute inset-0 bg-indigo-500/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-400 border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
                  {user?.name.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user?.name}</p>
                  <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">NODE: {user?.role}</p>
                </div>
             </div>
             <button
              onClick={handleLogout}
              className="w-full mt-6 flex items-center justify-center gap-3 py-3 text-[9px] font-black uppercase tracking-[0.3em] text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20 relative z-10"
            >
              <LogOut className="w-3 h-3" />
              Terminate Session
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content - Perspective View */}
      <main className="flex-1 overflow-y-auto p-12 relative z-10 scroll-smooth">
        <div className="h-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Ornament Fragments */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[150px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[150px] pointer-events-none rounded-full -translate-x-1/2 translate-y-1/2" />
    </div>
  );
}