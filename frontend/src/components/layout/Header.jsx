import React, { useEffect, useState } from 'react';
import { Menu, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/axios';

export const Header = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const [camera, setCamera] = useState(null);
  useEffect(() => {
    let active = true;
    apiClient.get('/recognition/status').then(({ data }) => active && setCamera(data)).catch(() => active && setCamera({ ready: false }));
    return () => { active = false; };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur-md md:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:flex">
          <span className={`h-2 w-2 rounded-full ${camera?.ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>{camera?.camera_id || 'Browser camera'}:</span>
          <span className={`font-semibold ${camera?.ready ? 'text-emerald-600' : 'text-amber-600'}`}>{camera?.ready ? 'Ready' : 'Unavailable'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="/attendance/live"
          className="hidden items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 sm:flex"
        >
          <Camera className="w-3.5 h-3.5" />
          Live Attendance Camera View
        </a>

        <div className="hidden h-5 w-px bg-slate-200 sm:block"></div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">
            {user?.full_name ? user.full_name.charAt(0) : '?'}
          </div>
          <div className="hidden min-w-0 md:block text-left">
            <p className="truncate text-xs font-semibold text-slate-800">{user?.full_name || ''}</p>
            <p className="text-[10px] capitalize text-slate-500">{user?.role || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
