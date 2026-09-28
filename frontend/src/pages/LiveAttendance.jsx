import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle2, Maximize, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axios';

const messages = error => typeof error.response?.data?.detail === 'string'
  ? error.response.data.detail : 'Recognition server unavailable. Retrying automatically…';

export const LiveAttendance = () => {
  const webcam = useRef(null);
  const panel = useRef(null);
  const cameraId = useRef('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const [lastMatch, setLastMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [setup, setSetup] = useState(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [rate, setRate] = useState(0);
  const seen = useRef(new Set());

  useEffect(() => {
    let disposed = false, timer, controller;
    const inspect = async () => {
      controller = new AbortController();
      try {
        const { data } = await apiClient.get('/recognition/status', { signal: controller.signal, timeout: 10000 });
        if (!disposed) {
          setSetup(data);
          if (data.camera_id) cameraId.current = data.camera_id;
        }
      } catch (error) {
        if (!disposed) setServerError(messages(error));
      }
      if (!disposed) timer = setTimeout(inspect, 15000);
    };
    inspect();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, []);

  useEffect(() => {
    let lock, disposed = false;
    const keepAwake = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const nextLock = await navigator.wakeLock?.request('screen');
        if (disposed) await nextLock?.release(); else lock = nextLock;
      } catch { /* Screen wake lock is optional and depends on browser policy. */ }
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    return () => { disposed = true; lock?.release(); document.removeEventListener('visibilitychange', keepAwake); };
  }, []);

  useEffect(() => {
    if (!cameraReady) return;
    let disposed = false, timer, controller;
    const scan = async () => {
      const video = webcam.current?.video;
      if (!video || video.readyState < 2 || !video.srcObject?.getVideoTracks().some(t => t.readyState === 'live')) {
        if (!disposed) { setResult(null); setRate(0); timer = setTimeout(scan, 1000); }
        return;
      }
      const started = performance.now();
      controller = new AbortController();
      try {
        const screenshot = webcam.current.getScreenshot();
        if (!screenshot) throw new Error('No camera frame available');
        const blob = await (await fetch(screenshot)).blob();
        const form = new FormData();
        form.append('file', blob, 'frame.jpg');
        if (!cameraId.current) cameraId.current = `browser-${crypto.randomUUID().slice(0, 20)}`;
        form.append('camera_id', cameraId.current);
        const { data } = await apiClient.post('/recognition/frame', form, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 15000, signal: controller.signal,
        });
        if (disposed) return;
        setServerError('');
        setResult(data);
        setAspect(data.width / data.height);
        setRate(1000 / (performance.now() - started + 450));
        const attendance = data.attendance;
        if (attendance?.success && ['CHECK_IN', 'ALREADY_RECORDED'].includes(attendance.action)) {
          const match = { ...attendance, captured: screenshot };
          setLastMatch(match);
          if (!seen.current.has(attendance.session_id)) {
            seen.current.add(attendance.session_id);
            if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value);
            setEvents(previous => [match, ...previous].slice(0, 20));
          }
        }
      } catch (error) {
        if (!disposed) { setServerError(messages(error)); setResult(null); setRate(0); }
      }
      // Back pressure: only one frame request at a time, with automatic retry.
      if (!disposed) timer = setTimeout(scan, 450);
    };
    scan();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, [cameraReady]);

  const handleCamera = stream => {
    setCameraError(''); setCameraReady(true);
    const track = stream.getVideoTracks()[0];
    const { width, height } = track.getSettings();
    if (width && height) setAspect(width / height);
    track.onended = () => { setCameraReady(false); setCameraError('Camera disconnected. Reconnect it and reload this page.'); };
  };
  const faceResult = result?.attendance;
  const confirmed = faceResult?.success && ['CHECK_IN', 'ALREADY_RECORDED'].includes(faceResult.action);

  return (
    <div ref={panel} className="space-y-5 bg-slate-950 p-4 text-slate-100 min-h-screen overflow-auto">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Camera className="text-cyan-400" />Automatic Attendance</h1>
          <p className="text-sm text-slate-400 mt-1">Face the camera. Attendance is saved automatically after your face is verified.</p>
        </div>
        <button className="rounded-xl border border-slate-700 px-4 py-2 flex gap-2" onClick={() => panel.current?.requestFullscreen?.().catch(() => {})}><Maximize size={18} />Full screen</button>
      </header>
      {(cameraError || serverError || (setup && !setup.ready)) && <div role="alert" className="bg-rose-950 border border-rose-600 rounded-xl p-4 flex gap-3"><AlertTriangle />{cameraError || serverError || setup.message}</div>}
      {setup?.needs_enrollment > 0 && <p className="text-amber-300 text-sm">{setup.needs_enrollment} old face profile(s) need a new photo. <Link className="underline" to="/students">Open student directory</Link>.</p>}
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-3">
          <div className="flex justify-between text-sm text-slate-400"><span>{cameraReady ? 'Camera connected' : 'Waiting for camera permission'}</span><span>{rate.toFixed(1)} scans/sec · {result?.faces?.length ?? 0} faces detected</span></div>
          <div className="relative bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: aspect }}>
            <Webcam ref={webcam} audio={false} mirrored={false} screenshotFormat="image/jpeg" screenshotQuality={0.9}
              videoConstraints={{ width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }}
              onUserMedia={handleCamera} onUserMediaError={error => { setCameraReady(false); setCameraError(`Camera unavailable (${error.name || error}). Allow camera access in your browser and reload.`); }}
              className="w-full h-full object-contain" />
            {result?.faces?.map((face, index) => <div key={index} className={`absolute border-2 rounded-lg pointer-events-none ${confirmed ? 'border-emerald-400' : 'border-amber-300'}`}
              style={{ left: `${100 * face.bbox[0] / result.width}%`, top: `${100 * face.bbox[1] / result.height}%`, width: `${100 * face.bbox[2] / result.width}%`, height: `${100 * face.bbox[3] / result.height}%` }}>
              <span className="absolute bottom-0 left-0 bg-black/80 px-2 py-1 text-xs">{face.label}</span>
            </div>)}
          </div>
          <div role="status" aria-live="polite" className={`rounded-xl p-5 text-center text-xl font-semibold ${confirmed ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-900 text-slate-300'}`}>
            {confirmed && <CheckCircle2 className="inline mr-2" />}{cameraError ? 'Camera unavailable' : serverError ? 'Recognition unavailable — attendance has not been confirmed' : result?.message || 'Allow the camera to start scanning automatically'}
          </div>
          <p className="text-xs text-slate-500">Keep this monitor open and the computer awake. Each student is marked present once per day; remaining in view does not check them out.</p>
        </section>
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h2 className="font-semibold text-slate-300">Last verified student</h2>
          {!lastMatch ? <p className="text-slate-500">No verified face yet. Enrol a clear face photo from the student's profile.</p> : <>
            <div className="grid grid-cols-2 gap-3">
              <div><img src={lastMatch.student.profile_photo_path} alt="Enrolled profile" className="w-full aspect-square object-cover rounded-xl" /><p className="text-xs text-slate-400 mt-1">Profile photo</p></div>
              <div><img src={lastMatch.captured} alt="Verified camera capture" className="w-full aspect-square object-cover rounded-xl" /><p className="text-xs text-slate-400 mt-1">Camera capture</p></div>
            </div>
            <Link to={`/students/${lastMatch.student.id}`} className="text-xl text-cyan-300 font-bold block">{lastMatch.student.full_name}</Link>
            <p>{lastMatch.student.student_id}</p><p className="text-sm text-slate-400 break-all">{lastMatch.student.email}</p>
            <p className="text-sm">{[lastMatch.student.department_name, lastMatch.student.course_name].filter(Boolean).join(' · ')}</p>
            <p className="text-sm text-slate-400">Match similarity: {lastMatch.similarity.toFixed(3)}</p>
            <p className="text-sm">Recorded at {new Date(lastMatch.timestamp).toLocaleString()}</p>
            <div className="text-emerald-300 bg-emerald-900/40 p-3 rounded-lg">Attendance saved</div>
          </>}
        </aside>
      </div>
      <section className="rounded-2xl bg-slate-900 p-5 overflow-auto">
        <h2 className="font-semibold mb-3">Verified on this monitor</h2>
        {!events.length ? <p className="text-slate-500 text-sm">Real matches will appear here.</p> : <table className="w-full text-sm text-left"><thead className="text-slate-400"><tr><th className="p-2">Student</th><th>ID</th><th>Attendance time</th><th>Result</th></tr></thead><tbody>
          {events.map(event => <tr key={event.session_id} className="border-t border-slate-800"><td className="p-2">{event.student.full_name}</td><td>{event.student.student_id}</td><td>{new Date(event.timestamp).toLocaleTimeString()}</td><td className="text-emerald-400">{event.action === 'CHECK_IN' ? 'Attendance done' : 'Already recorded today'}</td></tr>)}
        </tbody></table>}
      </section>
    </div>
  );
};
