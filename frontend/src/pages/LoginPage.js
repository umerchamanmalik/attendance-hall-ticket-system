import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
} from "react-bootstrap";
import {
  FaEnvelope,
  FaLock,
  FaSignInAlt,
  FaUserGraduate,
  FaShieldAlt,
  FaClock,
  FaChalkboardTeacher,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      toast.warning("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const emailLower = email.trim().toLowerCase();
      const response = await api.post("/auth/login", {
        email: emailLower,
        password,
      });

      if (response.data.success) {
        const userData = response.data.data;

        if (
          userData.role === "Faculty" &&
          userData.facultyStatus === "pending"
        ) {
          toast.warning(
            `⏳ Welcome ${userData.name}! Your account is pending HOD approval.`,
          );
        } else if (
          userData.role === "Faculty" &&
          userData.facultyStatus === "rejected"
        ) {
          toast.error(
            `❌ Your faculty registration was rejected. Please contact HOD.`,
          );
        } else {
          toast.success(`Welcome back, ${userData.name}! 🎉`);
        }

        localStorage.setItem(
          "user",
          JSON.stringify({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            facultyStatus: userData.facultyStatus || null,
            assignedRoleType: userData.assignedRoleType || null,
          }),
        );

        setEmail("");
        setPassword("");
        setShowPassword(false);

        onLogin({
          token: userData.token,
          role: userData.role,
          user: userData,
        });

        setTimeout(() => {
          navigateBasedOnRole(userData.role);
        }, 500);
      } else {
        throw new Error(response.data.error || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);

      if (err.response?.data?.code === "REGISTRATION_REQUIRED") {
        const studentData = err.response?.data?.data;
        setError(
          `Please complete registration first. Student: ${studentData?.name || ""}`,
        );
        toast.warning(
          "Please complete registration first. Go to Register page.",
        );
        setTimeout(() => {
          navigate("/register", {
            state: { email: email.trim().toLowerCase() },
          });
        }, 1000);
        setLoading(false);
        return;
      }

      if (err.response?.data?.code === "FACULTY_REJECTED") {
        setError(
          "Your faculty registration was rejected. Please contact your HOD.",
        );
        toast.error("Faculty registration rejected. Contact HOD.");
        setLoading(false);
        return;
      }

      const validationMessages = err.response?.data?.errors
        ?.map((item) => item.msg)
        .join(", ");

      const errorMessage =
        err.response?.data?.error ||
        validationMessages ||
        err.userMessage ||
        "Unable to login. Please check your credentials.";

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const navigateBasedOnRole = (role) => {
    const routes = {
      HOD: "/hod",
      Faculty: "/faculty",
      Mentor: "/mentor",
      Student: "/student",
      SuperAdmin: "/super-admin",
    };
    navigate(routes[role] || "/login");
  };

  const getRoleIcon = () => {
    return <FaUserGraduate className="text-primary" size={48} />;
  };

  return (
    <>
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "70vh" }}
      >
        <Row className="w-100 justify-content-center">
          <Col xs={12} sm={10} md={8} lg={5} xl={4}>
            <Card className="shadow-lg border-0 rounded-4">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3">
                    {getRoleIcon()}
                  </div>
                  <h3 className="fw-bold mb-1">Welcome Back</h3>
                  <p className="text-muted small">
                    Sign in to access your dashboard
                  </p>
                </div>

                {error && (
                  <Alert
                    variant="danger"
                    className="d-flex align-items-center"
                    dismissible
                    onClose={() => setError("")}
                  >
                    <FaShieldAlt className="me-2" />
                    <div>{error}</div>
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      <FaEnvelope className="me-1" /> Email Address
                    </Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={loading}
                      autoFocus
                      autoComplete="username" /* ✅ FIXED */
                      className="py-2 rounded-3"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      <FaLock className="me-1" /> Password
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        disabled={loading}
                        autoComplete="current-password" /* ✅ FIXED */
                        className="py-2 rounded-3 pe-5"
                      />
                      <Button
                        variant="link"
                        className="position-absolute top-50 end-0 translate-middle-y text-decoration-none text-muted"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ padding: "0 12px" }}
                        type="button"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </Form.Group>

                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100 py-2 fw-bold rounded-3"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <FaSignInAlt className="me-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-muted small mb-0">
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      className="text-primary fw-semibold text-decoration-none"
                    >
                      Register here
                    </Link>
                  </p>
                  <div className="mt-2">
                    <small className="text-muted">
                      <FaShieldAlt className="me-1" size={12} />
                      Secure login with JWT authentication
                    </small>
                  </div>
                </div>

                <Alert variant="info" className="mt-3 mb-0 small">
                  <FaChalkboardTeacher className="me-1 text-primary" />
                  <strong>Faculty Members:</strong> After login, you will see
                  your dashboard. If HOD hasn't assigned classes yet, you will
                  see a "Waiting for Approval" message.
                </Alert>

                <div className="mt-3 p-3 bg-light rounded-3">
                  <small className="text-muted d-block fw-semibold mb-1">
                    Demo Credentials:
                  </small>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge bg-primary">
                      HOD: hod@test.com / 123456
                    </span>
                    <span className="badge bg-success">
                      Faculty: faculty@test.com / 123456
                    </span>
                    <span className="badge bg-info">
                      Mentor: mentor@test.com / 123456
                    </span>
                    <span className="badge bg-warning text-dark">
                      Student: student@test.com / 123456
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <ToastNotification
        show={toast.toast?.show || false}
        message={toast.toast?.message || ""}
        variant={toast.toast?.variant || "success"}
        onClose={toast.hideToast}
      />
    </>
  );
};

export default LoginPage;
