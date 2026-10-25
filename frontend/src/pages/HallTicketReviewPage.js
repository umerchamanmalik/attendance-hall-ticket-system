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
  FaTicketAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaSync,
  FaEye,
  FaFilter,
  FaUserGraduate,
  FaBook,
  FaInfoCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const HallTicketReviewPage = () => {
  const [hallTickets, setHallTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [subjectOverrides, setSubjectOverrides] = useState({});
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  // ✅ New Filters
  const [semesterFilter, setSemesterFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // ✅ Approve All Selected
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [approvingAll, setApprovingAll] = useState(false);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast(); // ✅ Use global toast

  useEffect(() => {
    fetchHallTickets();
  }, []);

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

  // ✅ Get filtered tickets with all filters
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

    if (studentSearch) {
      const search = studentSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.studentId?.studentName?.toLowerCase().includes(search) ||
          t.studentId?.rollNumber?.toLowerCase().includes(search),
      );
    }

    return filtered;
  };

  const filteredTickets = getFilteredTickets();

  // ✅ Stats based on filtered tickets
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

  // ✅ Clear all filters
  const clearFilters = () => {
    setSemesterFilter("");
    setSectionFilter("");
    setStudentSearch("");
    setFilter("all");
    setSelectedTickets([]);
  };

  // ✅ Handle Select All for Approve All
  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    setSelectAllMode(checked);
    if (checked) {
      const pendingTickets = filteredTickets.filter(
        (t) => t.approvalStatus === "Pending",
      );
      setSelectedTickets(pendingTickets.map((t) => t._id));
    } else {
      setSelectedTickets([]);
    }
  };

  // ✅ Handle individual ticket selection
  const handleSelectTicket = (ticketId) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId],
    );
  };

  // ✅ Approve All Selected Tickets (Bulk Approve)
  const handleBulkApprove = async () => {
    if (selectedTickets.length === 0) {
      toast.warning("Please select at least one pending hall ticket.");
      return;
    }

    setApprovingAll(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const ticketId of selectedTickets) {
        try {
          const ticket = hallTickets.find((t) => t._id === ticketId);
          const overrides =
            ticket?.subjectEligibility?.map((s) => ({
              subjectName: s.subjectName,
              eligible: true,
              remarks: "Bulk approved by mentor",
            })) || [];

          await api.put(`/exam-halltickets/${ticketId}/mentor-review`, {
            action: "approve",
            remarks: "Bulk approved by mentor",
            subjectOverrides: overrides,
          });
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      setMessage(
        `✅ ${successCount} tickets approved successfully${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      toast.success(`${successCount} tickets approved successfully.`);
      setSelectedTickets([]);
      setSelectAllMode(false);
      fetchHallTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setMessage(`❌ ${errorMessage}`);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setApprovingAll(false);
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

  // ✅ Approve All - Makes ALL subjects eligible for a single ticket
  const handleApproveAll = async () => {
    if (!selectedTicket?.subjectEligibility?.length) return;
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

  const StatCard = ({ icon: Icon, title, value, bgColor }) => (
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

  // ✅ Get unique semesters and sections for filters
  const uniqueSemesters = [
    ...new Set(hallTickets.map((t) => t.studentId?.semester).filter(Boolean)),
  ];
  const uniqueSections = [
    ...new Set(hallTickets.map((t) => t.studentId?.section).filter(Boolean)),
  ];

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

  const hasPendingTickets = filteredTickets.some(
    (t) => t.approvalStatus === "Pending",
  );

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaTicketAlt className="me-2 text-primary" />
          Hall Ticket Review (Mentor)
        </h2>

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
                    {uniqueSemesters
                      .sort((a, b) => a - b)
                      .map((s) => (
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
                    {uniqueSections.sort().map((s) => (
                      <option key={s} value={s}>
                        Sec {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
                    Search Student
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Name or USN..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
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
              <Col xs={12} md={3}>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                  <span className="text-muted small align-self-center">
                    <FaInfoCircle className="me-1" />
                    {filteredTickets.length} tickets
                  </span>
                </div>
              </Col>
            </Row>
            {(semesterFilter ||
              sectionFilter ||
              studentSearch ||
              filter !== "all") && (
              <div className="mt-2">
                <small className="text-muted">Filters applied: </small>
                {semesterFilter && (
                  <Badge bg="info" className="me-1">
                    Sem {semesterFilter}
                  </Badge>
                )}
                {sectionFilter && (
                  <Badge bg="info" className="me-1">
                    Sec {sectionFilter}
                  </Badge>
                )}
                {studentSearch && (
                  <Badge bg="info" className="me-1">
                    Search: {studentSearch}
                  </Badge>
                )}
                {filter !== "all" && (
                  <Badge bg="info" className="me-1">
                    Status: {filter}
                  </Badge>
                )}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* ✅ Bulk Approve Section */}
        {hasPendingTickets && (
          <Card className="bg-light border-0 mb-3">
            <Card.Body className="p-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  id="selectAll"
                  onChange={handleSelectAll}
                  checked={selectAllMode}
                  label="Select All Pending"
                />
                <span className="text-muted small">
                  Selected: {selectedTickets.length} pending tickets
                </span>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={approvingAll || selectedTickets.length === 0}
                >
                  {approvingAll ? (
                    <>
                      <Spinner size="sm" className="me-1" /> Approving...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="me-1" /> Approve Selected
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Hall Tickets Table */}
        {filteredTickets.length === 0 ? (
          <Alert variant="info" className="text-center py-4">
            <FaTicketAlt size={24} className="mb-2 d-block" />
            No hall tickets found.
          </Alert>
        ) : (
          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: "4%" }}>
                        <Form.Check
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectAllMode}
                        />
                      </th>
                      <th>#</th>
                      <th>USN</th>
                      <th>Student</th>
                      <th>Sem</th>
                      <th>Sec</th>
                      <th>Exam</th>
                      <th>Subjects</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket, index) => {
                      const isPending = ticket.approvalStatus === "Pending";
                      return (
                        <tr key={ticket._id}>
                          <td>
                            {isPending && (
                              <Form.Check
                                type="checkbox"
                                checked={selectedTickets.includes(ticket._id)}
                                onChange={() => handleSelectTicket(ticket._id)}
                              />
                            )}
                          </td>
                          <td>{index + 1}</td>
                          <td>{ticket.studentId?.rollNumber || "N/A"}</td>
                          <td>{ticket.studentId?.studentName || "N/A"}</td>
                          <td>{ticket.studentId?.semester || "N/A"}</td>
                          <td>{ticket.studentId?.section || "N/A"}</td>
                          <td>{ticket.examId?.examName || "N/A"}</td>
                          <td>
                            {ticket.subjectEligibility && (
                              <small>
                                {ticket.subjectEligibility.map((s, i) => (
                                  <Badge
                                    bg="secondary"
                                    className="me-1"
                                    key={i}
                                  >
                                    {s.subjectName}: {s.eligible ? "✅" : "❌"}
                                  </Badge>
                                ))}
                              </small>
                            )}
                          </td>
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
                      );
                    })}
                  </tbody>
                </Table>
              </div>
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
                  📊 Attendance % shown for reference only. <br />✅ = Eligible
                  Eligibility is based on the department attendance threshold.
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

export default HallTicketReviewPage;
