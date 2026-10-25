import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  Container,
  Spinner,
  Alert,
  Button,
  Card,
  Badge,
} from "react-bootstrap";
import {
  FaExclamationTriangle,
  FaSync,
  FaUserShield,
  FaHourglassHalf,
  FaInfoCircle,
  FaCheckCircle,
  FaUserCheck,
} from "react-icons/fa";
import api from "../services/api";

// ─────────────────────────────────────────────
// Pending Faculty / Mentor Screen
// ─────────────────────────────────────────────
const PendingApprovalScreen = ({ userName, userRole, onRefresh }) => (
  <Container className="d-flex justify-content-center align-items-center py-5">
    <Card
      className="shadow-lg border-0 rounded-4 text-center"
      style={{ maxWidth: 600 }}
    >
      <Card.Body className="p-4 p-md-5">
        <div className="bg-warning bg-opacity-10 p-4 rounded-circle d-inline-block mb-3">
          <FaHourglassHalf size={48} className="text-warning" />
        </div>
        <h3 className="fw-bold mb-2">⏳ Waiting for HOD Approval</h3>
        <p className="text-muted mb-4">
          Welcome, <strong>{userName || "Faculty"}</strong>! Your account is
          registered but not yet approved.
        </p>

        <Alert variant="info" className="text-start">
          <h6 className="fw-bold">
            <FaInfoCircle className="me-2" />
            What happens next?
          </h6>
          <hr className="my-2" />
          <ol className="mb-0 ps-3">
            <li className="mb-2">
              <strong>HOD reviews your registration</strong> — They will check
              your details.
            </li>
            <li className="mb-2">
              <strong>HOD assigns your role</strong> — You will be assigned as:
              <ul className="mt-1 mb-0">
                <li>
                  <Badge bg="info">Faculty</Badge> — Mark attendance & view
                  history
                </li>
                <li>
                  <Badge bg="success">Mentor</Badge> — Review documents &
                  approve hall tickets
                </li>
                <li>
                  <Badge bg="primary">Both</Badge> — Full access (both roles)
                </li>
              </ul>
            </li>
            <li>
              <strong>HOD assigns your classes</strong> — Subjects, semesters,
              and sections will be added.
            </li>
          </ol>
        </Alert>

        <Alert variant="warning" className="text-start mb-0">
          <strong>📌 Note:</strong> You cannot access any dashboard page until
          HOD approves your account and assigns classes.
          <br />
          <small className="text-muted">
            Please contact your HOD if you have any questions.
          </small>
        </Alert>

        <Button variant="outline-primary" className="mt-4" onClick={onRefresh}>
          <FaSync className="me-1" /> Check Again
        </Button>
      </Card.Body>
    </Card>
  </Container>
);

// ─────────────────────────────────────────────
// Rejected Faculty / Mentor Screen
// ─────────────────────────────────────────────
const RejectedScreen = ({ userName, onRefresh }) => (
  <Container className="d-flex justify-content-center align-items-center py-5">
    <Card
      className="shadow-lg border-0 rounded-4 text-center border-danger"
      style={{ maxWidth: 600 }}
    >
      <Card.Body className="p-4 p-md-5">
        <div className="bg-danger bg-opacity-10 p-4 rounded-circle d-inline-block mb-3">
          <FaExclamationTriangle size={48} className="text-danger" />
        </div>
        <h3 className="fw-bold mb-2 text-danger">❌ Registration Rejected</h3>
        <p className="text-muted mb-4">
          Your registration was not approved by the HOD.
        </p>

        <Alert variant="danger" className="text-start">
          <strong>What can I do?</strong>
          <hr className="my-2" />
          <ul className="mb-0 ps-3">
            <li>Contact your HOD for more information.</li>
            <li>
              If this was a mistake, HOD can update your status from their
              dashboard.
            </li>
          </ul>
        </Alert>

        <Button variant="outline-primary" className="mt-3" onClick={onRefresh}>
          <FaSync className="me-1" /> Refresh
        </Button>
      </Card.Body>
    </Card>
  </Container>
);

// ─────────────────────────────────────────────
// Main Protected Route
// ─────────────────────────────────────────────
const ProtectedRoute = ({ auth, role, children }) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [isValid, setIsValid] = useState(true);

  // ✅ NEW: Faculty status state
  const [facultyStatus, setFacultyStatus] = useState(null);
  const [assignedRoleType, setAssignedRoleType] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // ── Verify token ──
  useEffect(() => {
    const verifyToken = async () => {
      if (!auth.token) {
        setIsValid(false);
        return;
      }

      setVerifying(true);
      setVerifyError(null);
      try {
        const response = await api.get("/auth/profile");
        if (!response.data.success) {
          setIsValid(false);
          setVerifyError("Session expired. Please login again.");
          localStorage.removeItem("token");
        } else {
          // ✅ NEW: Capture faculty status from profile
          const profile = response.data.data;
          if (profile.role === "Faculty" || profile.role === "Mentor") {
            setFacultyStatus(profile.facultyStatus || null);
            setAssignedRoleType(profile.assignedRoleType || null);
          }
        }
      } catch (error) {
        console.error("Token verification error:", error);
        if (error.response?.status === 401) {
          setIsValid(false);
          setVerifyError("Session expired. Please login again.");
          localStorage.removeItem("token");
        } else {
          setVerifyError(
            "Unable to verify session. Please refresh if you experience issues.",
          );
        }
      } finally {
        setVerifying(false);
      }
    };

    if (auth.token) {
      verifyToken();
    }
  }, [auth.token]);

  // ✅ NEW: Fetch faculty status independently (for refresh)
  useEffect(() => {
    const fetchFacultyStatus = async () => {
      if (!auth.token) return;
      const userRole = auth.user?.role || auth.role;
      if (userRole !== "Faculty" && userRole !== "Mentor") return;

      setStatusLoading(true);
      try {
        const res = await api.get("/auth/profile");
        if (res.data.success) {
          setFacultyStatus(res.data.data.facultyStatus || null);
          setAssignedRoleType(res.data.data.assignedRoleType || null);
        }
      } catch (err) {
        console.error("Status fetch error:", err);
      } finally {
        setStatusLoading(false);
      }
    };

    fetchFacultyStatus();
    // eslint-disable-next-line
  }, []);

  const handleRefreshStatus = () => {
    window.location.reload();
  };

  // ── No token ──
  if (!auth.token) {
    return <Navigate to="/login" replace />;
  }

  // ── Verifying ──
  if (verifying) {
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "60vh" }}
      >
        <div className="text-center">
          <Spinner
            animation="border"
            variant="primary"
            style={{ width: "3rem", height: "3rem" }}
          />
          <p className="mt-3 text-muted">Verifying your session...</p>
        </div>
      </Container>
    );
  }

  // ── Invalid token ──
  if (!isValid) {
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "60vh" }}
      >
        <div className="text-center" style={{ maxWidth: "500px" }}>
          <div className="mb-4">
            <FaExclamationTriangle size={48} className="text-warning" />
          </div>
          <Alert variant="danger">
            <strong>Authentication Failed</strong>
            <p className="mb-0 mt-2">{verifyError || "Please login again."}</p>
          </Alert>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
          >
            Go to Login
          </Button>
        </div>
      </Container>
    );
  }

  // ── Role check ──
  const userRole = auth.user?.role || auth.role;
  const userName = auth.user?.name || "User";

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];

    if (!allowedRoles.includes(userRole)) {
      return (
        <Container
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "60vh" }}
        >
          <div className="text-center" style={{ maxWidth: "500px" }}>
            <div className="mb-4">
              <FaUserShield size={48} className="text-danger" />
            </div>
            <Alert variant="danger">
              <strong>Access Denied</strong>
              <p className="mb-0 mt-2">
                You don't have permission to access this page.
              </p>
              <hr />
              <small className="text-muted">
                <strong>Required Role:</strong> {allowedRoles.join(", ")}
                <br />
                <strong>Your Role:</strong> {userRole || "Unknown"}
              </small>
            </Alert>
            <div className="d-flex gap-2 justify-content-center mt-3">
              <Button variant="primary" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  localStorage.removeItem("token");
                  window.location.href = "/login";
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </Container>
      );
    }
  }

  // ─────────────────────────────────────────────
  // ✅ NEW: Faculty / Mentor status check
  // ─────────────────────────────────────────────
  if (userRole === "Faculty" || userRole === "Mentor") {
    // Loading state
    if (statusLoading && facultyStatus === null) {
      return (
        <Container
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "60vh" }}
        >
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Checking your account status...</p>
          </div>
        </Container>
      );
    }

    // Pending approval
    if (facultyStatus === "pending") {
      return (
        <PendingApprovalScreen
          userName={userName}
          userRole={userRole}
          onRefresh={handleRefreshStatus}
        />
      );
    }

    // Rejected
    if (facultyStatus === "rejected") {
      return (
        <RejectedScreen userName={userName} onRefresh={handleRefreshStatus} />
      );
    }
  }

  // ── All checks passed ──
  return children;
};

export default ProtectedRoute;
