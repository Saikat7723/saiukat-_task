import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, User, CalendarCheck, Clock3, BookOpen, Bell, Settings, LogOut, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const links = [
  ['Dashboard', '/student/dashboard', LayoutDashboard],
  ['My Profile', '/student/profile', User],
  ['My Attendance', '/student/attendance', CalendarCheck],
  ['In/Out History', '/student/history', Clock3],
  ['My Library', '/student/library', BookOpen],
  ['Notifications', '/student/notifications', Bell],
  ['Settings', '/student/settings', Settings],
];

export const StudentNavigation = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  return <>
    <button type="button" aria-label="Close navigation" onClick={() => setIsOpen(false)} className={`fixed inset-0 z-30 bg-slate-950/60 md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] overflow-hidden bg-gradient-to-b from-[#07366e] via-[#062b5c] to-[#041f45] text-white shadow-2xl transition-transform md:w-64 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0b3e7e]"><GraduationCap size={28} /></div>
        <div><p className="font-bold leading-tight">University Portal</p><p className="text-[11px] text-blue-100">Student Management System</p></div>
      </div>
      <nav className="relative z-10 space-y-1 px-4 py-5">
        {links.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={() => setIsOpen(false)} className={({ isActive }) => `flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'}`}><Icon size={21} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="pointer-events-none absolute bottom-12 left-0 h-48 w-full opacity-10" aria-hidden="true"><div className="absolute bottom-0 left-6 h-32 w-24 rounded-t-[50%] bg-white" /><div className="absolute bottom-0 left-32 h-44 w-32 rounded-t-[50%] bg-white" /><div className="absolute bottom-0 right-0 h-24 w-20 rounded-t-[50%] bg-white" /></div>
      <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
        <button onClick={logout} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm text-blue-100 hover:bg-white/10"><LogOut size={21} />Logout</button>
        <div className="mt-3 border-t border-white/10 pt-3 text-xs text-blue-100"><p className="truncate font-semibold">{user?.full_name || ''}</p><p className="truncate">{user?.student_id || user?.email || ''}</p></div>
      </div>
    </aside>
  </>;
};
