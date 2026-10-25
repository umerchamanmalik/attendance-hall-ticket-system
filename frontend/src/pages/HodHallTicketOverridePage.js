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
  Form,
} from "react-bootstrap";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaTicketAlt,
  FaClock,
  FaSync,
  FaEye,
  FaUserGraduate,
  FaBook,
  FaInfoCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";

const HodHallTicketOverridePage = () => {
  const [tickets, setTickets] = useState([]);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast(); // ✅ Use global toast

  // Confirm Dialog States
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTicketId, setConfirmTicketId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/halltickets");
      setTickets(response.data.data || []);
    } catch (error) {
      setError(formatErrorMessage(error));
      toast.error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleOverride = (ticketId, status) => {
    setConfirmTicketId(ticketId);
    setConfirmAction(status);
    setShowConfirm(true);
  };

  const confirmOverride = async () => {
    if (!confirmTicketId) return;
    setConfirmLoading(true);
    try {
      await api.put(`/halltickets/review/${confirmTicketId}`, {
        status: confirmAction,
      });
      setMessage(`Ticket ${confirmAction.toLowerCase()} successfully.`);
      toast.success(`✅ Ticket ${confirmAction.toLowerCase()} successfully.`);
      setShowConfirm(false);
      setConfirmTicketId(null);
      await loadTickets();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setMessage(errorMessage);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const getStats = () => {
    const total = tickets.length;
    const pending = tickets.filter(
      (t) => t.approvalStatus === "Pending",
    ).length;
    const approved = tickets.filter(
      (t) => t.approvalStatus === "Approved",
    ).length;
    const rejected = tickets.filter(
      (t) => t.approvalStatus === "Rejected",
    ).length;
    return { total, pending, approved, rejected };
  };

  const stats = getStats();

  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter === "All") return true;
    return ticket.approvalStatus === statusFilter;
  });

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

  if (error && !tickets.length) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadTickets} />
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
            HOD Hall Ticket Override
          </h2>
          <Button variant="outline-secondary" size="sm" onClick={loadTickets}>
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {message && (
          <Alert variant="info" dismissible onClose={() => setMessage("")}>
            {message}
          </Alert>
        )}

        {/* Stats Cards */}
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

        {/* Filter */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row className="g-2 align-items-center">
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold small">
                    Filter by Status
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={9}>
                <div className="d-flex align-items-center h-100">
                  <span className="text-muted small">
                    <FaInfoCircle className="me-1" />
                    Showing {filteredTickets.length} of {tickets.length} tickets
                  </span>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Tickets Table */}
        {filteredTickets.length === 0 ? (
          <Alert variant="warning" className="text-center py-4">
            <FaExclamationTriangle size={24} className="mb-2 d-block" />
            No hall tickets found for the selected status.
          </Alert>
        ) : (
          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Roll No.</th>
                      <th>Sem</th>
                      <th>Sec</th>
                      <th>Attendance</th>
                      <th>Status</th>
                      <th>Approved By</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket, index) => (
                      <tr key={ticket._id}>
                        <td>{index + 1}</td>
                        <td>{ticket.studentId?.studentName || "Unknown"}</td>
                        <td>{ticket.studentId?.rollNumber || "Unknown"}</td>
                        <td>{ticket.studentId?.semester || "-"}</td>
                        <td>{ticket.studentId?.section || "-"}</td>
                        <td>
                          <Badge
                            bg={
                              ticket.attendancePercentage >=
                              (ticket.attendanceThreshold ?? 85)
                                ? "success"
                                : "danger"
                            }
                          >
                            {ticket.attendancePercentage?.toFixed(2)}%
                          </Badge>
                        </td>
                        <td>{getStatusBadge(ticket.approvalStatus)}</td>
                        <td>{ticket.approvedBy || "Pending"}</td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1 flex-wrap">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() =>
                                handleOverride(ticket._id, "Approved")
                              }
                              disabled={ticket.approvalStatus === "Approved"}
                            >
                              <FaCheckCircle className="me-1" /> Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                handleOverride(ticket._id, "Rejected")
                              }
                              disabled={ticket.approvalStatus === "Rejected"}
                            >
                              <FaTimesCircle className="me-1" /> Reject
                            </Button>
                          </div>
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
                Showing {filteredTickets.length} of {tickets.length} hall
                tickets
              </small>
            </Card.Footer>
          </Card>
        )}
      </Container>

      {/* Confirm Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setConfirmTicketId(null);
          setConfirmAction(null);
        }}
        onConfirm={confirmOverride}
        title={
          confirmAction === "Approved"
            ? "Approve Hall Ticket"
            : "Reject Hall Ticket"
        }
        message={
          confirmAction === "Approved"
            ? "Are you sure you want to approve this hall ticket?"
            : "Are you sure you want to reject this hall ticket?"
        }
        confirmText={confirmAction === "Approved" ? "Approve" : "Reject"}
        variant={confirmAction === "Rejected" ? "danger" : "success"}
        loading={confirmLoading}
      />

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

export default HodHallTicketOverridePage;
