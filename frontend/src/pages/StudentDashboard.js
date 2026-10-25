import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  Alert,
  Button,
  ProgressBar,
} from "react-bootstrap";
import {
  FaUserGraduate,
  FaIdCard,
  FaEnvelope,
  FaCalendarAlt,
  FaBook,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationTriangle,
  FaInfoCircle,
  FaFilePdf,
  FaDownload,
  FaEye,
  FaChartLine,
  FaUser,
  FaShieldAlt,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [progressError, setProgressError] = useState(null);
  const toast = useToast(); // ✅ Use global toast
  const [downloading, setDownloading] = useState(false);

  const baseUrl = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api$/, "")
    : "http://localhost:5000";

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get student data
      const studentResponse = await api.get("/students/me");

      if (studentResponse.data.success) {
        setStudent(studentResponse.data.data);

        if (studentResponse.data.data.showAttendanceProgress !== undefined) {
          setAttendanceEnabled(
            studentResponse.data.data.showAttendanceProgress,
          );
        }

        if (studentResponse.data.data.isPromoted) {
          setPromotionMessage(
            `🎉 Congratulations! You have been promoted to Semester ${studentResponse.data.data.semester}!`,
          );
          toast.success(
            `🎉 Promoted to Semester ${studentResponse.data.data.semester}!`,
          );
        }
      } else {
        throw new Error(
          studentResponse.data.message || "Failed to load student data",
        );
      }

      // Get hall ticket
      try {
        const ticketResponse = await api.get(
          "/exam-halltickets/student/my-hallticket",
        );
        if (ticketResponse.data.success) {
          // ✅ FIX: Get the hallTicket object from the response
          const ticketData = ticketResponse.data.data;
          // If the response has a nested hallTicket object, use it
          const hallTicket = ticketData.hallTicket || ticketData;
          setTicket(hallTicket);
          console.log("✅ Hall Ticket Data:", hallTicket);
          console.log("✅ Subject Eligibility:", hallTicket.subjectEligibility);
        }
      } catch (ticketError) {
        console.log("ℹ️ No hall ticket found:", ticketError.message);
        setTicket(null);
      }
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setError(errorMessage);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadProgress = async () => {
      if (!student || !student._id || !showProgress) return;

      if (!attendanceEnabled) {
        setProgressError("Attendance progress is disabled by your mentor.");
        setProgressLoading(false);
        return;
      }

      setProgressLoading(true);
      setProgressError(null);
      try {
        const response = await api.get(
          `/students/attendance-progress/${student._id}`,
        );

        if (response.data && response.data.success) {
          setProgressData(response.data.data);
        } else {
          setProgressError(
            response.data.message || "No attendance data available.",
          );
        }
      } catch (error) {
        console.error("Error loading attendance progress:", error);
        if (error.response?.data?.disabled) {
          setAttendanceEnabled(false);
          setProgressError(
            "Attendance progress feature is disabled by your mentor.",
          );
        } else if (error.response?.data?.message) {
          setProgressError(error.response.data.message);
        } else {
          setProgressError("Failed to load attendance data. Please try again.");
        }
      } finally {
        setProgressLoading(false);
      }
    };

    loadProgress();
  }, [student, showProgress, attendanceEnabled]);

  const isAttendanceVisible =
    student?.attendanceVisibility === "Show Percentage";

  const handleDownloadPDF = async () => {
    if (!ticket) {
      toast.warning("No hall ticket available to download");
      return;
    }

    // ✅ Frontend check: Student must have photo
    if (!student?.photoPath) {
      toast.warning(
        "⚠️ Please upload your profile photo first. Go to Profile → Upload Photo.",
      );
      return;
    }

    setDownloading(true);
    try {
      const response = await api.get(
        `/exam-halltickets/${ticket._id}/download`,
        { responseType: "blob" },
      );
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HallTicket_${student?.rollNumber || "hallticket"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("✅ Hall ticket downloaded successfully!");
    } catch (error) {
      // ✅ Detect photo-required error from backend
      if (error.response?.data?.code === "PHOTO_REQUIRED") {
        toast.warning(
          "⚠️ Please upload your profile photo before downloading the hall ticket.",
        );
      } else {
        const errorMessage = formatErrorMessage(error);
        toast.error(`❌ ${errorMessage}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleViewFullProgress = () => {
    navigate("/attendance-progress");
  };

  const getAttendanceText = () => {
    if (!ticket || !student) return "N/A";

    if (student.attendanceVisibility !== "Show Percentage") {
      return "🔒 Hidden by mentor";
    }

    // ✅ Check if subjectEligibility exists and has data
    if (!ticket.subjectEligibility || ticket.subjectEligibility.length === 0) {
      console.log("⚠️ No subject eligibility data:", ticket);
      return "No attendance data available";
    }

    const total = ticket.subjectEligibility.length;
    // ✅ Check both eligible and isEligible fields
    const eligible = ticket.subjectEligibility.filter(
      (s) => s.eligible === true || s.isEligible === true,
    ).length;

    const totalPercentage = ticket.subjectEligibility.reduce(
      (sum, s) => sum + (s.attendancePercentage || 0),
      0,
    );
    const avgPercentage = total > 0 ? (totalPercentage / total).toFixed(1) : 0;

    return `${avgPercentage}% (${eligible}/${total} subjects eligible)`;
  };

  const getStatusBadge = () => {
    if (!ticket) {
      return <Badge bg="secondary">No Hall Ticket</Badge>;
    }
    const status = ticket.approvalStatus;
    const variants = {
      Pending: "warning",
      Approved: "success",
      Rejected: "danger",
    };
    return <Badge bg={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getProgressClass = (percentage) => {
    const threshold = progressData?.attendanceThreshold ?? 85;
    if (percentage >= threshold) return "success";
    if (percentage >= threshold - 10) return "warning";
    return "danger";
  };

  const StatCard = ({ icon: Icon, title, value, color, bgColor }) => (
    <Col xs={6} md={3}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0 h-100`}
      >
        <Card.Body className="text-center p-3">
          <h6 className="text-white-50 small mb-1">{title}</h6>
          <h3 className="mb-0">{value || 0}</h3>
        </Card.Body>
      </Card>
    </Col>
  );

  if (loading) {
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
          <h5 className="mt-3 text-muted">Loading your dashboard...</h5>
        </div>
      </Container>
    );
  }

  if (error && !student) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadDashboardData} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaUserGraduate className="me-2 text-primary" />
          Student Dashboard
        </h2>

        {/* Promotion Message */}
        {promotionMessage && (
          <Alert
            variant="success"
            dismissible
            onClose={() => setPromotionMessage("")}
          >
            <strong>{promotionMessage}</strong>
          </Alert>
        )}

        {/* Profile Section */}
        <Row className="g-3 mb-4">
          <Col xs={12} md={4} lg={3}>
            <Card className="shadow-sm border-0 text-center p-3">
              {student?.photoPath ? (
                <img
                  src={`${baseUrl}${student.photoPath}`}
                  alt="Profile"
                  className="rounded-circle mx-auto"
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    border: "3px solid #ddd",
                  }}
                />
              ) : (
                <div
                  className="rounded-circle mx-auto d-flex align-items-center justify-content-center bg-light"
                  style={{
                    width: "120px",
                    height: "120px",
                    border: "3px solid #ddd",
                  }}
                >
                  <FaUser size={48} className="text-secondary" />
                </div>
              )}
              <h5 className="mt-3 mb-1">{student?.studentName || "Student"}</h5>
              <p className="text-muted small mb-0">
                {student?.rollNumber || "N/A"} | Sem{" "}
                {student?.semester || "N/A"}
              </p>
              <p className="text-muted small">
                Section {student?.section || "N/A"}
              </p>
              <div className="mt-2">
                {student?.batch && (
                  <Badge bg="info" className="me-2">
                    Batch: {student.batch}
                  </Badge>
                )}
                <Badge bg="primary">{student?.department || "CS"}</Badge>
              </div>
            </Card>
          </Col>

          <Col xs={12} md={8} lg={9}>
            <Card className="shadow-sm border-0 p-4">
              <h4 className="mb-2">
                Welcome, {student?.studentName || "Student"}!
              </h4>
              <Row className="mt-3">
                <Col md={6}>
                  <p className="mb-1">
                    <FaIdCard className="me-2 text-primary" />{" "}
                    <strong>Roll Number:</strong> {student?.rollNumber || "N/A"}
                  </p>
                  <p className="mb-1">
                    <FaCalendarAlt className="me-2 text-primary" />{" "}
                    <strong>Semester:</strong> {student?.semester || "N/A"}
                  </p>
                  {/* ✅ NEW: Department */}
                  <p className="mb-1">
                    <FaBook className="me-2 text-primary" />{" "}
                    <strong>Department:</strong>{" "}
                    <Badge bg="primary">{student?.department || "CS"}</Badge>
                  </p>
                </Col>
                <Col md={6}>
                  <p className="mb-1">
                    <FaBook className="me-2 text-primary" />{" "}
                    <strong>Section:</strong> {student?.section || "N/A"}
                  </p>
                  <p className="mb-1">
                    <FaEnvelope className="me-2 text-primary" />{" "}
                    <strong>Email:</strong> {student?.email || "N/A"}
                  </p>
                </Col>
              </Row>
              <div className="mt-3 d-flex flex-wrap gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  as={Link}
                  to="/student/profile"
                >
                  <FaUser className="me-1" /> View Profile
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  as={Link}
                  to="/student/documents"
                >
                  <FaBook className="me-1" /> My Documents
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Hall Ticket Section */}
        <Card className="shadow-sm border-0 p-4 mb-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h4 className="mb-0">
              <FaFilePdf className="me-2 text-primary" /> Hall Ticket Status
            </h4>
            {getStatusBadge()}
          </div>

          {!ticket ? (
            <Alert variant="warning">
              <FaExclamationTriangle className="me-2" />
              No hall ticket data available yet. Please contact your mentor.
            </Alert>
          ) : ticket.approvalStatus === "Pending" ? (
            <Alert variant="warning">
              <FaClock className="me-2" />⏳ Hall Ticket Awaiting Mentor
              Approval
            </Alert>
          ) : ticket.approvalStatus === "Rejected" ? (
            <Alert variant="danger">
              <FaTimesCircle className="me-2" />❌ Hall Ticket Rejected
              {ticket.mentorRemarks && (
                <div className="mt-2">
                  <strong>Reason:</strong> {ticket.mentorRemarks}
                </div>
              )}
            </Alert>
          ) : ticket.approvalStatus === "Approved" ? (
            <div>
              <Alert variant="success">
                <FaCheckCircle className="me-2" />✅ Hall Ticket Approved!
              </Alert>
              <Button
                variant="success"
                onClick={handleDownloadPDF}
                disabled={downloading || !student?.photoPath}
                title={
                  !student?.photoPath ? "Please upload your photo first" : ""
                }
              >
                {downloading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <FaDownload className="me-2" />
                    Download Hall Ticket PDF
                  </>
                )}
              </Button>
            </div>
          ) : null}

          <div className="mt-3">
            <h6 className="mb-1">📋 Hall Ticket Status</h6>
            <p className="mb-0">{getAttendanceText()}</p>
          </div>
        </Card>

        {/* Attendance Progress Section */}
        <Card className="shadow-sm border-0 p-4 mb-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="mb-0">
              <FaChartLine className="me-2 text-primary" /> Attendance Progress
            </h5>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant={showProgress ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setShowProgress((prev) => !prev)}
                disabled={!isAttendanceVisible || !attendanceEnabled}
              >
                {showProgress ? "Hide Details" : "Show Details"}
              </Button>

              {attendanceEnabled &&
                isAttendanceVisible &&
                showProgress &&
                progressData && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleViewFullProgress}
                  >
                    <FaEye className="me-1" /> Full Report
                  </Button>
                )}
            </div>
          </div>

          {!isAttendanceVisible ? (
            <Alert variant="secondary" className="mt-3">
              <FaShieldAlt className="me-2" />
              🔒 Attendance details are hidden by your mentor.
              <br />
              <small>Please contact your mentor for more information.</small>
            </Alert>
          ) : !attendanceEnabled ? (
            <Alert variant="secondary" className="mt-3">
              <FaShieldAlt className="me-2" />
              Attendance progress feature is currently disabled by your mentor.
              <br />
              <small>Please contact your mentor for more information.</small>
            </Alert>
          ) : showProgress ? (
            <div className="mt-3">
              {progressLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2">Loading progress...</span>
                </div>
              ) : progressError ? (
                <Alert variant="warning" className="mt-2">
                  <FaExclamationTriangle className="me-2" />
                  {progressError}
                </Alert>
              ) : progressData ? (
                <>
                  {/* Summary Cards */}
                  <Row className="g-3 mb-4">
                    <StatCard
                      icon={FaBook}
                      title="Total Subjects"
                      value={progressData.summary?.totalSubjects || 0}
                      bgColor="bg-primary"
                    />
                    <StatCard
                      icon={FaCheckCircle}
                      title="Eligible"
                      value={progressData.summary?.eligibleSubjects || 0}
                      bgColor="bg-success"
                    />
                    <StatCard
                      icon={FaTimesCircle}
                      title="Not Eligible"
                      value={progressData.summary?.notEligibleSubjects || 0}
                      bgColor="bg-danger"
                    />
                    <StatCard
                      icon={FaChartLine}
                      title="Overall"
                      value={`${progressData.summary?.overallAttendance || 0}%`}
                      bgColor="bg-info"
                    />
                  </Row>

                  {/* Subject-wise Progress */}
                  <h6 className="mb-3">Subject-wise Progress</h6>
                  {progressData.subjectProgress &&
                  progressData.subjectProgress.length > 0 ? (
                    progressData.subjectProgress.map((subject) => (
                      <Card
                        className="mb-3 shadow-sm border-0"
                        key={subject.subjectId || subject.subjectName}
                      >
                        <Card.Body className="p-3">
                          <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">{subject.subjectName}</h6>
                              <small className="text-muted">
                                {subject.subjectCode || ""}
                              </small>
                            </div>
                            <div className="text-end">
                              <Badge
                                bg={getProgressClass(
                                  subject.attendancePercentage,
                                )}
                                className="fs-6"
                              >
                                {subject.attendancePercentage}%
                              </Badge>
                              <div className="mt-1">
                                <Badge
                                  bg={getProgressClass(
                                    subject.attendancePercentage,
                                  )}
                                >
                                  {subject.statusText || "N/A"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <ProgressBar
                            now={Math.min(subject.attendancePercentage, 100)}
                            label={`${subject.attendancePercentage}%`}
                            variant={getProgressClass(
                              subject.attendancePercentage,
                            )}
                            striped={
                              subject.attendancePercentage <
                              (progressData.attendanceThreshold ?? 85)
                            }
                            animated={
                              subject.attendancePercentage <
                              (progressData.attendanceThreshold ?? 85)
                            }
                            style={{ height: "20px" }}
                          />
                          <div className="mt-2 small text-muted d-flex flex-wrap justify-content-between">
                            <span>Present: {subject.presentClasses || 0}</span>
                            <span>Total: {subject.totalClasses || 0}</span>
                            <span>
                              Absent:{" "}
                              {(subject.totalClasses || 0) -
                                (subject.presentClasses || 0)}
                            </span>
                          </div>

                          <div className="mt-2">
                            {subject.attendancePercentage >=
                            (progressData.attendanceThreshold ?? 85) ? (
                              <span className="text-success">
                                <FaCheckCircle className="me-1" /> Above{" "}
                                {progressData.attendanceThreshold ?? 85}% -
                                Eligible!
                              </span>
                            ) : subject.classesNeeded > 0 ? (
                              <span className="text-warning">
                                <FaClock className="me-1" />
                                Need <strong>
                                  {subject.classesNeeded}
                                </strong>{" "}
                                more class
                                {subject.classesNeeded > 1 ? "es" : ""} to reach
                                {progressData.attendanceThreshold ?? 85}%
                                {subject.totalClasses < 5 && (
                                  <span className="text-muted d-block small">
                                    (Only {subject.totalClasses} classes
                                    conducted so far)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-success">
                                <FaCheckCircle className="me-1" /> Above{" "}
                                {progressData.attendanceThreshold ?? 85}% -
                                Eligible!
                              </span>
                            )}
                          </div>

                          {subject.safeToSkip > 0 && (
                            <div className="mt-1 small text-success">
                              <FaCheckCircle className="me-1" />
                              Can skip <strong>
                                {subject.safeToSkip}
                              </strong>{" "}
                              class
                              {subject.safeToSkip > 1 ? "es" : ""} and stay
                              above {progressData.attendanceThreshold ?? 85}%
                            </div>
                          )}
                          {subject.attendancePercentage <
                            (progressData.attendanceThreshold ?? 85) - 10 && (
                            <div className="mt-1 small text-danger">
                              <FaExclamationTriangle className="me-1" />
                              ⚠️ ATTENTION NEEDED! Below{" "}
                              {(progressData.attendanceThreshold ?? 85) - 10}%
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    ))
                  ) : (
                    <Alert variant="info">No subject data available</Alert>
                  )}
                </>
              ) : (
                <Alert variant="info">No progress details available yet.</Alert>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setShowProgress(true)}
              >
                <FaEye className="me-1" /> Click to view your attendance
                progress
              </Button>
            </div>
          )}
        </Card>

        {/* Navigation Buttons */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          <Button as={Link} to="/student/halltickets" variant="primary">
            <FaFilePdf className="me-1" /> View Full Hall Ticket
          </Button>
          <Button as={Link} to="/student/profile" variant="secondary">
            <FaUser className="me-1" /> My Profile
          </Button>
          <Button
            as={Link}
            to="/student/documents"
            variant="info"
            className="text-white"
          >
            <FaBook className="me-1" /> My Documents
          </Button>
          {attendanceEnabled && progressData && (
            <Button as={Link} to="/attendance-progress" variant="success">
              <FaChartLine className="me-1" /> Full Progress Report
            </Button>
          )}
        </div>
      </Container>

      {/* ✅ Global Toast Notification */}
      <ToastNotification
        show={toast.toast?.show || false}
        message={toast.toast?.message || ""}
        variant={toast.toast?.variant || "success"}
        onClose={toast.hideToast}
      />
    </>
  );
};

export default StudentDashboard;
