import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Camera,
  CalendarCheck,
  FileBarChart,
  BookOpen,
  BookMarked,
  Clock,
  Settings,
  LogOut,
  ShieldCheck,
  BookPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Students', path: '/students', icon: Users },
    { title: 'Add Student', path: '/students/new', icon: UserPlus },
    { title: 'Live Attendance', path: '/attendance/live', icon: Camera, badge: 'Live' },
    { title: 'Attendance Log', path: '/attendance/list', icon: CalendarCheck },
    { title: 'Attendance Reports', path: '/attendance/reports', icon: FileBarChart },
    { title: 'Book Catalogue', path: '/books', icon: BookOpen },
    { title: 'Issue / Return', path: '/books/issue-return', icon: BookMarked },
    { title: 'Overdue Books', path: '/books/overdue', icon: Clock },
    { title: 'Admin Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-30 cursor-default bg-slate-950/65 backdrop-blur-sm transition-opacity md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-slate-800/80 bg-slate-900 shadow-2xl shadow-slate-950/50 transition-transform duration-300 ease-in-out md:w-64 md:max-w-none md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5 md:px-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm leading-tight">Library + Attendance</h1>
          <span className="text-[10px] text-cyan-400 font-medium tracking-wide uppercase">AI Face Recognition</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.title}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse font-semibold">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xs shrink-0">
              {user?.full_name ? user.full_name.charAt(0) : '?'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name || ''}</p>
              <p className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                {user?.role || ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
};
