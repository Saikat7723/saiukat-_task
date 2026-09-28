import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Clock3, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const StudentHeader = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-8">
    <button onClick={onToggleSidebar} aria-label="Open navigation" className="rounded-lg p-2 text-slate-600 md:hidden"><Menu /></button>
    <div className="hidden items-center gap-3 sm:flex"><div className="hidden rounded-xl bg-slate-50 px-4 py-2 text-left lg:block"><p className="text-xs font-semibold text-slate-900"><CalendarDays className="mr-2 inline text-blue-600" size={18} />{now.toLocaleDateString([], { weekday: 'long' })}</p><p className="pl-6 text-[11px] text-slate-500">{now.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' })}</p></div><div className="rounded-xl bg-slate-50 px-4 py-2 text-left"><p className="text-xs font-bold text-slate-900"><Clock3 className="mr-2 inline text-blue-600" size={18} />{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><p className="pl-6 text-[11px] text-slate-500">Current time</p></div></div>
    <div className="flex items-center gap-4">
      <Link to="/student/notifications" aria-label="Notifications" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell size={22} /></Link>
      <Link to="/student/profile" className="flex items-center gap-3 border-l border-slate-200 pl-4"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-700">{user?.profile_photo_path ? <img src={user.profile_photo_path} alt={user.full_name || 'Profile'} className="h-full w-full object-cover" /> : user?.full_name?.charAt(0) || '?'}</div><div className="hidden sm:block"><p className="text-sm font-bold text-slate-900">{user?.full_name || ''}</p><p className="text-xs text-slate-500">Roll: {user?.student_id || ''}</p></div></Link>
    </div>
  </header>;
};
