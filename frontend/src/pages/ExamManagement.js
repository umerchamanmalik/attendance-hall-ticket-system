import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  FaPlus,
  FaSync,
  FaEye,
  FaEdit,
  FaTrash,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaRedo,
  FaUserGraduate,
  FaSearch,
  FaFilePdf,
  FaExclamationTriangle,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";

const ExamManagement = () => {
  const [exams, setExams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [saving, setSaving] = useState(false);

  // Confirm Dialog States
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ✅ Regenerate States
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateExamId, setRegenerateExamId] = useState(null);
  const [regenerateType, setRegenerateType] = useState("all"); // 'all' or 'specific'
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const toast = useToast();

  // Filter States
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    examName: "",
    academicYear: "",
    semester: "",
    section: "",
    startDate: "",
    endDate: "",
    department: "CS",
  });

  const academicYears = [
    "First Year",
    "Second Year",
    "Third Year",
    "Final Year",
  ];
  const sections = ["A", "B", "C", "D"];
  const semesters = Array.from({ length: 8 }, (_, i) => i + 1);
  const statuses = ["DRAFT", "GENERATED", "COMPLETED", "CANCELLED"];

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
    fetchExams();
    api
      .get("/departments/public")
      .then((response) => setDepartments(response.data.data || []))
      .catch((error) => console.error("Error loading departments:", error));
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await api.get("/exams");
      setExams(response.data.data || []);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter((exam) => {
    let match = true;
    if (filterSemester)
      match = match && exam.semester === parseInt(filterSemester);
    if (filterSection) match = match && exam.section === filterSection;
    if (filterStatus) match = match && exam.status === filterStatus;
    if (filterDepartment) {
      match = match && (exam.department || "CS") === filterDepartment;
    }
    if (searchTerm)
      match =
        match && exam.examName.toLowerCase().includes(searchTerm.toLowerCase());
    return match;
  });

  const stats = {
    total: exams.length,
    draft: exams.filter((e) => e.status === "DRAFT").length,
    generated: exams.filter((e) => e.status === "GENERATED").length,
    completed: exams.filter((e) => e.status === "COMPLETED").length,
  };

  // ✅ Regenerate Functions
  const handleRegenerateClick = (examId) => {
    setRegenerateExamId(examId);
    setShowRegenerateModal(true);
    setRegenerateType("all");
    setStudentSearch("");
    setSearchResults([]);
    setSelectedStudentId(null);
  };

  const handleRegenerateAll = async () => {
    if (!regenerateExamId) return;
    setRegenerateLoading(true);
    try {
      const response = await api.post(`/exams/${regenerateExamId}/regenerate`);
      toast.success(
        response.data.message ||
          "✅ All hall tickets regenerated successfully!",
      );
      setShowRegenerateModal(false);
      fetchExams();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setRegenerateLoading(false);
    }
  };

  const handleSearchStudent = async () => {
    if (!studentSearch.trim()) {
      toast.warning("Please enter a USN or student name to search.");
      return;
    }

    try {
      const response = await api.get(
        `/students/search?query=${encodeURIComponent(studentSearch)}`,
      );
      const results = response.data.data || [];
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No students found matching your search.");
      }
    } catch (error) {
      toast.error(formatErrorMessage(error));
    }
  };

  const handleRegenerateSpecific = async () => {
    if (!selectedStudentId) {
      toast.warning("Please select a student first.");
      return;
    }

    setRegenerating(true);
    try {
      // ✅ Call regenerate API with studentId filter
      const response = await api.post(`/exams/${regenerateExamId}/regenerate`, {
        studentId: selectedStudentId,
      });
      toast.success(
        response.data.message || "✅ Hall ticket regenerated successfully!",
      );
      setShowRegenerateModal(false);
      setSelectedStudentId(null);
      setSearchResults([]);
      fetchExams();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setRegenerating(false);
    }
  };

  const handleOpenDialog = (exam = null) => {
    if (exam) {
      setEditingExam(exam);
      setFormData({
        examName: exam.examName,
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
        startDate: exam.startDate?.split("T")[0] || "",
        endDate: exam.endDate?.split("T")[0] || "",
        department: exam.department || "CS",
      });
    } else {
      setEditingExam(null);
      setFormData({
        examName: "",
        academicYear: "",
        semester: "",
        section: "",
        startDate: "",
        endDate: "",
        department: "CS",
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingExam(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const requiredFields = [
      "examName",
      "academicYear",
      "semester",
      "section",
      "startDate",
      "endDate",
    ];
    if (requiredFields.some((field) => !String(formData[field]).trim())) {
      toast.warning("Please complete all exam fields before submitting.");
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.warning("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const url = editingExam ? `/exams/${editingExam._id}` : "/exams";
      const method = editingExam ? "put" : "post";

      const response = await api[method](url, formData);

      toast.success(
        editingExam
          ? response.data.message || "✅ Exam updated successfully."
          : response.data.message || "✅ Exam created successfully.",
      );
      handleCloseDialog();
      await fetchExams();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteTargetId(id);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/exams/${deleteTargetId}`);
      toast.success("✅ Exam deleted successfully.");
      await fetchExams();
      setShowConfirm(false);
      setDeleteTargetId(null);
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setFilterSemester("");
    setFilterSection("");
    setFilterStatus("");
    setFilterDepartment("");
    setSearchTerm("");
  };

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: "warning",
      GENERATED: "info",
      COMPLETED: "success",
      CANCELLED: "danger",
    };
    const icons = {
      DRAFT: <FaClock />,
      GENERATED: <FaCheckCircle />,
      COMPLETED: <FaCheckCircle />,
      CANCELLED: <FaTimesCircle />,
    };
    return (
      <Badge bg={colors[status] || "secondary"} className="px-2 py-1">
        {icons[status]} {status}
      </Badge>
    );
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <Col xs={6} md={3}>
      <Card className={`bg-${color} text-white shadow-sm border-0`}>
        <Card.Body className="d-flex align-items-center justify-content-between">
          <div>
            <h6 className="text-white-50 small mb-1">{title}</h6>
            <h2 className="mb-0">{value}</h2>
          </div>
          <div className="bg-white bg-opacity-25 p-2 rounded-circle">
            <Icon size={20} />
          </div>
        </Card.Body>
      </Card>
    </Col>
  );

  // ✅ Mobile Card View
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {filteredExams.length === 0 ? (
        <div className="text-center py-4">
          <FaCalendarAlt size={24} className="mb-2 d-block text-muted" />
          <p className="text-muted">No exams found.</p>
        </div>
      ) : (
        filteredExams.map((exam) => (
          <Card key={exam._id} className="mb-3 shadow-sm border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <h6 className="mb-1 fw-bold">{exam.examName}</h6>
                  <div className="mb-1">
                    <Badge bg="secondary" className="me-1">
                      {exam.academicYear}
                    </Badge>
                    <Badge bg="secondary" className="me-1">
                      Sem {exam.semester}
                    </Badge>
                    <Badge bg="secondary">Sec {exam.section}</Badge>
                    <Badge bg="info" className="ms-1">
                      {exam.department || "CS"}
                    </Badge>
                  </div>
                  <div className="small text-muted">
                    <div>
                      <FaCalendarAlt className="me-1" size={12} />
                      {new Date(exam.startDate).toLocaleDateString()} -{" "}
                      {new Date(exam.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-1">{getStatusBadge(exam.status)}</div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <Button
                  as={Link}
                  to={`/hod/exam-details/${exam._id}`}
                  variant="outline-primary"
                  size="sm"
                  title="View Details"
                >
                  <FaEye className="me-1" /> View
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleOpenDialog(exam)}
                  title="Edit Exam"
                  disabled={
                    exam.status === "COMPLETED" || exam.status === "CANCELLED"
                  }
                >
                  <FaEdit className="me-1" /> Edit
                </Button>
                {/* ✅ Regenerate Button (only for GENERATED exams) */}
                {exam.status === "GENERATED" && (
                  <Button
                    variant="outline-warning"
                    size="sm"
                    onClick={() => handleRegenerateClick(exam._id)}
                    title="Regenerate Hall Tickets"
                  >
                    <FaRedo className="me-1" /> Regenerate
                  </Button>
                )}
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteClick(exam._id)}
                  title="Delete Exam"
                >
                  <FaTrash className="me-1" /> Delete
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
          <h5 className="mt-3 text-muted">Loading exams...</h5>
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
            <FaCalendarAlt className="me-2 text-primary" />
            Exam Management
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="outline-secondary" size="sm" onClick={fetchExams}>
              <FaSync className="me-1" /> Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenDialog()}
            >
              <FaPlus className="me-1" /> Create Exam
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            title="Total"
            value={stats.total}
            icon={FaCalendarAlt}
            color="primary"
          />
          <StatCard
            title="Draft"
            value={stats.draft}
            icon={FaClock}
            color="warning"
          />
          <StatCard
            title="Generated"
            value={stats.generated}
            icon={FaCheckCircle}
            color="info"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={FaCheckCircle}
            color="success"
          />
        </Row>

        {/* Filters */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Semester</Form.Label>
                  <Form.Select
                    size="sm"
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                  >
                    <option value="">All</option>
                    {semesters.map((s) => (
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
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                  >
                    <option value="">All</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        Sec {s}
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
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All</option>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
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
                  <Form.Label className="fw-bold small">Search</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Search by exam name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
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
                    <FaClock className="me-1" /> {filteredExams.length} exams
                  </span>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Exams Table / Cards */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-secondary text-white">
            <h5 className="mb-0">
              <FaCalendarAlt className="me-2" /> Exams List
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
                      <th>Exam Name</th>
                      <th>Year</th>
                      <th>Sem</th>
                      <th>Sec</th>
                      <th>Department</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-4 text-muted">
                          <FaCalendarAlt size={24} className="mb-2 d-block" />
                          No exams found. Click "Create Exam" to add one.
                        </td>
                      </tr>
                    ) : (
                      filteredExams.map((exam) => (
                        <tr key={exam._id}>
                          <td>
                            <strong>{exam.examName}</strong>
                          </td>
                          <td>{exam.academicYear}</td>
                          <td>{exam.semester}</td>
                          <td>{exam.section}</td>
                          <td>{exam.department || "CS"}</td>
                          <td>
                            {new Date(exam.startDate).toLocaleDateString()}
                          </td>
                          <td>{new Date(exam.endDate).toLocaleDateString()}</td>
                          <td>{getStatusBadge(exam.status)}</td>
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1 flex-wrap">
                              <Button
                                as={Link}
                                to={`/hod/exam-details/${exam._id}`}
                                variant="outline-primary"
                                size="sm"
                                title="View Details"
                              >
                                <FaEye />
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleOpenDialog(exam)}
                                title="Edit Exam"
                                disabled={
                                  exam.status === "COMPLETED" ||
                                  exam.status === "CANCELLED"
                                }
                              >
                                <FaEdit />
                              </Button>
                              {/* ✅ Regenerate Button (only for GENERATED exams) */}
                              {exam.status === "GENERATED" && (
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={() =>
                                    handleRegenerateClick(exam._id)
                                  }
                                  title="Regenerate Hall Tickets"
                                >
                                  <FaRedo />
                                </Button>
                              )}
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteClick(exam._id)}
                                title="Delete Exam"
                              >
                                <FaTrash />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          {filteredExams.length > 0 && (
            <Card.Footer className="bg-white">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Showing {filteredExams.length} of {exams.length} total exams
              </small>
            </Card.Footer>
          )}
        </Card>
      </Container>

      {/* Create/Edit Modal */}
      <Modal show={openDialog} onHide={handleCloseDialog} centered size="lg">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            {editingExam ? (
              <FaEdit className="me-2" />
            ) : (
              <FaPlus className="me-2" />
            )}
            {editingExam ? "Edit Exam" : "Create New Exam"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group>
                <Form.Label className="fw-bold">Exam Name</Form.Label>
                <Form.Control
                  type="text"
                  name="examName"
                  value={formData.examName}
                  onChange={handleInputChange}
                  placeholder="e.g., Internal Test 1"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">Academic Year</Form.Label>
                <Form.Select
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleInputChange}
                >
                  <option value="">Select Year</option>
                  {academicYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={3}>
              <Form.Group>
                <Form.Label className="fw-bold">Semester</Form.Label>
                <Form.Select
                  name="semester"
                  value={formData.semester}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  {semesters.map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={3}>
              <Form.Group>
                <Form.Label className="fw-bold">Section</Form.Label>
                <Form.Select
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">Department</Form.Label>
                <Form.Select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                >
                  {departments.map((department) => (
                    <option key={department.code} value={department.code}>
                      {department.code}
                    </option>
                  ))}
                  {departments.length === 0 && <option value="CS">CS</option>}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">Start Date</Form.Label>
                <Form.Control
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">End Date</Form.Label>
                <Form.Control
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                />
              </Form.Group>
            </Col>
          </Row>

          {editingExam && editingExam.status !== "DRAFT" && (
            <Alert variant="info" className="mt-3">
              <FaInfoCircle className="me-2" />
              <strong>Note:</strong> This exam already has hall tickets
              generated. You can only update dates. Subjects cannot be changed.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="me-1" /> Saving...
              </>
            ) : editingExam ? (
              "Update Exam"
            ) : (
              "Create Exam"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Regenerate Modal */}
      <Modal
        show={showRegenerateModal}
        onHide={() => {
          setShowRegenerateModal(false);
          setRegenerateExamId(null);
          setStudentSearch("");
          setSearchResults([]);
          setSelectedStudentId(null);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton className="bg-warning text-dark">
          <Modal.Title>
            <FaRedo className="me-2" />
            Regenerate Hall Tickets
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <FaInfoCircle className="me-2" />
            Choose how you want to regenerate hall tickets for this exam.
          </Alert>

          <div className="mb-3">
            <Form.Group>
              <Form.Label className="fw-bold">
                Select Regeneration Type
              </Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  type="radio"
                  id="regenerateAll"
                  label={
                    <>
                      <strong>Regenerate All</strong>
                      <br />
                      <small className="text-muted">
                        Regenerate hall tickets for ALL students in this exam
                      </small>
                    </>
                  }
                  value="all"
                  checked={regenerateType === "all"}
                  onChange={() => {
                    setRegenerateType("all");
                    setStudentSearch("");
                    setSearchResults([]);
                    setSelectedStudentId(null);
                  }}
                />
                <Form.Check
                  type="radio"
                  id="regenerateSpecific"
                  label={
                    <>
                      <strong>Regenerate Specific</strong>
                      <br />
                      <small className="text-muted">
                        Regenerate hall ticket for a specific student by USN
                      </small>
                    </>
                  }
                  value="specific"
                  checked={regenerateType === "specific"}
                  onChange={() => {
                    setRegenerateType("specific");
                  }}
                />
              </div>
            </Form.Group>
          </div>

          {regenerateType === "specific" && (
            <>
              <hr />
              <div className="mb-3">
                <Form.Group>
                  <Form.Label className="fw-bold">
                    <FaUserGraduate className="me-1" />
                    Search Student by USN or Name
                  </Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="text"
                      placeholder="Enter USN or Student Name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchStudent();
                        }
                      }}
                    />
                    <Button variant="primary" onClick={handleSearchStudent}>
                      <FaSearch className="me-1" /> Search
                    </Button>
                  </div>
                </Form.Group>
              </div>

              {searchResults.length > 0 && (
                <div className="mb-3">
                  <Form.Label className="fw-bold">Select Student</Form.Label>
                  <div
                    className="table-responsive"
                    style={{ maxHeight: "200px", overflowY: "auto" }}
                  >
                    <Table bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th>Select</th>
                          <th>USN</th>
                          <th>Name</th>
                          <th>Semester</th>
                          <th>Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((student) => (
                          <tr key={student._id}>
                            <td>
                              <Form.Check
                                type="radio"
                                name="selectedStudent"
                                checked={selectedStudentId === student._id}
                                onChange={() =>
                                  setSelectedStudentId(student._id)
                                }
                              />
                            </td>
                            <td>{student.rollNumber}</td>
                            <td>{student.studentName}</td>
                            <td>{student.semester}</td>
                            <td>{student.section}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <small className="text-muted">
                    Select a student and click "Regenerate" below.
                  </small>
                </div>
              )}
            </>
          )}

          {regenerateType === "all" && (
            <Alert variant="warning">
              <FaExclamationTriangle className="me-2" />
              <strong>Warning:</strong> This will regenerate hall tickets for
              ALL students in this exam. Previous hall tickets will be updated
              with the latest attendance data.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRegenerateModal(false);
              setRegenerateExamId(null);
              setStudentSearch("");
              setSearchResults([]);
              setSelectedStudentId(null);
            }}
          >
            Cancel
          </Button>
          {regenerateType === "all" ? (
            <Button
              variant="warning"
              onClick={handleRegenerateAll}
              disabled={regenerateLoading}
            >
              {regenerateLoading ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Regenerating...
                </>
              ) : (
                <>
                  <FaRedo className="me-1" />
                  Regenerate All
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="warning"
              onClick={handleRegenerateSpecific}
              disabled={regenerating || !selectedStudentId}
            >
              {regenerating ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Regenerating...
                </>
              ) : (
                <>
                  <FaRedo className="me-1" />
                  Regenerate Selected Student
                </>
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setDeleteTargetId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Exam"
        message="Are you sure you want to delete this exam? This action cannot be undone. All associated hall tickets will also be deleted."
        confirmText="Delete Exam"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
};

export default ExamManagement;
