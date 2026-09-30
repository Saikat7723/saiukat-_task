import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { StudentNavigation } from './StudentNavigation';
import { StudentHeader } from './StudentHeader';

export const MainLayout = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading System Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isStudent = user?.role === 'student';
  if (isStudent && !location.pathname.startsWith('/student')) return <Navigate to="/student/dashboard" replace />;
  if (!isStudent && location.pathname.startsWith('/student')) return <Navigate to="/dashboard" replace />;

  return (
    <div className={`min-h-dvh flex overflow-hidden ${isStudent ? 'bg-slate-950 text-slate-100' : 'admin-shell text-slate-900'}`}>
      {isStudent ? <StudentNavigation isOpen={sidebarOpen} setIsOpen={setSidebarOpen} /> : <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />}
      <div className="flex-1 md:ml-64 flex min-w-0 flex-col">
        {isStudent ? <StudentHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} /> : <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}
        <main className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 ${isStudent ? 'bg-gradient-to-br from-[#edf4fb] via-[#f8fafc] to-[#e7f0f8]' : 'admin-workspace bg-gradient-to-br from-[#edf4fb] via-[#f8fbff] to-[#eaf3fb]'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
