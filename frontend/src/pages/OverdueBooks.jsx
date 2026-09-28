import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import apiClient from '../api/axios';

export const OverdueBooks = () => {
  const [overdueList, setOverdueList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fineRate, setFineRate] = useState(null);

  const fetchOverdue = async () => {
    setLoading(true);
    try {
      const [overdueRes, settingsRes] = await Promise.all([
        apiClient.get('/book-issues/overdue'),
        apiClient.get('/admin/settings')
      ]);
      setOverdueList(overdueRes.data);
      const parsedRate = Number(settingsRes.data?.OVERDUE_FINE_PER_DAY);
      setFineRate(Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdue();
  }, []);

  const handleReturn = async (issueId) => {
    try {
      await apiClient.post(`/book-issues/${issueId}/return`, {
        return_date: new Date().toISOString().split('T')[0]
      });
      fetchOverdue();
    } catch (e) {
      alert('Return failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-400" />
            Overdue Books & Fine Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track books past due date with the configured overdue fine rate.</p>
          <p className="text-[11px] text-slate-500 mt-1">{fineRate === null ? 'No overdue fine rate configured.' : `Configured rate: ${fineRate.toFixed(2)} per day`}</p>
        </div>
        <div className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-sm rounded-xl">
          {overdueList.length} Overdue Pending
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Book Title</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Student ID</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Fine Amount</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Loading overdue records...</td>
                </tr>
              ) : overdueList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Great news! No overdue books at this time.</td>
                </tr>
              ) : (
                overdueList.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-100">{issue.book?.title}</td>
                    <td className="px-5 py-3.5 text-slate-200">{issue.student_name}</td>
                    <td className="px-5 py-3.5 font-mono text-cyan-400">{issue.student_code}</td>
                    <td className="px-5 py-3.5 text-rose-400 font-semibold">{issue.due_date}</td>
                    <td className="px-5 py-3.5 font-bold text-rose-400">${issue.fine_amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleReturn(issue.id)}
                        className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Return & Pay Fine
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
