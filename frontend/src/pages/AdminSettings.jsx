import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, Save } from 'lucide-react';
import apiClient from '../api/axios';

export const AdminSettings = () => {
  const [cameras, setCameras] = useState([]);
  const [settingsData, setSettingsData] = useState({
    FACE_RECOGNITION_THRESHOLD: '',
    ATTENDANCE_COOLDOWN_SECONDS: '',
    AUTO_CHECKOUT_HOURS: '',
    OVERDUE_FINE_PER_DAY: ''
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [saveMsg, setSaveMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchAdminData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [cRes, sRes, aRes] = await Promise.all([
        apiClient.get('/admin/cameras'),
        apiClient.get('/admin/settings'),
        apiClient.get('/admin/audit-logs?limit=30')
      ]);
      setCameras(cRes.data);
      setSettingsData(prev => ({ ...prev, ...(sRes.data || {}) }));
      setAuditLogs(aRes.data);
    } catch (e) {
      console.error(e);
      setLoadError(e.response?.data?.detail || 'Could not load administrator settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveMsg(null);
    try {
      await apiClient.put('/admin/settings', settingsData);
      setSaveMsg('Attendance and face recognition settings saved successfully.');
      await fetchAdminData();
    } catch (e) {
      setLoadError(e.response?.data?.detail || 'Could not update settings.');
    }
  };

  const settingsReady = settingsData.FACE_RECOGNITION_THRESHOLD &&
    settingsData.ATTENDANCE_COOLDOWN_SECONDS && settingsData.AUTO_CHECKOUT_HOURS;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          Administration &amp; System Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">Configure face recognition parameters and review actual system activity.</p>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveMsg}</span>
        </div>
      )}
      {loadError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Attendance Engine Parameters</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Face Recognition Confidence Threshold (0.50 - 0.95)</label>
              <input type="number" step="0.05" min="0.5" max="0.95" value={settingsData.FACE_RECOGNITION_THRESHOLD}
                onChange={e => setSettingsData({ ...settingsData, FACE_RECOGNITION_THRESHOLD: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100" />
              <span className="text-[11px] text-slate-400">Minimum match confidence to trigger attendance.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Attendance Cooldown Duration (Seconds)</label>
              <input type="number" min="30" max="3600" value={settingsData.ATTENDANCE_COOLDOWN_SECONDS}
                onChange={e => setSettingsData({ ...settingsData, ATTENDANCE_COOLDOWN_SECONDS: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100" />
              <span className="text-[11px] text-slate-400">Prevents duplicate check-ins while a face remains in view.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Auto-Checkout Window (Hours)</label>
              <input type="number" min="1" max="24" value={settingsData.AUTO_CHECKOUT_HOURS}
                onChange={e => setSettingsData({ ...settingsData, AUTO_CHECKOUT_HOURS: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Overdue Fine per Day (optional)</label>
              <input type="number" step="0.01" min="0" value={settingsData.OVERDUE_FINE_PER_DAY}
                onChange={e => setSettingsData({ ...settingsData, OVERDUE_FINE_PER_DAY: e.target.value })}
                placeholder="Leave blank to disable fines"
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100" />
              <span className="text-[11px] text-slate-400">Used to calculate a fine when an overdue book is returned.</span>
            </div>
            <button type="submit" disabled={loading || !settingsReady}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" /> Save System Settings
            </button>
          </form>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Configured Entrance Cameras</h2>
          <div className="space-y-3">
            {loading ? <p className="text-xs text-slate-500">Loading configured cameras...</p> : cameras.length === 0 ?
              <p className="text-xs text-slate-500">No persistent camera has been configured. Browser Live Attendance can still use its authenticated webcam.</p> : cameras.map(cam => (
                <div key={cam.id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100">{cam.name}</h3>
                    <p className="text-[11px] font-mono text-cyan-400">{cam.camera_code} <span aria-hidden="true">•</span> {cam.location || 'Location not set'}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{cam.status}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-slate-200">System Audit Logs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Admin Email</th><th className="px-4 py-3">Action Code</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading audit logs...</td></tr> : auditLogs.length === 0 ?
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No audit activity has been recorded.</td></tr> : auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-cyan-400">{log.admin_email || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{log.action}</td>
                    <td className="px-4 py-3 text-slate-300">{log.details}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
