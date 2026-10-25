import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
  InputGroup,
  Tab,
  ProgressBar,
} from "react-bootstrap";
import {
  FaBuilding,
  FaUsers,
  FaUserGraduate,
  FaTicketAlt,
  FaChartBar,
  FaPlus,
  FaEdit,
  FaTrash,
  FaUserTie,
  FaSearch,
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationCircle,
  FaShieldAlt,
  FaUniversity,
  FaClipboardList,
  FaUserShield,
} from "react-icons/fa";
import api from "../services/api";

// ─────────────────────────────────────────────
// Mini stat card
// ─────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <Card
    className="border-0 h-100"
    style={{
      borderLeft: `4px solid ${color}`,
      background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
    }}
  >
    <Card.Body className="d-flex align-items-center gap-3 p-3">
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color="#fff" />
      </div>
      <div>
        <div className="text-muted small mb-0">{label}</div>
        <div className="fw-bold fs-4 lh-1">{value}</div>
        {sub && (
          <div className="text-muted" style={{ fontSize: "0.73rem" }}>
            {sub}
          </div>
        )}
      </div>
    </Card.Body>
  </Card>
);

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
const StatusBadge = ({ active }) =>
  active ? (
    <Badge bg="success" className="d-inline-flex align-items-center gap-1">
      <FaCheckCircle size={10} /> Active
    </Badge>
  ) : (
    <Badge bg="danger" className="d-inline-flex align-items-center gap-1">
      <FaTimesCircle size={10} /> Inactive
    </Badge>
  );

const getActivityDetails = (log) => {
  if (log.description) return log.description;
  if (log.resource) return log.resource;
  if (log.details && Object.keys(log.details).length > 0) {
    return JSON.stringify(log.details);
  }
  return "—";
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const SuperAdminDashboard = ({ defaultTab = "overview" }) => {
  const location = useLocation();

  // ✅ Derive active tab from URL — no state, always in sync
  const activeTab = (() => {
    const path = location.pathname;
    if (path.endsWith("/departments")) return "departments";
    if (path.endsWith("/activity")) return "activity";
    if (path.endsWith("/users")) return "users";
    return defaultTab || "overview";
  })();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userDeptFilter, setUserDeptFilter] = useState("ALL");
  const [deptSearch, setDeptSearch] = useState("");
  const [deptStatusFilter, setDeptStatusFilter] = useState("all");

  // Modals
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showEditDept, setShowEditDept] = useState(false);
  const [showAssignHod, setShowAssignHod] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    attendanceThreshold: 75,
  });
  const [hodForm, setHodForm] = useState({ email: "", departmentCode: "" });
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);

  // ── Fetch helpers ──────────────────────────
  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get("/super-admin/overview");
      if (res.data.success) setOverview(res.data.data);
    } catch (err) {
      console.error("Error fetching overview:", err);
      setError(err.userMessage || "Failed to load dashboard overview.");
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const params = {};
      if (deptSearch) params.search = deptSearch;
      if (deptStatusFilter !== "all") params.status = deptStatusFilter;
      const res = await api.get("/departments", { params });
      if (res.data.success) setDepartments(res.data.data);
    } catch (err) {
      console.error("Error fetching departments:", err);
    }
  }, [deptSearch, deptStatusFilter]);

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        const params = { page, limit: 20 };
        if (userSearch) params.search = userSearch;
        if (userRoleFilter !== "ALL") params.role = userRoleFilter;
        if (userDeptFilter !== "ALL") params.department = userDeptFilter;
        const res = await api.get("/super-admin/users", { params });
        if (res.data.success) {
          setUsers(res.data.data.users);
          setUserPagination(res.data.data.pagination);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    },
    [userSearch, userRoleFilter, userDeptFilter],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchOverview(), fetchDepartments(), fetchUsers()]);
    setLoading(false);
  }, [fetchOverview, fetchDepartments, fetchUsers]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading) fetchDepartments();
  }, [deptSearch, deptStatusFilter]); // eslint-disable-line

  useEffect(() => {
    if (!loading) fetchUsers();
  }, [userSearch, userRoleFilter, userDeptFilter]); // eslint-disable-line

  // ── Department CRUD ─────────────────────────
  const openCreate = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      attendanceThreshold: 75,
    });
    setFormError(null);
    setFormSuccess(null);
    setShowCreateDept(true);
  };

  const openEdit = (dept) => {
    setSelectedDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      attendanceThreshold: dept.attendanceThreshold ?? 75,
    });
    setFormError(null);
    setFormSuccess(null);
    setShowEditDept(true);
  };

  const openAssignHod = (dept) => {
    setSelectedDept(dept);
    setHodForm({ email: dept.hodEmail || "", departmentCode: dept.code });
    setFormError(null);
    setFormSuccess(null);
    setShowAssignHod(true);
  };

  const openDeleteConfirm = (dept) => {
    setSelectedDept(dept);
    setShowDeleteConfirm(true);
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await api.post("/departments", formData);
      if (res.data.success) {
        setFormSuccess(res.data.message);
        await fetchDepartments();
        await fetchOverview();
        setTimeout(() => setShowCreateDept(false), 1200);
      }
    } catch (err) {
      setFormError(
        err.userMessage ||
          err.response?.data?.error ||
          "Failed to create department.",
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditDept = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        attendanceThreshold: formData.attendanceThreshold,
      };
      const departmentId = selectedDept._id || selectedDept.id;
      if (!departmentId) {
        throw new Error("Department ID is missing. Refresh and try again.");
      }
      const res = await api.put(`/departments/${departmentId}`, payload);
      if (res.data.success) {
        setFormSuccess("Department updated successfully!");
        await fetchDepartments();
        await fetchOverview();
        setTimeout(() => setShowEditDept(false), 1200);
      }
    } catch (err) {
      setFormError(
        err.userMessage ||
          err.response?.data?.error ||
          "Failed to update department.",
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (dept) => {
    try {
      await api.put(`/departments/${dept._id}`, { isActive: !dept.isActive });
      await fetchDepartments();
      await fetchOverview();
    } catch (err) {
      alert(err.userMessage || "Failed to update department status.");
    }
  };

  const handleDeleteDept = async () => {
    try {
      const res = await api.delete(`/departments/${selectedDept._id}`);
      if (res.data.success) {
        setShowDeleteConfirm(false);
        await fetchDepartments();
        await fetchOverview();
      }
    } catch (err) {
      alert(err.userMessage || "Failed to delete department.");
    }
  };

  const handleAssignHod = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await api.post("/super-admin/assign-hod", {
        departmentCode: hodForm.departmentCode,
        email: hodForm.email,
      });
      if (res.data.success) {
        setFormSuccess(res.data.message);
        await fetchDepartments();
        await fetchOverview();
        setTimeout(() => setShowAssignHod(false), 1500);
      }
    } catch (err) {
      setFormError(
        err.userMessage || err.response?.data?.error || "Failed to assign HOD.",
      );
    } finally {
      setFormLoading(false);
    }
  };

  // ── Computed values ─────────────────────────
  const summary = overview?.summary;
  const departmentBreakdown = overview?.departmentBreakdown || [];
  const recentActivity = overview?.recentActivity || [];

  // ── Loading / Error ─────────────────────────
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
          <p className="mt-3 text-muted">Loading Super Admin Dashboard…</p>
        </div>
      </Container>
    );
  }

  if (error && !summary) {
    return (
      <Container className="mt-4">
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <FaExclamationCircle /> {error}
          <Button
            variant="outline-danger"
            size="sm"
            className="ms-auto"
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  // ── Main UI ─────────────────────────────────
  return (
    <Container fluid className="py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <FaShieldAlt className="text-primary" /> Super Admin Dashboard
          </h2>
          <p className="text-muted mb-0">
            College-wide management across all departments
          </p>
        </div>
        <Button
          variant="outline-primary"
          className="d-flex align-items-center gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <FaSync className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Alert
          variant="warning"
          className="mb-3"
          dismissible
          onClose={() => setError(null)}
        >
          <FaExclamationCircle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {/* Summary Cards — only visible on Overview tab */}
      {activeTab === "overview" && (
        <Row className="g-3 mb-4">
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaUniversity}
              label="Departments"
              value={summary?.totalDepartments ?? 0}
              color="#6366f1"
              sub={`${summary?.activeDepartments ?? 0} active`}
            />
          </Col>
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaUserGraduate}
              label="Students"
              value={summary?.totalStudents ?? 0}
              color="#22c55e"
            />
          </Col>
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaUsers}
              label="Faculty"
              value={summary?.totalFaculty ?? 0}
              color="#3b82f6"
            />
          </Col>
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaUserTie}
              label="HODs"
              value={summary?.totalHods ?? 0}
              color="#f59e0b"
            />
          </Col>
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaClipboardList}
              label="Exams"
              value={summary?.totalExams ?? 0}
              color="#ec4899"
            />
          </Col>
          <Col xs={6} md={4} lg={2}>
            <StatCard
              icon={FaTicketAlt}
              label="Hall Tickets"
              value={summary?.totalHallTickets ?? 0}
              color="#14b8a6"
              sub={`${summary?.overallApprovalRate ?? 0}% approved`}
            />
          </Col>
        </Row>
      )}

      {/* ✅ Navigation handled by top navbar + bottom navbar */}
      <Tab.Container activeKey={activeTab}>
        <Tab.Content>
          {/* ── Overview Tab ── */}
          <Tab.Pane eventKey="overview">
            <Row className="g-3">
              {departmentBreakdown.map((dept) => (
                <Col md={6} xl={4} key={dept.id}>
                  <Card className="h-100 shadow-sm border-0">
                    <Card.Header className="bg-transparent border-bottom d-flex justify-content-between align-items-center py-2">
                      <div>
                        <span className="fw-semibold">{dept.name}</span>
                        <Badge bg="secondary" className="ms-2 rounded-pill">
                          {dept.code}
                        </Badge>
                      </div>
                      <StatusBadge active={dept.isActive} />
                    </Card.Header>
                    <Card.Body className="py-3">
                      <div className="d-flex justify-content-between small text-muted mb-1">
                        <span>HOD</span>
                        <span className="fw-semibold text-dark">
                          {dept.hodName || "Not Assigned"}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small text-muted mb-2">
                        <span>Attendance Threshold</span>
                        <span className="fw-semibold text-dark">
                          {dept.attendanceThreshold}%
                        </span>
                      </div>
                      <hr className="my-2" />
                      <Row className="g-2 text-center">
                        <Col xs={4}>
                          <div className="fw-bold text-success">
                            {dept.stats.students}
                          </div>
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.7rem" }}
                          >
                            Students
                          </div>
                        </Col>
                        <Col xs={4}>
                          <div className="fw-bold text-primary">
                            {dept.stats.faculty}
                          </div>
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.7rem" }}
                          >
                            Faculty
                          </div>
                        </Col>
                        <Col xs={4}>
                          <div className="fw-bold text-warning">
                            {dept.stats.exams}
                          </div>
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.7rem" }}
                          >
                            Exams
                          </div>
                        </Col>
                      </Row>
                      {dept.stats.hallTickets > 0 && (
                        <div className="mt-3">
                          <div className="d-flex justify-content-between small mb-1">
                            <span className="text-muted">Approval Rate</span>
                            <span className="fw-semibold">
                              {dept.stats.approvalRate}%
                            </span>
                          </div>
                          <ProgressBar
                            now={dept.stats.approvalRate}
                            variant={
                              dept.stats.approvalRate >= 75
                                ? "success"
                                : dept.stats.approvalRate >= 50
                                  ? "warning"
                                  : "danger"
                            }
                            style={{ height: 6, borderRadius: 3 }}
                          />
                        </div>
                      )}
                    </Card.Body>
                    <Card.Footer className="bg-transparent border-top-0 d-flex gap-2 pb-3 px-3">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="flex-fill"
                        onClick={() => openAssignHod(dept)}
                      >
                        <FaUserTie className="me-1" size={11} /> Assign HOD
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="flex-fill"
                        onClick={() => openEdit(dept)}
                      >
                        <FaEdit className="me-1" size={11} /> Edit
                      </Button>
                    </Card.Footer>
                  </Card>
                </Col>
              ))}
              {departmentBreakdown.length === 0 && (
                <Col xs={12}>
                  <Alert variant="info" className="text-center">
                    No departments found.
                  </Alert>
                </Col>
              )}
            </Row>
          </Tab.Pane>

          {/* ── Departments Tab ── */}
          <Tab.Pane eventKey="departments">
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-transparent py-3">
                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                  <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                    <FaBuilding className="text-primary" /> Department
                    Management
                  </h6>
                  <div className="d-flex gap-2 flex-wrap">
                    <InputGroup size="sm" style={{ width: 220 }}>
                      <InputGroup.Text>
                        <FaSearch size={12} />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search departments…"
                        value={deptSearch}
                        onChange={(e) => setDeptSearch(e.target.value)}
                      />
                    </InputGroup>
                    <Form.Select
                      size="sm"
                      style={{ width: 130 }}
                      value={deptStatusFilter}
                      onChange={(e) => setDeptStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Form.Select>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={openCreate}
                      className="d-flex align-items-center gap-1"
                    >
                      <FaPlus size={12} /> Add Department
                    </Button>
                  </div>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table
                    hover
                    className="mb-0 align-middle"
                    style={{ fontSize: "0.875rem" }}
                  >
                    <thead className="table-light">
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>HOD</th>
                        <th className="text-center">Students</th>
                        <th className="text-center">Faculty</th>
                        <th className="text-center">Exams</th>
                        <th className="text-center">Threshold</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((dept) => (
                        <tr key={dept._id}>
                          <td>
                            <Badge bg="dark" className="rounded-1">
                              {dept.code}
                            </Badge>
                          </td>
                          <td className="fw-semibold">{dept.name}</td>
                          <td>
                            {dept.hodName || dept.hodId?.name ? (
                              <span className="text-success small">
                                {dept.hodName || dept.hodId?.name}
                              </span>
                            ) : (
                              <span className="text-danger small">
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {dept.stats?.totalStudents ?? 0}
                          </td>
                          <td className="text-center">
                            {dept.stats?.totalFaculty ?? 0}
                          </td>
                          <td className="text-center">
                            {dept.stats?.totalExams ?? 0}
                          </td>
                          <td className="text-center">
                            {dept.attendanceThreshold}%
                          </td>
                          <td className="text-center">
                            <StatusBadge active={dept.isActive} />
                          </td>
                          <td className="text-center">
                            <div className="d-flex gap-1 justify-content-center">
                              <Button
                                size="sm"
                                variant="outline-info"
                                title="Assign HOD"
                                onClick={() => openAssignHod(dept)}
                              >
                                <FaUserTie size={11} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                title="Edit"
                                onClick={() => openEdit(dept)}
                              >
                                <FaEdit size={11} />
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  dept.isActive
                                    ? "outline-warning"
                                    : "outline-success"
                                }
                                title={
                                  dept.isActive ? "Deactivate" : "Activate"
                                }
                                onClick={() => handleToggleActive(dept)}
                              >
                                {dept.isActive ? (
                                  <FaTimesCircle size={11} />
                                ) : (
                                  <FaCheckCircle size={11} />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                title="Delete"
                                onClick={() => openDeleteConfirm(dept)}
                                disabled={dept.code === "CS"}
                              >
                                <FaTrash size={11} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {departments.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="text-center text-muted py-4"
                          >
                            No departments found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Tab.Pane>

          {/* ── Users Tab ── */}
          <Tab.Pane eventKey="users">
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-transparent py-3">
                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                  <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                    <FaUserShield className="text-primary" /> User Management
                  </h6>
                  <div className="d-flex gap-2 flex-wrap">
                    <InputGroup size="sm" style={{ width: 220 }}>
                      <InputGroup.Text>
                        <FaSearch size={12} />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Search users…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                    </InputGroup>
                    <Form.Select
                      size="sm"
                      style={{ width: 120 }}
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                    >
                      <option value="ALL">All Roles</option>
                      <option value="HOD">HOD</option>
                      <option value="Faculty">Faculty</option>
                      <option value="Mentor">Mentor</option>
                      <option value="Student">Student</option>
                      <option value="SuperAdmin">SuperAdmin</option>
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      style={{ width: 130 }}
                      value={userDeptFilter}
                      onChange={(e) => setUserDeptFilter(e.target.value)}
                    >
                      <option value="ALL">All Depts</option>
                      {departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table
                    hover
                    className="mb-0 align-middle"
                    style={{ fontSize: "0.875rem" }}
                  >
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th className="text-center">Role</th>
                        <th className="text-center">Dept</th>
                        <th className="text-center">Approved</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td className="fw-semibold">{user.name}</td>
                          <td className="text-muted small">{user.email}</td>
                          <td className="text-center">
                            <Badge
                              bg={
                                user.role === "SuperAdmin"
                                  ? "dark"
                                  : user.role === "HOD"
                                    ? "primary"
                                    : user.role === "Faculty"
                                      ? "success"
                                      : user.role === "Mentor"
                                        ? "info"
                                        : user.role === "Student"
                                          ? "warning"
                                          : "secondary"
                              }
                            >
                              {user.role}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {user.department ? (
                              <Badge bg="secondary" className="rounded-1">
                                {user.department}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {user.isApproved === false ? (
                              <Badge bg="warning" text="dark">
                                Pending
                              </Badge>
                            ) : (
                              <Badge bg="success">Yes</Badge>
                            )}
                          </td>
                          <td className="text-muted small">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted py-4"
                          >
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
              {userPagination.pages > 1 && (
                <Card.Footer className="bg-transparent d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    Page {userPagination.page} of {userPagination.pages} (
                    {userPagination.total} total)
                  </small>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={userPagination.page === 1}
                      onClick={() => fetchUsers(userPagination.page - 1)}
                    >
                      ← Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={userPagination.page === userPagination.pages}
                      onClick={() => fetchUsers(userPagination.page + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </Card.Footer>
              )}
            </Card>
          </Tab.Pane>

          {/* ── Activity Tab ── */}
          <Tab.Pane eventKey="activity">
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-transparent py-3">
                <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <FaClipboardList className="text-primary" /> Recent Activity
                  (College-wide)
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table
                    hover
                    className="mb-0 align-middle"
                    style={{ fontSize: "0.875rem" }}
                  >
                    <thead className="table-light">
                      <tr>
                        <th>Action</th>
                        <th>User</th>
                        <th className="text-center">Role</th>
                        <th>Details</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((log) => (
                        <tr key={log._id}>
                          <td>
                            <Badge bg="light" text="dark" className="border">
                              {log.action}
                            </Badge>
                          </td>
                          <td>
                            <div className="fw-semibold">
                              {log.userId?.name || "System"}
                            </div>
                            <small className="text-muted">
                              {log.userId?.email || ""}
                            </small>
                          </td>
                          <td className="text-center">
                            {log.userId?.role && (
                              <Badge bg="secondary">{log.userId.role}</Badge>
                            )}
                          </td>
                          <td className="text-muted small">
                            {getActivityDetails(log)}
                          </td>
                          <td className="text-muted small">
                            {log.createdAt
                              ? new Date(log.createdAt).toLocaleString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {recentActivity.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center text-muted py-4"
                          >
                            No recent activity.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* ────── Modals ────── */}

      {/* Create Department */}
      <Modal
        show={showCreateDept}
        onHide={() => setShowCreateDept(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaPlus className="text-primary" /> Add New Department
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateDept}>
          <Modal.Body>
            {formError && (
              <Alert variant="danger" className="small py-2">
                {formError}
              </Alert>
            )}
            {formSuccess && (
              <Alert variant="success" className="small py-2">
                {formSuccess}
              </Alert>
            )}
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Department Name *
                  </Form.Label>
                  <Form.Control
                    required
                    placeholder="e.g. Electronics &amp; Communication"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Department Code *
                  </Form.Label>
                  <Form.Control
                    required
                    placeholder="e.g. EC"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={10}
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Description
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Brief description…"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Attendance Threshold:{" "}
                    <strong>{formData.attendanceThreshold}%</strong>
                  </Form.Label>
                  <Form.Range
                    min={50}
                    max={100}
                    value={formData.attendanceThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attendanceThreshold: parseInt(e.target.value),
                      })
                    }
                  />
                  <div
                    className="d-flex justify-content-between text-muted"
                    style={{ fontSize: "0.7rem" }}
                  >
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowCreateDept(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formLoading}
              className="d-flex align-items-center gap-2"
            >
              {formLoading && <Spinner size="sm" />} Create Department
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Department */}
      <Modal show={showEditDept} onHide={() => setShowEditDept(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaEdit className="text-primary" /> Edit — {selectedDept?.code}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditDept}>
          <Modal.Body>
            {formError && (
              <Alert variant="danger" className="small py-2">
                {formError}
              </Alert>
            )}
            {formSuccess && (
              <Alert variant="success" className="small py-2">
                {formSuccess}
              </Alert>
            )}
            <Row className="g-3">
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Department Name *
                  </Form.Label>
                  <Form.Control
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Description
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    Attendance Threshold:{" "}
                    <strong>{formData.attendanceThreshold}%</strong>
                  </Form.Label>
                  <Form.Range
                    min={50}
                    max={100}
                    value={formData.attendanceThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attendanceThreshold: parseInt(e.target.value),
                      })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowEditDept(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formLoading}
              className="d-flex align-items-center gap-2"
            >
              {formLoading && <Spinner size="sm" />} Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assign HOD */}
      <Modal
        show={showAssignHod}
        onHide={() => setShowAssignHod(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaUserTie className="text-info" /> Assign HOD —{" "}
            {selectedDept?.name}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAssignHod}>
          <Modal.Body>
            {formError && (
              <Alert variant="danger" className="small py-2">
                {formError}
              </Alert>
            )}
            {formSuccess && (
              <Alert variant="success" className="small py-2">
                {formSuccess}
              </Alert>
            )}
            {selectedDept?.hodName && (
              <Alert variant="info" className="small py-2">
                Current HOD: <strong>{selectedDept.hodName}</strong>
              </Alert>
            )}
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                HOD Email Address *
              </Form.Label>
              <Form.Control
                required
                type="email"
                placeholder="Registered user's email"
                value={hodForm.email}
                onChange={(e) =>
                  setHodForm({ ...hodForm, email: e.target.value })
                }
              />
              <Form.Text className="text-muted">
                The user must already be registered. Their role will be updated
                to HOD.
              </Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label className="small fw-semibold">Department</Form.Label>
              <Form.Control
                readOnly
                value={`${selectedDept?.code} — ${selectedDept?.name}`}
                className="bg-light"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowAssignHod(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="info"
              className="text-white d-flex align-items-center gap-2"
              disabled={formLoading}
            >
              {formLoading && <Spinner size="sm" />} Assign HOD
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title className="text-danger d-flex align-items-center gap-2">
            <FaTrash /> Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1">
            Delete{" "}
            <strong>
              {selectedDept?.name} ({selectedDept?.code})
            </strong>
            ?
          </p>
          <small className="text-muted">
            If this department has students, it will be deactivated instead of
            deleted.
          </small>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteDept}
            className="d-flex align-items-center gap-1"
          >
            <FaTrash size={11} /> Delete
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Container>
  );
};

export default SuperAdminDashboard;
