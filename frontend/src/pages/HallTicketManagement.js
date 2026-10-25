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
  Modal,
  Alert,
} from "react-bootstrap";
import {
  FaTicketAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaSync,
  FaEye,
  FaFilter,
  FaUserGraduate,
  FaBook,
  FaTrash,
  FaUserTie,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaExclamationTriangle,
  FaSearch,
  FaChevronDown, // ✅ ADDED
  FaChevronUp, // ✅ ADDED
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";

// ✅ ADDED: Default number of items shown before "Show All"
const INITIAL_LIMIT = 10;

const HallTicketManagement = () => {
  const [hallTickets, setHallTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [subjectOverrides, setSubjectOverrides] = useState({});
  const [filter, setFilter] = useState("all");

  // ✅ ADDED: Show All toggle
  const [showAll, setShowAll] = useState(false);

  // Filters
  const [semesterFilter, setSemesterFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [uniqueMentors, setUniqueMentors] = useState([]);

  // Select All / Approve All
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [approvingAll, setApprovingAll] = useState(false);
  const [error, setError] = useState(null);

  // Bulk Delete
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Confirm Dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const toast = useToast();

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

  const fetchHallTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/exams/halltickets");
      const data = response.data.data || [];
      setHallTickets(data);

      const mentors = [
        ...new Set(data.map((t) => t.studentId?.mentorName).filter(Boolean)),
      ];
      setUniqueMentors(mentors.length > 0 ? mentors : ["No mentors assigned"]);
    } catch (error) {
      setError(formatErrorMessage(error));
      toast.error(formatErrorMessage(error));
      setHallTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTickets = () => {
    let filtered = hallTickets;

    if (filter !== "all") {
      filtered = filtered.filter((t) => t.approvalStatus === filter);
    }

    if (semesterFilter) {
      filtered = filtered.filter(
        (t) => t.studentId?.semester === parseInt(semesterFilter),
      );
    }

    if (sectionFilter) {
      filtered = filtered.filter((t) => t.studentId?.section === sectionFilter);
    }

    if (mentorFilter) {
      filtered = filtered.filter(
        (t) => t.studentId?.mentorName === mentorFilter,
      );
    }
    if (departmentFilter) {
      filtered = filtered.filter(
        (ticket) => (ticket.department || "CS") === departmentFilter,
      );
    }

    return filtered;
  };

  const filteredTickets = getFilteredTickets();

  // ✅ ADDED: Slice + hidden count for Show More / Show Less
  const visibleTickets = showAll
    ? filteredTickets
    : filteredTickets.slice(0, INITIAL_LIMIT);
  const hiddenTicketCount = Math.max(0, filteredTickets.length - INITIAL_LIMIT);

  const getStats = () => {
    const total = filteredTickets.length;
    const pending = filteredTickets.filter(
      (t) => t.approvalStatus === "Pending",
    ).length;
    const approved = filteredTickets.filter(
      (t) => t.approvalStatus === "Approved",
    ).length;
    const rejected = filteredTickets.filter(
      (t) => t.approvalStatus === "Rejected",
    ).length;
    return { total, pending, approved, rejected };
  };

  const stats = getStats();

  // Bulk Selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pendingTickets = filteredTickets.filter(
        (t) => t.approvalStatus === "Pending",
      );
      setSelectedTickets(pendingTickets.map((t) => t._id));
    } else {
      setSelectedTickets([]);
    }
  };

  const handleSelectTicket = (ticketId) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId],
    );
  };

  const clearSelection = () => {
    setSelectedTickets([]);
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedTickets.length === 0) {
      toast.warning("Please select at least one hall ticket.");
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedTickets.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const ticketId of selectedTickets) {
        try {
          await api.delete(`/exams/hallticket/${ticketId}`);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast.success(
        `${successCount} hall ticket(s) deleted successfully${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      setSelectedTickets([]);
      setShowBulkDeleteConfirm(false);
      fetchHallTickets();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to delete hall tickets.");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Bulk Approve
  const handleApproveAll = () => {
    if (selectedTickets.length === 0) {
      toast.warning("Please select at least one pending hall ticket.");
      return;
    }
    setConfirmAction("approveAll");
    setShowConfirm(true);
  };

  const confirmApproveAll = async () => {
    setConfirmLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const ticketId of selectedTickets) {
        try {
          await api.put(`/exams/hallticket/${ticketId}/hod-override`, {
            action: "approve",
            remarks: "Bulk approved by HOD",
            subjectOverrides: [],
          });
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast.success(
        `${successCount} tickets approved successfully${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      setSelectedTickets([]);
      setShowConfirm(false);
      fetchHallTickets();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  // Clear Filters
  const clearFilters = () => {
    setSemesterFilter("");
    setSectionFilter("");
    setMentorFilter("");
    setDepartmentFilter("");
    setFilter("all");
    setSelectedTickets([]);
    setShowAll(false); // ✅ ADDED
  };

  const applyFilters = () => {
    setSelectedTickets([]);
    setShowAll(false); // ✅ ADDED
  };

  // Review Modal functions
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

  const handleApprove = () => {
    setConfirmAction("approve");
    setShowConfirm(true);
  };

  const confirmApprove = async () => {
    setConfirmLoading(true);
    try {
      if (!selectedTicket) return;
      const overrides = Object.keys(subjectOverrides).map((name) => ({
        subjectName: name,
        eligible: subjectOverrides[name].eligible,
        remarks: subjectOverrides[name].remarks,
      }));

      await api.put(`/exams/hallticket/${selectedTicket._id}/hod-override`, {
        action: "approve",
        remarks,
        subjectOverrides: overrides,
      });

      toast.success("✅ Hall ticket approved successfully!");
      closeModal();
      setShowConfirm(false);
      fetchHallTickets();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const handleReject = () => {
    setConfirmAction("reject");
    setShowConfirm(true);
  };

  const confirmReject = async () => {
    setConfirmLoading(true);
    try {
      if (!selectedTicket) return;
      await api.put(`/exams/hallticket/${selectedTicket._id}/hod-override`, {
        action: "reject",
        remarks,
      });

      toast.success("✅ Hall ticket rejected successfully");
      closeModal();
      setShowConfirm(false);
      fetchHallTickets();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
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
      <Badge bg={variants[status] || "secondary"} className="px-2 py-1">
        {icons[status]} {status}
      </Badge>
    );
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

  // Mobile Card View — ✅ uses visibleTickets
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {filteredTickets.length === 0 ? (
        <Alert variant="info" className="text-center">
          No hall tickets found.
        </Alert>
      ) : (
        visibleTickets.map((ticket, index) => {
          const isPending = ticket.approvalStatus === "Pending";
          return (
            <Card key={ticket._id} className="mb-3 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2">
                      {isPending && (
                        <Form.Check
                          type="checkbox"
                          checked={selectedTickets.includes(ticket._id)}
                          onChange={() => handleSelectTicket(ticket._id)}
                          className="me-2"
                        />
                      )}
                      <Badge bg="secondary">#{index + 1}</Badge>
                    </div>
                    <div className="mt-2">
                      <div>
                        <FaUserGraduate
                          className="text-primary me-1"
                          size={14}
                        />
                        <strong>Student:</strong>{" "}
                        {ticket.studentId?.studentName || "N/A"}
                      </div>
                      <div>
                        <FaBook className="text-primary me-1" size={14} />
                        <strong>USN:</strong>{" "}
                        {ticket.studentId?.rollNumber || "N/A"}
                      </div>
                      <div>
                        <FaBook className="text-primary me-1" size={14} />
                        <strong>Sem:</strong>{" "}
                        {ticket.studentId?.semester || "N/A"} |{" "}
                        <strong>Sec:</strong>{" "}
                        {ticket.studentId?.section || "N/A"}
                      </div>
                      <div>
                        <FaUserTie className="text-primary me-1" size={14} />
                        <strong>Mentor:</strong>{" "}
                        {ticket.studentId?.mentorName || "N/A"}
                      </div>
                      <div>
                        <strong>Exam:</strong>{" "}
                        {ticket.examId?.examName || "N/A"}
                      </div>
                      <div>
                        <strong>Department:</strong> {ticket.department || "CS"}
                      </div>
                      <div className="mt-1">
                        {getStatusBadge(ticket.approvalStatus)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openReviewModal(ticket)}
                    disabled={!isPending}
                    title={
                      isPending ? "Review ticket" : "Ticket already reviewed"
                    }
                  >
                    <FaEye /> Review
                  </Button>
                </div>
              </Card.Body>
            </Card>
          );
        })
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
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaTicketAlt className="me-2 text-primary" />
            Hall Ticket Management (HOD)
          </h2>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchHallTickets}
            title="Refresh hall tickets"
          >
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

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

        {/* Filters Section */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Semester</Form.Label>
                  <Form.Select
                    size="sm"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Section</Form.Label>
                  <Form.Select
                    size="sm"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {["A", "B", "C", "D"].map((s) => (
                      <option key={s} value={s}>
                        Sec {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Mentor</Form.Label>
                  <Form.Select
                    size="sm"
                    value={mentorFilter}
                    onChange={(e) => setMentorFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {uniqueMentors.map((mentor) => (
                      <option key={mentor} value={mentor}>
                        {mentor}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Status</Form.Label>
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
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Department</Form.Label>
                  <Form.Select
                    size="sm"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
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
              <Col xs={12} md={4}>
                <div className="d-flex gap-2 flex-wrap">
                  <Button variant="primary" size="sm" onClick={applyFilters}>
                    <FaSearch className="me-1" /> Apply
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                  <span className="text-muted small align-self-center">
                    <FaInfoCircle className="me-1" />
                    Showing {filteredTickets.length} tickets
                  </span>
                </div>
              </Col>
            </Row>
            <div className="mt-2">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                {semesterFilter && (
                  <Badge bg="info" className="ms-1">
                    Sem {semesterFilter}
                  </Badge>
                )}
                {sectionFilter && (
                  <Badge bg="info" className="ms-1">
                    Sec {sectionFilter}
                  </Badge>
                )}
                {mentorFilter && (
                  <Badge bg="info" className="ms-1">
                    Mentor: {mentorFilter}
                  </Badge>
                )}
                {filter !== "all" && (
                  <Badge bg="info" className="ms-1">
                    Status: {filter}
                  </Badge>
                )}
              </small>
            </div>
          </Card.Body>
        </Card>

        {/* Bulk Actions Section */}
        {selectedTickets.length > 0 && (
          <div className="bg-light p-2 rounded d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="fw-bold">
              <FaCheckCircle className="text-success me-1" />
              {selectedTickets.length} ticket(s) selected
            </span>
            <Button
              variant="success"
              size="sm"
              onClick={handleApproveAll}
              disabled={approvingAll}
              title="Approve selected tickets"
            >
              {approvingAll ? (
                <>
                  <Spinner size="sm" className="me-1" /> Approving...
                </>
              ) : (
                <>
                  <FaCheck className="me-1" /> Approve Selected
                </>
              )}
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleBulkDelete}
              title="Delete selected tickets"
            >
              <FaTrash className="me-1" /> Delete Selected
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={clearSelection}
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Approve All Section (Legacy - kept for compatibility) */}
        {filteredTickets.some((t) => t.approvalStatus === "Pending") &&
          selectedTickets.length === 0 && (
            <Card className="bg-light border-0 mb-3">
              <Card.Body className="p-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <Form.Check
                    type="checkbox"
                    id="selectAll"
                    onChange={handleSelectAll}
                    checked={
                      selectedTickets.length ===
                        filteredTickets.filter(
                          (t) => t.approvalStatus === "Pending",
                        ).length &&
                      filteredTickets.some(
                        (t) => t.approvalStatus === "Pending",
                      )
                    }
                    label="Select All Pending"
                  />
                  <span className="text-muted small">
                    Selected: {selectedTickets.length} pending tickets
                  </span>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={approvingAll || selectedTickets.length === 0}
                  >
                    {approvingAll ? (
                      <>
                        <Spinner size="sm" className="me-1" /> Approving...
                      </>
                    ) : (
                      <>
                        <FaCheck className="me-1" /> Approve Selected
                      </>
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

        {/* Hall Tickets Table / Cards */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <FaTicketAlt className="me-2" /> Hall Tickets List
            </h5>
            {filteredTickets.some((t) => t.approvalStatus === "Pending") &&
              filteredTickets.length > 0 && (
                <Form.Check
                  type="checkbox"
                  className="text-white"
                  label={`Select All Pending (${filteredTickets.filter((t) => t.approvalStatus === "Pending").length})`}
                  onChange={handleSelectAll}
                  checked={
                    selectedTickets.length ===
                      filteredTickets.filter(
                        (t) => t.approvalStatus === "Pending",
                      ).length &&
                    filteredTickets.some((t) => t.approvalStatus === "Pending")
                  }
                />
              )}
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
                      <th style={{ width: "5%" }}>
                        <Form.Check
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={
                            filteredTickets.some(
                              (t) => t.approvalStatus === "Pending",
                            ) &&
                            selectedTickets.length ===
                              filteredTickets.filter(
                                (t) => t.approvalStatus === "Pending",
                              ).length
                          }
                        />
                      </th>
                      <th>#</th>
                      <th>USN</th>
                      <th>Student</th>
                      <th>Sem</th>
                      <th>Sec</th>
                      <th>Mentor</th>
                      <th>Department</th>
                      <th>Exam</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td
                          colSpan="10"
                          className="text-center py-4 text-muted"
                        >
                          <FaInfoCircle size={24} className="mb-2 d-block" />
                          No hall tickets found. Create an exam and generate
                          hall tickets!
                        </td>
                      </tr>
                    ) : (
                      /* ✅ CHANGED: uses visibleTickets */
                      visibleTickets.map((ticket, index) => {
                        const isPending = ticket.approvalStatus === "Pending";
                        return (
                          <tr key={ticket._id}>
                            <td>
                              {isPending && (
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedTickets.includes(ticket._id)}
                                  onChange={() =>
                                    handleSelectTicket(ticket._id)
                                  }
                                />
                              )}
                            </td>
                            <td>{index + 1}</td>
                            <td>{ticket.studentId?.rollNumber || "N/A"}</td>
                            <td>{ticket.studentId?.studentName || "N/A"}</td>
                            <td>{ticket.studentId?.semester || "N/A"}</td>
                            <td>{ticket.studentId?.section || "N/A"}</td>
                            <td>{ticket.studentId?.mentorName || "N/A"}</td>
                            <td>{ticket.department || "CS"}</td>
                            <td>{ticket.examId?.examName || "N/A"}</td>
                            <td>{getStatusBadge(ticket.approvalStatus)}</td>
                            <td className="text-center">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openReviewModal(ticket)}
                                disabled={!isPending}
                                title={
                                  isPending
                                    ? "Review ticket"
                                    : "Ticket already reviewed"
                                }
                              >
                                <FaEye className="me-1" /> Review
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            )}

            {/* ✅ ADDED: Show All / Show Less toggle */}
            {filteredTickets.length > INITIAL_LIMIT && (
              <div className="text-center py-3 border-top">
                {!showAll ? (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setShowAll(true)}
                  >
                    <FaChevronDown className="me-1" />
                    Show All ({hiddenTicketCount} more)
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
          {filteredTickets.length > 0 && (
            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" />
                  Showing {visibleTickets.length} of {filteredTickets.length}{" "}
                  tickets
                </small>
                <div className="d-flex gap-2">
                  {selectedTickets.length > 0 && (
                    <Badge bg="success">
                      <FaCheckCircle className="me-1" />
                      {selectedTickets.length} Selected
                    </Badge>
                  )}
                </div>
              </div>
            </Card.Footer>
          )}
        </Card>
      </Container>

      {/* Review Modal */}
      <Modal show={showModal} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaEye className="me-2" />
            HOD Review - {selectedTicket?.studentId?.studentName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="mb-3">
            <Col md={6}>
              <small className="text-muted d-block">Student</small>
              <strong>{selectedTicket?.studentId?.studentName}</strong>
            </Col>
            <Col md={6}>
              <small className="text-muted d-block">USN</small>
              <strong>{selectedTicket?.studentId?.rollNumber}</strong>
            </Col>
            <Col md={6}>
              <small className="text-muted d-block">Semester</small>
              <strong>{selectedTicket?.studentId?.semester}</strong>
            </Col>
            <Col md={6}>
              <small className="text-muted d-block">Section</small>
              <strong>{selectedTicket?.studentId?.section}</strong>
            </Col>
            <Col md={12}>
              <small className="text-muted d-block">Exam</small>
              <strong>{selectedTicket?.examId?.examName}</strong>
            </Col>
          </Row>

          <h6 className="mb-2">Subject Eligibility</h6>
          <p className="text-muted small">
            <FaInfoCircle className="me-1" />✅ = Eligible | ❌ = Not Eligible
          </p>
          <div className="table-responsive mb-3">
            <Table bordered size="sm">
              <thead className="table-light">
                <tr>
                  <th>Subject</th>
                  <th>Attendance %</th>
                  <th>Current Status</th>
                  <th>HOD Override</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {selectedTicket?.subjectEligibility.map((subject, index) => (
                  <tr key={index}>
                    <td>{subject.subjectName}</td>
                    <td>
                      <Badge bg={subject.eligible ? "success" : "danger"}>
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
                          subjectOverrides[subject.subjectName]?.eligible !==
                          undefined
                            ? subjectOverrides[subject.subjectName].eligible
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
                          subjectOverrides[subject.subjectName]?.remarks || ""
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
                ))}
              </tbody>
            </Table>
          </div>

          <Form.Group>
            <Form.Label className="fw-bold">HOD Remarks</Form.Label>
            <Form.Control
              as="textarea"
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter HOD remarks..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReject}>
            <FaTimes className="me-1" /> Reject
          </Button>
          <Button variant="success" onClick={handleApprove}>
            <FaCheck className="me-1" /> Approve
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setConfirmAction(null);
        }}
        onConfirm={
          confirmAction === "approveAll"
            ? confirmApproveAll
            : confirmAction === "approve"
              ? confirmApprove
              : confirmAction === "reject"
                ? confirmReject
                : confirmApprove
        }
        title={
          confirmAction === "approveAll"
            ? "Approve All Selected Tickets"
            : confirmAction === "approve"
              ? "Approve Hall Ticket"
              : "Reject Hall Ticket"
        }
        message={
          confirmAction === "approveAll"
            ? `Are you sure you want to approve ${selectedTickets.length} hall ticket(s)?`
            : confirmAction === "approve"
              ? "Are you sure you want to approve this hall ticket?"
              : "Are you sure you want to reject this hall ticket?"
        }
        confirmText={
          confirmAction === "approveAll"
            ? "Approve All"
            : confirmAction === "approve"
              ? "Approve"
              : "Reject"
        }
        variant={confirmAction === "reject" ? "danger" : "success"}
        loading={confirmLoading}
      />

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        show={showBulkDeleteConfirm}
        onHide={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Selected Hall Tickets"
        message={`Are you sure you want to delete ${selectedTickets.length} selected hall ticket(s)? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
        loading={bulkDeleteLoading}
      />
    </>
  );
};

export default HallTicketManagement;
