import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { StudentList } from './pages/StudentList';
import { StudentAdd } from './pages/StudentAdd';
import { StudentDetails } from './pages/StudentDetails';
import { LiveAttendance } from './pages/LiveAttendance';
import { AttendanceList } from './pages/AttendanceList';
import { AttendanceReports } from './pages/AttendanceReports';
import { BookList } from './pages/BookList';
import { IssueReturn } from './pages/IssueReturn';
import { OverdueBooks } from './pages/OverdueBooks';
import { AdminSettings } from './pages/AdminSettings';
import { StudentPortal } from './pages/StudentPortal';

const RoleHome = () => {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'student' ? '/student/dashboard' : '/dashboard'} replace />;
};

const AdminOnly = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/" element={<MainLayout />}>
            <Route index element={<RoleHome />} />
            <Route path="dashboard" element={<Dashboard />} />

            <Route path="students" element={<AdminOnly><StudentList /></AdminOnly>} />
            <Route path="students/new" element={<AdminOnly><StudentAdd /></AdminOnly>} />
            <Route path="students/:id" element={<AdminOnly><StudentDetails /></AdminOnly>} />
            <Route path="students/:id/edit" element={<AdminOnly><StudentAdd /></AdminOnly>} />

            <Route path="attendance/live" element={<AdminOnly><LiveAttendance /></AdminOnly>} />
            <Route path="attendance/list" element={<AdminOnly><AttendanceList /></AdminOnly>} />
            <Route path="attendance/reports" element={<AdminOnly><AttendanceReports /></AdminOnly>} />

            <Route path="books" element={<AdminOnly><BookList /></AdminOnly>} />
            <Route path="books/issue-return" element={<AdminOnly><IssueReturn /></AdminOnly>} />
            <Route path="books/overdue" element={<AdminOnly><OverdueBooks /></AdminOnly>} />

            <Route path="admin/settings" element={<AdminOnly><AdminSettings /></AdminOnly>} />

            <Route path="student/dashboard" element={<StudentPortal section="dashboard" />} />
            <Route path="student/profile" element={<StudentPortal section="profile" />} />
            <Route path="student/attendance" element={<StudentPortal section="attendance" />} />
            <Route path="student/history" element={<StudentPortal section="history" />} />
            <Route path="student/library" element={<StudentPortal section="library" />} />
            <Route path="student/notifications" element={<StudentPortal section="notifications" />} />
            <Route path="student/settings" element={<StudentPortal section="settings" />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
