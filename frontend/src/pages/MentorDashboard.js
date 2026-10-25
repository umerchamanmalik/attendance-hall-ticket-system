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
  Table,
  Modal,
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaUsers,
  FaFileAlt,
  FaBook,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaUserGraduate,
  FaSearch,
  FaSync,
  FaEye,
  FaFilePdf,
  FaToggleOn,
  FaTimesCircle,
  FaToggleOff,
  FaInfoCircle,
  FaFilter,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const MentorDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [mentees, setMentees] = useState([]);
  const [filteredMentees, setFilteredMentees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPercentage, setShowPercentage] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(null);
  // ✅ ADDED: Department displayed in the dashboard header
  const [department, setDepartment] = useState("CS");
  const [attendanceThreshold, setAttendanceThreshold] = useState(85);
  const toast = useToast();

  // ✅ Filter states for mentees
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // ✅ Stats
  const [stats, setStats] = useState({
    totalMentees: 0,
    pendingHallTickets: 0,
    approvedHallTickets: 0,
    rejectedHallTickets: 0,
    lowAttendance: 0,
    pendingDocuments: 0,
  });

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Attendance Details Modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const navigate = useNavigate();

  // ✅ Get unique semesters and sections from mentees
  const uniqueSemesters = [
    ...new Set(mentees.map((m) => m.semester).filter(Boolean)),
  ].sort((a, b) => a - b);
  const uniqueSections = [
    ...new Set(mentees.map((m) => m.section).filter(Boolean)),
  ].sort();

  // ✅ Filter mentees when filters change
  useEffect(() => {
    let filtered = [...mentees];

    if (filterSemester) {
      filtered = filtered.filter(
        (m) => m.semester === parseInt(filterSemester),
      );
    }
    if (filterSection) {
      filtered = filtered.filter((m) => m.section === filterSection);
    }
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.studentName?.toLowerCase().includes(search) ||
          m.rollNumber?.toLowerCase().includes(search),
      );
    }
    setFilteredMentees(filtered);
  }, [mentees, filterSemester, filterSection, filterSearch]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("📊 [MentorDashboard] Loading data...");

      // ✅ ADDED: Read the mentor's department from the authenticated profile
      try {
        const profileResponse = await api.get("/auth/profile");
        setDepartment(profileResponse.data.data?.department || "CS");
        setAttendanceThreshold(
          profileResponse.data.data?.attendanceThreshold ?? 85,
        );
      } catch (profileError) {
        console.log("Could not load mentor department:", profileError.message);
      }

      // 1. Get mentor settings
      try {
        const settingsResponse = await api.get("/mentor/settings");
        setShowPercentage(
          settingsResponse.data.data?.showAttendancePercentage ?? true,
        );
      } catch (e) {
        console.log("No mentor settings found, using default");
        setShowPercentage(true);
      }

      // 2. Get mentees with filters
      try {
        console.log("📊 [MentorDashboard] Fetching mentees...");
        const menteesResponse = await api.get("/students/mentees");
        console.log(
          "📊 [MentorDashboard] Mentees response:",
          menteesResponse.data,
        );

        const menteeList = menteesResponse.data.data || [];
        console.log(`📊 [MentorDashboard] Found ${menteeList.length} mentees`);

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
                showAttendanceProgress: mentee.showAttendanceProgress !== false,
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
                showAttendanceProgress: mentee.showAttendanceProgress !== false,
              };
            }
          }),
        );

        setMentees(menteesWithAttendance);
        setFilteredMentees(menteesWithAttendance);

        const lowAttendanceCount = menteesWithAttendance.filter(
          (m) =>
            m.attendancePercentage > 0 &&
            m.attendancePercentage <
              (m.attendanceThreshold ?? attendanceThreshold),
        ).length;
        setStats((prev) => ({
          ...prev,
          totalMentees: menteesWithAttendance.length,
          lowAttendance: lowAttendanceCount,
        }));
      } catch (e) {
        console.error("Error loading mentees:", e);
        setMentees([]);
        setFilteredMentees([]);
        setError("Failed to load mentees. Please refresh.");
      }

      // 3. Get pending documents for review
      try {
        console.log("📊 [MentorDashboard] Fetching pending documents...");
        const docsResponse = await api.get("/documents/review");
        console.log(
          "📊 [MentorDashboard] Documents response:",
          docsResponse.data,
        );

        const allDocs = docsResponse.data.data || [];
        const pendingDocs = allDocs.filter(
          (d) => d.status === "pending" || d.status === "mentor-approved",
        );
        console.log(
          `📊 [MentorDashboard] Found ${pendingDocs.length} pending documents`,
        );

        setDocuments(pendingDocs);
        setStats((prev) => ({
          ...prev,
          pendingDocuments: pendingDocs.filter((d) => d.status === "pending")
            .length,
        }));
      } catch (e) {
        console.error("Error loading documents:", e);
        setDocuments([]);
      }

      // 4. Get hall ticket stats
      try {
        const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
          api.get(
            "/exam-halltickets/mentor/halltickets?approvalStatus=Pending",
          ),
          api.get(
            "/exam-halltickets/mentor/halltickets?approvalStatus=Approved",
          ),
          api.get(
            "/exam-halltickets/mentor/halltickets?approvalStatus=Rejected",
          ),
        ]);
        setStats((prev) => ({
          ...prev,
          pendingHallTickets: pendingRes.data.data?.length || 0,
          approvedHallTickets: approvedRes.data.data?.length || 0,
          rejectedHallTickets: rejectedRes.data.data?.length || 0,
        }));
      } catch (e) {
        console.log("Error fetching hall tickets:", e);
      }

      toast.success("Dashboard loaded successfully!");
    } catch (error) {
      console.error("Error loading mentor dashboard:", error);
      setError("Failed to load dashboard data. Please refresh the page.");
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Handle Student Search - ONLY shows mentees
  const handleSearch = async () => {
    const searchQuery = searchTerm.trim();

    if (!searchQuery) {
      toast.warning("Please enter a name, USN, or roll number to search.");
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(
        `/students/search?query=${encodeURIComponent(searchQuery)}`,
      );
      console.log("🔍 Search response:", response.data);

      const results = response.data.data || [];
      setSearchResults(results);

      if (results.length === 0) {
        toast.info(`No mentees found matching "${searchQuery}".`);
      } else {
        toast.success(
          `Found ${results.length} mentee(s) matching "${searchQuery}".`,
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

  // Toggle Attendance Progress for ALL mentees
  const handleToggleVisibility = async () => {
    if (mentees.length === 0) {
      toast.warning("No mentees found to toggle.");
      return;
    }

    setToggling(true);
    try {
      const newValue = !showPercentage;

      const response = await api.put("/mentor/toggle-visibility", {
        showPercentage: newValue,
      });

      console.log("✅ Toggle response:", response.data);

      if (response.data.success) {
        setShowPercentage(newValue);
        setMentees(
          mentees.map((m) => ({
            ...m,
            attendanceVisibility: newValue
              ? "Show Percentage"
              : "Hide Percentage",
            showAttendanceProgress: newValue,
          })),
        );

        toast.success(
          `Attendance progress ${newValue ? "enabled" : "disabled"} for all ${mentees.length} mentees`,
        );
      } else {
        toast.error(response.data.message || "Failed to toggle visibility");
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
      toast.error(
        error.response?.data?.error ||
          "❌ Failed to toggle visibility. Please try again.",
      );
    } finally {
      setToggling(false);
    }
  };

  // View Attendance Details
  const viewAttendanceDetails = async (student) => {
    setSelectedStudent(student);
    setShowModal(true);
    setLoadingDetails(true);

    try {
      const studentId = student?._id || student?.id;

      if (!studentId) {
        console.error("❌ No student ID found:", student);
        toast.error("Student ID is missing. Please try again.");
        setLoadingDetails(false);
        return;
      }

      console.log("🔍 Fetching attendance details for student:", {
        id: studentId,
        name: student?.studentName,
        rollNumber: student?.rollNumber,
      });

      const response = await api.get("/attendance", {
        params: { studentId: studentId },
      });

      console.log("✅ API Response:", response.data);

      if (response.data.success) {
        const records = response.data.data || [];
        console.log(`📊 Found ${records.length} attendance records`);

        const subjectMap = {};
        records.forEach((record) => {
          const subjectName = record.subjectName || "Unknown";
          if (!subjectMap[subjectName]) {
            subjectMap[subjectName] = {
              subjectName: subjectName,
              total: 0,
              present: 0,
              absent: 0,
              records: [],
            };
          }
          subjectMap[subjectName].total++;
          if (record.status === "Present") {
            subjectMap[subjectName].present++;
          } else {
            subjectMap[subjectName].absent++;
          }
          subjectMap[subjectName].records.push(record);
        });

        const subjectSummary = Object.values(subjectMap);
        console.log(`📊 Subject Summary:`, subjectSummary);

        const total = records.length;
        const present = records.filter((r) => r.status === "Present").length;
        const absent = records.filter((r) => r.status === "Absent").length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        setAttendanceDetails({
          attendanceThreshold:
            student.attendanceThreshold ?? attendanceThreshold,
          student: {
            name: student.studentName,
            rollNumber: student.rollNumber,
            semester: student.semester,
            section: student.section,
            mentorName: student.mentorName,
          },
          summary: {
            total,
            present,
            absent,
            percentage,
          },
          subjectSummary: subjectSummary,
          records: records,
        });
      } else {
        toast.error(response.data.error || "Failed to load attendance details");
        setAttendanceDetails(null);
      }
    } catch (error) {
      console.error("❌ Error fetching attendance details:", error);
      toast.error(
        error.response?.data?.error ||
          "Failed to load attendance details. Please try again.",
      );
      setAttendanceDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
    setAttendanceDetails(null);
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= attendanceThreshold) return "text-success";
    if (percentage >= attendanceThreshold - 10) return "text-warning";
    return "text-danger";
  };

  const getAttendanceBadge = (percentage) => {
    if (percentage >= attendanceThreshold) return "success";
    if (percentage >= attendanceThreshold - 10) return "warning";
    if (percentage > 0) return "danger";
    return "secondary";
  };

  const getStatusBadge = (status, documentType) => {
    if (documentType === "leave" && status === "mentor-approved") {
      return <Badge bg="success">✅ Completed</Badge>;
    }
    if (
      documentType === "attendance-correction" &&
      status === "mentor-approved"
    ) {
      return <Badge bg="info">⏳ Under Faculty</Badge>;
    }

    const variants = {
      pending: "warning",
      "mentor-approved": "info",
      "mentor-rejected": "danger",
      completed: "success",
    };

    const labels = {
      pending: "⏳ Pending",
      "mentor-approved": "⏳ Under Faculty",
      "mentor-rejected": "❌ Rejected",
      completed: "✅ Completed",
    };

    return (
      <Badge bg={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const StatCard = ({ icon: Icon, title, value, bgColor }) => (
    <Col xs={6} sm={6} md={4} lg={3}>
      <Card
        className={`h-100 shadow-sm border-0 bg-${bgColor || "primary"} text-white`}
      >
        <Card.Body className="d-flex align-items-center justify-content-between">
          <div>
            <h6 className="text-white-50 mb-1">{title}</h6>
            <h2 className="mb-0">{value || 0}</h2>
          </div>
          <div className="bg-white bg-opacity-25 p-2 rounded-circle">
            <Icon size={24} className="text-white" />
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
          <p className="mt-3 text-muted">Loading dashboard...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaUserGraduate className="me-2 text-primary" />
            Mentor Dashboard
          </h2>
          <Badge bg="info" className="align-self-center">
            Department: {department}
          </Badge>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={loadDashboardData}
          >
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {/* Error Display */}
        {error && <ErrorMessage message={error} onRetry={loadDashboardData} />}

        {/* Attendance Visibility Toggle */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body className="d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <h5 className="mb-1">📊 Attendance Visibility</h5>
              <p className="text-muted mb-0 small">
                {showPercentage
                  ? "✅ Students can see their attendance percentage and progress"
                  : "🔒 Students cannot see attendance percentage and progress"}
              </p>
              <small className="text-muted">
                Applied to {mentees.length} mentees
              </small>
            </div>
            <div className="d-flex align-items-center gap-3 mt-2 mt-md-0">
              <span
                className={`small fw-bold ${showPercentage ? "text-success" : "text-muted"}`}
              >
                {showPercentage ? (
                  <FaToggleOn size={20} />
                ) : (
                  <FaToggleOff size={20} />
                )}
                {showPercentage ? " Show %" : " Hide %"}
              </span>
              <Form.Check
                type="switch"
                id="attendanceToggle"
                checked={showPercentage}
                onChange={handleToggleVisibility}
                disabled={toggling || mentees.length === 0}
                label={toggling ? "Toggling..." : ""}
              />
              {toggling && (
                <Spinner animation="border" size="sm" variant="primary" />
              )}
            </div>
          </Card.Body>
        </Card>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaUsers}
            title="Total Mentees"
            value={stats.totalMentees}
            bgColor="primary"
          />
          <StatCard
            icon={FaClock}
            title="Pending Hall Tickets"
            value={stats.pendingHallTickets}
            bgColor="warning"
          />
          <StatCard
            icon={FaCheckCircle}
            title="Approved"
            value={stats.approvedHallTickets}
            bgColor="success"
          />
          <StatCard
            icon={FaExclamationTriangle}
            title="Rejected"
            value={stats.rejectedHallTickets}
            bgColor="danger"
          />
        </Row>

        {/* Quick Actions */}
        <Row className="g-2 mb-4">
          <Col xs={6} md={3}>
            <Button
              variant="primary"
              className="w-100"
              onClick={() => navigate("/mentor/mentees")}
            >
              👁️ View Mentees
            </Button>
          </Col>
          <Col xs={6} md={3}>
            <Button
              variant="success"
              className="w-100"
              onClick={() => navigate("/mentor/hall-ticket-approval")}
            >
              🎫 Approve Hall Tickets
            </Button>
          </Col>
          <Col xs={6} md={3}>
            <Button
              variant="info"
              className="w-100 text-white"
              onClick={() => navigate("/mentor/documents")}
            >
              📄 Review Docs ({stats.pendingDocuments})
            </Button>
          </Col>
          <Col xs={6} md={3}>
            <Link
              to="/mentor/mentees"
              className="btn btn-warning w-100 text-white"
            >
              📊 Attendance Report
            </Link>
          </Col>
        </Row>

        {/* Quick Student Lookup - Only shows mentees */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaSearch className="me-2" />
              Quick Student Lookup (My Mentees)
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
                <h6>Search Results ({searchResults.length})</h6>
                <div className="table-responsive">
                  <Table bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>USN</th>
                        <th>Name</th>
                        <th>Semester</th>
                        <th>Section</th>
                        <th>Attendance</th>
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
                              bg={getAttendanceBadge(
                                student.attendancePercentage || 0,
                              )}
                            >
                              {student.attendancePercentage || 0}%
                            </Badge>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="info"
                              className="text-white"
                              onClick={() => viewAttendanceDetails(student)}
                            >
                              <FaEye /> Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSearchResults([]);
                  }}
                >
                  Clear Results
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Pending Documents */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-warning d-flex flex-wrap justify-content-between align-items-center">
            <h5 className="mb-0">📄 Documents for Review</h5>
            <Badge bg="dark">{stats.pendingDocuments} pending</Badge>
          </Card.Header>
          <Card.Body className="p-0">
            {documents.length === 0 ? (
              <div className="text-center py-4">
                <Alert variant="info" className="m-3">
                  No pending documents to review.
                </Alert>
              </div>
            ) : (
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Type</th>
                      <th>Subjects</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 5).map((doc, index) => (
                      <tr key={doc._id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>
                            {doc.studentId?.studentName || "Unknown"}
                          </strong>
                          <br />
                          <small className="text-muted">
                            {doc.studentId?.rollNumber}
                          </small>
                        </td>
                        <td>
                          <Badge
                            bg={
                              doc.documentType === "attendance-correction"
                                ? "info"
                                : "secondary"
                            }
                          >
                            {doc.documentType === "attendance-correction"
                              ? "Attendance"
                              : "Leave"}
                          </Badge>
                        </td>
                        <td>
                          <small>
                            {doc.subjects && doc.subjects.length > 0
                              ? doc.subjects.map((s) => s.name || s).join(", ")
                              : "All Subjects"}
                          </small>
                        </td>
                        <td>
                          <small>
                            {doc.dates && doc.dates.length > 0
                              ? doc.dates
                                  .map((d) => new Date(d).toLocaleDateString())
                                  .join(", ")
                              : doc.leaveStartDate
                                ? `${new Date(doc.leaveStartDate).toLocaleDateString()} - ${new Date(doc.leaveEndDate).toLocaleDateString()}`
                                : "-"}
                          </small>
                        </td>
                        <td>{getStatusBadge(doc.status, doc.documentType)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => navigate("/mentor/documents")}
                          >
                            📝 Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          {documents.length > 5 && (
            <Card.Footer className="bg-white">
              <Link
                to="/mentor/documents"
                className="btn btn-outline-primary btn-sm"
              >
                👁️ View All Documents ({documents.length})
              </Link>
            </Card.Footer>
          )}
        </Card>

        {/* ✅ Mentees Filter Section */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaFilter className="me-2 text-primary" />
              Filter Mentees
            </h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-2">
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="small fw-bold">
                    <FaBook className="me-1 text-primary" size={12} />
                    Semester
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                  >
                    <option value="">All</option>
                    {uniqueSemesters.map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="small fw-bold">
                    <FaUserGraduate className="me-1 text-primary" size={12} />
                    Section
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                  >
                    <option value="">All</option>
                    {uniqueSections.map((s) => (
                      <option key={s} value={s}>
                        Sec {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label className="small fw-bold">
                    <FaSearch className="me-1 text-primary" size={12} />
                    Search
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Name or USN..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} md={2} className="d-flex align-items-end">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-100"
                  onClick={() => {
                    setFilterSemester("");
                    setFilterSection("");
                    setFilterSearch("");
                  }}
                >
                  <FaTimesCircle className="me-1" /> Clear
                </Button>
              </Col>
            </Row>
            <div className="mt-2">
              <small className="text-muted">
                <FaInfoCircle className="me-1" size={12} />
                Showing {filteredMentees.length} of {mentees.length} mentees
              </small>
            </div>
          </Card.Body>
        </Card>

        {/* Mentees List - Using filteredMentees */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-center">
            <h5 className="mb-0">👨‍🎓 My Mentees</h5>
            <Badge bg="secondary">{filteredMentees.length} students</Badge>
          </Card.Header>
          <Card.Body className="p-0">
            {filteredMentees.length === 0 ? (
              <div className="text-center py-4">
                <Alert variant="info" className="m-3">
                  {mentees.length === 0
                    ? "No mentees assigned yet. Please contact your HOD to assign students."
                    : "No mentees match the current filters."}
                </Alert>
              </div>
            ) : (
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Semester</th>
                      <th>Section</th>
                      <th>Attendance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMentees.slice(0, 10).map((mentee, index) => {
                      const percentage = mentee.attendancePercentage || 0;
                      const hasNoRecords =
                        percentage === 0 && mentee.totalClasses === 0;
                      return (
                        <tr key={mentee._id}>
                          <td>{index + 1}</td>
                          <td>{mentee.rollNumber}</td>
                          <td>{mentee.studentName}</td>
                          <td>{mentee.semester}</td>
                          <td>{mentee.section}</td>
                          <td className={getAttendanceColor(percentage)}>
                            {hasNoRecords ? "N/A" : `${percentage}%`}
                          </td>
                          <td>
                            {hasNoRecords ? (
                              <Badge bg="secondary">No Records</Badge>
                            ) : percentage <
                              (mentee.attendanceThreshold ??
                                attendanceThreshold) ? (
                              <Badge bg="danger">⚠️ Need Attention</Badge>
                            ) : (
                              <Badge bg="success">✅ On Track</Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="info"
                              className="text-white"
                              onClick={() => viewAttendanceDetails(mentee)}
                            >
                              <FaEye /> Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          {filteredMentees.length > 10 && (
            <Card.Footer className="bg-white">
              <Link
                to="/mentor/mentees"
                className="btn btn-outline-primary btn-sm"
              >
                👁️ View All Mentees ({filteredMentees.length})
              </Link>
            </Card.Footer>
          )}
        </Card>

        {/* Attendance Details Modal */}
        <Modal show={showModal} onHide={closeModal} size="lg" centered>
          <Modal.Header closeButton className="bg-primary text-white">
            <Modal.Title>
              📋 Attendance Details - {selectedStudent?.studentName}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {loadingDetails ? (
              <div className="text-center py-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2 text-muted">Loading attendance details...</p>
              </div>
            ) : attendanceDetails ? (
              attendanceDetails.records &&
              attendanceDetails.records.length === 0 ? (
                <Alert variant="info">
                  <FaExclamationTriangle className="me-2" />
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
                      {attendanceDetails.student?.mentorName ||
                        selectedStudent?.mentorName ||
                        "Not Assigned"}
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
                        className={`${attendanceDetails.summary?.percentage >= (attendanceDetails.attendanceThreshold ?? attendanceThreshold) ? "bg-success" : "bg-danger"} text-white`}
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
                                          (subject.present / subject.total) *
                                            100,
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
                                              attendanceThreshold)
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
                              {attendanceDetails.records.map(
                                (record, index) => (
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
                                ),
                              )}
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
            {attendanceDetails?.records &&
              attendanceDetails.records.length > 0 && (
                <Button variant="primary">
                  <FaFilePdf className="me-1" /> Download Report
                </Button>
              )}
          </Modal.Footer>
        </Modal>
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

export default MentorDashboard;
