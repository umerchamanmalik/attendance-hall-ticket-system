import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaHistory,
  FaFilter,
  FaDownload,
  FaFileExcel,
  FaFileCsv,
  FaCalendarAlt,
  FaBook,
  FaUserGraduate,
  FaSearch,
  FaSync,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaPrint,
  FaEye,
  FaChevronDown, // ✅ ADDED
  FaChevronUp, // ✅ ADDED
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

// ✅ ADDED: Default number of records shown before "Show All"
const INITIAL_LIMIT = 10;

// ✅ ADDED: Print-only CSS — hides everything except the records table
const printStyles = `
  @media print {
    body * { visibility: hidden; }
    .print-area, .print-area * { visibility: visible; }
    .print-area {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    .print-area .no-print { display: none !important; }
    .print-area table { font-size: 11px; }
    .print-area th, .print-area td { padding: 4px 6px; }
  }
`;

const AttendanceHistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  // ✅ ADDED: Show-all toggle
  const [showAll, setShowAll] = useState(false);

  const [filters, setFilters] = useState({
    subjectName: "",
    startDate: "",
    endDate: "",
    studentSearch: "",
    section: "",
    department: "",
  });
  const [classes, setClasses] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    total: 0,
    percentage: 0,
  });

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadClasses();
    loadHistory();
  }, []);

  const loadClasses = async () => {
    try {
      const response = await api.get("/attendance/classes");

      if (response.data.success) {
        setClasses(response.data.data || []);
      }
    } catch (error) {
      console.error("Error loading classes:", error);
      toast.warning("⚠️ Failed to load classes");
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};

      if (filters.subjectName) params.subjectName = filters.subjectName;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.department) params.department = filters.department;

      console.log("📊 Fetching attendance with params:", params);

      const response = await api.get("/attendance", { params });

      if (!response.data.success) {
        throw new Error(
          response.data.message || "Failed to load attendance history",
        );
      }

      let data = response.data.data || [];

      // ✅ Filter by student name/roll number
      if (filters.studentSearch) {
        const search = filters.studentSearch.toLowerCase();
        data = data.filter((record) => {
          const name = record.studentId?.studentName?.toLowerCase() || "";
          const roll = record.studentId?.rollNumber?.toLowerCase() || "";
          return name.includes(search) || roll.includes(search);
        });
      }

      // ✅ Filter by section
      if (filters.section) {
        data = data.filter((record) => {
          const section = record.studentId?.section?.toUpperCase() || "";
          return section === filters.section.toUpperCase();
        });
      }

      // Sort by date descending (newest first)
      data.sort(
        (a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate),
      );

      setHistory(data);
      setTotalRecords(data.length);

      // ✅ ADDED: Collapse back to limited view whenever fresh data arrives
      setShowAll(false);

      // Calculate summary
      const present = data.filter((r) => r.status === "Present").length;
      const absent = data.filter((r) => r.status === "Absent").length;
      const total = data.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      setSummary({
        present,
        absent,
        total,
        percentage,
      });

      if (data.length === 0) {
        toast.info("No attendance records found for the selected filters.");
      } else {
        toast.success(`Found ${data.length} attendance records.`);
      }
    } catch (error) {
      console.error("Error loading history:", error);
      setError(
        error.response?.data?.error || "Failed to load attendance history",
      );
      toast.error(
        error.response?.data?.error || "Failed to load attendance history",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    setShowAll(false); // ✅ ADDED: collapse on new filter
    loadHistory();
  };

  const clearFilters = () => {
    setFilters({
      subjectName: "",
      startDate: "",
      endDate: "",
      studentSearch: "",
      section: "",
      department: "",
    });
    setShowAll(false); // ✅ ADDED
    setTimeout(() => loadHistory(), 100);
  };

  const uniqueSubjects = [...new Set(classes.map((c) => c.subjectName))];
  const sections = ["A", "B", "C", "D"];

  // ✅ ADDED: Computed visible records + hidden count
  const visibleRecords = showAll ? history : history.slice(0, INITIAL_LIMIT);
  const hiddenCount = Math.max(0, history.length - INITIAL_LIMIT);

  const downloadCSV = () => {
    if (history.length === 0) {
      toast.warning("No records to download. Please apply filters first.");
      return;
    }

    setDownloading(true);
    try {
      const headers = [
        "Date",
        "Student Name",
        "Roll Number",
        "Subject",
        "Semester",
        "Section",
        "Status",
      ];

      const rows = history.map((record) => [
        new Date(record.attendanceDate).toLocaleDateString(),
        record.studentId?.studentName || "Unknown",
        record.studentId?.rollNumber || "Unknown",
        record.subjectName || "N/A",
        record.studentId?.semester || "N/A",
        record.studentId?.section || "N/A",
        record.status || "N/A",
      ]);

      let csvContent = headers.join(",") + "\n";
      rows.forEach((row) => {
        const escapedRow = row.map(
          (cell) => `"${String(cell).replace(/"/g, '""')}"`,
        );
        csvContent += escapedRow.join(",") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_history_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("✅ Download started successfully!");
    } catch (error) {
      console.error("Error downloading CSV:", error);
      toast.error("Failed to download attendance records");
    } finally {
      setDownloading(false);
    }
  };

  const downloadExcel = () => {
    downloadCSV();
  };

  const getStatusBadge = (status) => {
    const variants = {
      Present: "success",
      Absent: "danger",
    };
    return <Badge bg={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getStatusIcon = (status) => {
    if (status === "Present") return <FaCheckCircle className="text-success" />;
    if (status === "Absent") return <FaTimesCircle className="text-danger" />;
    return null;
  };

  const StatCard = ({ icon: Icon, title, value, bgColor }) => (
    <Col xs={6} md={3}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0`}
      >
        <Card.Body className="d-flex align-items-center justify-content-between p-2 p-md-3">
          <div>
            <h6 className="text-white-50 mb-1 small">{title}</h6>
            <h2 className="mb-0 h4 h2-md">{value || 0}</h2>
          </div>
          <div className="bg-white bg-opacity-25 p-2 rounded-circle">
            <Icon size={20} className="text-white" />
          </div>
        </Card.Body>
      </Card>
    </Col>
  );

  // ✅ Render mobile cards — uses visibleRecords now
  const renderMobileCards = () => {
    if (history.length === 0) {
      return (
        <Alert variant="info" className="text-center py-4 mb-0">
          <FaInfoCircle className="me-2" size={24} />
          <br />
          No attendance records found.
        </Alert>
      );
    }

    return visibleRecords.map((record, index) => {
      const statusColor = record.status === "Present" ? "success" : "danger";
      return (
        <Card
          key={record._id || index}
          className="mb-2 mb-md-3 shadow-sm border-0"
        >
          <Card.Body className="p-3">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <Badge bg="secondary" className="mb-1">
                #{index + 1}
              </Badge>
              <Badge bg={statusColor}>
                {getStatusIcon(record.status)} {record.status}
              </Badge>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <small className="text-muted d-block">Date</small>
                <strong className="small">
                  {new Date(record.attendanceDate).toLocaleDateString()}
                </strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Subject</small>
                <strong className="small">{record.subjectName || "N/A"}</strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Student Name</small>
                <strong className="small">
                  {record.studentId?.studentName || "Unknown"}
                </strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">USN / Roll No</small>
                <strong className="small">
                  {record.studentId?.rollNumber || "Unknown"}
                </strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Semester</small>
                <strong className="small">
                  {record.studentId?.semester || "N/A"}
                </strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Section</small>
                <strong className="small">
                  {record.studentId?.section || "N/A"}
                </strong>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Department</small>
                <strong className="small">{record.department || "CS"}</strong>
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    });
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
          <p className="mt-3 text-muted">Loading attendance history...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      {/* ✅ ADDED: Print-only CSS */}
      <style>{printStyles}</style>

      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 mb-md-4 gap-2">
          <h2 className="mb-0 h4 h2-md">
            <FaHistory className="me-2 text-primary" />
            Attendance History
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate("/faculty/attendance")}
            >
              <FaArrowLeft className="me-1" /> Back
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={downloadExcel}
              disabled={downloading || history.length === 0}
            >
              {downloading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Downloading...
                </>
              ) : (
                <>
                  <FaDownload className="me-1" /> Download
                </>
              )}
            </Button>
            <Button variant="outline-primary" size="sm" onClick={loadHistory}>
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <Alert variant="info" className="mb-3 small">
          <FaInfoCircle className="me-2" />
          Showing attendance records for your assigned classes only.
          {classes.length > 0 && (
            <span className="ms-2 d-none d-md-inline">
              (Subjects: {uniqueSubjects.join(", ")})
            </span>
          )}
        </Alert>

        {/* Summary Cards */}
        {history.length > 0 && (
          <Row className="g-2 g-md-3 mb-3 mb-md-4">
            <StatCard
              icon={FaCheckCircle}
              title="Present"
              value={summary.present}
              bgColor="bg-success"
            />
            <StatCard
              icon={FaTimesCircle}
              title="Absent"
              value={summary.absent}
              bgColor="bg-danger"
            />
            <StatCard
              icon={FaHistory}
              title="Total Records"
              value={summary.total}
              bgColor="bg-primary"
            />
            <StatCard
              icon={FaEye}
              title="Attendance %"
              value={`${summary.percentage}%`}
              bgColor="bg-info"
            />
          </Row>
        )}

        {/* Filters Section */}
        <Card className="shadow-sm border-0 mb-3 mb-md-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0 h6 h5-md">
              <FaFilter className="me-2" /> Filter Attendance
            </h5>
          </Card.Header>
          <Card.Body className="p-3">
            <Form onSubmit={handleFilter}>
              <Row className="g-2 g-md-3">
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      <FaBook className="me-1" /> Subject
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.subjectName}
                      onChange={(e) =>
                        setFilters({ ...filters, subjectName: e.target.value })
                      }
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
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      <FaCalendarAlt className="me-1" /> Start Date
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.startDate}
                      onChange={(e) =>
                        setFilters({ ...filters, startDate: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      <FaCalendarAlt className="me-1" /> End Date
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filters.endDate}
                      onChange={(e) =>
                        setFilters({ ...filters, endDate: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">Section</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.section}
                      onChange={(e) =>
                        setFilters({ ...filters, section: e.target.value })
                      }
                    >
                      <option value="">All Sections</option>
                      {sections.map((section) => (
                        <option key={section} value={section}>
                          Section {section}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      Department
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.department}
                      onChange={(e) =>
                        setFilters({ ...filters, department: e.target.value })
                      }
                    >
                      <option value="">All Departments</option>
                      {[
                        ...new Set(
                          classes.map((item) => item.department || "CS"),
                        ),
                      ].map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold small">
                      <FaUserGraduate className="me-1" /> Search Student
                    </Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        placeholder="Name or USN..."
                        value={filters.studentSearch}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            studentSearch: e.target.value,
                          })
                        }
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mt-3">
                <Col xs={12}>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <Button variant="primary" size="sm" type="submit">
                      <FaSearch className="me-1" /> Apply Filters
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={clearFilters}
                    >
                      <FaSync className="me-1" /> Clear Filters
                    </Button>
                    <span className="text-muted small">
                      Showing {history.length} records
                    </span>
                  </div>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {/* ✅ History Table / Mobile Cards */}
        {history.length === 0 ? (
          <Alert variant="info" className="text-center py-4">
            <FaInfoCircle className="me-2" size={24} />
            <br />
            No attendance records found. Try adjusting your filters.
          </Alert>
        ) : (
          /* ✅ ADDED: print-area class marks this card as the only printable region */
          <Card className="shadow-sm border-0 print-area">
            <Card.Body className="p-0">
              {/* ✅ ADDED: Print-only header inside the card */}
              <div className="d-none d-print-block p-3 border-bottom">
                <h4 className="mb-1">Attendance History Report</h4>
                <small className="text-muted">
                  Generated on {new Date().toLocaleDateString()} at{" "}
                  {new Date().toLocaleTimeString()}
                </small>
              </div>

              {/* ✅ Mobile Card View */}
              {isMobile ? (
                <div className="p-2 p-md-3">
                  {renderMobileCards()}
                  <div className="text-center text-muted small mt-2">
                    <FaInfoCircle className="me-1" />
                    Showing {visibleRecords.length} of {history.length} records
                  </div>
                </div>
              ) : (
                /* ✅ Desktop Table View */
                <div className="table-responsive">
                  <Table bordered hover className="mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Student Name</th>
                        <th>USN / Roll No</th>
                        <th>Subject</th>
                        <th>Semester</th>
                        <th>Section</th>
                        <th>Department</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.map((record, index) => (
                        <tr key={record._id || index}>
                          <td>{index + 1}</td>
                          <td>
                            <small>
                              {new Date(
                                record.attendanceDate,
                              ).toLocaleDateString()}
                            </small>
                          </td>
                          <td>{record.studentId?.studentName || "Unknown"}</td>
                          <td>{record.studentId?.rollNumber || "Unknown"}</td>
                          <td>{record.subjectName || "N/A"}</td>
                          <td>{record.studentId?.semester || "N/A"}</td>
                          <td>{record.studentId?.section || "N/A"}</td>
                          <td>{record.department || "CS"}</td>
                          <td className="text-center">
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              {getStatusIcon(record.status)}
                              {getStatusBadge(record.status)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* ✅ Show All / Show Less toggle — no-print hides it during print */}
              {history.length > INITIAL_LIMIT && (
                <div className="text-center py-3 border-top no-print">
                  {!showAll ? (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => setShowAll(true)}
                    >
                      <FaChevronDown className="me-1" />
                      Show All ({hiddenCount} more)
                    </Button>
                  ) : (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowAll(false)}
                    >
                      <FaChevronUp className="me-1" />
                      Show Less
                    </Button>
                  )}
                </div>
              )}
            </Card.Body>
            {/* ✅ Footer hidden in print so only the table appears */}
            <Card.Footer className="bg-white no-print">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" />
                  Showing {visibleRecords.length} of {history.length} records
                </small>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={downloadCSV}
                    disabled={downloading}
                  >
                    <FaFileCsv className="me-1" /> CSV
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={downloadExcel}
                    disabled={downloading}
                  >
                    <FaFileExcel className="me-1" /> Excel
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => window.print()}
                  >
                    <FaPrint className="me-1" /> Print
                  </Button>
                </div>
              </div>
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

export default AttendanceHistoryPage;
