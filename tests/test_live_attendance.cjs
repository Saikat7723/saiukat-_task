const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const frontend = path.resolve(__dirname, '../frontend');
const req = createRequire(path.join(frontend, 'package.json'));
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const babel = req('@babel/core');
const source = fs.readFileSync(path.join(frontend, 'src/pages/LiveAttendance.jsx'), 'utf8');
const code = req('esbuild').transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
const student = { id: 1, student_id: 'TEST001', full_name: 'Test Student', email: 'test@example.com' };
const base = { student, timezone: 'Asia/Kolkata', currentTime: '2026-10-02T10:30:00+05:30', session_date: '2026-10-02' };
for (const action of ['CHECK_IN', 'ALREADY_RECORDED', 'ATTENDANCE_CUTOFF_PASSED', 'ATTENDANCE_NOT_STARTED']) {
  const rejected = action.startsWith('ATTENDANCE_');
  const attendance = { ...base, action, success: !rejected, code: rejected ? action : undefined,
    status: rejected ? 'Missed Cutoff' : 'Present', cutoffTime: '10:00 AM',
    message: 'Attendance must be completed before 10:00 AM.',
    check_in_time: rejected ? undefined : '2026-10-02T03:50:00+00:00', session_id: rejected ? undefined : 1 };
  const result = { attendance, width: 640, height: 480, faces: [{ bbox: [100, 100, 120, 120], label: 'Test Student' }] };
  let index = 0;
  const mock = { ...React, useEffect: () => {}, useRef: () => ({ current: null }),
    useState: initial => { const values = { 0: true, 3: result, 4: attendance, 5: { timezone: 'Asia/Kolkata' } }; const i = index++; return [i in values ? values[i] : initial, () => {}]; } };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === 'react') return mock;
    if (name === 'react-router-dom') return { Link: ({ children }) => React.createElement('a', null, children) };
    if (name === 'react-webcam') return React.forwardRef(() => React.createElement('video'));
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name === '../api/axios') return {};
    throw new Error(name);
  }});
  const html = renderToStaticMarkup(React.createElement(module.exports.LiveAttendance));
  assert(html.includes('Test Student'));
  assert(html.includes('<video'));
  if (action === 'ATTENDANCE_CUTOFF_PASSED') {
    for (const text of ['Attendance Not Accepted', 'deadline has passed.', 'Cutoff time: 10:00 AM', 'Missed Cutoff', 'border-orange-500', '10:30:00 AM']) assert(html.includes(text), text);
    assert(!html.includes('Confirm check-out'));
  } else if (!rejected) {
    assert(html.includes(action === 'CHECK_IN' ? 'Attendance Recorded' : 'Attendance Already Recorded'));
    assert(html.includes('09:20:00 AM'));
    assert(!html.includes('Attendance Not Accepted'));
  }
  console.log('Rendered UI state passed:', action);
}
// Scope validation catches unresolved identifiers that a Vite build permits.
const globals = new Set(['console', 'setTimeout', 'clearTimeout', 'AbortController', 'document', 'navigator', 'performance', 'fetch', 'FormData', 'crypto', 'Date', 'Math', 'Error', 'undefined']);
for (const file of ['LiveAttendance.jsx', 'AdminSettings.jsx']) {
  babel.transformSync(fs.readFileSync(path.join(frontend, 'src/pages', file), 'utf8'), { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] }, plugins: [() => ({ visitor: {
    ReferencedIdentifier(path) { if (!path.scope.hasBinding(path.node.name) && !globals.has(path.node.name) && path.node.type === 'Identifier') throw new Error(`${file}: unresolved ${path.node.name}`); }
  } })] });
  console.log('Identifier scope check passed:', file);
}
