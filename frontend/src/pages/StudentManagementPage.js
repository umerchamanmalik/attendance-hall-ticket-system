import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Modal,
} from "react-bootstrap";
import {
  FaUserGraduate,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaSync,
  FaExclamationTriangle,
  FaInfoCircle,
  FaUpload,
  FaEnvelope,
  FaIdCard,
  FaBook,
  FaUserTie,
  FaGraduationCap,
  FaUsers,
  FaCheckCircle,
  FaTimesCircle,
  FaUserCheck,
  FaTimes,
  FaUserCog,
  FaChevronDown, // ✅ ADDED
  FaChevronUp, // ✅ ADDED
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";

// ✅ ADDED: Default number of items shown before "Show All"
const INITIAL_LIMIT = 10;

const StudentManagementPage = () => {
  const initialForm = {
    studentName: "",
    rollNumber: "",
    email: "",
    academicYear: "",
    semester: "",
    section: "",
    mentorName: "",
    attendanceVisibility: "Show Percentage",
    department: "CS",
  };
  const [form, setForm] = useState(initialForm);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [editId, setEditId] = useState(null);
  const toast = useToast();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ✅ ADDED: Show All toggle
  const [showAll, setShowAll] = useState(false);

  // Confirm Dialog States
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk Operations
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showBulkMentorModal, setShowBulkMentorModal] = useState(false);
  const [bulkMentor, setBulkMentor] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filter States
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterMentor, setFilterMentor] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [searchUSN, setSearchUSN] = useState("");

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadStudents = async () => {
    try {
      const response = await api.get("/students");

      if (response.data.success) {
        setStudents(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to load students");
      }
    } catch (error) {
      console.error("Error loading students:", error);
      setError(error.response?.data?.error || "Unable to load students.");
      toast.error(error.response?.data?.error || "Unable to load students.");
    }
  };

  const loadMentors = async () => {
    try {
      const response = await api.get("/students/mentors/list");

      if (response.data.success) {
        setMentors(response.data.data || []);
        console.log("📊 [loadMentors] Loaded mentors:", response.data.data);
      } else {
        throw new Error(response.data.message || "Failed to load mentors");
      }
    } catch (error) {
      console.error("❌ [loadMentors] Error:", error);
      toast.warning(
        error.response?.data?.error ||
          "Unable to load mentors. Using fallback list.",
      );
      setMentors([
        { facultyName: "Dr. Smith", roleType: "Mentor" },
        { facultyName: "Prof. Johnson", roleType: "Mentor" },
        { facultyName: "Dr. Williams", roleType: "Mentor" },
        { facultyName: "Prof. Brown", roleType: "Mentor" },
        { facultyName: "Dr. Jones", roleType: "Mentor" },
        { facultyName: "Prof. Garcia", roleType: "Mentor" },
      ]);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStudents(), loadMentors()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await api.get("/departments/public");
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  };

  useEffect(() => {
    loadAllData();
    loadDepartments();
  }, []);

  // Filter Students
  const filteredStudents = students.filter((student) => {
    let match = true;

    if (filterSemester) {
      match = match && student.semester === parseInt(filterSemester);
    }

    if (filterSection) {
      match = match && student.section === filterSection;
    }

    if (filterMentor) {
      match = match && student.mentorName === filterMentor;
    }
    if (filterDepartment) {
      match = match && (student.department || "CS") === filterDepartment;
    }

    if (searchUSN) {
      match =
        match &&
        student.rollNumber.toLowerCase().includes(searchUSN.toLowerCase());
    }

    return match;
  });

  // ✅ ADDED: Slice + hidden count for Show More / Show Less
  const visibleStudents = showAll
    ? filteredStudents
    : filteredStudents.slice(0, INITIAL_LIMIT);
  const hiddenStudentCount = Math.max(
    0,
    filteredStudents.length - INITIAL_LIMIT,
  );

  // Handle Select All
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudents(filteredStudents.map((s) => s._id));
    } else {
      setSelectedStudents([]);
    }
  };

  // Handle Select Individual
  const handleSelectStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  // Clear Selection
  const clearSelection = () => {
    setSelectedStudents([]);
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedStudents.length === 0) {
      toast.warning("Please select at least one student.");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    setDeleteLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const id of selectedStudents) {
        try {
          await api.delete(`/students/${id}`);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast.success(
        `${successCount} student(s) deleted successfully${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      setSelectedStudents([]);
      setShowConfirm(false);
      await loadStudents();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to delete students.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk Mentor Update
  const handleBulkMentorUpdate = () => {
    if (selectedStudents.length === 0) {
      toast.warning("Please select at least one student.");
      return;
    }
    setShowBulkMentorModal(true);
  };

  const confirmBulkMentorUpdate = async () => {
    if (!bulkMentor) {
      toast.warning("Please select a mentor.");
      return;
    }

    setBulkLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const id of selectedStudents) {
        try {
          await api.put(`/students/${id}`, {
            mentorName: bulkMentor,
          });
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast.success(
        `${successCount} student(s) updated to mentor "${bulkMentor}"${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      setSelectedStudents([]);
      setShowBulkMentorModal(false);
      setBulkMentor("");
      await loadStudents();
    } catch (error) {
      console.error("Error in bulk mentor update:", error);
      toast.error("Failed to update mentors.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.studentName.trim()) {
      toast.warning("Please enter student name");
      return;
    }

    if (!form.rollNumber.trim()) {
      toast.warning("Please enter roll number");
      return;
    }

    if (!form.email.trim()) {
      toast.warning("Please enter email");
      return;
    }

    setSubmitting(true);
    try {
      let response;
      if (editId) {
        response = await api.put(`/students/${editId}`, form);
        toast.success(
          response.data.message || "✅ Student updated successfully.",
        );
      } else {
        response = await api.post("/students", form);
        toast.success(
          response.data.message || "✅ Student added successfully.",
        );
      }
      setForm(initialForm);
      setEditId(null);
      await loadStudents();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(error.response?.data?.error || "Unable to save student.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (student) => {
    setForm({
      studentName: student.studentName || "",
      rollNumber: student.rollNumber || "",
      email: student.email || "",
      academicYear: student.academicYear || "",
      semester: student.semester || "",
      section: student.section || "",
      mentorName: student.mentorName || "",
      attendanceVisibility: student.attendanceVisibility || "Show Percentage",
      department: student.department || "CS",
    });
    setEditId(student._id);
  };

  const handleDeleteClick = (id) => {
    setDeleteTargetId(id);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      const response = await api.delete(`/students/${deleteTargetId}`);
      toast.success(
        response.data.message || "✅ Student deleted successfully.",
      );
      setShowConfirm(false);
      setDeleteTargetId(null);
      await loadStudents();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error(error.response?.data?.error || "Unable to delete student.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setFilterSemester("");
    setFilterSection("");
    setFilterMentor("");
    setSearchUSN("");
    setSelectedStudents([]);
    setShowAll(false); // ✅ ADDED
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditId(null);
  };

  const applyFilters = () => {
    // Just refresh the filter display
    setSelectedStudents([]);
    setShowAll(false); // ✅ ADDED
  };

  // Render Student Card for Mobile — ✅ uses visibleStudents
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {filteredStudents.length === 0 ? (
        <Alert variant="info" className="text-center">
          No students found.
        </Alert>
      ) : (
        visibleStudents.map((student) => (
          <Card key={student._id} className="mb-3 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      checked={selectedStudents.includes(student._id)}
                      onChange={() => handleSelectStudent(student._id)}
                      className="me-2"
                    />
                    <h6 className="mb-0">{student.studentName}</h6>
                  </div>
                  <div className="mt-2">
                    <div>
                      <FaIdCard className="text-primary me-1" size={14} />
                      <strong>Roll:</strong> {student.rollNumber}
                    </div>
                    <div>
                      <FaBook className="text-primary me-1" size={14} />
                      <strong>Sem:</strong> {student.semester} |{" "}
                      <strong>Sec:</strong> {student.section}
                    </div>
                    <div>
                      <FaUserTie className="text-primary me-1" size={14} />
                      <strong>Mentor:</strong>{" "}
                      {student.mentorName || "Not Assigned"}
                    </div>
                    <div>
                      <strong>Department:</strong> {student.department || "CS"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleEdit(student)}
                  title="Edit student"
                >
                  <FaEdit /> Edit
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteClick(student._id)}
                  title="Delete student"
                >
                  <FaTrash /> Delete
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
          <h5 className="mt-3 text-muted">Loading students...</h5>
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
            Student Management
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              as={Link}
              to="/hod/bulk-upload"
              variant="primary"
              title="Upload students in bulk"
            >
              <FaUpload className="me-1" /> Bulk Upload
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadAllData}
              title="Refresh student list"
            >
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Add/Edit Form */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">
              {editId ? (
                <FaEdit className="me-2" />
              ) : (
                <FaPlus className="me-2" />
              )}
              {editId ? "Edit Student" : "Add New Student"}
            </h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col xs={12} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Student Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={form.studentName}
                      onChange={(e) =>
                        setForm({ ...form, studentName: e.target.value })
                      }
                      required
                      placeholder="Enter student name"
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Roll Number</Form.Label>
                    <Form.Control
                      type="text"
                      value={form.rollNumber}
                      onChange={(e) =>
                        setForm({ ...form, rollNumber: e.target.value })
                      }
                      required
                      placeholder="Enter roll number"
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      required
                      placeholder="Enter email"
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Academic Year</Form.Label>
                    <Form.Select
                      value={form.academicYear}
                      onChange={(e) =>
                        setForm({ ...form, academicYear: e.target.value })
                      }
                      required
                    >
                      <option value="">Select Year</option>
                      <option>First Year</option>
                      <option>Second Year</option>
                      <option>Third Year</option>
                      <option>Final Year</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Semester</Form.Label>
                    <Form.Select
                      value={form.semester}
                      onChange={(e) =>
                        setForm({ ...form, semester: e.target.value })
                      }
                      required
                    >
                      <option value="">Select</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Section</Form.Label>
                    <Form.Select
                      value={form.section}
                      onChange={(e) =>
                        setForm({ ...form, section: e.target.value })
                      }
                      required
                    >
                      <option value="">Select</option>
                      {["A", "B", "C", "D"].map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Mentor</Form.Label>
                    <Form.Select
                      value={form.mentorName}
                      onChange={(e) =>
                        setForm({ ...form, mentorName: e.target.value })
                      }
                      required
                    >
                      <option value="">Select Mentor</option>
                      {mentors.map((mentor) => (
                        <option
                          key={mentor._id || mentor.facultyName}
                          value={mentor.facultyName}
                        >
                          {mentor.facultyName}
                          {mentor.roleType ? ` (${mentor.roleType})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Department</Form.Label>
                    <Form.Select
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    >
                      {departments.map((department) => (
                        <option key={department.code} value={department.code}>
                          {department.code}
                        </option>
                      ))}
                      {departments.length === 0 && (
                        <option value="CS">CS</option>
                      )}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={2} className="d-flex align-items-end">
                  <div className="d-flex gap-2 w-100">
                    <Button
                      variant="primary"
                      type="submit"
                      className="flex-grow-1"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Saving...
                        </>
                      ) : (
                        <>
                          {editId ? (
                            <FaEdit className="me-1" />
                          ) : (
                            <FaPlus className="me-1" />
                          )}
                          {editId ? "Update" : "Add Student"}
                        </>
                      )}
                    </Button>
                    {editId && (
                      <Button variant="outline-secondary" onClick={resetForm}>
                        <FaTrash className="me-1" /> Cancel
                      </Button>
                    )}
                  </div>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {/* Filter Section */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaFilter className="me-2" /> Filter Students
            </h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Semester</Form.Label>
                  <Form.Select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    size="sm"
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
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    size="sm"
                  >
                    <option value="">All</option>
                    {["A", "B", "C", "D"].map((section) => (
                      <option key={section} value={section}>
                        Sec {section}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Mentor</Form.Label>
                  <Form.Select
                    value={filterMentor}
                    onChange={(e) => setFilterMentor(e.target.value)}
                    size="sm"
                  >
                    <option value="">All Mentors</option>
                    {mentors.map((mentor) => (
                      <option
                        key={mentor.facultyName}
                        value={mentor.facultyName}
                      >
                        {mentor.facultyName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Department</Form.Label>
                  <Form.Select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    size="sm"
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
                    Search by Roll Number
                  </Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      type="text"
                      placeholder="Enter roll number..."
                      value={searchUSN}
                      onChange={(e) => setSearchUSN(e.target.value)}
                    />
                    {searchUSN && (
                      <Button
                        variant="outline-secondary"
                        onClick={() => setSearchUSN("")}
                      >
                        <FaTimesCircle />
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col xs={12} md={2}>
                <div className="d-flex gap-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-grow-1"
                    onClick={applyFilters}
                  >
                    <FaSearch className="me-1" /> Apply
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearFilters}
                    title="Clear all filters"
                  >
                    <FaTimes />
                  </Button>
                </div>
              </Col>
            </Row>
            <div className="mt-2">
              <span className="text-muted small">
                <FaInfoCircle className="me-1" />
                Showing <strong>{filteredStudents.length}</strong> of{" "}
                <strong>{students.length}</strong> students
                {filterSemester && (
                  <Badge bg="info" className="ms-1">
                    Sem {filterSemester}
                  </Badge>
                )}
                {filterSection && (
                  <Badge bg="info" className="ms-1">
                    Sec {filterSection}
                  </Badge>
                )}
                {filterMentor && (
                  <Badge bg="info" className="ms-1">
                    Mentor: {filterMentor}
                  </Badge>
                )}
                {searchUSN && (
                  <Badge bg="info" className="ms-1">
                    Roll: {searchUSN}
                  </Badge>
                )}
              </span>
            </div>
          </Card.Body>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedStudents.length > 0 && (
          <div className="bg-light p-2 rounded d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="fw-bold">
              <FaCheckCircle className="text-success me-1" />
              {selectedStudents.length} student(s) selected
            </span>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleBulkDelete}
              title="Delete selected students"
            >
              <FaTrash className="me-1" /> Delete Selected
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleBulkMentorUpdate}
              title="Update mentor for selected students"
            >
              <FaUserCog className="me-1" /> Change Mentor
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

        {/* Students Table / Cards */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <FaUsers className="me-2" /> Students List
            </h5>
            {filteredStudents.length > 0 && (
              <Form.Check
                type="checkbox"
                className="text-white"
                label={`Select All (${filteredStudents.length})`}
                onChange={handleSelectAll}
                checked={
                  selectedStudents.length === filteredStudents.length &&
                  filteredStudents.length > 0
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
                            selectedStudents.length ===
                              filteredStudents.length &&
                            filteredStudents.length > 0
                          }
                        />
                      </th>
                      <th>#</th>
                      <th>Name</th>
                      <th>Roll</th>
                      <th>Email</th>
                      <th>Year</th>
                      <th>Sem</th>
                      <th>Section</th>
                      <th>Mentor</th>
                      <th>Department</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td
                          colSpan="11"
                          className="text-center py-4 text-muted"
                        >
                          <FaInfoCircle size={24} className="mb-2 d-block" />
                          No students found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      /* ✅ CHANGED: uses visibleStudents */
                      visibleStudents.map((student, index) => (
                        <tr key={student._id}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedStudents.includes(student._id)}
                              onChange={() => handleSelectStudent(student._id)}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{student.studentName}</strong>
                          </td>
                          <td>
                            <Badge bg="secondary">{student.rollNumber}</Badge>
                          </td>
                          <td>{student.email}</td>
                          <td>{student.academicYear}</td>
                          <td>{student.semester}</td>
                          <td>{student.section}</td>
                          <td>{student.mentorName || "Not Assigned"}</td>
                          <td>{student.department || "CS"}</td>
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1 flex-wrap">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleEdit(student)}
                                title="Edit student"
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteClick(student._id)}
                                title="Delete student"
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

            {/* ✅ ADDED: Show All / Show Less toggle */}
            {filteredStudents.length > INITIAL_LIMIT && (
              <div className="text-center py-3 border-top">
                {!showAll ? (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setShowAll(true)}
                  >
                    <FaChevronDown className="me-1" />
                    Show All ({hiddenStudentCount} more)
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
          {filteredStudents.length > 0 && (
            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" />
                  Showing {visibleStudents.length} of {filteredStudents.length}{" "}
                  students
                </small>
                <div className="d-flex gap-2">
                  <Badge bg="primary">
                    <FaUsers className="me-1" />
                    {students.length} Total
                  </Badge>
                  {selectedStudents.length > 0 && (
                    <Badge bg="success">
                      <FaCheckCircle className="me-1" />
                      {selectedStudents.length} Selected
                    </Badge>
                  )}
                </div>
              </div>
            </Card.Footer>
          )}
        </Card>
      </Container>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setDeleteTargetId(null);
        }}
        onConfirm={
          deleteTargetId ? handleConfirmDelete : handleConfirmBulkDelete
        }
        title={deleteTargetId ? "Delete Student" : "Delete Selected Students"}
        message={
          deleteTargetId
            ? "Are you sure you want to delete this student? This action cannot be undone."
            : `Are you sure you want to delete ${selectedStudents.length} selected student(s)? This action cannot be undone.`
        }
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />

      {/* Bulk Mentor Update Modal */}
      <Modal
        show={showBulkMentorModal}
        onHide={() => setShowBulkMentorModal(false)}
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaUserCog className="me-2" />
            Change Mentor for Selected Students
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{selectedStudents.length}</strong> student(s) selected.
            Select a new mentor for all selected students.
          </p>
          <Form.Group>
            <Form.Label className="fw-bold">Select Mentor</Form.Label>
            <Form.Select
              value={bulkMentor}
              onChange={(e) => setBulkMentor(e.target.value)}
            >
              <option value="">Select Mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor.facultyName} value={mentor.facultyName}>
                  {mentor.facultyName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBulkMentorModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmBulkMentorUpdate}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <>
                <Spinner size="sm" className="me-2" /> Updating...
              </>
            ) : (
              <>
                <FaUserCheck className="me-1" /> Update Mentors
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

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

export default StudentManagementPage;
