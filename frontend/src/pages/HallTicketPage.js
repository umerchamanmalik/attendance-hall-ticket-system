import React, { useEffect, useState } from "react";
import {
  Container,
  Alert,
  Spinner,
  Button,
  Table,
  Badge,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import {
  FaTicketAlt,
  FaDownload,
  FaSync,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const HallTicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast(); // ✅ Use global toast

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/halltickets", { params: { studentId } });
      setTickets(response.data.data || []);
    } catch (error) {
      setError(formatErrorMessage(error));
      toast.error(`❌ ${formatErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleDownload = async (id) => {
    try {
      const response = await api.get(`/halltickets/download/${id}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hall-ticket-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("✅ Hall ticket downloaded successfully.");
    } catch (error) {
      toast.error(`❌ ${formatErrorMessage(error)}`);
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
            Hall Tickets
          </h2>
          <Button variant="outline-secondary" size="sm" onClick={loadTickets}>
            <FaSync className="me-1" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {tickets.length > 0 && (
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
        )}

        {/* Tickets Table */}
        {tickets.length === 0 ? (
          <Alert variant="info" className="text-center py-4">
            <FaInfoCircle size={24} className="mb-2 d-block" />
            No hall tickets found.
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table bordered hover>
              <thead className="table-dark">
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Roll Number</th>
                  <th>Attendance %</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={ticket._id}>
                    <td>{index + 1}</td>
                    <td>{ticket.studentId?.studentName || "N/A"}</td>
                    <td>{ticket.studentId?.rollNumber || "N/A"}</td>
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
                    <td className="text-center">
                      {ticket.pdfPath && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownload(ticket._id)}
                        >
                          <FaDownload className="me-1" /> Download
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
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

export default HallTicketPage;
