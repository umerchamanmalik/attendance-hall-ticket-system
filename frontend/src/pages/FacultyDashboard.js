import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  Alert,
  Button,
  Table,
  ProgressBar,
} from "react-bootstrap";
import {
  FaChalkboardTeacher,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaBook,
  FaFileAlt,
  FaHistory,
  FaSync,
  FaUserCheck,
  FaUserGraduate,
  FaExclamationTriangle,
  FaInfoCircle,
  FaArrowRight,
  FaHourglassHalf,
  FaUserTimes,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import ErrorMessage from "../components/ErrorMessage";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";

const FacultyDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [mode, setMode] = useState("faculty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  // ✅ NEW: Faculty status states
  const [facultyStatus, setFacultyStatus] = useState(null);
  const [assignedRoleType, setAssignedRoleType] = useState(null);
  // ✅ ADDED: Department displayed in the dashboard header
  const [department, setDepartment] = useState("CS");
  const [attendanceThreshold, setAttendanceThreshold] = useState(85);

  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingHallTickets: 0,
    totalClasses: 0,
    todayAttendance: 0,
    totalAttendance: 0,
  });
  const [todayAttendanceData, setTodayAttendanceData] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, [refreshKey]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ STEP 1: Get user profile to check facultyStatus
      try {
        const profileRes = await api.get("/auth/profile");
        if (profileRes.data.success) {
          const profileData = profileRes.data.data;
          console.log("📋 Profile:", profileData);
          console.log("📋 Faculty Status:", profileData.facultyStatus);
          console.log("📋 Assigned Role Type:", profileData.assignedRoleType);

          setFacultyStatus(profileData.facultyStatus || null);
          setAssignedRoleType(profileData.assignedRoleType || null);
          setDepartment(profileData.department || "CS");
          setAttendanceThreshold(profileData.attendanceThreshold ?? 85);
        }
      } catch (err) {
        console.log("Could not load profile:", err.message);
      }

      // ✅ STEP 2: Load classes
      const classesResponse = await api.get("/attendance/classes");
      const classData = classesResponse.data.data || [];

      if (classesResponse.data.success) {
        setClasses(classData);
      } else {
        throw new Error(
          classesResponse.data.message || "Failed to load classes",
        );
      }

      let pendingHallTickets = 0;
      try {
        const hallTicketsResponse = await api.get(
          "/exam-halltickets/mentor/halltickets?approvalStatus=Pending",
        );
        if (hallTicketsResponse.data.success) {
          pendingHallTickets = hallTicketsResponse.data.data?.length || 0;
        }
      } catch (e) {
        console.log("No pending hall tickets found");
      }

      let totalStudents = 0;
      try {
        const menteesResponse = await api.get("/students/mentees");
        if (menteesResponse.data.success) {
          totalStudents = menteesResponse.data.data?.length || 0;
        }
      } catch (e) {
        console.log("No mentees found");
      }

      setStats((prev) => ({
        ...prev,
        totalClasses: classData.length,
        pendingHallTickets,
        totalStudents,
      }));

      if (classData.length > 0) {
        await loadTodayAttendance(classData);
        await loadRecentHistory(classData);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setError(error.response?.data?.error || "Failed to load dashboard data");
      toast.error(
        error.response?.data?.error || "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTodayAttendance = async (classList) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const classData = classList || classes;
      let allTodayAttendance = [];

      for (const cls of classData) {
        try {
          const response = await api.get("/attendance", {
            params: { subjectName: cls.subjectName },
          });

          if (response.data.success && response.data.data?.length > 0) {
            const todayRecords = response.data.data.filter((record) => {
              const recordDate = new Date(record.attendanceDate);
              recordDate.setHours(0, 0, 0, 0);
              return recordDate.getTime() === today.getTime();
            });

            if (todayRecords.length > 0) {
              allTodayAttendance = [...allTodayAttendance, ...todayRecords];
            }
          }
        } catch (e) {
          // No attendance for this subject
        }
      }

      setTodayAttendanceData(allTodayAttendance);

      const totalStudents = allTodayAttendance.length;
      const presentCount = allTodayAttendance.filter(
        (a) => a.status === "Present",
      ).length;
      const attendancePercent =
        totalStudents > 0
          ? Math.round((presentCount / totalStudents) * 100)
          : 0;

      setStats((prev) => ({
        ...prev,
        todayAttendance: attendancePercent,
        totalAttendance: totalStudents,
      }));
    } catch (error) {
      console.error("Error loading today's attendance:", error);
      toast.warning("Failed to load today's attendance data");
    }
  };

  const loadRecentHistory = async (classList) => {
    try {
      const classData = classList || classes;
      let allHistory = [];

      for (const cls of classData) {
        try {
          const response = await api.get("/attendance", {
            params: { subjectName: cls.subjectName },
          });

          if (response.data.success && response.data.data?.length > 0) {
            const recordsWithSubject = response.data.data.map((record) => ({
              ...record,
              subjectName: cls.subjectName,
            }));
            allHistory = [...allHistory, ...recordsWithSubject];
          }
        } catch (e) {
          // No records for this subject
        }
      }

      const sorted = allHistory
        .sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate))
        .slice(0, 10);

      setRecentHistory(sorted);
    } catch (error) {
      console.error("Error loading recent history:", error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    toast.info("Refreshing dashboard data...");
  };

  const hasMentorMode = classes.some(
    (allocation) =>
      allocation.roleType === "Both" || allocation.roleType === "Mentor",
  );
  const hasFacultyMode = classes.some(
    (allocation) =>
      allocation.roleType === "Both" || allocation.roleType === "Faculty",
  );

  const StatCard = ({ icon: Icon, title, value, bgColor }) => (
    <Col xs={6} md={3}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0 h-100`}
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

  // ============================================
  // ✅ LOADING STATE
  // ============================================
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
          <h5 className="mt-3 text-muted">Loading dashboard...</h5>
        </div>
      </Container>
    );
  }

  // ============================================
  // ✅ NEW: PENDING FACULTY - Waiting for HOD Approval
  // ============================================
  if (facultyStatus === "pending") {
    return (
      <>
        <Container className="d-flex justify-content-center align-items-center py-5">
          <Row className="w-100 justify-content-center">
            <Col xs={12} md={8} lg={6}>
              <Card className="shadow-lg border-0 rounded-4 text-center">
                <Card.Body className="p-4 p-md-5">
                  <div className="bg-warning bg-opacity-10 p-4 rounded-circle d-inline-block mb-3">
                    <FaHourglassHalf size={48} className="text-warning" />
                  </div>
                  <h3 className="fw-bold mb-2">⏳ Waiting for HOD Approval</h3>
                  <p className="text-muted mb-4">
                    Your faculty account has been registered successfully!
                  </p>

                  <Alert variant="info" className="text-start">
                    <h6 className="fw-bold">
                      <FaInfoCircle className="me-2" />
                      What happens next?
                    </h6>
                    <hr className="my-2" />
                    <ol className="mb-0 ps-3">
                      <li className="mb-2">
                        <strong>HOD reviews your registration</strong> — They
                        will check your details.
                      </li>
                      <li className="mb-2">
                        <strong>HOD assigns your role</strong> — You will be
                        assigned as:
                        <ul className="mt-1">
                          <li>
                            <Badge bg="info">Faculty</Badge> — Mark attendance &
                            view history
                          </li>
                          <li>
                            <Badge bg="success">Mentor</Badge> — Review
                            documents & approve hall tickets
                          </li>
                          <li>
                            <Badge bg="primary">Both</Badge> — Full access (both
                            roles)
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>HOD assigns your classes</strong> — Subjects,
                        semesters, and sections will be added.
                      </li>
                    </ol>
                  </Alert>

                  <Alert variant="warning" className="text-start mb-0">
                    <strong>📌 Note:</strong> You cannot access the dashboard
                    until HOD approves your account and assigns classes.
                    <br />
                    <small className="text-muted">
                      Please contact your HOD if you have any questions.
                    </small>
                  </Alert>

                  <Button
                    variant="outline-primary"
                    className="mt-4"
                    onClick={handleRefresh}
                  >
                    <FaSync className="me-1" /> Check Again
                  </Button>
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
  }

  // ============================================
  // ✅ NEW: REJECTED FACULTY
  // ============================================
  if (facultyStatus === "rejected") {
    return (
      <>
        <Container className="d-flex justify-content-center align-items-center py-5">
          <Row className="w-100 justify-content-center">
            <Col xs={12} md={8} lg={6}>
              <Card className="shadow-lg border-0 rounded-4 text-center border-danger">
                <Card.Body className="p-4 p-md-5">
                  <div className="bg-danger bg-opacity-10 p-4 rounded-circle d-inline-block mb-3">
                    <FaUserTimes size={48} className="text-danger" />
                  </div>
                  <h3 className="fw-bold mb-2 text-danger">
                    ❌ Registration Rejected
                  </h3>
                  <p className="text-muted mb-4">
                    Your faculty registration was not approved by the HOD.
                  </p>

                  <Alert variant="danger" className="text-start">
                    <strong>What can I do?</strong>
                    <hr className="my-2" />
                    <ul className="mb-0 ps-3">
                      <li>Contact your HOD for more information.</li>
                      <li>
                        If this was a mistake, HOD can update your status from
                        their dashboard.
                      </li>
                    </ul>
                  </Alert>

                  <Button
                    variant="outline-primary"
                    className="mt-3"
                    onClick={handleRefresh}
                  >
                    <FaSync className="me-1" /> Refresh
                  </Button>
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
  }

  // ============================================
  // ✅ APPROVED FACULTY BUT NO CLASSES ASSIGNED YET
  // ============================================
  if (facultyStatus === "approved" && classes.length === 0 && !error) {
    return (
      <>
        <Container className="d-flex justify-content-center align-items-center py-5">
          <Row className="w-100 justify-content-center">
            <Col xs={12} md={8} lg={6}>
              <Card className="shadow-lg border-0 rounded-4 text-center border-success">
                <Card.Body className="p-4 p-md-5">
                  <div className="bg-success bg-opacity-10 p-4 rounded-circle d-inline-block mb-3">
                    <FaCheckCircle size={48} className="text-success" />
                  </div>
                  <h3 className="fw-bold mb-2 text-success">
                    ✅ Account Approved!
                  </h3>
                  <p className="text-muted mb-4">
                    Your faculty account has been approved by HOD.
                  </p>

                  {assignedRoleType ? (
                    <Alert variant="success" className="text-start">
                      <h6 className="fw-bold">
                        <FaUserCheck className="me-2" />
                        Your Assigned Role
                      </h6>
                      <hr className="my-2" />
                      <div className="text-center my-3">
                        <Badge
                          bg={
                            assignedRoleType === "Both"
                              ? "primary"
                              : assignedRoleType === "Mentor"
                                ? "success"
                                : "info"
                          }
                          style={{ fontSize: "1.1rem", padding: "8px 16px" }}
                        >
                          {assignedRoleType}
                        </Badge>
                      </div>
                      <ul className="mb-0 ps-3">
                        {assignedRoleType === "Faculty" && (
                          <>
                            <li>✅ Mark attendance</li>
                            <li>✅ View attendance history</li>
                            <li>✅ Download reports</li>
                          </>
                        )}
                        {assignedRoleType === "Mentor" && (
                          <>
                            <li>✅ Review documents</li>
                            <li>✅ Approve hall tickets</li>
                            <li>✅ View mentees</li>
                          </>
                        )}
                        {assignedRoleType === "Both" && (
                          <>
                            <li>✅ Mark attendance</li>
                            <li>✅ Review documents</li>
                            <li>✅ Approve hall tickets</li>
                            <li>✅ View mentees</li>
                            <li>✅ Download reports</li>
                          </>
                        )}
                      </ul>
                    </Alert>
                  ) : (
                    <Alert variant="info">
                      <FaInfoCircle className="me-2" />
                      Your role has been assigned. Please wait for HOD to assign
                      classes.
                    </Alert>
                  )}

                  <Alert variant="warning" className="text-start mb-0">
                    <strong>📌 Next Step:</strong> HOD will assign subjects,
                    semesters, and sections to you. Once assigned, you can
                    access the full dashboard.
                    <br />
                    <small className="text-muted">
                      Contact your HOD if you have any questions.
                    </small>
                  </Alert>

                  <Button
                    variant="outline-primary"
                    className="mt-4"
                    onClick={handleRefresh}
                  >
                    <FaSync className="me-1" /> Check Again
                  </Button>
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
  }

  // ============================================
  // ✅ ERROR STATE
  // ============================================
  if (error && classes.length === 0) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadDashboardData} />
      </Container>
    );
  }

  // ============================================
  // ✅ FULL DASHBOARD (Classes Assigned)
  // ============================================
  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaChalkboardTeacher className="me-2 text-primary" />
            Faculty Dashboard
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Badge bg="info" className="align-self-center px-3 py-2">
              Department: {department}
            </Badge>
            {/* ✅ Show role badge */}
            {assignedRoleType && (
              <Badge
                bg={
                  assignedRoleType === "Both"
                    ? "primary"
                    : assignedRoleType === "Mentor"
                      ? "success"
                      : "info"
                }
                className="align-self-center px-3 py-2"
              >
                Role: {assignedRoleType}
              </Badge>
            )}
            <Button
              as={Link}
              to="/faculty/documents"
              variant="outline-primary"
              size="sm"
            >
              <FaFileAlt className="me-1" /> Document Requests
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleRefresh}
            >
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        <Alert variant="info" className="mb-4">
          <FaInfoCircle className="me-2" />
          Your department's minimum attendance threshold is{" "}
          {attendanceThreshold}%, set by the Super Admin. Students below this
          will be ineligible for hall tickets unless overridden.
        </Alert>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaBook}
            title="Assigned Classes"
            value={stats.totalClasses}
            bgColor="bg-primary"
          />
          <StatCard
            icon={FaUsers}
            title="My Students"
            value={stats.totalStudents}
            bgColor="bg-info"
          />
          <StatCard
            icon={FaClock}
            title="Pending Hall Tickets"
            value={stats.pendingHallTickets}
            bgColor="bg-warning"
          />
          <StatCard
            icon={FaUserCheck}
            title="Current Mode"
            value={
              assignedRoleType === "Both"
                ? mode === "faculty"
                  ? "Faculty"
                  : "Mentor"
                : assignedRoleType || "Faculty"
            }
            bgColor="bg-secondary"
          />
        </Row>

        <Row className="g-3 mb-4">
          {/* Today's Attendance */}
          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light">
                <h5 className="mb-0">
                  <FaCalendarAlt className="me-2 text-primary" /> Today's
                  Attendance
                </h5>
              </Card.Header>
              <Card.Body>
                {classes.length === 0 ? (
                  <div className="text-center text-muted py-3">
                    <FaExclamationTriangle className="mb-2" size={24} />
                    <p>No classes assigned.</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          Marked: {todayAttendanceData.length > 0 ? "✅" : "⏳"}
                          {todayAttendanceData.length} / {classes.length}{" "}
                          classes
                        </small>
                        <Badge
                          bg={
                            todayAttendanceData.length === classes.length
                              ? "success"
                              : "warning"
                          }
                        >
                          {todayAttendanceData.length === classes.length
                            ? "Complete"
                            : "In Progress"}
                        </Badge>
                      </div>
                      <ProgressBar
                        now={
                          (todayAttendanceData.length / classes.length) * 100
                        }
                        variant={
                          todayAttendanceData.length === classes.length
                            ? "success"
                            : "info"
                        }
                        className="mt-1"
                        style={{ height: "6px" }}
                      />
                    </div>

                    <div className="mb-3">
                      {classes.map((cls) => {
                        const marked = todayAttendanceData.some(
                          (a) => a.subjectName === cls.subjectName,
                        );
                        return (
                          <Badge
                            key={cls._id}
                            bg={marked ? "success" : "secondary"}
                            className="me-1 mb-1"
                          >
                            {cls.subjectName} {marked ? "✅" : "⏳"}
                          </Badge>
                        );
                      })}
                    </div>

                    {todayAttendanceData.length > 0 ? (
                      <>
                        <Row className="text-center mt-2">
                          <Col xs={4}>
                            <h5 className="text-success">
                              {
                                todayAttendanceData.filter(
                                  (a) => a.status === "Present",
                                ).length
                              }
                            </h5>
                            <small>Present</small>
                          </Col>
                          <Col xs={4}>
                            <h5 className="text-danger">
                              {
                                todayAttendanceData.filter(
                                  (a) => a.status === "Absent",
                                ).length
                              }
                            </h5>
                            <small>Absent</small>
                          </Col>
                          <Col xs={4}>
                            <h5 className="text-primary">
                              {stats.todayAttendance}%
                            </h5>
                            <small>Attendance</small>
                          </Col>
                        </Row>
                        <ProgressBar
                          now={stats.todayAttendance}
                          variant="success"
                          className="mt-2"
                          style={{ height: "8px" }}
                        />
                      </>
                    ) : (
                      <div className="text-center text-muted py-3">
                        <p className="mb-2">No attendance marked yet today.</p>
                        <Button
                          as={Link}
                          to="/faculty/attendance"
                          variant="primary"
                          size="sm"
                        >
                          <FaClock className="me-1" /> Mark Attendance
                        </Button>
                      </div>
                    )}

                    {todayAttendanceData.length < classes.length && (
                      <div className="mt-3">
                        <small className="text-warning">
                          ⚠️ {classes.length - todayAttendanceData.length}{" "}
                          class(es) pending
                        </small>
                        <Button
                          as={Link}
                          to="/faculty/attendance"
                          variant="outline-primary"
                          size="sm"
                          className="ms-2"
                        >
                          Mark Pending
                        </Button>
                      </div>
                    )}

                    {todayAttendanceData.length === classes.length &&
                      classes.length > 0 && (
                        <div className="mt-2">
                          <small className="text-success">
                            <FaCheckCircle className="me-1" /> All classes
                            marked for today!
                          </small>
                        </div>
                      )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Recent History */}
          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaHistory className="me-2 text-primary" /> Recent History
                </h5>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleRefresh}
                >
                  <FaSync />
                </Button>
              </Card.Header>
              <Card.Body className="p-0">
                {recentHistory.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <FaInfoCircle className="mb-2" size={24} />
                    <p>No recent attendance records found.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table bordered hover size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Subject</th>
                          <th>Student</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentHistory.slice(0, 5).map((record, index) => (
                          <tr key={index}>
                            <td>
                              {new Date(
                                record.attendanceDate,
                              ).toLocaleDateString()}
                            </td>
                            <td>{record.subjectName}</td>
                            <td>
                              {record.studentId?.studentName || "Unknown"}
                            </td>
                            <td>
                              <Badge
                                bg={
                                  record.status === "Present"
                                    ? "success"
                                    : "danger"
                                }
                              >
                                {record.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
              {recentHistory.length > 0 && (
                <Card.Footer className="bg-white">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => navigate("/faculty/history")}
                  >
                    <FaHistory className="me-1" /> View Full History
                  </Button>
                </Card.Footer>
              )}
            </Card>
          </Col>
        </Row>

        {/* Mode Switch - Only if Both */}
        {assignedRoleType === "Both" && hasMentorMode && hasFacultyMode && (
          <div className="mb-4">
            <div className="btn-group w-100 w-md-auto" role="group">
              <Button
                variant={mode === "faculty" ? "primary" : "outline-primary"}
                onClick={() => {
                  setMode("faculty");
                  navigate("/faculty");
                }}
              >
                <FaChalkboardTeacher className="me-1" /> Faculty Mode
              </Button>
              <Button
                variant={mode === "mentor" ? "primary" : "outline-primary"}
                onClick={() => {
                  setMode("mentor");
                  navigate("/mentor");
                }}
              >
                <FaUserGraduate className="me-1" /> Mentor Mode
              </Button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <Row className="g-2 mb-4">
          {mode === "faculty" ? (
            <>
              <Col xs={6} md={3}>
                <Button
                  variant="success"
                  className="w-100"
                  onClick={() => navigate("/faculty/attendance")}
                >
                  <FaClock className="me-1" /> Mark Attendance
                </Button>
              </Col>
              <Col xs={6} md={3}>
                <Button
                  variant="info"
                  className="w-100 text-white"
                  onClick={() => navigate("/faculty/history")}
                >
                  <FaHistory className="me-1" /> Attendance History
                </Button>
              </Col>
              {assignedRoleType === "Both" && (
                <Col xs={6} md={3}>
                  <Button
                    variant="warning"
                    className="w-100 text-white"
                    onClick={() => navigate("/mentor/hall-ticket-approval")}
                  >
                    <FaCheckCircle className="me-1" /> Review Hall Tickets
                  </Button>
                </Col>
              )}
            </>
          ) : (
            <>
              <Col xs={6} md={3}>
                <Button
                  variant="primary"
                  className="w-100"
                  onClick={() => navigate("/mentor/mentees")}
                >
                  <FaUsers className="me-1" /> View Mentees
                </Button>
              </Col>
              <Col xs={6} md={3}>
                <Button
                  variant="info"
                  className="w-100 text-white"
                  onClick={() => navigate("/mentor/documents")}
                >
                  <FaFileAlt className="me-1" /> Documents Review
                </Button>
              </Col>
              <Col xs={6} md={3}>
                <Button
                  variant="success"
                  className="w-100"
                  onClick={() => navigate("/mentor/hall-ticket-approval")}
                >
                  <FaCheckCircle className="me-1" /> Approve Hall Tickets
                </Button>
              </Col>
            </>
          )}
        </Row>

        {/* Assigned Classes */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaBook className="me-2 text-primary" /> My Assigned Classes
            </h5>
          </Card.Header>
          <Card.Body className="p-0">
            {classes.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <FaExclamationTriangle className="mb-2" size={24} />
                <p>No classes assigned yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Year</th>
                      <th>Sem</th>
                      <th>Section</th>
                      <th>Subject</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((allocation, index) => (
                      <tr key={allocation._id}>
                        <td>{index + 1}</td>
                        <td>{allocation.academicYear}</td>
                        <td>{allocation.semester}</td>
                        <td>{allocation.section}</td>
                        <td>{allocation.subjectName}</td>
                        <td>
                          <Badge
                            bg={
                              allocation.roleType === "Both"
                                ? "primary"
                                : allocation.roleType === "Mentor"
                                  ? "success"
                                  : "info"
                            }
                          >
                            {allocation.roleType}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          {classes.length > 0 && (
            <Card.Footer className="bg-white">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Total: {classes.length} assigned class(es)
              </small>
            </Card.Footer>
          )}
        </Card>
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

export default FacultyDashboard;
