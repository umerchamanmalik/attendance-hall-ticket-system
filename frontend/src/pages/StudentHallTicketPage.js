import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  Button,
  Alert,
} from "react-bootstrap";
import {
  FaTicketAlt,
  FaDownload,
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaInfoCircle,
  FaUserGraduate,
  FaIdCard,
  FaCalendarAlt,
  FaBook,
  FaExclamationTriangle,
  FaUpload,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const StudentHallTicketPage = () => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const baseUrl = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api$/, "")
    : "http://localhost:5000";

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/exam-halltickets/student/my-hallticket");
      console.log("📋 API Response:", response.data);

      if (response.data.success) {
        const ticketData = response.data.data;

        // ✅ Extract hallTicket from nested structure
        const hallTicket = ticketData.hallTicket || ticketData;

        // ✅ Extract student data if it exists separately
        if (ticketData.student) {
          hallTicket.studentId = ticketData.student;
        }

        // ✅ Ensure studentId has all required fields
        if (hallTicket.studentId) {
          console.log("✅ Student Data:", hallTicket.studentId);
          console.log("✅ Photo Path:", hallTicket.studentId.photoPath);
        }

        // ✅ Ensure semester and section are set
        if (!hallTicket.semester && hallTicket.studentId?.semester) {
          hallTicket.semester = hallTicket.studentId.semester;
        }
        if (!hallTicket.section && hallTicket.studentId?.section) {
          hallTicket.section = hallTicket.studentId.section;
        }

        setTicket(hallTicket);
        console.log("✅ Hall Ticket Data:", hallTicket);
      } else {
        setError(response.data.error || "Failed to load hall ticket");
      }
    } catch (error) {
      console.error("Error loading ticket:", error);
      setError(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, []);

  const handleDownloadPDF = async () => {
    if (!ticket) {
      toast.warning("⚠️ No hall ticket available to download.");
      return;
    }

    // ✅ Frontend check: Student must have photo
    const currentStudent = ticket.studentId || ticket.student || {};
    if (!currentStudent.photoPath) {
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
      link.download = `HallTicket_${ticket.studentId?.rollNumber || ticket.rollNumber || "hallticket"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("✅ Hall ticket downloaded successfully.");
    } catch (error) {
      // ✅ Detect photo-required error from backend
      if (error.response?.data?.code === "PHOTO_REQUIRED") {
        toast.warning(
          "⚠️ Please upload your profile photo before downloading the hall ticket.",
        );
      } else {
        toast.error(`❌ ${formatErrorMessage(error)}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Pending: "warning",
      Approved: "success",
      Rejected: "danger",
      pending: "warning",
      approved: "success",
      rejected: "danger",
    };
    const icons = {
      Pending: <FaClock />,
      Approved: <FaCheckCircle />,
      Rejected: <FaTimesCircle />,
      pending: <FaClock />,
      approved: <FaCheckCircle />,
      rejected: <FaTimesCircle />,
    };
    const normalizedStatus =
      status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase();
    const finalStatus =
      normalizedStatus === "Approved"
        ? "Approved"
        : normalizedStatus === "Rejected"
          ? "Rejected"
          : "Pending";

    return (
      <Badge bg={variants[finalStatus] || "secondary"} className="px-2 py-1">
        {icons[finalStatus]} {finalStatus}
      </Badge>
    );
  };

  const getEligibilityBadge = (eligible) => {
    if (eligible) {
      return <Badge bg="success">✓ Eligible</Badge>;
    }
    return <Badge bg="danger">✗ Not Eligible</Badge>;
  };

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
          <h5 className="mt-3 text-muted">Loading hall ticket...</h5>
        </div>
      </Container>
    );
  }

  if (error && !ticket) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadTicket} />
      </Container>
    );
  }

  if (!ticket) {
    return (
      <Container className="mt-4">
        <Alert variant="warning" className="text-center py-4">
          <FaTicketAlt size={24} className="mb-2 d-block" />
          No hall ticket found. Please contact your mentor.
        </Alert>
      </Container>
    );
  }

  // ✅ Get student data from ticket
  const studentData = ticket.studentId || ticket.student || {};
  const photoPath = studentData.photoPath;
  const photoUrl = photoPath ? `${baseUrl}${photoPath}` : null;
  const hasPhoto = !!photoPath;

  // ✅ Get exam data
  const examData = ticket.examId || ticket.exam || {};

  const isApproved =
    ticket.approvalStatus === "Approved" ||
    ticket.approvalStatus === "approved";

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaTicketAlt className="me-2 text-primary" />
            My Hall Ticket
          </h2>
          <Button variant="outline-secondary" size="sm" onClick={loadTicket}>
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {/* ✅ NEW: Photo Required Warning Banner */}
        {!hasPhoto && (
          <Alert
            variant="warning"
            className="d-flex align-items-center shadow-sm border-0"
          >
            <FaExclamationTriangle className="me-3" size={28} />
            <div className="flex-grow-1">
              <strong>⚠️ Profile Photo Required</strong>
              <div className="small mt-1">
                You must upload a profile photo before you can download your
                hall ticket.
              </div>
            </div>
            <Button
              as={Link}
              to="/student/profile"
              variant="warning"
              size="sm"
              className="ms-3 text-dark fw-bold"
            >
              <FaUpload className="me-1" /> Upload Photo
            </Button>
          </Alert>
        )}

        {/* Hall Ticket Card */}
        <Card className="shadow-sm border-0 p-3 p-md-4">
          {/* Exam Info */}
          {examData && examData.examName && (
            <Alert variant="info">
              <FaInfoCircle className="me-2" />
              <strong>Exam:</strong> {examData.examName}
              {examData.startDate && examData.endDate && (
                <span className="ms-2">
                  ({new Date(examData.startDate).toLocaleDateString()} -{" "}
                  {new Date(examData.endDate).toLocaleDateString()})
                </span>
              )}
            </Alert>
          )}

          {/* Student Photo + Details */}
          <Row className="mb-3 align-items-center">
            <Col xs={12} md={3} className="text-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Student Photo"
                  className="rounded-circle"
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    border: "3px solid #ddd",
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentElement.innerHTML = `
                      <div class="rounded-circle mx-auto d-flex align-items-center justify-content-center bg-light" style="width:120px;height:120px;border:3px solid #ddd">
                        <svg class="text-secondary" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    `;
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
                  <FaUserGraduate size={48} className="text-secondary" />
                </div>
              )}
              <p
                className={`mt-1 small fw-bold ${
                  hasPhoto ? "text-muted" : "text-warning"
                }`}
              >
                {hasPhoto ? "Student Photo" : "⚠️ Photo Missing"}
              </p>
            </Col>

            <Col xs={12} md={9}>
              <Row>
                <Col xs={12} sm={6}>
                  <p className="mb-1">
                    <FaUserGraduate className="me-2 text-primary" />
                    <strong>Student:</strong>{" "}
                    {studentData.studentName || studentData.name || "N/A"}
                  </p>
                  <p className="mb-1">
                    <FaIdCard className="me-2 text-primary" />
                    <strong>Roll Number:</strong>{" "}
                    {studentData.rollNumber || ticket.rollNumber || "N/A"}
                  </p>
                  {/* ✅ NEW: Department */}
                  <p className="mb-1">
                    <FaBook className="me-2 text-primary" />
                    <strong>Department:</strong>{" "}
                    <Badge bg="info">
                      {ticket.department || studentData.department || "CS"}
                    </Badge>
                  </p>
                  <p className="mb-1">
                    <FaCalendarAlt className="me-2 text-primary" />
                    <strong>Academic Year:</strong>{" "}
                    {studentData.academicYear || ticket.academicYear || "N/A"}
                  </p>
                </Col>
                <Col xs={12} sm={6}>
                  <p className="mb-1">
                    <FaBook className="me-2 text-primary" />
                    <strong>Semester:</strong>{" "}
                    {studentData.semester || ticket.semester || "N/A"}
                  </p>
                  <p className="mb-1">
                    <FaBook className="me-2 text-primary" />
                    <strong>Section:</strong>{" "}
                    {studentData.section || ticket.section || "N/A"}
                  </p>
                  <p className="mb-1">
                    <FaInfoCircle className="me-2 text-primary" />
                    <strong>Status:</strong>{" "}
                    {getStatusBadge(ticket.approvalStatus)}
                  </p>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* Subject Eligibility Table */}
          {ticket.subjectEligibility &&
            ticket.subjectEligibility.length > 0 && (
              <>
                <h6 className="mt-3">
                  <FaCheckCircle className="me-2 text-primary" />
                  Subject Eligibility
                </h6>
                <div className="table-responsive">
                  <table className="table table-bordered table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Subject Name</th>
                        <th>Attendance %</th>
                        <th className="text-center">Eligibility</th>
                        <th>Invigilator Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ✅ Remove duplicate subjects in display */}
                      {(() => {
                        const seen = {};
                        const uniqueSubjects = ticket.subjectEligibility.filter(
                          (s) => {
                            if (seen[s.subjectName]) return false;
                            seen[s.subjectName] = true;
                            return true;
                          },
                        );
                        return uniqueSubjects.map((subject, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{subject.subjectName}</td>
                            <td>
                              <Badge
                                bg={
                                  subject.eligible || subject.isEligible
                                    ? "success"
                                    : "danger"
                                }
                              >
                                {subject.attendancePercentage || 0}%
                              </Badge>
                            </td>
                            <td className="text-center">
                              {getEligibilityBadge(
                                subject.eligible || subject.isEligible,
                              )}
                            </td>
                            <td style={{ minWidth: "100px" }}>&nbsp;</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          {/* Additional Details */}
          <dl className="row mt-3">
            <dt className="col-sm-3">Approved By</dt>
            <dd className="col-sm-9">
              {ticket.approvedBy && ticket.approvedBy !== "Pending"
                ? ticket.approvedBy
                : ticket.hodOverride
                  ? "HOD Override"
                  : "Pending"}
            </dd>

            <dt className="col-sm-3">Mentor Remarks</dt>
            <dd className="col-sm-9">
              {ticket.mentorRemarks && ticket.mentorRemarks !== "N/A"
                ? ticket.mentorRemarks
                : ticket.hodRemarks || "N/A"}
            </dd>

            <dt className="col-sm-3">Generated Date</dt>
            <dd className="col-sm-9">
              {ticket.generatedDate || ticket.generatedAt || ticket.createdAt
                ? new Date(
                    ticket.generatedDate ||
                      ticket.generatedAt ||
                      ticket.createdAt,
                  ).toLocaleDateString()
                : "Not generated yet"}
            </dd>

            <dt className="col-sm-3">HOD Override</dt>
            <dd className="col-sm-9">{ticket.hodOverride ? "✅ Yes" : "No"}</dd>
          </dl>

          {/* Download Button */}
          {isApproved ? (
            <div>
              <Button
                variant={hasPhoto ? "success" : "secondary"}
                onClick={handleDownloadPDF}
                disabled={downloading || !hasPhoto}
                title={
                  !hasPhoto
                    ? "Please upload your photo first"
                    : "Download hall ticket"
                }
              >
                {downloading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <FaDownload className="me-2" />
                    Download Hall Ticket PDF
                  </>
                )}
              </Button>
              {!hasPhoto && (
                <div className="mt-2 small text-warning">
                  <FaExclamationTriangle className="me-1" />
                  Upload your photo to enable download.
                </div>
              )}
            </div>
          ) : (
            <Alert
              variant={
                ticket.approvalStatus === "Pending" ||
                ticket.approvalStatus === "pending"
                  ? "info"
                  : "danger"
              }
              className="mt-3"
            >
              {ticket.approvalStatus === "Pending" ||
              ticket.approvalStatus === "pending" ? (
                <>
                  <FaClock className="me-2" />⏳ Hall Ticket awaiting mentor
                  approval.
                </>
              ) : (
                <>
                  <FaTimesCircle className="me-2" />❌ Hall Ticket has been
                  rejected.
                </>
              )}
            </Alert>
          )}
        </Card>
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

export default StudentHallTicketPage;
