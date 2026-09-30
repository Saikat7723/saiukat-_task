import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookMarked, BookOpen, CalendarCheck, Camera, FileBarChart, LayoutDashboard, LogOut, Settings, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navigation = [
  { title: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, end: true },
  { title: 'Students', path: '/admin/students', icon: Users, end: true },
  { title: 'Add Student', path: '/admin/students/add', icon: UserPlus, end: true },
  { title: 'Live Attendance', path: '/attendance/live', icon: Camera, badge: 'Live' },
  { title: 'Attendance Log', path: '/attendance/list', icon: CalendarCheck },
  { title: 'Attendance Reports', path: '/attendance/reports', icon: FileBarChart },
  { title: 'Book Catalogue', path: '/books', icon: BookOpen, end: true },
  { title: 'Issue / Return', path: '/books/issue-return', icon: BookMarked },
  { title: 'Overdue Books', path: '/books/overdue', icon: ShieldAlert },
  { title: 'Settings', path: '/admin/settings', icon: Settings },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const openSection = (event, path) => {
    event.preventDefault();
    setIsOpen(false);
    navigate(path);
  };

  return (
    <>
      <button type="button" aria-label="Close navigation menu" onClick={() => setIsOpen(false)} className={`fixed inset-0 z-30 cursor-default bg-slate-950/65 backdrop-blur-sm transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />

      <aside aria-label="Admin navigation" className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 max-w-[85vw] flex-col overflow-hidden border-r border-[#173252] bg-gradient-to-b from-[#061a30] via-[#062039] to-[#031629] shadow-2xl shadow-slate-950/50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex h-[74px] items-center gap-2.5 border-b border-white/10 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 via-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-400/25"><BookOpen className="h-5 w-5" strokeWidth={2.4} /></div>
          <div className="min-w-0"><h1 className="truncate text-[13px] font-bold tracking-tight text-white">Library &amp; Attendance</h1><p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-cyan-300">AI Face Recognition</p></div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Admin sections">
          {navigation.map(({ title, path, icon: Icon, badge, end }) => (
            <NavLink key={path} to={path} end={end} onClick={(event) => openSection(event, path)} className={({ isActive }) => `group relative flex h-10 items-center gap-3 rounded-md px-3 text-[12px] font-medium transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-blue-600 text-white shadow-lg shadow-blue-950/40' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}>
              {({ isActive }) => <>
                {isActive && <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-cyan-200 shadow-[0_0_10px_rgba(34,211,238,.95)]" />}
                <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-cyan-200'}`} strokeWidth={2} />
                <span className="truncate">{title}</span>
                {badge && <span className="ml-auto rounded-md bg-emerald-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-950 shadow-sm">{badge}</span>}
              </>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 bg-slate-950/20 px-3 py-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-xs font-bold text-cyan-200">{user?.full_name?.charAt(0) || 'A'}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-white">{user?.full_name || 'Administrator'}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] capitalize text-slate-400"><ShieldCheck className="h-2.5 w-2.5 text-cyan-300" /> {user?.role || 'admin'}</p></div>
            <button type="button" onClick={logout} title="Log out" aria-label="Log out" className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
};
