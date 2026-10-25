import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  Button,
  Table,
  Alert,
} from "react-bootstrap";
import {
  FaUsers,
  FaSync,
  FaUserGraduate,
  FaBook,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaChartLine,
  FaExclamationTriangle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const MenteeManagementPage = () => {
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const loadMentees = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Get mentees list
      const response = await api.get("/students/mentees");
      const menteeList = response.data.data || [];

      // Step 2: For each mentee, fetch their attendance
      const menteesWithAttendance = await Promise.all(
        menteeList.map(async (mentee) => {
          try {
            const attendanceRes = await api.get("/attendance", {
              params: { studentId: mentee._id },
            });
            const records = attendanceRes.data.data || [];
            const total = records.length;
            const present = records.filter(
              (r) => r.status === "Present",
            ).length;
            const percentage =
              total > 0 ? Math.round((present / total) * 100) : 0;
            return {
              ...mentee,
              attendancePercentage: percentage,
              totalClasses: total,
              presentClasses: present,
            };
          } catch (e) {
            console.error(
              `Error getting attendance for ${mentee.studentName}:`,
              e,
            );
            return {
              ...mentee,
              attendancePercentage: 0,
              totalClasses: 0,
              presentClasses: 0,
            };
          }
        }),
      );

      setMentees(menteesWithAttendance);
    } catch (error) {
      setError(formatErrorMessage(error));
      toast.error(`❌ ${formatErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentees();
  }, []);

  const getStats = () => {
    const total = mentees.length;
    const eligible = mentees.filter(
      (m) => m.attendancePercentage >= (m.attendanceThreshold ?? 85),
    ).length;
    const notEligible = mentees.filter(
      (m) =>
        m.attendancePercentage > 0 &&
        m.attendancePercentage < (m.attendanceThreshold ?? 85),
    ).length;
    return { total, eligible, notEligible };
  };

  const stats = getStats();

  const getAttendanceBadge = (percentage, threshold = 85) => {
    if (percentage >= threshold) return "success";
    if (percentage >= threshold - 10) return "warning";
    if (percentage > 0) return "danger";
    return "secondary";
  };

  const getAttendanceText = (mentee) => {
    if (mentee.totalClasses === 0) return "No Records";
    return `${mentee.attendancePercentage}%`;
  };

  const StatCard = ({ icon: Icon, title, value, bgColor }) => (
    <Col xs={6} md={4}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0`}
      >
        <Card.Body className="d-flex align-items-center justify-content-between p-3">
          <div>
            <h6 className="text-white-50 small mb-1">{title}</h6>
            <h2 className="mb-0">{value || 0}</h2>
          </div>
          <div className="bg-white bg-opacity-25 p-2 rounded-circle">
            <Icon size={20} className="text-white" />
          </div>
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
          <h5 className="mt-3 text-muted">Loading mentees...</h5>
        </div>
      </Container>
    );
  }

  if (error && !mentees.length) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadMentees} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaUsers className="me-2 text-primary" />
            Mentee Management
          </h2>
          <Button variant="outline-secondary" size="sm" onClick={loadMentees}>
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaUsers}
            title="Total Mentees"
            value={stats.total}
            bgColor="bg-primary"
          />
          <StatCard
            icon={FaCheckCircle}
            title={`Eligible (≥${mentees[0]?.attendanceThreshold ?? 85}%)`}
            value={stats.eligible}
            bgColor="bg-success"
          />
          <StatCard
            icon={FaExclamationTriangle}
            title="Need Attention"
            value={stats.notEligible}
            bgColor="bg-danger"
          />
        </Row>

        {/* Info Alert */}
        <Alert variant="info" className="d-flex align-items-center mb-3">
          <FaInfoCircle className="me-2" />
          <div>
            <strong>Overall Attendance</strong> — Green ≥
            {mentees[0]?.attendanceThreshold ?? 85}% (Eligible), Yellow from{" "}
            {(mentees[0]?.attendanceThreshold ?? 85) - 10}% to below{" "}
            {mentees[0]?.attendanceThreshold ?? 85}% (At Risk), then red
          </div>
        </Alert>

        {/* Mentees Table */}
        {mentees.length === 0 ? (
          <Alert variant="info" className="text-center py-4">
            <FaInfoCircle size={24} className="mb-2 d-block" />
            No mentees assigned to you.
          </Alert>
        ) : (
          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Section</th>
                      <th className="text-center">Overall Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentees.map((student, index) => (
                      <tr key={student._id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{student.studentName}</strong>
                        </td>
                        <td>{student.rollNumber}</td>
                        <td>{student.academicYear}</td>
                        <td>{student.semester}</td>
                        <td>{student.section}</td>
                        <td className="text-center">
                          {student.totalClasses === 0 ? (
                            <Badge bg="secondary">No Records</Badge>
                          ) : (
                            <Badge
                              bg={getAttendanceBadge(
                                student.attendancePercentage,
                                student.attendanceThreshold ?? 85,
                              )}
                              className="fs-6"
                            >
                              <FaChartLine className="me-1" />
                              {getAttendanceText(student)}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
            <Card.Footer className="bg-white">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Total: {mentees.length} mentees assigned
              </small>
            </Card.Footer>
          </Card>
        )}
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

export default MenteeManagementPage;
