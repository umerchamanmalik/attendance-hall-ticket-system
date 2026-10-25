import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  FaUserGraduate,
  FaBook,
  FaChalkboardTeacher,
  FaPlus,
  FaEdit,
  FaTrash,
  FaFilter,
  FaSearch,
  FaTimes,
  FaSync,
  FaInfoCircle,
  FaUpload,
  FaUserCheck,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaEnvelope,
  FaTimesCircle,
} from "react-icons/fa";
import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const INITIAL_LIMIT = 10;

const AllocateFacultyPage = () => {
  const location = useLocation();
  const toast = useToast();

  const queryParams = new URLSearchParams(location.search);
  const semesterFromUrl = queryParams.get("semester");

  const [form, setForm] = useState({
    academicYear: "",
    semester: semesterFromUrl || "",
    section: "",
    subjectName: "",
    facultyEmail: "", // ✅ NEW: Email field replaces pre-create form
    facultyName: "",
    facultyUserId: "",
    roleType: "Faculty",
    department: "CS",
  });
  const [allocations, setAllocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [editId, setEditId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(
    semesterFromUrl || "",
  );
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ✅ NEW: Email check state
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailCheckResult, setEmailCheckResult] = useState(null);

  // Bulk Delete
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [facultySearchTerm, setFacultySearchTerm] = useState("");
  const [filteredFacultyUsers, setFilteredFacultyUsers] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadAllocations = async () => {
    try {
      const response = await api.get("/allocations");
      if (response.data.success) {
        setAllocations(response.data.data || []);
      }
    } catch (error) {
      console.error("Error loading allocations:", error);
      setError(error.response?.data?.error || "Unable to load allocations.");
      toast.error(error.response?.data?.error || "Unable to load allocations.");
    }
  };

  const loadFacultyUsers = async () => {
    try {
      const response = await api.get("/allocations/users");
      if (response.data.success) {
        setFacultyUsers(response.data.data || []);
      }
    } catch (error) {
      console.error("Error loading faculty users:", error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAllocations(), loadFacultyUsers()]);
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

  // ✅ NEW: Check email on blur — auto-fill name if faculty exists
  const handleEmailCheck = async (email) => {
    if (!email || !email.includes("@") || email.length < 5) {
      setEmailCheckResult(null);
      return;
    }

    setEmailCheckLoading(true);
    try {
      // Check if user exists
      const response = await api.get(
        `/auth/check-registration?email=${encodeURIComponent(email)}`,
      );

      if (response.data.success && response.data.data.exists) {
        const user = response.data.data;
        setEmailCheckResult({
          exists: true,
          name: user.name,
          role: user.role,
          facultyStatus: user.facultyStatus,
          assignedRoleType: user.assignedRoleType,
          department: user.department,
        });

        // ✅ Auto-fill name
        if (user.name) {
          setForm((prev) => ({ ...prev, facultyName: user.name }));
        }

        // ✅ Auto-fill role type if faculty
        if (user.assignedRoleType) {
          setForm((prev) => ({
            ...prev,
            roleType: user.assignedRoleType,
          }));
        }

        // ✅ Auto-fill department
        if (user.department) {
          setForm((prev) => ({ ...prev, department: user.department }));
        }

        // ✅ Find matching faculty user for facultyUserId
        const matchingUser = facultyUsers.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (matchingUser) {
          setForm((prev) => ({
            ...prev,
            facultyUserId: matchingUser._id,
          }));
        }
      } else {
        // ✅ New email → will auto-create on submit
        setEmailCheckResult({
          exists: false,
          isNew: true,
        });
      }
    } catch (err) {
      console.error("Email check error:", err);
      setEmailCheckResult({ exists: false, isNew: true });
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const uniqueSubjects = [
    ...new Set(allocations.map((a) => a.subjectName).filter(Boolean)),
  ];

  const filteredAllocations = allocations.filter((allocation) => {
    let match = true;
    if (selectedSemester) {
      match = match && allocation.semester === parseInt(selectedSemester);
    }
    if (selectedSection) {
      match = match && allocation.section === selectedSection;
    }
    if (selectedSubject) {
      match = match && allocation.subjectName === selectedSubject;
    }
    if (selectedDepartment) {
      match = match && (allocation.department || "CS") === selectedDepartment;
    }
    if (selectedFaculty) {
      const faculty = facultyUsers.find((f) => f._id === selectedFaculty);
      match = match && allocation.facultyName === faculty?.name;
    }
    return match;
  });

  const visibleAllocations = showAll
    ? filteredAllocations
    : filteredAllocations.slice(0, INITIAL_LIMIT);
  const hiddenCount = Math.max(0, filteredAllocations.length - INITIAL_LIMIT);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAllocations(filteredAllocations.map((a) => a._id));
    } else {
      setSelectedAllocations([]);
    }
  };

  const handleSelectAllocation = (id) => {
    setSelectedAllocations((prev) =>
      prev.includes(id) ? prev.filter((aid) => aid !== id) : [...prev, id],
    );
  };

  const clearSelection = () => {
    setSelectedAllocations([]);
  };

  const handleBulkDelete = () => {
    if (selectedAllocations.length === 0) {
      toast.warning("Please select at least one allocation.");
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedAllocations.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of selectedAllocations) {
        try {
          await api.delete(`/allocations/${id}`);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }
      toast.success(
        `${successCount} allocation(s) deleted successfully${failCount > 0 ? `, ${failCount} failed.` : "."}`,
      );
      setSelectedAllocations([]);
      setShowBulkDeleteConfirm(false);
      await loadAllocations();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to delete allocations.");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleFacultySearch = (e) => {
    const term = e.target.value;
    setFacultySearchTerm(term);
    if (term.length > 0) {
      const filtered = facultyUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(term.toLowerCase()) ||
          user.email?.toLowerCase().includes(term.toLowerCase()),
      );
      setFilteredFacultyUsers(filtered.slice(0, 10));
    } else {
      setFilteredFacultyUsers([]);
    }
  };

  const selectFaculty = (faculty) => {
    setSelectedFaculty(faculty._id);
    setFacultySearchTerm(faculty.name);
    setFilteredFacultyUsers([]);
  };

  const clearFacultyFilter = () => {
    setSelectedFaculty("");
    setFacultySearchTerm("");
    setFilteredFacultyUsers([]);
  };

  // ✅ UPDATED: Submit handler now handles email → auto-create
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    if (!form.academicYear || !form.semester || !form.section) {
      toast.warning("Please fill Academic Year, Semester, and Section.");
      return;
    }
    if (!form.subjectName) {
      toast.warning("Please enter Subject Name.");
      return;
    }
    if (!form.facultyEmail || !form.facultyEmail.includes("@")) {
      toast.warning("Please enter a valid Faculty Email.");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ Step 1: If email is NEW (doesn't exist), pre-create the faculty record first
      let facultyUserId = form.facultyUserId;
      let finalFacultyName = form.facultyName;

      if (!facultyUserId && emailCheckResult?.isNew) {
        // Pre-create the faculty User record
        try {
          const createRes = await api.post("/allocations/faculty/pre-create", {
            name: form.facultyName || form.facultyEmail.split("@")[0],
            email: form.facultyEmail,
            department: form.department,
            roleType: form.roleType,
          });
          if (createRes.data.success) {
            facultyUserId = createRes.data.data.id;
            finalFacultyName = createRes.data.data.name;
            toast.info(
              `✅ Faculty account created for ${form.facultyEmail}. They can register anytime with this email.`,
            );
          }
        } catch (createErr) {
          // If creation fails because email exists, try to fetch it
          if (createErr.response?.status === 409) {
            const checkRes = await api.get(
              `/auth/check-registration?email=${encodeURIComponent(form.facultyEmail)}`,
            );
            if (checkRes.data.data?.exists) {
              const allUsers = await api.get("/allocations/users");
              const matchingUser = (allUsers.data.data || []).find(
                (u) =>
                  u.email?.toLowerCase() === form.facultyEmail.toLowerCase(),
              );
              if (matchingUser) {
                facultyUserId = matchingUser._id;
                finalFacultyName = matchingUser.name;
              }
            }
          } else {
            throw createErr;
          }
        }
      }

      // ✅ Step 2: Create or update the allocation
      const allocationPayload = {
        ...form,
        facultyUserId: facultyUserId || null,
        facultyName: finalFacultyName || form.facultyName,
      };

      if (editId) {
        await api.put(`/allocations/${editId}`, allocationPayload);
        toast.success("Allocation updated successfully.");
      } else {
        const response = await api.post("/allocations", allocationPayload);
        if (response.data.wasPending) {
          toast.success(
            response.data.message ||
              "✅ Faculty approved and assigned successfully!",
          );
        } else {
          toast.success("Allocation created successfully.");
        }
      }

      // Reset form
      setForm({
        academicYear: "",
        semester: "",
        section: "",
        subjectName: "",
        facultyEmail: "",
        facultyName: "",
        facultyUserId: "",
        roleType: "Faculty",
        department: form.department,
      });
      setEditId(null);
      setEmailCheckResult(null);
      await loadAllData();
    } catch (error) {
      console.error("Error saving allocation:", error);
      const validationMessages = error.response?.data?.errors
        ?.map((item) => item.msg)
        .join(", ");
      toast.error(
        error.response?.data?.error ||
          validationMessages ||
          "Unable to save allocation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (allocation) => {
    setForm({
      academicYear: allocation.academicYear,
      semester: allocation.semester,
      section: allocation.section,
      subjectName: allocation.subjectName,
      facultyEmail: allocation.facultyEmail || "",
      facultyName: allocation.facultyName,
      facultyUserId: allocation.facultyUserId || "",
      roleType: allocation.roleType,
      department: allocation.department || "CS",
    });
    setEditId(allocation._id);
    setEmailCheckResult({ exists: true, name: allocation.facultyName });
  };

  const executeDelete = async (id) => {
    try {
      await api.delete(`/allocations/${id}`);
      toast.success("Allocation deleted successfully.");
      await loadAllData();
    } catch (error) {
      console.error("Error deleting allocation:", error);
      toast.error(
        error.response?.data?.error || "Unable to delete allocation.",
      );
    }
  };

  const handleDelete = (id) => {
    setConfirmation({
      title: "Delete Allocation",
      message: "Are you sure you want to delete this allocation?",
      confirmLabel: "Delete",
      confirmVariant: "danger",
      onConfirm: () => executeDelete(id),
    });
  };

  const executeDeleteAll = async () => {
    setDeletingAll(true);
    try {
      let url = "/allocations/all";
      const params = [];
      if (selectedSemester) params.push(`semester=${selectedSemester}`);
      if (selectedSection) params.push(`section=${selectedSection}`);
      if (params.length > 0) url += `?${params.join("&")}`;

      const response = await api.delete(url);
      toast.success(
        `${response.data.data?.deletedCount || filteredAllocations.length} allocations deleted successfully.`,
      );
      await loadAllData();
      clearFacultyFilter();
      setSelectedSemester("");
      setSelectedSection("");
      setSelectedSubject("");
      setSelectedAllocations([]);
    } catch (error) {
      console.error("Error deleting allocations:", error);
      toast.error(
        error.response?.data?.error || "Unable to delete allocations.",
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const handleSemesterFilterChange = (e) => {
    const value = e.target.value;
    setSelectedSemester(value);
    if (value) {
      setForm({ ...form, semester: value });
    }
  };

  const applyFilters = () => {
    setSelectedAllocations([]);
    setShowAll(false);
  };

  const getFacultyName = (id) => {
    const faculty = facultyUsers.find((f) => f._id === id);
    return faculty ? faculty.name : "";
  };

  const resetForm = () => {
    setForm({
      academicYear: "",
      semester: "",
      section: "",
      subjectName: "",
      facultyEmail: "",
      facultyName: "",
      facultyUserId: "",
      roleType: "Faculty",
      department: "CS",
    });
    setEditId(null);
    setEmailCheckResult(null);
  };

  const getRoleDisplayText = (user) => {
    if (user.assignedRoleType) return user.assignedRoleType;
    return user.role || "Faculty";
  };

  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {filteredAllocations.length === 0 ? (
        <Alert variant="info" className="text-center">
          No allocations found.
        </Alert>
      ) : (
        visibleAllocations.map((allocation, index) => (
          <Card key={allocation._id} className="mb-3 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      checked={selectedAllocations.includes(allocation._id)}
                      onChange={() => handleSelectAllocation(allocation._id)}
                      className="me-2"
                    />
                    <Badge bg="secondary">#{index + 1}</Badge>
                  </div>
                  <div className="mt-2">
                    <div>
                      <FaBook className="text-primary me-1" size={14} />
                      <strong>Subject:</strong> {allocation.subjectName}
                    </div>
                    <div>
                      <FaUserGraduate className="text-primary me-1" size={14} />
                      <strong>Faculty:</strong> {allocation.facultyName}
                    </div>
                    <div>
                      <FaBook className="text-primary me-1" size={14} />
                      <strong>Year:</strong> {allocation.academicYear} |{" "}
                      <strong>Sem:</strong> {allocation.semester} |{" "}
                      <strong>Sec:</strong> {allocation.section}
                    </div>
                    <div>
                      <Badge
                        bg={
                          allocation.roleType === "Both"
                            ? "primary"
                            : allocation.roleType === "Mentor"
                              ? "info"
                              : "secondary"
                        }
                      >
                        {allocation.roleType}
                      </Badge>
                    </div>
                    <div>
                      <strong>Department:</strong>{" "}
                      {allocation.department || "CS"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleEdit(allocation)}
                >
                  <FaEdit /> Edit
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDelete(allocation._id)}
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
          <p className="mt-3 text-muted">Loading allocations...</p>
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
            <FaBook className="me-2 text-primary" />
            Subject Faculty Allocation
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Link
              to="/hod/bulk-upload"
              className="btn btn-primary"
              title="Bulk upload allocations"
            >
              <FaUpload className="me-1" /> Bulk Upload
            </Link>
            <Button variant="outline-secondary" size="sm" onClick={loadAllData}>
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* ✅ Info Alert */}
        <Alert variant="info" className="mb-3">
          <FaInfoCircle className="me-2" />
          <strong>How it works:</strong>
          <ol className="mb-0 mt-2 ps-3 small">
            <li>
              Enter the <strong>faculty's email</strong> in the form below.
            </li>
            <li>
              If the email <strong>already exists</strong>, their name
              auto-fills.
            </li>
            <li>
              If the email is <strong>new</strong>, a faculty account is
              auto-created. They can register later with this email.
            </li>
            <li>
              On registration, faculty get <strong>instant access</strong> with
              the role you assign here.
            </li>
          </ol>
        </Alert>

        {/* ✅ UPDATED: Single Add/Edit Form with Email Field */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">
              {editId ? (
                <FaEdit className="me-2" />
              ) : (
                <FaPlus className="me-2" />
              )}
              {editId ? "Edit Allocation" : "Add New Allocation"}
            </h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
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
                <Col xs={12} md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Role</Form.Label>
                    <Form.Select
                      value={form.roleType}
                      onChange={(e) =>
                        setForm({ ...form, roleType: e.target.value })
                      }
                    >
                      <option value="Faculty">Faculty</option>
                      <option value="Mentor">Mentor</option>
                      <option value="Both">Both</option>
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

                {/* ✅ NEW: Email field (primary) */}
                <Col xs={12} md={4}>
                  <Form.Group>
                    <Form.Label className="fw-bold">
                      <FaEnvelope className="me-1" />
                      Faculty Email <span className="text-danger">*</span>
                    </Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="email"
                        value={form.facultyEmail}
                        onChange={(e) => {
                          setForm({ ...form, facultyEmail: e.target.value });
                          setEmailCheckResult(null);
                          setForm((prev) => ({
                            ...prev,
                            facultyUserId: "",
                            facultyName: "",
                          }));
                        }}
                        onBlur={(e) => handleEmailCheck(e.target.value)}
                        required
                        placeholder="faculty@college.edu"
                      />
                      {emailCheckLoading && (
                        <InputGroup.Text>
                          <Spinner size="sm" animation="border" />
                        </InputGroup.Text>
                      )}
                      {emailCheckResult?.exists && (
                        <InputGroup.Text className="text-success">
                          <FaCheckCircle />
                        </InputGroup.Text>
                      )}
                      {emailCheckResult?.isNew && (
                        <InputGroup.Text className="text-info">
                          <FaPlus />
                        </InputGroup.Text>
                      )}
                    </InputGroup>
                    {emailCheckResult?.exists && (
                      <Form.Text className="text-success small">
                        ✅ Faculty found:{" "}
                        <strong>{emailCheckResult.name}</strong>
                        {emailCheckResult.facultyStatus === "pending" && (
                          <Badge bg="warning" text="dark" className="ms-2">
                            ⏳ Pending Registration
                          </Badge>
                        )}
                        {emailCheckResult.facultyStatus === "approved" && (
                          <Badge bg="success" className="ms-2">
                            ✅ Active
                          </Badge>
                        )}
                      </Form.Text>
                    )}
                    {emailCheckResult?.isNew && (
                      <Form.Text className="text-info small">
                        🆕 New faculty — account will be created automatically
                        on submit.
                      </Form.Text>
                    )}
                    {!emailCheckResult && !emailCheckLoading && (
                      <Form.Text className="text-muted small">
                        Enter email. Existing faculty auto-fill; new emails get
                        auto-created.
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>

                {/* ✅ NEW: Name field (auto-filled from email) */}
                <Col xs={12} md={3}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Faculty Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={form.facultyName}
                      onChange={(e) =>
                        setForm({ ...form, facultyName: e.target.value })
                      }
                      placeholder="Auto-filled or enter manually"
                    />
                    <Form.Text className="text-muted small">
                      Auto-filled if email exists
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col xs={12} md={5}>
                  <Form.Group>
                    <Form.Label className="fw-bold">Subject Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={form.subjectName}
                      onChange={(e) =>
                        setForm({ ...form, subjectName: e.target.value })
                      }
                      required
                      placeholder="Enter subject name"
                    />
                  </Form.Group>
                </Col>

                <Col xs={12} className="d-flex gap-2">
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
                        {editId ? "Update Allocation" : "Allocate"}
                      </>
                    )}
                  </Button>
                  {editId && (
                    <Button variant="outline-secondary" onClick={resetForm}>
                      <FaTimes className="me-1" /> Cancel
                    </Button>
                  )}
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {/* Filter Section */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light">
            <h5 className="mb-0">
              <FaFilter className="me-2" /> Filter Allocations
            </h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Semester</Form.Label>
                  <Form.Select
                    value={selectedSemester}
                    onChange={handleSemesterFilterChange}
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
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
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
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label className="fw-bold small">Subject</Form.Label>
                  <Form.Select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    size="sm"
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
                  <Form.Label className="fw-bold small">Department</Form.Label>
                  <Form.Select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
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
                    Filter by Faculty
                  </Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      size="sm"
                      placeholder="Search faculty name..."
                      value={facultySearchTerm}
                      onChange={handleFacultySearch}
                    />
                    {selectedFaculty && (
                      <span
                        className="position-absolute top-50 end-0 translate-middle-y me-2 text-danger"
                        style={{ cursor: "pointer" }}
                        onClick={clearFacultyFilter}
                      >
                        <FaTimes />
                      </span>
                    )}
                    {filteredFacultyUsers.length > 0 && (
                      <div
                        className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm"
                        style={{
                          zIndex: 1000,
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                      >
                        {filteredFacultyUsers.map((faculty) => (
                          <div
                            key={faculty._id}
                            className="p-2 hover-bg-light"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "white")
                            }
                            onClick={() => selectFaculty(faculty)}
                          >
                            <strong>{faculty.name}</strong>
                            <span className="text-muted ms-2 small">
                              ({getRoleDisplayText(faculty)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedFaculty && (
                    <small className="text-success">
                      Filtering by:{" "}
                      <strong>{getFacultyName(selectedFaculty)}</strong>
                    </small>
                  )}
                </Form.Group>
              </Col>
              <Col xs={12} md={3}>
                <div className="d-flex align-items-center h-100">
                  <span className="text-muted small">
                    <FaInfoCircle className="me-1" />
                    Showing <strong>{filteredAllocations.length}</strong>{" "}
                    allocations
                  </span>
                </div>
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
                    onClick={() => {
                      setSelectedSemester("");
                      setSelectedSection("");
                      setSelectedSubject("");
                      clearFacultyFilter();
                      setSelectedAllocations([]);
                      setShowAll(false);
                    }}
                  >
                    <FaTimes />
                  </Button>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedAllocations.length > 0 && (
          <div className="bg-light p-2 rounded d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="fw-bold">
              <FaCheckCircle className="text-success me-1" />
              {selectedAllocations.length} allocation(s) selected
            </span>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleBulkDelete}
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

        {/* Allocations Table / Cards */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <FaChalkboardTeacher className="me-2" /> Allocations List
            </h5>
            {filteredAllocations.length > 0 && (
              <Form.Check
                type="checkbox"
                className="text-white"
                label={`Select All (${filteredAllocations.length})`}
                onChange={handleSelectAll}
                checked={
                  selectedAllocations.length === filteredAllocations.length &&
                  filteredAllocations.length > 0
                }
              />
            )}
          </Card.Header>
          <Card.Body className="p-0">
            {isMobile ? (
              renderMobileCards()
            ) : (
              <div className="table-responsive d-none d-md-block">
                <Table bordered hover className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: "5%" }}>
                        <Form.Check
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={
                            selectedAllocations.length ===
                              filteredAllocations.length &&
                            filteredAllocations.length > 0
                          }
                        />
                      </th>
                      <th>#</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Section</th>
                      <th>Subject</th>
                      <th>Faculty</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocations.length === 0 ? (
                      <tr>
                        <td
                          colSpan="10"
                          className="text-center py-4 text-muted"
                        >
                          <FaInfoCircle size={24} className="mb-2 d-block" />
                          No allocations found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      visibleAllocations.map((allocation, index) => (
                        <tr key={allocation._id}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedAllocations.includes(
                                allocation._id,
                              )}
                              onChange={() =>
                                handleSelectAllocation(allocation._id)
                              }
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>{allocation.academicYear}</td>
                          <td>{allocation.semester}</td>
                          <td>{allocation.section}</td>
                          <td>
                            <strong>{allocation.subjectName}</strong>
                          </td>
                          <td>{allocation.facultyName}</td>
                          <td>
                            <Badge
                              bg={
                                allocation.roleType === "Both"
                                  ? "primary"
                                  : allocation.roleType === "Mentor"
                                    ? "info"
                                    : "secondary"
                              }
                            >
                              {allocation.roleType}
                            </Badge>
                          </td>
                          <td>{allocation.department || "CS"}</td>
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1 flex-wrap">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleEdit(allocation)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDelete(allocation._id)}
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

            {filteredAllocations.length > INITIAL_LIMIT && (
              <div className="text-center py-3 border-top">
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
          {filteredAllocations.length > 0 && (
            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" />
                  Showing {visibleAllocations.length} of{" "}
                  {filteredAllocations.length} allocations
                </small>
                <div className="d-flex gap-2">
                  <Badge bg="secondary">
                    <FaUserCheck className="me-1" />
                    {facultyUsers.length} Faculty
                  </Badge>
                  {selectedAllocations.length > 0 && (
                    <Badge bg="success">
                      <FaCheckCircle className="me-1" />
                      {selectedAllocations.length} Selected
                    </Badge>
                  )}
                </div>
              </div>
            </Card.Footer>
          )}
        </Card>
      </Container>

      <ConfirmDialog
        show={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel || "Confirm"}
        confirmVariant={confirmation?.confirmVariant || "primary"}
        busy={deletingAll}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => {
          const onConfirm = confirmation?.onConfirm;
          setConfirmation(null);
          await onConfirm?.();
        }}
      />

      <ConfirmDialog
        show={showBulkDeleteConfirm}
        onHide={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Selected Allocations"
        message={`Are you sure you want to delete ${selectedAllocations.length} selected allocation(s)? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
        loading={bulkDeleteLoading}
      />

      <ToastNotification
        show={toast.toast?.show || false}
        message={toast.toast?.message || ""}
        variant={toast.toast?.variant || "success"}
        onClose={toast.hideToast}
      />
    </>
  );
};

export default AllocateFacultyPage;
