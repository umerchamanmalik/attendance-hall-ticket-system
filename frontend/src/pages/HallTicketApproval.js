import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  Button,
  Table,
  Form,
  Alert,
} from "react-bootstrap";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaSync,
  FaClock,
  FaInfoCircle,
  FaTicketAlt,
  FaUserGraduate,
  FaBook,
  FaSearch,
  FaFilter,
  FaBolt,
  FaCheckDouble,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const HallTicketApproval = () => {
  const [hallTickets, setHallTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [subjectOverrides, setSubjectOverrides] = useState({});
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  // ✅ Bulk approve state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkThreshold, setBulkThreshold] = useState("");

  // ✅ Filter states
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStudentSearch, setFilterStudentSearch] = useState("");

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const getDepartmentThreshold = (departmentCode) =>
    departments.find((department) => department.code === departmentCode)
      ?.attendanceThreshold ?? 85;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchHallTickets();
    api
      .get("/departments/public")
      .then((response) => setDepartments(response.data.data || []))
      .catch((error) => console.error("Error loading departments:", error));
  }, []);

  // ✅ Get unique semesters and sections from hallTickets
  const uniqueSemesters = [
    ...new Set(hallTickets.map((t) => t.studentId?.semester).filter(Boolean)),
  ].sort((a, b) => a - b);
  const uniqueSections = [
    ...new Set(hallTickets.map((t) => t.studentId?.section).filter(Boolean)),
  ].sort();

  // ✅ Get filtered tickets with all filters
  const getFilteredTickets = () => {
    let filtered = hallTickets;

    if (filter !== "all") {
      filtered = filtered.filter((t) => t.approvalStatus === filter);
    }

    if (filterSemester) {
      filtered = filtered.filter(
        (t) => t.studentId?.semester === parseInt(filterSemester),
      );
    }

    if (filterSection) {
      filtered = filtered.filter((t) => t.studentId?.section === filterSection);
    }
    if (filterDepartment) {
      filtered = filtered.filter(
        (ticket) => (ticket.department || "CS") === filterDepartment,
      );
    }

    if (filterStudentSearch) {
      const search = filterStudentSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.studentId?.studentName?.toLowerCase().includes(search) ||
          t.studentId?.rollNumber?.toLowerCase().includes(search),
      );
    }

    return filtered;
  };

  const fetchHallTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/exam-halltickets/mentor/halltickets");
      setHallTickets(response.data.data || []);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setError(errorMessage);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (ticket) => {
    setSelectedTicket(ticket);
    setSubjectOverrides({});
    setRemarks("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTicket(null);
  };

  const handleOverrideChange = (subjectName, eligible) => {
    setSubjectOverrides((prev) => ({
      ...prev,
      [subjectName]: { eligible, remarks: prev[subjectName]?.remarks || "" },
    }));
  };

  // ✅ Approve All - Makes ALL subjects eligible
  const handleApproveAll = async () => {
    if (!selectedTicket?.subjectEligibility?.length) {
      toast.warning("⚠️ No subject eligibility data is available.");
      return;
    }
    setActionLoading(true);
    try {
      const overrides = selectedTicket.subjectEligibility.map((s) => ({
        subjectName: s.subjectName,
        eligible: true,
        remarks: "Approved all subjects by mentor",
      }));

      await api.put(`/exam-halltickets/${selectedTicket._id}/mentor-review`, {
        action: "approve",
        remarks: remarks || "All subjects approved by mentor",
        subjectOverrides: overrides,
      });

      setMessage("✅ All subjects approved successfully!");
      toast.success("✅ All subjects approved successfully.");
      closeModal();
      await fetchHallTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setMessage(`❌ ${errorMessage}`);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Approve - Apply department-threshold eligibility
  const handleApprove = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const overrides = Object.keys(subjectOverrides).map((name) => ({
        subjectName: name,
        eligible: subjectOverrides[name].eligible,
        remarks: subjectOverrides[name].remarks,
      }));

      await api.put(`/exam-halltickets/${selectedTicket._id}/mentor-review`, {
        action: "approve",
        remarks: remarks || "Approved by mentor",
        subjectOverrides: overrides,
      });

      setMessage("✅ Hall ticket approved successfully!");
      toast.success("✅ Hall ticket approved successfully.");
      closeModal();
      await fetchHallTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setMessage(`❌ ${errorMessage}`);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      await api.put(`/exam-halltickets/${selectedTicket._id}/mentor-review`, {
        action: "reject",
        remarks: remarks || "Rejected by mentor",
      });

      setMessage("✅ Hall ticket rejected successfully");
      toast.success("✅ Hall ticket rejected successfully.");
      closeModal();
      await fetchHallTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setMessage(`❌ ${errorMessage}`);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Open bulk approve modal → fetch preview
  const handleOpenBulkModal = async () => {
    const thresholdValue = bulkThreshold.trim();
    if (
      thresholdValue &&
      (!Number.isFinite(Number(thresholdValue)) ||
        Number(thresholdValue) < 0 ||
        Number(thresholdValue) > 100)
    ) {
      toast.warning("Threshold must be a number between 0 and 100.");
      return;
    }

    setBulkLoading(true);
    setBulkPreview(null);
    try {
      const response = await api.post(
        "/exam-halltickets/mentor/bulk-approve-preview",
        thresholdValue ? { threshold: Number(thresholdValue) } : {},
      );
      setBulkPreview(response.data);
      setShowBulkModal(true);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // ✅ Close bulk modal
  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkPreview(null);
  };

  // ✅ Confirm bulk approve
  const handleConfirmBulkApprove = async () => {
    setBulkLoading(true);
    try {
      const thresholdValue = bulkThreshold.trim();
      const response = await api.post(
        "/exam-halltickets/mentor/bulk-approve-eligible",
        thresholdValue ? { threshold: Number(thresholdValue) } : {},
      );

      const { approvedCount, skippedCount } = response.data;
      toast.success(
        `✅ ${approvedCount} hall tickets approved! (${skippedCount} skipped)`,
      );
      setMessage(
        `✅ Bulk approval done: ${approvedCount} approved, ${skippedCount} skipped.`,
      );
      closeBulkModal();
      await fetchHallTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      Pending: "warning",
      Approved: "success",
      Rejected: "danger",
    };
    const icons = {
      Pending: <FaClock />,
      Approved: <FaCheckCircle />,
      Rejected: <FaTimesCircle />,
    };
    return (
      <Badge bg={colors[status] || "secondary"} className="px-2 py-1">
        {icons[status]} {status}
      </Badge>
    );
  };

  const getStats = () => {
    const filtered = getFilteredTickets();
    const total = filtered.length;
    const pending = filtered.filter(
      (t) => t.approvalStatus === "Pending",
    ).length;
    const approved = filtered.filter(
      (t) => t.approvalStatus === "Approved",
    ).length;
    const rejected = filtered.filter(
      (t) => t.approvalStatus === "Rejected",
    ).length;
    return { total, pending, approved, rejected };
  };

  const stats = getStats();
  const filteredTickets = getFilteredTickets();

  // ✅ Clear all filters
  const clearFilters = () => {
    setFilterSemester("");
    setFilterSection("");
    setFilterDepartment("");
    setFilterStudentSearch("");
    setFilter("all");
  };

  const StatCard = ({ icon: Icon, title, value, color, bgColor }) => (
    <Col xs={6} md={3}>
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

  // ✅ Mobile Card View
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {filteredTickets.length === 0 ? (
        <div className="text-center py-4">
          <FaTicketAlt size={24} className="mb-2 d-block text-muted" />
          <p className="text-muted">No hall tickets found.</p>
        </div>
      ) : (
        filteredTickets.map((ticket, index) => (
          <Card key={ticket._id} className="mb-3 shadow-sm border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <Badge bg="secondary" className="mb-1">
                    #{index + 1}
                  </Badge>
                  <h6 className="mb-1">
                    {ticket.studentId?.studentName || "N/A"}
                  </h6>
                  <div className="small text-muted">
                    <div>
                      <FaUserGraduate className="me-1" size={12} />
                      <strong>USN:</strong>{" "}
                      {ticket.studentId?.rollNumber || "N/A"}
                    </div>
                    <div>
                      <FaBook className="me-1" size={12} />
                      <strong>Sem:</strong>{" "}
                      {ticket.studentId?.semester || "N/A"} |{" "}
                      <strong>Sec:</strong> {ticket.studentId?.section || "N/A"}
                    </div>
                    <div>
                      <strong>Exam:</strong> {ticket.examId?.examName || "N/A"}
                    </div>
                    <div>
                      <strong>Department:</strong> {ticket.department || "CS"}
                    </div>
                  </div>
                  <div className="mt-2">
                    {getStatusBadge(ticket.approvalStatus)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-100"
                  onClick={() => openReviewModal(ticket)}
                  disabled={ticket.approvalStatus !== "Pending"}
                >
                  <FaEye className="me-1" /> Review
                </Button>
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
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
          <h5 className="mt-3 text-muted">Loading hall tickets...</h5>
        </div>
      </Container>
    );
  }

  if (error && !hallTickets.length) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={fetchHallTickets} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <h2 className="mb-0">
            <FaTicketAlt className="me-2 text-primary" />
            Hall Ticket Approval (Mentor)
          </h2>
        </div>

        {message && (
          <Alert
            variant={message.includes("✅") ? "success" : "danger"}
            dismissible
            onClose={() => setMessage("")}
          >
            {message}
          </Alert>
        )}

        {/* Stats Cards with Icons */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaTicketAlt}
            title="Total"
            value={stats.total}
            bgColor="bg-primary"
          />
          <StatCard
            icon={FaClock}
            title="Pending"
            value={stats.pending}
            bgColor="bg-warning"
          />
          <StatCard
            icon={FaCheckCircle}
            title="Approved"
            value={stats.approved}
            bgColor="bg-success"
          />
          <StatCard
            icon={FaTimesCircle}
            title="Rejected"
            value={stats.rejected}
            bgColor="bg-danger"
          />
        </Row>

        {/* ✅ Advanced Filters */}
        <Card className="shadow-sm border-0 mb-3">
          <Card.Header className="bg-light">
            <h6 className="mb-0">
              <FaFilter className="me-2 text-primary" />
              Filter Hall Tickets
            </h6>
          </Card.Header>
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
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
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
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
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Department</Form.Label>
                  <Form.Select
                    size="sm"
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                  >
                    <option value="">All</option>
                    {departments.map((department) => (
                      <option key={department.code} value={department.code}>
                        {department.code}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
                    <FaSearch className="me-1 text-primary" size={12} />
                    Search Student
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Name or USN..."
                    value={filterStudentSearch}
                    onChange={(e) => setFilterStudentSearch(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
                    <FaClock className="me-1 text-primary" size={12} />
                    Status
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={3}>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <FaTimesCircle className="me-1" /> Clear Filters
                  </Button>
                  <span className="text-muted small align-self-center">
                    <FaInfoCircle className="me-1" />
                    {filteredTickets.length} tickets
                  </span>
                </div>
              </Col>
            </Row>
            {(filterSemester ||
              filterSection ||
              filterStudentSearch ||
              filter !== "all") && (
              <div className="mt-2">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" size={10} />
                  Filters applied:
                </small>
                {filterSemester && (
                  <Badge bg="info" className="me-1">
                    <FaBook className="me-1" size={10} /> Sem {filterSemester}
                  </Badge>
                )}
                {filterSection && (
                  <Badge bg="info" className="me-1">
                    <FaUserGraduate className="me-1" size={10} /> Sec{" "}
                    {filterSection}
                  </Badge>
                )}
                {filterStudentSearch && (
                  <Badge bg="info" className="me-1">
                    <FaSearch className="me-1" size={10} />{" "}
                    {filterStudentSearch}
                  </Badge>
                )}
                {filter !== "all" && (
                  <Badge bg="info" className="me-1">
                    <FaClock className="me-1" size={10} /> {filter}
                  </Badge>
                )}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* ✅ Bulk approve action after filters, before the ticket list */}
        <Card className="border-success shadow-sm mb-3">
          <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h6 className="mb-1 text-success">
                <FaBolt className="me-2" /> Bulk Approve Eligible Students
              </h6>
              <small className="text-muted">
                Checks every pending hall ticket for all your mentees. Tickets
                with any subject below threshold remain pending.
              </small>
            </div>
            <div className="d-flex flex-wrap align-items-end gap-2">
              <Form.Group>
                <Form.Label className="small fw-bold mb-1">
                  Threshold override (%)
                </Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  placeholder="Department default"
                  value={bulkThreshold}
                  onChange={(e) => setBulkThreshold(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  style={{ width: "175px" }}
                  title="Leave empty to use each student's department threshold"
                />
              </Form.Group>
              <Button
                variant="success"
                onClick={handleOpenBulkModal}
                disabled={bulkLoading}
              >
                {bulkLoading ? (
                  <>
                    <Spinner size="sm" className="me-2" /> Checking...
                  </>
                ) : (
                  <>
                    <FaBolt className="me-1" /> Bulk Approve Eligible
                  </>
                )}
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Filter Buttons */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button
            variant={filter === "all" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filter === "Pending" ? "warning" : "outline-warning"}
            size="sm"
            onClick={() => setFilter("Pending")}
          >
            Pending ({stats.pending})
          </Button>
          <Button
            variant={filter === "Approved" ? "success" : "outline-success"}
            size="sm"
            onClick={() => setFilter("Approved")}
          >
            Approved ({stats.approved})
          </Button>
          <Button
            variant={filter === "Rejected" ? "danger" : "outline-danger"}
            size="sm"
            onClick={() => setFilter("Rejected")}
          >
            Rejected ({stats.rejected})
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchHallTickets}
          >
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {/* Hall Tickets Table / Cards */}
        {filteredTickets.length === 0 ? (
          <Alert variant="info" className="text-center py-4">
            <FaTicketAlt size={24} className="mb-2 d-block" />
            No hall tickets found.
          </Alert>
        ) : (
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-secondary text-white">
              <h5 className="mb-0">
                <FaTicketAlt className="me-2" /> Hall Tickets List
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {/* Mobile Card View */}
              {isMobile ? (
                renderMobileCards()
              ) : (
                /* Desktop Table View */
                <div className="table-responsive d-none d-md-block">
                  <Table bordered hover className="mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th>#</th>
                        <th>USN</th>
                        <th>Student Name</th>
                        <th>Exam</th>
                        <th>Sem</th>
                        <th>Sec</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map((ticket, index) => (
                        <tr key={ticket._id}>
                          <td>{index + 1}</td>
                          <td>{ticket.studentId?.rollNumber || "N/A"}</td>
                          <td>{ticket.studentId?.studentName || "N/A"}</td>
                          <td>{ticket.examId?.examName || "N/A"}</td>
                          <td>{ticket.studentId?.semester || "N/A"}</td>
                          <td>{ticket.studentId?.section || "N/A"}</td>
                          <td>{ticket.department || "CS"}</td>
                          <td>{getStatusBadge(ticket.approvalStatus)}</td>
                          <td className="text-center">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openReviewModal(ticket)}
                              disabled={ticket.approvalStatus !== "Pending"}
                            >
                              <FaEye className="me-1" /> Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="bg-white">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Showing {filteredTickets.length} of {hallTickets.length} hall
                tickets
              </small>
            </Card.Footer>
          </Card>
        )}
      </Container>

      {/* Review Modal */}
      {showModal && selectedTicket && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Review Hall Ticket - {selectedTicket.studentId?.studentName}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Student:</strong>{" "}
                    {selectedTicket.studentId?.studentName}
                  </div>
                  <div className="col-md-6">
                    <strong>USN:</strong> {selectedTicket.studentId?.rollNumber}
                  </div>
                  <div className="col-md-6">
                    <strong>Semester:</strong>{" "}
                    {selectedTicket.studentId?.semester}
                  </div>
                  <div className="col-md-6">
                    <strong>Section:</strong>{" "}
                    {selectedTicket.studentId?.section}
                  </div>
                  <div className="col-md-12">
                    <strong>Exam:</strong> {selectedTicket.examId?.examName}
                  </div>
                </div>

                <h6>Subject Eligibility</h6>
                <p className="text-muted small">
                  📊 Attendance % shown for reference only. Eligibility uses the
                  department threshold ({" "}
                  {getDepartmentThreshold(
                    selectedTicket.department ||
                      selectedTicket.studentId?.department ||
                      "CS",
                  )}
                  %).
                  <br />✅ = Eligible | ❌ = Not Eligible
                </p>
                <div className="table-responsive">
                  <Table bordered size="sm">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Attendance %</th>
                        <th>Current Status</th>
                        <th>Mentor Override</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTicket.subjectEligibility.map(
                        (subject, index) => (
                          <tr key={index}>
                            <td>{subject.subjectName}</td>
                            <td>
                              <Badge
                                bg={subject.eligible ? "success" : "danger"}
                              >
                                {subject.attendancePercentage}%
                              </Badge>
                            </td>
                            <td>
                              {subject.eligible ? (
                                <Badge bg="success">✅ Eligible</Badge>
                              ) : (
                                <Badge bg="danger">❌ Not Eligible</Badge>
                              )}
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={
                                  subjectOverrides[subject.subjectName]
                                    ?.eligible !== undefined
                                    ? subjectOverrides[subject.subjectName]
                                        .eligible
                                    : subject.eligible
                                }
                                onChange={(e) =>
                                  handleOverrideChange(
                                    subject.subjectName,
                                    e.target.value === "true",
                                  )
                                }
                              >
                                <option value="true">✅ Eligible</option>
                                <option value="false">❌ Not Eligible</option>
                              </Form.Select>
                            </td>
                            <td>
                              <Form.Control
                                type="text"
                                size="sm"
                                placeholder="Reason"
                                value={
                                  subjectOverrides[subject.subjectName]
                                    ?.remarks || ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSubjectOverrides((prev) => ({
                                    ...prev,
                                    [subject.subjectName]: {
                                      ...prev[subject.subjectName],
                                      remarks: val,
                                    },
                                  }));
                                }}
                              />
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </Table>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Overall Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows="2"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter overall remarks..."
                  />
                </Form.Group>

                <Alert variant="info">
                  <strong>📌 Choose Action:</strong>
                  <ul className="mb-0 mt-2">
                    <li>
                      🟢 <strong>Approve</strong> - Only eligible subjects
                      (meets the department threshold)
                    </li>
                    <li>
                      ⭐ <strong>Approve All</strong> - ALL subjects become
                      eligible (override attendance)
                    </li>
                    <li>
                      🔴 <strong>Reject</strong> - Reject entire hall ticket
                    </li>
                  </ul>
                </Alert>
              </div>
              <div className="modal-footer">
                <Button variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  <FaTimesCircle className="me-1" /> Reject
                </Button>
                <Button
                  variant="success"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  <FaCheckCircle className="me-1" /> Approve
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApproveAll}
                  disabled={actionLoading}
                  style={{ fontWeight: "bold" }}
                >
                  ⭐ Approve All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Bulk Approve Confirmation Modal */}
      {showBulkModal && bulkPreview && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <FaBolt className="me-2" />
                  Bulk Approve Eligible Students
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeBulkModal}
                  disabled={bulkLoading}
                ></button>
              </div>
              <div className="modal-body">
                <Alert variant="info" className="mb-3">
                  <strong>Threshold:</strong>{" "}
                  {bulkPreview.threshold !== null &&
                  bulkPreview.threshold !== undefined
                    ? `${bulkPreview.threshold}% (custom override)`
                    : "Department default"}
                </Alert>

                <Row className="g-3 mb-3">
                  <Col xs={4}>
                    <Card className="text-center border-0 bg-warning text-white">
                      <Card.Body className="p-3">
                        <h6 className="mb-1 small">Pending Tickets</h6>
                        <h3 className="mb-0">
                          {bulkPreview.totalPending ??
                            bulkPreview.approvedCount +
                              bulkPreview.skippedCount}
                        </h3>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={4}>
                    <Card className="text-center border-0 bg-success text-white">
                      <Card.Body className="p-3">
                        <h6 className="mb-1 small">✅ Eligible Students</h6>
                        <h3 className="mb-0">
                          {bulkPreview.eligibleStudentCount ??
                            bulkPreview.approvedCount}
                        </h3>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={4}>
                    <Card className="text-center border-0 bg-danger text-white">
                      <Card.Body className="p-3">
                        <h6 className="mb-1 small">❌ Not Eligible</h6>
                        <h3 className="mb-0">
                          {bulkPreview.notEligibleStudentCount ??
                            bulkPreview.skippedCount}
                        </h3>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {bulkPreview.approvedCount > 0 ? (
                  <>
                    <p className="mb-2">
                      <strong>{bulkPreview.approvedCount}</strong> pending
                      hall-ticket(s) belong to{" "}
                      <strong>
                        {bulkPreview.eligibleStudentCount ??
                          bulkPreview.approvedCount}
                      </strong>{" "}
                      eligible student(s). Every subject meets the threshold;
                      these tickets will be approved.
                    </p>

                    {(
                      bulkPreview.eligibleStudents ||
                      bulkPreview.approvedTickets
                    )?.length > 0 && (
                      <div
                        className="border rounded p-2 mb-3"
                        style={{ maxHeight: "220px", overflowY: "auto" }}
                      >
                        <Table size="sm" className="mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Name</th>
                              <th>USN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              bulkPreview.eligibleStudents ||
                              bulkPreview.approvedTickets
                            ).map((s, i) => (
                              <tr key={s._id}>
                                <td>{i + 1}</td>
                                <td>{s.studentName}</td>
                                <td>{s.rollNumber}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </>
                ) : (
                  <Alert variant="warning">
                    No students meet the threshold criteria. Nothing will be
                    approved.
                  </Alert>
                )}

                {bulkPreview.skippedCount > 0 && (
                  <Alert variant="secondary" className="small mb-0">
                    <FaInfoCircle className="me-1" />
                    {bulkPreview.skippedCount} pending ticket(s) for{" "}
                    {bulkPreview.notEligibleStudentCount ??
                      bulkPreview.skippedCount}{" "}
                    student(s) will remain <strong>Pending</strong> (attendance
                    below threshold in one or more subjects). You can review
                    them individually.
                  </Alert>
                )}
              </div>
              <div className="modal-footer">
                <Button
                  variant="secondary"
                  onClick={closeBulkModal}
                  disabled={bulkLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={handleConfirmBulkApprove}
                  disabled={bulkLoading || bulkPreview.approvedCount === 0}
                >
                  <FaCheckDouble className="me-1" />
                  {bulkLoading
                    ? "Approving..."
                    : `Yes, Approve ${bulkPreview.approvedCount}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default HallTicketApproval;
