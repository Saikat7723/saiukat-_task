import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, CheckCircle2, Save, Camera, Plus, MapPin, Radio, RefreshCw, Server, X } from 'lucide-react';
import apiClient from '../api/axios';

const formatTime = value => {
  if (!value) return '—';
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(timestamp).toLocaleString();
};

export const AdminSettings = () => {
  const [cameras, setCameras] = useState([]);
  const [settingsData, setSettingsData] = useState({
    attendance_start_time: '',
    attendance_cutoff_time: '',
    FACE_RECOGNITION_THRESHOLD: '',
    ATTENDANCE_COOLDOWN_SECONDS: '',
    AUTO_CHECKOUT_HOURS: '',
    OVERDUE_FINE_PER_DAY: ''
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [saveMsg, setSaveMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cameraFormOpen, setCameraFormOpen] = useState(false);
  const [cameraSaving, setCameraSaving] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameraForm, setCameraForm] = useState({ camera_code: '', name: '', location: '', stream_url: '0' });

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

  const addCamera = async event => {
    event.preventDefault();
    setCameraSaving(true);
    setCameraMessage('');
    try {
      await apiClient.post('/admin/cameras', null, { params: cameraForm });
      setCameraMessage('Entrance camera saved and marked active.');
      setCameraForm({ camera_code: '', name: '', location: '', stream_url: '0' });
      setCameraFormOpen(false);
      await fetchAdminData();
    } catch (error) {
      setCameraMessage(error.response?.data?.detail || 'Camera could not be saved. Check that its code is unique.');
    } finally {
      setCameraSaving(false);
    }
  };

  const settingsReady = settingsData.FACE_RECOGNITION_THRESHOLD &&
    settingsData.ATTENDANCE_COOLDOWN_SECONDS && settingsData.AUTO_CHECKOUT_HOURS;

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Settings className="h-5 w-5 text-cyan-600" />
          Administration &amp; System Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">Manage the attendance engine, entrance devices, and recorded administrator activity.</p>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">Attendance Engine Parameters</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {['attendance_start_time', 'attendance_cutoff_time'].map(key => <label key={key} className="block text-sm font-semibold text-slate-700">
              {key === 'attendance_start_time' ? 'Attendance Start Time' : 'Attendance Cutoff Time'}
              <input required type="time" value={settingsData[key]} onChange={e => setSettingsData({ ...settingsData, [key]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
            </label>)}
            <p className="text-xs text-slate-500">Uses the institution timezone. New attendance is accepted only before the cutoff.</p>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Face Recognition Confidence Threshold (0.50 - 0.95)</label>
              <input type="number" step="0.05" min="0.5" max="0.95" value={settingsData.FACE_RECOGNITION_THRESHOLD}
                onChange={e => setSettingsData({ ...settingsData, FACE_RECOGNITION_THRESHOLD: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              <span className="text-xs text-slate-500">Minimum match confidence required to create a check-in.</span>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Attendance Cooldown Duration (Seconds)</label>
              <input type="number" min="30" max="3600" value={settingsData.ATTENDANCE_COOLDOWN_SECONDS}
                onChange={e => setSettingsData({ ...settingsData, ATTENDANCE_COOLDOWN_SECONDS: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              <span className="text-xs text-slate-500">Prevents duplicate check-ins while a face remains in view.</span>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Auto-Checkout Window (Hours)</label>
              <input type="number" min="1" max="24" value={settingsData.AUTO_CHECKOUT_HOURS}
                onChange={e => setSettingsData({ ...settingsData, AUTO_CHECKOUT_HOURS: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Overdue Fine per Day (optional)</label>
              <input type="number" step="0.01" min="0" value={settingsData.OVERDUE_FINE_PER_DAY}
                onChange={e => setSettingsData({ ...settingsData, OVERDUE_FINE_PER_DAY: e.target.value })}
                placeholder="Leave blank to disable fines"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              <span className="text-xs text-slate-500">Used to calculate a fine when an overdue book is returned.</span>
            </div>
            <button type="submit" disabled={loading || !settingsReady}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="w-4 h-4" /> Save System Settings
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"><div><h2 className="text-base font-bold text-slate-900">Configured Entrance Cameras</h2><p className="mt-1 text-xs text-slate-500">{cameras.length} registered device{cameras.length === 1 ? '' : 's'} for attendance monitoring</p></div><div className="flex gap-2"><button type="button" onClick={fetchAdminData} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Refresh cameras"><RefreshCw size={16} /></button><button type="button" onClick={() => { setCameraMessage(''); setCameraFormOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Add camera</button></div></div>
          {cameraFormOpen && <form onSubmit={addCamera} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Register entrance camera</p><button type="button" onClick={() => setCameraFormOpen(false)} className="text-slate-500"><X size={17} /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-600">Camera code<input required maxLength="50" placeholder="e.g. LIB-MAIN-01" value={cameraForm.camera_code} onChange={e => setCameraForm({ ...cameraForm, camera_code: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Display name<input required maxLength="100" placeholder="Main entrance" value={cameraForm.name} onChange={e => setCameraForm({ ...cameraForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Location<input required maxLength="100" placeholder="Library ground floor" value={cameraForm.location} onChange={e => setCameraForm({ ...cameraForm, location: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Device stream / index<input required maxLength="255" placeholder="0 or rtsp://…" value={cameraForm.stream_url} onChange={e => setCameraForm({ ...cameraForm, stream_url: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div><button disabled={cameraSaving} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Server size={15} />{cameraSaving ? 'Saving…' : 'Save camera'}</button></form>}
          {cameraMessage && <p className={`rounded-lg p-3 text-xs ${cameraMessage.includes('saved') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{cameraMessage}</p>}
          <div className="space-y-3">
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading configured cameras...</p> : cameras.length === 0 ?
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Camera className="mx-auto mb-2 text-slate-400" size={26} /><p className="text-sm font-semibold text-slate-700">No entrance camera is registered</p><p className="mt-1 text-xs text-slate-500">Register a device or use the browser webcam in Live Attendance.</p><Link to="/live-attendance" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><Radio size={14} /> Open Live Attendance</Link></div> : cameras.map(cam => (
                <div key={cam.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><Camera size={19} /></div><div><h3 className="text-sm font-bold text-slate-900">{cam.name}</h3><p className="mt-0.5 flex items-center gap-1 text-xs font-mono text-slate-500"><MapPin size={12} /> {cam.camera_code} · {cam.location || 'Location not set'}</p></div></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cam.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{cam.status}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">System Audit Logs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Admin Email</th><th className="px-4 py-3">Action Code</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading audit logs...</td></tr> : auditLogs.length === 0 ?
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No audit activity has been recorded.</td></tr> : auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3 text-cyan-700">{log.admin_email || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600">{log.details}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
