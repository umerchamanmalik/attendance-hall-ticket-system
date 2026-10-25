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
  Form,
  Alert,
} from "react-bootstrap";
import {
  FaDownload,
  FaSync,
  FaInfoCircle,
  FaHistory,
  FaCalendarDay,
  FaPlus,
  FaTrash,
  FaUserGraduate,
  FaBook,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    action: "",
    module: "",
    userRole: "",
    department: "",
    startDate: "",
    endDate: "",
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 0 });
  const [error, setError] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const toast = useToast();

  const actions = [
    "LOGIN",
    "LOGOUT",
    "CREATE",
    "UPDATE",
    "DELETE",
    "APPROVE",
    "REJECT",
    "CONFIRM",
    "OVERRIDE",
    "UPLOAD",
    "DOWNLOAD",
    "GENERATE",
    "VIEW",
    "TOGGLE",
    "SYNC",
  ];

  const modules = [
    "ATTENDANCE",
    "DOCUMENT",
    "HALL_TICKET",
    "STUDENT",
    "FACULTY",
    "EXAM",
    "USER",
    "PROFILE",
    "DASHBOARD",
    "SEMESTER",
  ];

  const roles = ["HOD", "Faculty", "Mentor", "Student"];

  useEffect(() => {
    loadAuditLogs();
    loadSummary();
    api
      .get("/departments/public")
      .then((response) => setDepartments(response.data.data || []))
      .catch((error) => console.error("Error loading departments:", error));
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [pagination.page]);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append("action", filters.action);
      if (filters.module) params.append("module", filters.module);
      if (filters.userRole) params.append("userRole", filters.userRole);
      if (filters.department) params.append("department", filters.department);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("page", pagination.page);
      params.append("limit", 50);

      const response = await api.get(`/audit?${params.toString()}`);
      setLogs(response.data.data.logs);
      setPagination(response.data.data.pagination);
    } catch (error) {
      setError(formatErrorMessage(error));
      toast.error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryError(null);
    try {
      const response = await api.get("/audit/summary");
      setSummary(response.data.data);
    } catch (error) {
      setSummaryError(formatErrorMessage(error));
    }
  };

  const exportLogs = () => {
    if (!logs.length) {
      toast.warning("There are no logs to export.");
      return;
    }
    const headers = [
      "User",
      "Role",
      "Action",
      "Module",
      "Description",
      "Status",
      "Date",
    ];
    const rows = logs.map((log) => [
      log.userName || "Unknown",
      log.userRole || "",
      log.action,
      log.module,
      log.description || "",
      log.status,
      new Date(log.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("✅ Audit logs exported successfully.");
  };

  const getActionBadge = (action) => {
    const colors = {
      LOGIN: "success",
      LOGOUT: "secondary",
      CREATE: "primary",
      UPDATE: "info",
      DELETE: "danger",
      APPROVE: "success",
      REJECT: "danger",
      CONFIRM: "success",
      OVERRIDE: "warning",
      UPLOAD: "primary",
      DOWNLOAD: "info",
      GENERATE: "success",
      VIEW: "secondary",
      TOGGLE: "warning",
      SYNC: "info",
    };
    const icons = {
      LOGIN: <FaUserGraduate />,
      LOGOUT: <FaUserGraduate />,
      CREATE: <FaPlus />,
      UPDATE: <FaBook />,
      DELETE: <FaTrash />,
      APPROVE: <FaCheckCircle />,
      REJECT: <FaTimesCircle />,
      OVERRIDE: <FaExclamationTriangle />,
    };
    return (
      <Badge bg={colors[action] || "secondary"} className="px-2 py-1">
        {icons[action]} {action}
      </Badge>
    );
  };

  const getModuleBadge = (module) => {
    const colors = {
      ATTENDANCE: "primary",
      DOCUMENT: "info",
      HALL_TICKET: "success",
      STUDENT: "warning",
      FACULTY: "secondary",
      EXAM: "danger",
      USER: "dark",
      PROFILE: "light",
      DASHBOARD: "primary",
      SEMESTER: "info",
    };
    return (
      <Badge bg={colors[module] || "secondary"} className="px-2 py-1">
        {module}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      SUCCESS: "success",
      FAILURE: "danger",
      PENDING: "warning",
    };
    const icons = {
      SUCCESS: <FaCheckCircle />,
      FAILURE: <FaTimesCircle />,
      PENDING: <FaClock />,
    };
    return (
      <Badge bg={colors[status] || "secondary"} className="px-2 py-1">
        {icons[status]} {status}
      </Badge>
    );
  };

  const handleApplyFilters = () => {
    setPagination({ ...pagination, page: 1 });
    loadAuditLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      action: "",
      module: "",
      userRole: "",
      department: "",
      startDate: "",
      endDate: "",
    });
    setPagination({ ...pagination, page: 1 });
    setTimeout(loadAuditLogs, 100);
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

  if (loading && logs.length === 0) {
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
          <h5 className="mt-3 text-muted">Loading audit logs...</h5>
        </div>
      </Container>
    );
  }

  if (error && !logs.length) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadAuditLogs} />
      </Container>
    );
  }

  return (
    <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <h2 className="mb-2 mb-md-0">
          <FaInfoCircle className="me-2 text-primary" />
          Audit Log
        </h2>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              loadAuditLogs();
              loadSummary();
            }}
          >
            <FaSync className="me-1" /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={exportLogs}>
            <FaDownload className="me-1" /> Export CSV
          </Button>
        </div>
      </div>

      {summaryError && (
        <Alert variant="warning" className="mb-3">
          {summaryError}
        </Alert>
      )}

      {/* Summary Cards with Icons */}
      {summary && (
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaHistory}
            title="Total Actions"
            value={summary.totalLogs}
            bgColor="bg-primary"
          />
          <StatCard
            icon={FaCalendarDay}
            title="Today's Actions"
            value={summary.todayLogs || 0}
            bgColor="bg-success"
          />
          <StatCard
            icon={FaPlus}
            title="Creations"
            value={
              summary.byAction?.find((a) => a._id === "CREATE")?.count || 0
            }
            bgColor="bg-warning"
          />
          <StatCard
            icon={FaTrash}
            title="Deletions"
            value={
              summary.byAction?.find((a) => a._id === "DELETE")?.count || 0
            }
            bgColor="bg-danger"
          />
        </Row>
      )}

      {/* Filters */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          <h6 className="mb-3">
            <FaInfoCircle className="me-2 text-primary" /> Filter Logs
          </h6>
          <Row className="g-2">
            <Col xs={12} md={2}>
              <Form.Select
                size="sm"
                value={filters.action}
                onChange={(e) =>
                  setFilters({ ...filters, action: e.target.value })
                }
              >
                <option value="">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={2}>
              <Form.Select
                size="sm"
                value={filters.module}
                onChange={(e) =>
                  setFilters({ ...filters, module: e.target.value })
                }
              >
                <option value="">All Modules</option>
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={2}>
              <Form.Select
                size="sm"
                value={filters.userRole}
                onChange={(e) =>
                  setFilters({ ...filters, userRole: e.target.value })
                }
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={2}>
              <Form.Select
                size="sm"
                value={filters.department}
                onChange={(e) =>
                  setFilters({ ...filters, department: e.target.value })
                }
              >
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department.code} value={department.code}>
                    {department.code}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Control
                type="date"
                size="sm"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
              />
            </Col>
            <Col xs={6} md={2}>
              <Form.Control
                type="date"
                size="sm"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
              />
            </Col>
            <Col xs={12} md={2}>
              <div className="d-flex gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-fill"
                  onClick={handleApplyFilters}
                >
                  Apply
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleClearFilters}
                  title="Clear Filters"
                >
                  ✕
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <Alert variant="info" className="text-center py-4">
          <FaInfoCircle size={24} className="mb-2 d-block" />
          No audit logs found.
        </Alert>
      ) : (
        <Card className="shadow-sm border-0">
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table bordered hover className="mb-0">
                <thead className="table-dark">
                  <tr>
                    <th style={{ width: "5%" }}>#</th>
                    <th style={{ width: "12%" }}>User</th>
                    <th style={{ width: "10%" }}>Action</th>
                    <th style={{ width: "10%" }}>Module</th>
                    <th style={{ width: "25%" }}>Description</th>
                    <th style={{ width: "8%" }}>Status</th>
                    <th style={{ width: "15%" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={log._id}>
                      <td className="text-center">
                        {index + 1 + (pagination.page - 1) * 50}
                      </td>
                      <td>
                        <strong>{log.userName || "Unknown"}</strong>
                        <br />
                        <small className="text-muted">{log.userRole}</small>
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>{getModuleBadge(log.module)}</td>
                      <td>
                        <div
                          className="text-truncate"
                          style={{ maxWidth: "250px" }}
                          title={log.description}
                        >
                          {log.description}
                        </div>
                      </td>
                      <td>{getStatusBadge(log.status)}</td>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
          <Card.Footer className="bg-white">
            <small className="text-muted">
              <FaInfoCircle className="me-1" />
              Showing {logs.length} logs
            </small>
          </Card.Footer>
        </Card>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center mt-3">
          <span className="text-muted small">
            Showing {pagination.total > 0 ? (pagination.page - 1) * 50 + 1 : 0}{" "}
            - {Math.min(pagination.page * 50, pagination.total)} of{" "}
            {pagination.total}
          </span>
          <div className="d-flex gap-1 mt-2 mt-md-0">
            <Button
              variant="outline-primary"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page - 1 })
              }
            >
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled>
              Page {pagination.page} of {pagination.pages}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              disabled={pagination.page === pagination.pages}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page + 1 })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
};

export default AuditLogPage;
