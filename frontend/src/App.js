import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HodDashboard from "./pages/HodDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import MentorDashboard from "./pages/MentorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AllocateFacultyPage from "./pages/AllocateFacultyPage";
import StudentManagementPage from "./pages/StudentManagementPage";
import AttendancePage from "./pages/AttendancePage";
import AttendanceHistoryPage from "./pages/AttendanceHistoryPage";
import MenteeManagementPage from "./pages/MenteeManagementPage";
import DocumentsPage from "./pages/DocumentsPage";
import HallTicketPage from "./pages/HallTicketPage";
import HallTicketReviewPage from "./pages/HallTicketReviewPage";
import HodHallTicketOverridePage from "./pages/HodHallTicketOverridePage";
import StudentHallTicketPage from "./pages/StudentHallTicketPage";
import StudentDocumentsPage from "./pages/StudentDocumentsPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
// ✅ ADDED: Mobile bottom navbar
import BottomNavbar from "./components/BottomNavbar";

// Exam Features
import ExamManagement from "./pages/ExamManagement";
import HallTicketManagement from "./pages/HallTicketManagement";
import HallTicketApproval from "./pages/HallTicketApproval";
import BulkUploadPage from "./pages/BulkUploadPage";
import ExamDetailsPage from "./pages/ExamDetailsPage";
import AuditLogPage from "./pages/AuditLogPage";

// Student Profile
import StudentProfilePage from "./pages/StudentProfilePage";

// Semester Management
import SemesterManagement from "./pages/SemesterManagement";

// Attendance Progress
import AttendanceProgressPage from "./pages/AttendanceProgressPage";

// ✅ SuperAdmin
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

// ✅ Landing Page
import LandingPage from "./pages/LandingPage";

// ✅ CORRECTED IMPORTS - Using ./ not ../
import { useToast } from "./context/ToastContext";

const App = () => {
  const [auth, setAuth] = useState({
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
  });
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // CHECK BROWSER SESSION - Force Login on fresh tab
  useEffect(() => {
    const hasSession = sessionStorage.getItem("hasSession");

    if (!hasSession) {
      console.log("🔐 Fresh session detected - Clearing credentials");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");

      setAuth({ token: null, role: null });

      sessionStorage.setItem("hasSession", "true");
    }
  }, []);

  // ✅ FIXED: Redirect to login ONLY for protected routes.
  useEffect(() => {
    const publicPaths = ["/", "/login", "/register"];
    const isPublic =
      publicPaths.includes(location.pathname) ||
      location.pathname.startsWith("/register/complete");

    if (!auth.token && !isPublic) {
      navigate("/login");
    }
  }, [auth.token, location.pathname, navigate]);

  const handleLogin = ({ token, role }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    setAuth({ token, role });
    if (role === "HOD") navigate("/hod");
    if (role === "Faculty") navigate("/faculty");
    if (role === "Mentor") navigate("/mentor");
    if (role === "Student") navigate("/student");
    if (role === "SuperAdmin") navigate("/super-admin");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setAuth({ token: null, role: null });
    navigate("/login");
  };

  // ✅ Detect landing page so we can hide the app Navbar and use full-width
  const isLandingPage = location.pathname === "/";

  return (
    <div>
      {/* ✅ Hide the app Navbar on the landing page (landing has its own) */}
      {!isLandingPage && <Navbar auth={auth} onLogout={handleLogout} />}

      {/* ✅ Landing page uses full width; other pages use container.
          Added "app-content-wrapper" so we can pad bottom on mobile. */}
      <div
        className={isLandingPage ? "" : "container mt-4 app-content-wrapper"}
      >
        <Routes>
          {/* ✅ Landing Page (public root) */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Routes */}
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route
            path="/register"
            element={<RegisterPage onLogin={handleLogin} />}
          />

          {/* HOD Routes */}
          <Route
            path="/hod"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <HodDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/allocations"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <AllocateFacultyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/students"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <StudentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/halltickets"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <HodHallTicketOverridePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/exam-management"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <ExamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/hall-ticket-management"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <HallTicketManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/bulk-upload"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <BulkUploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/exam-details/:id"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <ExamDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/semester-management"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <SemesterManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hod/audit-logs"
            element={
              <ProtectedRoute auth={auth} role="HOD">
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          {/* Faculty Routes */}
          <Route
            path="/faculty"
            element={
              <ProtectedRoute auth={auth} role={["Faculty", "Mentor"]}>
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/attendance"
            element={
              <ProtectedRoute auth={auth} role={["Faculty", "Mentor"]}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/history"
            element={
              <ProtectedRoute auth={auth} role={["Faculty", "Mentor"]}>
                <AttendanceHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/documents"
            element={
              <ProtectedRoute auth={auth} role={["Faculty", "Mentor"]}>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />

          {/* Mentor Routes */}
          <Route
            path="/mentor"
            element={
              <ProtectedRoute auth={auth} role={["Mentor", "Faculty"]}>
                <MentorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/mentees"
            element={
              <ProtectedRoute auth={auth} role={["Mentor", "Faculty"]}>
                <MenteeManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/documents"
            element={
              <ProtectedRoute auth={auth} role={["Mentor", "Faculty"]}>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/halltickets"
            element={
              <ProtectedRoute auth={auth} role={["Mentor", "Faculty"]}>
                <HallTicketReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/hall-ticket-approval"
            element={
              <ProtectedRoute auth={auth} role={["Mentor", "Faculty"]}>
                <HallTicketApproval />
              </ProtectedRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute auth={auth} role="Student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/documents"
            element={
              <ProtectedRoute auth={auth} role="Student">
                <StudentDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/halltickets"
            element={
              <ProtectedRoute auth={auth} role="Student">
                <StudentHallTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute auth={auth} role="Student">
                <StudentProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance-progress"
            element={
              <ProtectedRoute auth={auth} role="Student">
                <AttendanceProgressPage />
              </ProtectedRoute>
            }
          />
          {/* ✅ FIXED: Notifications — accessible by ALL authenticated users */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute auth={auth}>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />

          {/* SuperAdmin Routes */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute auth={auth} role="SuperAdmin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          {/* ✅ ADDED: SuperAdmin sub-routes → open specific tab */}
          <Route
            path="/super-admin/departments"
            element={
              <ProtectedRoute auth={auth} role="SuperAdmin">
                <SuperAdminDashboard defaultTab="departments" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/activity"
            element={
              <ProtectedRoute auth={auth} role="SuperAdmin">
                <SuperAdminDashboard defaultTab="activity" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/users"
            element={
              <ProtectedRoute auth={auth} role="SuperAdmin">
                <SuperAdminDashboard defaultTab="users" />
              </ProtectedRoute>
            }
          />
          {/* Wildcard — must come AFTER the specific sub-routes */}
          <Route
            path="/super-admin/*"
            element={
              <ProtectedRoute auth={auth} role="SuperAdmin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Common Routes */}
          <Route
            path="/halltickets"
            element={
              <ProtectedRoute auth={auth}>
                <HallTicketPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>

      {/* ✅ ADDED: Mobile bottom navbar (renders only on mobile, hidden on public pages) */}
      <BottomNavbar auth={auth} />
    </div>
  );
};

export default App;
