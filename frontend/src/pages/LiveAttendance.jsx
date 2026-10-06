import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Camera, CheckCircle2, LogIn, LogOut, Maximize, AlertTriangle, Clock3, ScanFace, UserCheck, Flag } from 'lucide-react';
import apiClient from '../api/axios';

const messages = error => typeof error.response?.data?.detail === 'string'
  ? error.response.data.detail : 'Recognition server unavailable. Retrying automatically…';
const asDate = value => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
const duration = minutes => minutes === null || minutes === undefined ? '—' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const speakMessage = (message) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(msg);
  }
};

export const LiveAttendance = () => {
  const webcam = useRef(null);
  const panel = useRef(null);
  const cameraId = useRef('');
  const lastDecision = useRef('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const [lastMatch, setLastMatch] = useState(null);
  const [setup, setSetup] = useState(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [rate, setRate] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [studentSessions, setStudentSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  const enableAudio = () => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance('');
      msg.volume = 0;
      window.speechSynthesis.speak(msg);
    }
    setIsAudioEnabled(true);
  };

  const institutionTimezone = lastMatch?.timezone || setup?.timezone;
  const time = value => value ? asDate(value).toLocaleTimeString('en-US', { timeZone: institutionTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

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
      let delay = 450;
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
        const attendance = data.attendance;
        if (attendance?.student) {
          // Keep identification running, but debounce stable faces and repeated announcements.
          delay = 2000;
          const decision = `${attendance.student.id}:${attendance.action}:${attendance.session_id || attendance.session_date}:${attendance.cutoffTime || ''}`;
          if (lastDecision.current !== decision) {
            lastDecision.current = decision;
            setLastMatch({ ...attendance, captured: screenshot });
            if (attendance.success && ['CHECK_IN', 'CHECK_OUT'].includes(attendance.action)) {
              speakMessage('Attendance successfully taken');
            } else if (attendance.success === false) {
              speakMessage('Attendance not accepted');
            }
          }
        } else {
          lastDecision.current = '';
        }
        setRate(1000 / (performance.now() - started + delay));
      } catch (error) {
        if (!disposed) { setServerError(messages(error)); setResult(null); setRate(0); }
      }
      // Back pressure: only one frame request at a time, with automatic retry.
      if (!disposed) timer = setTimeout(scan, delay);
    };
    scan();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, [cameraReady]);

  useEffect(() => {
    if (!lastMatch?.student?.id) {
      setStudentSessions([]);
      return;
    }
    let cancelled = false;
    const loadSessions = async () => {
      setSessionsLoading(true);
      try {
        const { data } = await apiClient.get('/attendance', { params: { student_id: lastMatch.student.id, limit: 8 } });
        if (!cancelled) setStudentSessions(data);
      } catch {
        if (!cancelled) setStudentSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    };
    loadSessions();
    return () => { cancelled = true; };
  }, [lastMatch?.student?.id, lastMatch?.session_id, lastMatch?.check_out_time]);

  const handleCamera = stream => {
    setCameraError(''); setCameraReady(true);
    const track = stream.getVideoTracks()[0];
    const { width, height } = track.getSettings();
    if (width && height) setAspect(width / height);
    track.onended = () => { setCameraReady(false); setCameraError('Camera disconnected. Reconnect it and reload this page.'); };
  };
  const faceResult = result?.attendance;
  const confirmed = faceResult?.success && ['CHECK_IN', 'CHECK_OUT', 'ALREADY_RECORDED'].includes(faceResult.action);
  const rejected = faceResult?.code === 'ATTENDANCE_CUTOFF_PASSED';
  const lastRejected = lastMatch?.success === false;
  const hasActiveSession = lastMatch?.success && !lastMatch.check_out_time;
  const title = match => match?.code === 'ATTENDANCE_CUTOFF_PASSED' ? 'Attendance Not Accepted'
    : match?.code === 'ATTENDANCE_NOT_STARTED' ? 'Attendance Not Started'
      : match?.action === 'ALREADY_RECORDED' ? 'Attendance Already Recorded'
        : match?.action === 'CHECK_OUT' ? 'Check-out Recorded' : 'Attendance Recorded';
  const displayedMessage = rejected ? 'Student verified — attendance deadline passed'
    : faceResult?.code === 'ATTENDANCE_NOT_STARTED' ? faceResult.message
      : confirmed ? title(faceResult) : result?.message || 'Allow the camera to start scanning automatically';

  const confirmCheckout = async () => {
    if (!lastMatch?.session_id || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const { data } = await apiClient.post(`/attendance/${lastMatch.session_id}/checkout`);
      const match = { ...lastMatch, ...data, captured: lastMatch.captured, similarity: lastMatch.similarity };
      setLastMatch(match);
      setResult({ attendance: data, message: 'Check-out recorded successfully.' });
    } catch (error) {
      setCheckoutError(messages(error));
    } finally {
      setCheckoutBusy(false);
    }
  };

  const detectedTime = lastMatch?.currentTime ? asDate(lastMatch.currentTime).toLocaleTimeString('en-US', {
    timeZone: institutionTimezone, hour: '2-digit', minute: '2-digit',
  }) : '—';
  const detectedDate = lastMatch?.currentTime ? asDate(lastMatch.currentTime).toLocaleDateString('en-GB', {
    timeZone: institutionTimezone, day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';
  const rejectionPanel = lastRejected && (
    <div role="status" className="space-y-4 rounded-xl border border-red-100 bg-red-50/80 p-4 text-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg font-bold text-white" aria-hidden="true">!</span>
        <div><p className="font-bold text-red-600">{title(lastMatch)}</p>
          {lastMatch.code === 'ATTENDANCE_CUTOFF_PASSED' && <p className="mt-1 text-xs leading-relaxed text-slate-500">Your attendance was not accepted because the attendance deadline has passed.</p>}
        </div>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-red-100/70 p-3 text-xs font-medium text-red-600"><AlertTriangle size={14} className="shrink-0" />{lastMatch.message}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-white/60 p-3">
          <Clock3 size={18} className="shrink-0 text-red-500" />
          <div><p className="text-xs text-slate-500">Detected at</p><p className="whitespace-nowrap font-bold text-red-600">{detectedTime}</p><p className="mt-1 text-xs text-slate-500">{detectedDate}</p></div>
        </div>
        {lastMatch.cutoffTime && <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-white/60 p-3">
          <Flag size={18} className="shrink-0 text-red-500" />
          <div><p className="text-xs text-slate-500">Cutoff time</p><p className="whitespace-nowrap font-bold text-slate-800">{lastMatch.cutoffTime}</p><p className="mt-1 text-xs text-slate-500">{detectedDate}</p></div>
        </div>}
      </div>
      {lastMatch.code === 'ATTENDANCE_CUTOFF_PASSED' && <p className="flex items-center gap-2 rounded-lg bg-red-100/70 p-3 text-xs font-medium text-red-600"><ScanFace size={21} className="shrink-0" />Student verified — attendance deadline passed.</p>}
      <p className="text-xs font-semibold text-red-600">Status: {lastMatch.status}</p>
    </div>
  );

  const todaySessions = studentSessions.filter(session => session.session_date === lastMatch?.session_date);
  const recentSessions = studentSessions.filter(session => !todaySessions.some(today => today.id === session.id)).slice(0, 3);

  return (
    <>
      {!isAudioEnabled && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm">
          <ScanFace size={64} className="mb-6 animate-pulse text-emerald-400" />
          <h2 className="mb-2 text-3xl font-bold text-white">Live Attendance Kiosk</h2>
          <p className="mb-8 text-slate-300">Click below to enable the camera and audio announcements.</p>
          <button 
            onClick={enableAudio} 
            className="rounded-full bg-emerald-500 px-8 py-4 text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-900/50 transition hover:bg-emerald-400"
          >
            Start Attendance
          </button>
        </div>
      )}
    <div ref={panel} className="min-h-screen space-y-5 bg-slate-50 p-5 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />Live Attendance <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span></h1><p className="mt-1 text-sm text-slate-500">Face recognition is active. Position one face clearly in front of the camera.</p></div>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => panel.current?.requestFullscreen?.().catch(() => {})}><Maximize size={17} /> Full screen monitor</button>
      </header>
      {(cameraError || serverError || (setup && !setup.ready)) && <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertTriangle />{cameraError || serverError || setup.message}</div>}
      {setup?.needs_enrollment > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{setup.needs_enrollment} face profile(s) need a new photo. Update the enrollment photo through the approved student administration process.</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(390px,0.85fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap justify-between gap-3 text-sm"><span className={`flex items-center gap-2 font-semibold ${cameraReady ? 'text-emerald-700' : 'text-amber-700'}`}><Camera size={17} />{cameraReady ? 'Camera active' : 'Waiting for camera permission'}</span><span className="text-slate-500">{rate.toFixed(1)} scans/sec · {result?.faces?.length ?? 0} face{(result?.faces?.length ?? 0) === 1 ? '' : 's'} detected</span></div>
          <div className="relative overflow-hidden rounded-2xl bg-slate-950" style={{ aspectRatio: aspect }}>
            <Webcam ref={webcam} audio={false} mirrored={false} screenshotFormat="image/jpeg" screenshotQuality={0.9}
              videoConstraints={{ width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }}
              onUserMedia={handleCamera} onUserMediaError={error => { setCameraReady(false); setCameraError(`Camera unavailable (${error.name || error}). Allow camera access in your browser and reload.`); }}
              className="w-full h-full object-contain" />
            {result?.faces?.map((face, index) => <div key={index} className={`pointer-events-none absolute rounded-lg border-2 ${rejected ? 'border-orange-500' : confirmed ? 'border-emerald-400' : 'border-amber-300'}`}
              style={{ left: `${100 * face.bbox[0] / result.width}%`, top: `${100 * face.bbox[1] / result.height}%`, width: `${100 * face.bbox[2] / result.width}%`, height: `${100 * face.bbox[3] / result.height}%` }}>
              <span className={`absolute bottom-0 left-0 px-2 py-1 text-xs font-semibold ${rejected ? 'bg-orange-500 text-white' : confirmed ? 'bg-emerald-500 text-emerald-950' : 'bg-amber-300 text-amber-950'}`}>{face.label}</span>
            </div>)}
            {(confirmed || rejected) && <div className={`absolute bottom-5 right-5 max-w-xs rounded-2xl border p-5 text-center text-white shadow-xl ${rejected ? 'border-orange-300 bg-orange-950/95' : 'border-emerald-300 bg-emerald-950/90'}`}>
              {rejected ? <AlertTriangle className="mx-auto mb-2 text-orange-300" size={36} /> : <CheckCircle2 className="mx-auto mb-2 text-emerald-300" size={36} />}
              <p className="text-lg font-bold">{title(faceResult)}</p>
              {rejected ? <><p className="mt-1 text-sm">Your attendance was not accepted because the attendance deadline has passed.</p><p className="mt-2 text-sm">{faceResult.message}</p><p className="mt-2 text-xs">Detected at: {time(faceResult.currentTime)}<br />Cutoff time: {faceResult.cutoffTime}<br />Status: Missed Cutoff</p></>
                : <>{faceResult.action === 'CHECK_IN' && <p className="mt-1 text-sm">Your attendance has been successfully recorded.</p>}<p className="mt-2 text-xs">Check-in: {time(faceResult.check_in_time)}<br />Status: Present</p></>}
            </div>}
          </div>
          <div role="status" aria-live="polite" className={`rounded-xl border p-4 text-center text-sm font-semibold ${faceResult?.success === false ? 'border-orange-300 bg-orange-50 text-orange-800' : confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            {confirmed && <CheckCircle2 className="mr-2 inline" size={18} />}{cameraError ? 'Camera unavailable' : serverError ? 'Recognition unavailable — attendance has not been confirmed' : displayedMessage}
          </div>
          {lastMatch && <div className="flex items-center justify-between rounded-xl bg-blue-50 p-4"><div className="flex items-center gap-3">{lastMatch.student.profile_photo_path && <img src={lastMatch.student.profile_photo_path} alt="Profile" className="h-12 w-12 rounded-full object-cover" />}<div><p className="font-semibold text-slate-900">{lastMatch.student.full_name} <span className={`ml-1 rounded-full px-2 py-1 text-xs ${lastRejected ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-700'}`}>{lastMatch.status || 'Present'}</span></p><p className="text-sm text-slate-500">Verified by face recognition at {time(lastMatch.check_in_time || lastMatch.currentTime)}</p></div></div><Link className="text-sm font-semibold text-blue-600" to={`/students/${lastMatch.student.id}`}>View details</Link></div>}
        </section>
        <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Current student</h2>{lastMatch && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lastRejected ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-700'}`}>{lastMatch.status || 'Present'}</span>}</div>
          {!lastMatch ? <div className="rounded-xl bg-slate-50 p-8 text-center"><ScanFace className="mx-auto mb-3 text-slate-400" size={34} /><p className="font-semibold text-slate-700">Waiting for a verified student</p><p className="mt-1 text-sm text-slate-500">Student identity and live session details appear after a stable face match.</p></div> : <><div className="flex gap-4 rounded-xl bg-slate-50 p-3"><img src={lastMatch.student.profile_photo_path} alt="Student profile" className="h-28 w-28 rounded-xl object-cover" /><div className="min-w-0"><Link to={`/students/${lastMatch.student.id}`} className="text-xl font-bold text-slate-900">{lastMatch.student.full_name}</Link><p className="mt-1 font-mono text-sm text-blue-700">{lastMatch.student.student_id}</p><p className="mt-3 break-all text-sm text-slate-600">{lastMatch.student.email}</p><p className="mt-2 text-sm text-slate-600">{[lastMatch.student.department_name, lastMatch.student.course_name].filter(Boolean).join(' · ')}</p></div></div><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-emerald-50 p-3"><LogIn className="text-emerald-600" size={19} /><p className="mt-2 text-xs text-slate-500">{lastRejected ? 'Detected at' : 'Check-in'}</p><p className="font-bold">{time(lastMatch.check_in_time || lastMatch.currentTime)}</p></div><div className="rounded-xl bg-rose-50 p-3"><LogOut className="text-rose-600" size={19} /><p className="mt-2 text-xs text-slate-500">Check out</p><p className="font-bold">{time(lastMatch.check_out_time)}</p></div><div className="rounded-xl bg-blue-50 p-3"><Clock3 className="text-blue-600" size={19} /><p className="mt-2 text-xs text-slate-500">Duration</p><p className="font-bold">{duration(lastMatch.duration_minutes)}</p></div></div>{lastRejected ? rejectionPanel : hasActiveSession ? <button type="button" onClick={confirmCheckout} disabled={checkoutBusy} className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 disabled:opacity-60">{checkoutBusy ? 'Recording check-out…' : 'Confirm check-out'}</button> : <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">Check-out recorded at {time(lastMatch.check_out_time)}</div>}{checkoutError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{checkoutError}</p>}<section><h3 className="mb-3 flex items-center gap-2 font-bold"><UserCheck size={18} className="text-blue-600" />Today&apos;s attendance</h3>{sessionsLoading ? <p className="text-sm text-slate-500">Loading verified attendance…</p> : todaySessions.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Check in</th><th className="p-2">Check out</th><th className="p-2">Duration</th></tr></thead><tbody>{todaySessions.map((session, index) => <tr key={session.id} className="border-b border-slate-100"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold text-emerald-700">{time(session.check_in_time)}</td><td className="p-2">{time(session.check_out_time)}</td><td className="p-2">{duration(session.duration_minutes)}</td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">No session recorded for today.</p>}</section><section><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Recent attendance</h3><Link to={`/students/${lastMatch.student.id}`} className="text-xs font-semibold text-blue-600">View student</Link></div>{recentSessions.length ? <div className="space-y-2">{recentSessions.map(session => <div key={session.id} className="grid grid-cols-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>{session.session_date}</span><span>{time(session.check_in_time)}</span><span>{time(session.check_out_time)}</span><span>{duration(session.duration_minutes)}</span></div>)}</div> : <p className="text-sm text-slate-500">No earlier attendance sessions.</p>}</section></>}
        </aside>
      </div>
    </div>
    </>
  );
};
