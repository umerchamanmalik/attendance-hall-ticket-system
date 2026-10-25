import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Modal,
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaUsers,
  FaBook,
  FaChalkboardTeacher,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaSearch,
  FaSync,
  FaEye,
  FaUserGraduate,
  FaUniversity,
  FaFileAlt,
  FaUpload,
  FaGraduationCap,
  FaPlus,
  FaTicketAlt,
  FaInfoCircle,
  FaExclamationTriangle,
  FaFilter,
  FaUserPlus,
  FaUserCheck,
  FaUserTimes,
  FaRedo,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const HodDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [semesterData, setSemesterData] = useState([]);
  const toast = useToast();

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Attendance Details Modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Date & Subject Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [uniqueSubjects, setUniqueSubjects] = useState([]);

  // ✅ NEW: Faculty Management States
  const [pendingFaculty, setPendingFaculty] = useState([]);
  const [facultyStats, setFacultyStats] = useState({
    totalFaculty: 0,
    pendingFaculty: 0,
    approvedFaculty: 0,
    rejectedFaculty: 0,
  });
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultyRoleType, setFacultyRoleType] = useState("Faculty");
  const [facultyActionLoading, setFacultyActionLoading] = useState(false);
  const [facultyRemarks, setFacultyRemarks] = useState("");

  useEffect(() => {
    loadDashboardData();
    loadFacultyData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/dashboard/hod");

      if (response.data.success) {
        setOverview(response.data.data);
      } else {
        throw new Error(
          response.data.message || "Failed to load dashboard data",
        );
      }

      try {
        const hallTicketsResponse = await api.get("/exams/halltickets");
        const allTickets = hallTicketsResponse.data.data || [];
        const sorted = allTickets
          .sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA;
          })
          .slice(0, 5);
        setRecentActivity(sorted);
      } catch (error) {
        console.log("No hall tickets found");
        setRecentActivity([]);
      }

      try {
        const semesterResponse = await api.get("/semesters");
        setSemesterData(semesterResponse.data.data || []);
      } catch (error) {
        console.log("No semester data found");
        setSemesterData([]);
      }

      toast.success("Dashboard loaded successfully!");
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setError(error.message || "Failed to load dashboard data");
      toast.error(error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Load Faculty Data
  const loadFacultyData = async () => {
    try {
      // Load pending faculty
      try {
        const pendingRes = await api.get("/faculty/pending");
        setPendingFaculty(pendingRes.data.data || []);
      } catch (err) {
        console.log("No pending faculty:", err.message);
        setPendingFaculty([]);
      }

      // Load faculty stats
      try {
        const statsRes = await api.get("/faculty/stats");
        if (statsRes.data.success) {
          setFacultyStats(statsRes.data.data);
        }
      } catch (err) {
        console.log("No faculty stats:", err.message);
      }
    } catch (error) {
      console.error("Error loading faculty data:", error);
    }
  };

  const handleSearch = async () => {
    const searchQuery = searchTerm.trim();

    if (!searchQuery) {
      toast.warning("Please enter a name, USN, or roll number to search.");
      return;
    }

    setSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await api.get(`/students/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const results = response.data.data || [];
      setSearchResults(results);

      if (results.length === 0) {
        toast.info(`No students found matching "${searchQuery}".`);
      } else {
        toast.success(
          `Found ${results.length} student(s) matching "${searchQuery}".`,
        );
      }

      setSearchTerm("");
    } catch (error) {
      console.error("Search error:", error);
      toast.error(
        error.response?.data?.error || "Failed to search. Please try again.",
      );
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSearchTerm("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterSubject("");
    setUniqueSubjects([]);
  };

  // ✅ FIXED: View Attendance Details with proper data mapping
  const viewAttendanceDetails = async (student) => {
    console.log("📊 Viewing attendance for student:", student);
    console.log("📊 Student keys:", Object.keys(student));

    // ✅ Map student data correctly - check all possible field names
    const studentData = {
      _id: student?._id || student?.id,
      studentName:
        student?.studentName || student?.name || student?.fullName || "Unknown",
      rollNumber:
        student?.rollNumber ||
        student?.rollNo ||
        student?.usn ||
        student?.roll ||
        "N/A",
      semester: student?.semester || student?.sem || "N/A",
      section: student?.section || student?.sec || "N/A",
      mentorName: student?.mentorName || student?.mentor || "Not Assigned",
      attendanceThreshold:
        student?.attendanceThreshold ?? overview?.attendanceThreshold ?? 85,
    };

    console.log("📊 Mapped student data:", studentData);

    setSelectedStudent(studentData);
    setShowModal(true);
    setLoadingDetails(true);

    // Reset filters
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterSubject("");
    setUniqueSubjects([]);

    try {
      const studentId = studentData._id;

      if (!studentId) {
        toast.error("Student ID is missing. Please try again.");
        setLoadingDetails(false);
        return;
      }

      await loadAttendanceData(studentId, studentData);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load attendance details. Please try again.");
      setAttendanceDetails(null);
      setLoadingDetails(false);
    }
  };

  // ✅ FIXED: Load attendance data with filters
  const loadAttendanceData = async (
    studentId,
    studentData,
    startDate,
    endDate,
    subject,
  ) => {
    setLoadingDetails(true);
    try {
      const params = { studentId: studentId };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (subject) params.subjectName = subject;

      console.log("📊 Fetching attendance with params:", params);

      const response = await api.get("/attendance", { params });

      console.log("📊 Attendance response:", response.data);

      if (response.data.success) {
        const records = response.data.data || [];

        // Extract unique subjects for filter dropdown
        const subjects = [
          ...new Set(records.map((r) => r.subjectName).filter(Boolean)),
        ];
        setUniqueSubjects(subjects);

        const total = records.length;
        const present = records.filter((r) => r.status === "Present").length;
        const absent = records.filter((r) => r.status === "Absent").length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        const subjectSummary = {};
        records.forEach((record) => {
          const subjectName = record.subjectName || "Unknown";
          if (!subjectSummary[subjectName]) {
            subjectSummary[subjectName] = {
              subjectName: subjectName,
              total: 0,
              present: 0,
              absent: 0,
            };
          }
          subjectSummary[subjectName].total++;
          if (record.status === "Present") {
            subjectSummary[subjectName].present++;
          } else {
            subjectSummary[subjectName].absent++;
          }
        });

        setAttendanceDetails({
          attendanceThreshold:
            response.data.data.attendanceThreshold ??
            studentData?.attendanceThreshold ??
            overview?.attendanceThreshold ??
            85,
          student: {
            name: studentData?.studentName || "Unknown",
            rollNumber: studentData?.rollNumber || "N/A",
            semester: studentData?.semester || "N/A",
            section: studentData?.section || "N/A",
            mentorName: studentData?.mentorName || "N/A",
          },
          summary: {
            total,
            present,
            absent,
            percentage,
          },
          subjectSummary: Object.values(subjectSummary),
          records: records,
        });
      } else {
        toast.error(response.data.error || "Failed to load attendance details");
        setAttendanceDetails(null);
      }
    } catch (error) {
      console.error("Error fetching attendance details:", error);
      toast.error(
        error.response?.data?.error ||
          "Failed to load attendance details. Please try again.",
      );
      setAttendanceDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const applyFilters = () => {
    if (!selectedStudent?._id) return;
    loadAttendanceData(
      selectedStudent._id,
      selectedStudent,
      filterStartDate,
      filterEndDate,
      filterSubject,
    );
  };

  const resetFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterSubject("");
    if (selectedStudent?._id) {
      loadAttendanceData(selectedStudent._id, selectedStudent);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
    setAttendanceDetails(null);
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterSubject("");
    setUniqueSubjects([]);
  };

  // ✅ NEW: Open Faculty Approval Modal
  const openFacultyApprovalModal = (faculty) => {
    setSelectedFaculty(faculty);
    setFacultyRoleType("Faculty");
    setFacultyRemarks("");
    setShowFacultyModal(true);
  };

  // ✅ NEW: Approve Faculty
  const handleApproveFaculty = async () => {
    if (!selectedFaculty) return;
    setFacultyActionLoading(true);

    try {
      const response = await api.put(`/faculty/${selectedFaculty._id}/status`, {
        facultyStatus: "approved",
        assignedRoleType: facultyRoleType,
        remarks: facultyRemarks || "Approved by HOD",
      });

      toast.success(
        `✅ ${selectedFaculty.name} approved as ${facultyRoleType}!`,
      );
      setShowFacultyModal(false);
      setSelectedFaculty(null);
      await loadFacultyData();
      await loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to approve faculty");
    } finally {
      setFacultyActionLoading(false);
    }
  };

  // ✅ NEW: Reject Faculty
  const handleRejectFaculty = async () => {
    if (!selectedFaculty) return;
    setFacultyActionLoading(true);

    try {
      await api.put(`/faculty/${selectedFaculty._id}/status`, {
        facultyStatus: "rejected",
        remarks: facultyRemarks || "Rejected by HOD",
      });

      toast.success(`❌ ${selectedFaculty.name} rejected.`);
      setShowFacultyModal(false);
      setSelectedFaculty(null);
      await loadFacultyData();
      await loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject faculty");
    } finally {
      setFacultyActionLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, link, bgColor }) => (
    <Col xs={6} md={4} lg={3}>
      <Link to={link} className="text-decoration-none">
        <Card
          className={`h-100 text-white shadow-sm border-0 ${bgColor || "bg-primary"}`}
        >
          <Card.Body className="d-flex align-items-center justify-content-between">
            <div>
              <h6 className="text-white-50 small mb-1">{title}</h6>
              <h2 className="mb-0">{value || 0}</h2>
            </div>
            <div className="bg-white bg-opacity-25 p-2 rounded-circle">
              <Icon size={20} className="text-white" />
            </div>
          </Card.Body>
        </Card>
      </Link>
    </Col>
  );

  const getStatusBadge = (status) => {
    const variants = {
      Approved: "success",
      Pending: "warning",
      Rejected: "danger",
      "Mentor Approved": "info",
    };
    return (
      <Badge bg={variants[status] || "secondary"}>{status || "N/A"}</Badge>
    );
  };

  const getRoleTypeBadge = (roleType) => {
    if (!roleType) return <Badge bg="secondary">Not Assigned</Badge>;
    const variants = {
      Faculty: "info",
      Mentor: "success",
      Both: "primary",
    };
    return <Badge bg={variants[roleType] || "secondary"}>{roleType}</Badge>;
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
          <p className="mt-3 text-muted">Loading dashboard...</p>
        </div>
      </Container>
    );
  }

  if (error && !overview) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadDashboardData} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaUniversity className="me-2 text-primary" />
            HOD Dashboard
          </h2>
          <Badge bg="info" className="align-self-center">
            Department: {overview?.department || "CS"}
          </Badge>
          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                loadDashboardData();
                loadFacultyData();
              }}
            >
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        <Alert variant="info" className="mb-4">
          <FaInfoCircle className="me-2" />
          Your department's minimum attendance threshold is{" "}
          {overview?.attendanceThreshold ?? 85}%, set by the Super Admin.
          Students below this will be ineligible for hall tickets unless
          overridden.
        </Alert>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaUsers}
            title="Total Students"
            value={overview?.totalStudents || 0}
            bgColor="bg-primary"
            link="/hod/students"
          />
          <StatCard
            icon={FaBook}
            title="Total Allocations"
            value={overview?.totalAllocations || 0}
            bgColor="bg-info"
            link="/hod/allocations"
          />
          <StatCard
            icon={FaChalkboardTeacher}
            title="Total Faculty"
            value={facultyStats.totalFaculty || 0}
            bgColor="bg-secondary"
            link="/hod/allocations"
          />
          <StatCard
            icon={FaUserPlus}
            title="Pending Faculty"
            value={facultyStats.pendingFaculty || 0}
            bgColor="bg-warning"
            link="#pending-faculty"
          />
          <StatCard
            icon={FaUserCheck}
            title="Approved Faculty"
            value={facultyStats.approvedFaculty || 0}
            bgColor="bg-success"
            link="/hod/allocations"
          />
          <StatCard
            icon={FaTicketAlt}
            title="Pending Hall Tickets"
            value={overview?.pendingHallTickets || 0}
            bgColor="bg-warning"
            link="/hod/hall-ticket-management"
          />
          <StatCard
            icon={FaCheckCircle}
            title="Approved Hall Tickets"
            value={overview?.approvedHallTickets || 0}
            bgColor="bg-success"
            link="/hod/hall-ticket-management"
          />
          <StatCard
            icon={FaTimesCircle}
            title="Rejected Hall Tickets"
            value={overview?.rejectedHallTickets || 0}
            bgColor="bg-danger"
            link="/hod/hall-ticket-management"
          />
        </Row>

        {/* ✅ NEW: Pending Faculty Section */}
        {pendingFaculty.length > 0 && (
          <Card
            className="shadow-sm border-0 mb-4 border-warning border-3"
            id="pending-faculty"
          >
            <Card.Header className="bg-warning text-dark d-flex flex-wrap justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaUserPlus className="me-2" />⏳ Pending Faculty Approvals (
                {pendingFaculty.length})
              </h5>
              <Badge bg="dark">Action Required</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered On</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingFaculty.map((faculty, index) => (
                      <tr key={faculty._id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{faculty.name}</strong>
                        </td>
                        <td>{faculty.email}</td>
                        <td>
                          <small>
                            {new Date(faculty.createdAt).toLocaleDateString()}
                          </small>
                        </td>
                        <td className="text-center">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => openFacultyApprovalModal(faculty)}
                          >
                            <FaUserCheck className="me-1" /> Approve / Assign
                          </Button>
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
                These faculty members have registered but are waiting for you to
                assign them a role (Faculty, Mentor, or Both).
              </small>
            </Card.Footer>
          </Card>
        )}

        {/* Quick Student Lookup */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaSearch className="me-2" />
              Quick Student Lookup
            </h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col xs={12} md={8}>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search by Name, USN, or Roll Number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        setSearchTerm("");
                        setSearchResults([]);
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </InputGroup>
              </Col>
              <Col xs={12} md={4}>
                <Button
                  variant="primary"
                  className="w-100"
                  onClick={handleSearch}
                  disabled={searching || !searchTerm.trim()}
                >
                  {searching ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Searching...
                    </>
                  ) : (
                    "🔎 Search"
                  )}
                </Button>
              </Col>
            </Row>

            {searchResults.length > 0 && (
              <div className="mt-3">
                <div className="d-flex flex-wrap justify-content-between align-items-center">
                  <h6 className="mb-2 mb-md-0">
                    Search Results ({searchResults.length})
                  </h6>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearSearch}
                  >
                    ✕ Clear Results
                  </Button>
                </div>
                <div className="table-responsive mt-2">
                  <Table bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>USN</th>
                        <th>Name</th>
                        <th>Semester</th>
                        <th>Section</th>
                        <th>Attendance</th>
                        <th>Hall Ticket</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((student) => (
                        <tr key={student._id}>
                          <td>{student.rollNumber}</td>
                          <td>{student.studentName}</td>
                          <td>{student.semester}</td>
                          <td>{student.section}</td>
                          <td>
                            <Badge
                              bg={
                                student.attendancePercentage >=
                                (student.attendanceThreshold ??
                                  overview?.attendanceThreshold ??
                                  85)
                                  ? "success"
                                  : "danger"
                              }
                            >
                              {student.attendancePercentage || 0}%
                            </Badge>
                          </td>
                          <td>
                            <Badge
                              bg={
                                student.hallTicketStatus === "Approved"
                                  ? "success"
                                  : student.hallTicketStatus === "Pending"
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {student.hallTicketStatus || "N/A"}
                            </Badge>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="info"
                              className="text-white"
                              onClick={() => viewAttendanceDetails(student)}
                              title="View attendance details with filters"
                            >
                              <FaEye /> Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">⚡ Quick Actions</h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-2">
              <Button
                as={Link}
                to="/hod/exam-management"
                variant="outline-primary"
              >
                <FaFileAlt className="me-1" /> Create Exam
              </Button>
              <Button
                as={Link}
                to="/hod/hall-ticket-management"
                variant="outline-primary"
              >
                <FaTicketAlt className="me-1" /> Manage Hall Tickets
              </Button>
              <Button as={Link} to="/hod/bulk-upload" variant="outline-primary">
                <FaUpload className="me-1" /> Bulk Upload
              </Button>
              <Button
                as={Link}
                to="/hod/semester-management"
                variant="outline-primary"
              >
                <FaGraduationCap className="me-1" /> Semester Management
              </Button>
              <Button as={Link} to="/hod/students" variant="outline-primary">
                <FaUserGraduate className="me-1" /> Manage Students
              </Button>
              <Button as={Link} to="/hod/allocations" variant="outline-primary">
                <FaBook className="me-1" /> Allocate Faculty
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Two Column Layout */}
        <Row className="g-4">
          <Col lg={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-center">
                <h5 className="mb-0">🔄 Recent Hall Ticket Activity</h5>
                <Link
                  to="/hod/hall-ticket-management"
                  className="btn btn-sm btn-outline-primary"
                >
                  View All
                </Link>
              </Card.Header>
              <Card.Body>
                {recentActivity.length === 0 ? (
                  <p className="text-muted text-center py-3">
                    No recent hall ticket activity.
                  </p>
                ) : (
                  <div className="list-group list-group-flush">
                    {recentActivity.map((ticket, index) => (
                      <div key={index} className="list-group-item px-0">
                        <div className="d-flex flex-wrap justify-content-between align-items-center">
                          <div>
                            <strong>
                              {ticket.studentId?.studentName || "Unknown"}
                            </strong>
                            <span className="text-muted ms-2">
                              ({ticket.studentId?.rollNumber || "N/A"})
                            </span>
                            <br />
                            <small className="text-muted">
                              Exam: {ticket.examId?.examName || "N/A"}
                            </small>
                          </div>
                          <div className="text-end">
                            {getStatusBadge(ticket.approvalStatus)}
                            <br />
                            <small className="text-muted">
                              {ticket.updatedAt
                                ? new Date(
                                    ticket.updatedAt,
                                  ).toLocaleDateString()
                                : "Unknown date"}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
              <Card.Footer>
                <div className="d-flex flex-wrap justify-content-between">
                  <small>
                    Pending:{" "}
                    <span className="text-warning fw-bold">
                      {overview?.pendingHallTickets || 0}
                    </span>
                  </small>
                  <small>
                    Approved:{" "}
                    <span className="text-success fw-bold">
                      {overview?.approvedHallTickets || 0}
                    </span>
                  </small>
                  <small>
                    Rejected:{" "}
                    <span className="text-danger fw-bold">
                      {overview?.rejectedHallTickets || 0}
                    </span>
                  </small>
                </div>
              </Card.Footer>
            </Card>
          </Col>

          <Col lg={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-center">
                <h5 className="mb-0">📚 Semester Overview</h5>
                <Link
                  to="/hod/semester-management"
                  className="btn btn-sm btn-outline-primary"
                >
                  Manage
                </Link>
              </Card.Header>
              <Card.Body>
                <Row className="g-2">
                  {semesterData.length > 0
                    ? semesterData.map((sem) => (
                        <Col xs={4} sm={3} key={sem.semester}>
                          <div
                            className={`p-2 text-center rounded border ${sem.status === "Active" ? "bg-success text-white border-success" : "bg-light text-muted"}`}
                          >
                            <small>Sem {sem.semester}</small>
                            <div className="fw-bold">
                              {sem.status === "Active"
                                ? sem.studentCount || 0
                                : 0}
                            </div>
                            <small>
                              {sem.status === "Active"
                                ? "✅ Active"
                                : "⏳ Inactive"}
                            </small>
                          </div>
                        </Col>
                      ))
                    : [1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                        <Col xs={4} sm={3} key={sem}>
                          <div className="p-2 text-center rounded bg-light text-muted border">
                            <small>Sem {sem}</small>
                            <div className="fw-bold">0</div>
                            <small>⏳</small>
                          </div>
                        </Col>
                      ))}
                </Row>
                <hr className="my-3" />
                <div className="d-flex flex-wrap justify-content-between">
                  <small>
                    Active:{" "}
                    <span className="text-success fw-bold">
                      {semesterData.filter((s) => s.status === "Active")
                        .length || 0}
                    </span>
                  </small>
                  <small>
                    Inactive:{" "}
                    <span className="text-muted fw-bold">
                      {semesterData.filter((s) => s.status !== "Active")
                        .length || 0}
                    </span>
                  </small>
                  <small>
                    Total Students:{" "}
                    <span className="text-primary fw-bold">
                      {semesterData.reduce(
                        (sum, s) => sum + (s.studentCount || 0),
                        0,
                      )}
                    </span>
                  </small>
                </div>
              </Card.Body>
              <Card.Footer>
                <Button
                  as={Link}
                  to="/hod/semester-management"
                  variant="outline-secondary"
                  size="sm"
                >
                  <FaPlus className="me-1" /> Manage Semesters
                </Button>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* ✅ Attendance Details Modal with Filters */}
      <Modal show={showModal} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaEye className="me-2" />
            Attendance Details - {selectedStudent?.studentName || "Student"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Filter Section */}
          <Card className="border-primary mb-3">
            <Card.Header className="bg-light">
              <h6 className="mb-0">
                <FaFilter className="me-2 text-primary" />
                Filter Attendance Records
              </h6>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col xs={12} sm={6} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      📅 Start Date
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="border-primary"
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      📅 End Date
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="border-primary"
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      📚 Subject
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                      className="border-primary"
                    >
                      <option value="">All Subjects</option>
                      {uniqueSubjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <div className="d-flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={applyFilters}
                      className="px-4"
                    >
                      <FaFilter className="me-1" /> Apply Filters
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={resetFilters}
                    >
                      <FaSync className="me-1" /> Reset
                    </Button>
                    {filterStartDate || filterEndDate || filterSubject ? (
                      <span className="text-muted small align-self-center ms-2">
                        <FaInfoCircle className="me-1" />
                        Filters applied
                      </span>
                    ) : (
                      <span className="text-muted small align-self-center ms-2">
                        <FaInfoCircle className="me-1" />
                        Showing all records
                      </span>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {loadingDetails ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading attendance details...</p>
            </div>
          ) : attendanceDetails ? (
            attendanceDetails.records &&
            attendanceDetails.records.length === 0 ? (
              <Alert variant="info">
                <FaClock className="me-2" />
                No attendance records found for this student.
                <br />
                <small>
                  Attendance records will appear once classes are conducted.
                </small>
              </Alert>
            ) : (
              <div>
                {/* Student Info */}
                <Row className="mb-3">
                  <Col md={6}>
                    <strong>Name:</strong> {attendanceDetails.student?.name}
                  </Col>
                  <Col md={6}>
                    <strong>USN:</strong>{" "}
                    {attendanceDetails.student?.rollNumber}
                  </Col>
                  <Col md={6}>
                    <strong>Semester:</strong>{" "}
                    {attendanceDetails.student?.semester}
                  </Col>
                  <Col md={6}>
                    <strong>Section:</strong>{" "}
                    {attendanceDetails.student?.section}
                  </Col>
                  <Col md={12}>
                    <strong>Mentor:</strong>{" "}
                    {attendanceDetails.student?.mentorName || "N/A"}
                  </Col>
                </Row>

                {/* Summary Cards */}
                <Row className="g-2 mb-3">
                  <Col xs={3}>
                    <Card className="bg-primary text-white">
                      <Card.Body className="text-center py-2">
                        <h5 className="mb-0">
                          {attendanceDetails.summary?.total || 0}
                        </h5>
                        <small>Total</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={3}>
                    <Card className="bg-success text-white">
                      <Card.Body className="text-center py-2">
                        <h5 className="mb-0">
                          {attendanceDetails.summary?.present || 0}
                        </h5>
                        <small>Present</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={3}>
                    <Card className="bg-danger text-white">
                      <Card.Body className="text-center py-2">
                        <h5 className="mb-0">
                          {attendanceDetails.summary?.absent || 0}
                        </h5>
                        <small>Absent</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={3}>
                    <Card
                      className={`${attendanceDetails.summary?.percentage >= (attendanceDetails.attendanceThreshold ?? selectedStudent?.attendanceThreshold ?? overview?.attendanceThreshold ?? 85) ? "bg-success" : "bg-danger"} text-white`}
                    >
                      <Card.Body className="text-center py-2">
                        <h5 className="mb-0">
                          {attendanceDetails.summary?.percentage || 0}%
                        </h5>
                        <small>Attendance</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Subject-wise Summary */}
                {attendanceDetails.subjectSummary &&
                  attendanceDetails.subjectSummary.length > 0 && (
                    <>
                      <h6>Subject-wise Summary</h6>
                      <div className="table-responsive mb-3">
                        <Table bordered size="sm">
                          <thead className="table-light">
                            <tr>
                              <th>Subject</th>
                              <th>Total</th>
                              <th>Present</th>
                              <th>Absent</th>
                              <th>Attendance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceDetails.subjectSummary.map(
                              (subject, index) => {
                                const subPercentage =
                                  subject.total > 0
                                    ? Math.round(
                                        (subject.present / subject.total) * 100,
                                      )
                                    : 0;
                                return (
                                  <tr key={index}>
                                    <td>{subject.subjectName}</td>
                                    <td>{subject.total}</td>
                                    <td className="text-success">
                                      {subject.present}
                                    </td>
                                    <td className="text-danger">
                                      {subject.absent}
                                    </td>
                                    <td>
                                      <Badge
                                        bg={
                                          subPercentage >=
                                          (attendanceDetails.attendanceThreshold ??
                                            selectedStudent?.attendanceThreshold ??
                                            overview?.attendanceThreshold ??
                                            85)
                                            ? "success"
                                            : "danger"
                                        }
                                      >
                                        {subPercentage}%
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </Table>
                      </div>
                    </>
                  )}

                {/* Date-wise Records */}
                {attendanceDetails.records &&
                  attendanceDetails.records.length > 0 && (
                    <>
                      <h6>Date-wise Attendance Records</h6>
                      <small className="text-muted d-block mb-2">
                        <FaInfoCircle className="me-1" />
                        <strong>Note:</strong> Faculty name shows who marked
                        attendance on that specific date. Different faculty may
                        appear for the same subject if multiple faculty are
                        assigned (e.g., Theory + Lab) or if a substitute marked
                        attendance.
                      </small>
                      <div
                        className="table-responsive"
                        style={{ maxHeight: "200px", overflowY: "auto" }}
                      >
                        <Table bordered size="sm">
                          <thead className="table-light">
                            <tr>
                              <th>Date</th>
                              <th>Subject</th>
                              <th>Status</th>
                              <th>Faculty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceDetails.records.map((record, index) => (
                              <tr key={index}>
                                <td>
                                  {new Date(
                                    record.attendanceDate,
                                  ).toLocaleDateString()}
                                </td>
                                <td>{record.subjectName || "Unknown"}</td>
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
                                <td>{record.facultyName || "N/A"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </>
                  )}
              </div>
            )
          ) : (
            <Alert variant="danger">Failed to load attendance details.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ NEW: Faculty Approval Modal */}
      <Modal
        show={showFacultyModal}
        onHide={() => {
          setShowFacultyModal(false);
          setSelectedFaculty(null);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaUserCheck className="me-2" />
            Approve Faculty - {selectedFaculty?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <FaInfoCircle className="me-2" />
            Assign a role to <strong>{selectedFaculty?.name}</strong>. They will
            get access to the dashboard based on the role you select.
          </Alert>

          <Row className="mb-3">
            <Col md={6}>
              <strong>Name:</strong> {selectedFaculty?.name}
            </Col>
            <Col md={6}>
              <strong>Email:</strong> {selectedFaculty?.email}
            </Col>
            <Col md={6}>
              <strong>Registered:</strong>{" "}
              {selectedFaculty?.createdAt
                ? new Date(selectedFaculty.createdAt).toLocaleDateString()
                : "N/A"}
            </Col>
            <Col md={6}>
              <strong>Status:</strong> <Badge bg="warning">Pending</Badge>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              Assign Role <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select
              value={facultyRoleType}
              onChange={(e) => setFacultyRoleType(e.target.value)}
            >
              <option value="Faculty">
                Faculty - Can mark attendance & view history
              </option>
              <option value="Mentor">
                Mentor - Can review documents & approve hall tickets
              </option>
              <option value="Both">
                Both - Faculty + Mentor (Full access)
              </option>
            </Form.Select>
            <Form.Text className="text-muted">
              Choose the role based on what this faculty will do.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Remarks (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows="2"
              value={facultyRemarks}
              onChange={(e) => setFacultyRemarks(e.target.value)}
              placeholder="Enter any remarks..."
            />
          </Form.Group>

          <Alert variant="warning">
            <strong>Note:</strong> After approval, you need to assign subjects
            and classes from <strong>Allocate Faculty</strong> page.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowFacultyModal(false);
              setSelectedFaculty(null);
            }}
            disabled={facultyActionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRejectFaculty}
            disabled={facultyActionLoading}
          >
            <FaUserTimes className="me-1" /> Reject
          </Button>
          <Button
            variant="success"
            onClick={handleApproveFaculty}
            disabled={facultyActionLoading}
          >
            {facultyActionLoading ? (
              <>
                <Spinner size="sm" className="me-1" />
                Approving...
              </>
            ) : (
              <>
                <FaUserCheck className="me-1" /> Approve as {facultyRoleType}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

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

export default HodDashboard;
