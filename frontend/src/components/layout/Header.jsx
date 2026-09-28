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
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open navigation menu"
          className="p-2 text-slate-400 hover:text-slate-100 md:hidden rounded-lg hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>{camera?.camera_id || 'Browser camera'}:</span>
          <span className={`font-semibold ${camera?.ready ? 'text-emerald-400' : 'text-amber-400'}`}>{camera?.ready ? 'Ready' : 'Unavailable'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="/attendance/live"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 text-xs font-semibold transition"
        >
          <Camera className="w-3.5 h-3.5" />
          Live Attendance Camera View
        </a>

        <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
            {user?.full_name ? user.full_name.charAt(0) : '?'}
          </div>
          <div className="hidden min-w-0 md:block text-left">
            <p className="truncate text-xs font-semibold text-slate-200">{user?.full_name || ''}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.role || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
