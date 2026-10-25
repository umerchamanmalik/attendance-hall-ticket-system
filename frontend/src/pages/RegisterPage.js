import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  FaUser,
  FaEnvelope,
  FaLock,
  FaUserPlus,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaShieldAlt,
  FaInfoCircle,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";

const RegisterPage = ({ onLogin }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Student");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [userExists, setUserExists] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    setName("");
    setPassword("");
    setConfirmPassword("");
    setRole("Student");
    setDepartment("");
    setError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordStrength(0);
    setUserExists(null);

    if (location.state?.email) {
      setEmail(location.state.email);
    } else {
      setEmail("");
    }
  }, []);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await api.get("/departments/public");
        setDepartments(response.data.data || []);
      } catch (err) {
        console.error("Unable to load departments:", err);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      if (email.length > 5) {
        try {
          const response = await api.get(
            `/auth/check-registration?email=${encodeURIComponent(email)}`,
          );
          if (response.data.success && response.data.data.exists) {
            const userData = response.data.data;
            setUserExists(userData);

            if (userData.role) {
              setRole(userData.role);
            }
            // ✅ NEW: Auto-fill name if pre-created faculty
            if (userData.isPreCreatedFaculty && userData.name) {
              setName(userData.name);
            }
            // ✅ NEW: Auto-fill department if pre-created faculty
            if (userData.isPreCreatedFaculty && userData.department) {
              setDepartment(userData.department);
            }
          } else {
            setUserExists(null);
          }
        } catch (err) {
          console.log("Error checking user:", err);
        }
      }
    };

    const timeout = setTimeout(checkUser, 500);
    return () => clearTimeout(timeout);
  }, [email]);

  const checkPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.match(/[a-z]/)) strength++;
    if (pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/[0-9]/)) strength++;
    if (pwd.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
    return strength;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    checkPasswordStrength(pwd);
  };

  const getPasswordStrengthText = () => {
    const levels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
    return levels[Math.min(passwordStrength, 4)];
  };

  const getPasswordStrengthColor = () => {
    const colors = ["danger", "warning", "info", "success", "success"];
    return colors[Math.min(passwordStrength, 4)];
  };

  const getPasswordStrengthWidth = () => {
    return Math.min((passwordStrength / 5) * 100, 100);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter your name");
      toast.warning("Please enter your name");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email");
      toast.warning("Please enter your email");
      return;
    }
    if (!password) {
      setError("Please enter a password");
      toast.warning("Please enter a password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      toast.warning("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      toast.warning("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const emailLower = email.trim().toLowerCase();

      const response = await api.post("/auth/register", {
        name: name.trim(),
        email: emailLower,
        password,
        role: role,
        department: role === "Faculty" ? department : undefined,
      });

      if (response.data.success) {
        const userData = response.data.data;

        localStorage.setItem(
          "user",
          JSON.stringify({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            department: userData.department || "CS",
            facultyStatus: userData.facultyStatus || null,
            assignedRoleType: userData.assignedRoleType || null,
          }),
        );

        // ✅ UPDATED: Same success message for both roles
        toast.success(`🎉 Registration successful! Welcome, ${userData.name}!`);

        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setRole("Student");
        setDepartment("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setPasswordStrength(0);
        setUserExists(null);

        onLogin({
          token: userData.token,
          role: userData.role,
          user: userData,
        });

        setTimeout(() => {
          const routes = {
            Student: "/student",
            Faculty: "/faculty",
            Mentor: "/mentor",
            HOD: "/hod",
          };
          navigate(routes[userData.role] || "/login");
        }, 500);
      } else {
        throw new Error(response.data.error || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);

      const validationMessages = err.response?.data?.errors
        ?.map((item) => item.msg)
        .join(", ");

      const errorMessage =
        err.response?.data?.error ||
        validationMessages ||
        err.userMessage ||
        "Unable to register. Please try again.";

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = () => {
    if (role === "Student") return <FaUserGraduate size={24} />;
    if (role === "Faculty") return <FaChalkboardTeacher size={24} />;
    return <FaUser size={24} />;
  };

  const getRoleDescription = () => {
    if (role === "Student") {
      return "View attendance, upload documents, download hall tickets";
    }
    if (role === "Faculty") {
      return "Mark attendance, review documents, manage students";
    }
    return "";
  };

  return (
    <>
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "70vh" }}
      >
        <Row className="w-100 justify-content-center">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            <Card className="shadow-lg border-0 rounded-4">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="bg-success bg-opacity-10 p-3 rounded-circle d-inline-block mb-3">
                    <FaUserPlus size={36} className="text-success" />
                  </div>
                  <h3 className="fw-bold mb-1">Create Account</h3>
                  <p className="text-muted small">Register to get started</p>
                </div>

                {/* ✅ NEW: Pre-created faculty welcome */}
                {userExists?.isPreCreatedFaculty && (
                  <Alert variant="success" className="small">
                    <strong>👋 Welcome, {userExists.name}!</strong>
                    <br />
                    <span className="text-muted">
                      Your HOD has created your faculty account. Please set a
                      password to activate it.
                    </span>
                    {userExists.assignedRoleType && (
                      <div className="mt-2">
                        <strong>Your Role:</strong>{" "}
                        <span className="badge bg-primary">
                          {userExists.assignedRoleType}
                        </span>
                      </div>
                    )}
                  </Alert>
                )}

                {userExists && !userExists.isPreCreatedFaculty && (
                  <Alert variant="info" className="small">
                    <strong>Account Found:</strong> {userExists.name}
                    <br />
                    <span className="text-muted">
                      Role: {userExists.role} •{" "}
                      {userExists.isRegistered
                        ? "✅ Already registered"
                        : "⚠️ Needs registration"}
                    </span>
                    {userExists.isRegistered && (
                      <div className="mt-1">
                        <Link to="/login" className="text-primary">
                          Already registered? Click here to login →
                        </Link>
                      </div>
                    )}
                  </Alert>
                )}

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
                      <FaUser className="me-1" /> Full Name
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                      disabled={loading}
                      autoFocus
                      autoComplete="off"
                      className="py-2 rounded-3"
                    />
                  </Form.Group>

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
                      autoComplete="off"
                      className="py-2 rounded-3"
                    />
                    <Form.Text className="text-muted">
                      {role === "Student"
                        ? "Use the email provided by your HOD"
                        : "Use the email your HOD registered you with"}
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      <FaLock className="me-1" /> Password
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="Create a password (min 6 characters)"
                        required
                        disabled={loading}
                        autoComplete="new-password"
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
                    {password && (
                      <div className="mt-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            Strength:{" "}
                            <span
                              className={`text-${getPasswordStrengthColor()} fw-bold`}
                            >
                              {getPasswordStrengthText()}
                            </span>
                          </small>
                          <small className="text-muted">
                            {password.length}/6+
                          </small>
                        </div>
                        <div className="progress" style={{ height: "4px" }}>
                          <div
                            className={`progress-bar bg-${getPasswordStrengthColor()}`}
                            style={{ width: `${getPasswordStrengthWidth()}%` }}
                            role="progressbar"
                          />
                        </div>
                      </div>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      <FaLock className="me-1" /> Confirm Password
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                        disabled={loading}
                        autoComplete="new-password"
                        className="py-2 rounded-3 pe-5"
                      />
                      <Button
                        variant="link"
                        className="position-absolute top-50 end-0 translate-middle-y text-decoration-none text-muted"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        style={{ padding: "0 12px" }}
                        type="button"
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </Button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <small className="text-danger">
                        Passwords do not match
                      </small>
                    )}
                    {confirmPassword &&
                      password === confirmPassword &&
                      password.length > 0 && (
                        <small className="text-success">
                          ✓ Passwords match
                        </small>
                      )}
                  </Form.Group>

                  {/* Hide role selector if pre-created faculty */}
                  {!userExists?.isPreCreatedFaculty && (
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        {getRoleIcon()} Register As
                      </Form.Label>
                      <Form.Select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={loading || (userExists && userExists.role)}
                        className="py-2 rounded-3"
                      >
                        <option value="Student">Student</option>
                        <option value="Faculty">Faculty</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {getRoleDescription()}
                      </Form.Text>
                    </Form.Group>
                  )}

                  {role === "Faculty" && !userExists?.isPreCreatedFaculty && (
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        Department
                      </Form.Label>
                      <Form.Select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={loading}
                        required
                        className="py-2 rounded-3"
                      >
                        <option value="">Select Department</option>
                        {departments.map((item) => (
                          <option key={item._id || item.code} value={item.code}>
                            {item.code} - {item.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  )}

                  <Button
                    variant="success"
                    type="submit"
                    className="w-100 py-2 fw-bold rounded-3"
                    disabled={
                      loading || (userExists && userExists.isRegistered)
                    }
                  >
                    {loading ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <FaUserPlus className="me-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-muted small mb-0">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="text-primary fw-semibold text-decoration-none"
                    >
                      Login here
                    </Link>
                  </p>
                  <div className="mt-2">
                    <small className="text-muted">
                      <FaShieldAlt className="me-1" size={12} />
                      Secure registration with password encryption
                    </small>
                  </div>
                </div>

                {/* ✅ UPDATED: Both flows are identical now */}
                <Alert variant="info" className="mt-3 mb-0 small">
                  <FaInfoCircle className="me-1" />
                  <strong>How Registration Works:</strong>
                  <hr className="my-2" />
                  <div className="mb-2">
                    <FaUserGraduate className="me-1 text-primary" />
                    <strong>Students:</strong> HOD adds you first → register
                    with the same email → instant access.
                  </div>
                  <div>
                    <FaChalkboardTeacher className="me-1 text-success" />
                    <strong>Faculty:</strong> HOD adds you first → register with
                    the same email → instant access. (Same as students!)
                  </div>
                </Alert>
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

export default RegisterPage;
