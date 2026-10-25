import React, { useState, useEffect } from "react";
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
  Modal,
  Form,
} from "react-bootstrap";
import {
  FaFileAlt,
  FaUpload,
  FaEdit,
  FaTrash,
  FaEye,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaBook,
  FaUserGraduate,
  FaSync,
  FaPlus,
  FaFilePdf,
  FaFileImage,
  FaFile,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";

const StudentDocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState("leave");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const toast = useToast();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Confirm Dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Leave Application fields
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");

  // Attendance Correction fields
  const [attendanceDates, setAttendanceDates] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectAllSubjects, setSelectAllSubjects] = useState(false);
  const [subjectLoading, setSubjectLoading] = useState(false);

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const baseUrl = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api$/, "")
    : "http://localhost:5000";

  // Load student's subjects
  const loadSubjects = async () => {
    setSubjectLoading(true);
    try {
      const response = await api.get("/documents/subjects");
      console.log("📊 Subjects response:", response.data);

      if (response.data.success) {
        setAvailableSubjects(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to load subjects");
      }
    } catch (error) {
      console.error("Error loading subjects:", error);
      toast.warning(error.response?.data?.error || "Failed to load subjects");
    } finally {
      setSubjectLoading(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/documents");

      if (response.data.success) {
        setDocuments(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to load documents");
      }
    } catch (error) {
      console.error("Error loading documents:", error);
      setError(error.response?.data?.error || "Failed to load documents");
      toast.error(error.response?.data?.error || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadSubjects();
  }, []);

  // ✅ FIXED: Only select REAL ObjectId subject IDs (24-char hex)
  const isRealObjectId = (val) =>
    typeof val === "string" && /^[a-f0-9]{24}$/i.test(val);

  const handleSubjectToggle = (subjectId) => {
    const idStr = String(subjectId);
    setSelectedSubjects((prev) => {
      const next = prev.includes(idStr)
        ? prev.filter((id) => id !== idStr)
        : [...prev, idStr];

      const allIds = availableSubjects
        .map((s) => s.subjectId?._id || s._id || s.id)
        .filter((id) => id && isRealObjectId(String(id)))
        .map((id) => String(id));

      if (next.length === 0) setSelectAllSubjects(false);
      else if (next.length === allIds.length) setSelectAllSubjects(true);
      else setSelectAllSubjects(false);

      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectAllSubjects) {
      setSelectedSubjects([]);
      setSelectAllSubjects(false);
    } else {
      const allSubjectIds = availableSubjects
        .map((s) => s.subjectId?._id || s._id || s.id)
        .filter((id) => id && isRealObjectId(String(id)))
        .map((id) => String(id));
      setSelectedSubjects(allSubjectIds);
      setSelectAllSubjects(true);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    const normalizedType =
      documentType === "leave" ? "leave" : "attendance-correction";

    formData.append("documentType", normalizedType);
    formData.append("description", description);

    if (normalizedType === "attendance-correction") {
      if (!attendanceDates) {
        toast.warning("❌ Please enter at least one attendance date.");
        return;
      }

      const datesArray = attendanceDates
        .split(/[,\n]/)
        .map((d) => d.trim())
        .filter(Boolean);

      if (datesArray.length === 0) {
        toast.warning("❌ Please enter at least one valid date.");
        return;
      }

      datesArray.forEach((date) => {
        formData.append("dates", date.trim());
      });

      if (selectedSubjects.length > 0) {
        selectedSubjects.forEach((subjectId) => {
          formData.append("subjects", subjectId);
        });
      }

      if (file) {
        formData.append("file", file);
      }
    } else {
      if (!leaveStartDate) {
        toast.warning("❌ Please select the leave start date.");
        return;
      }
      if (!leaveEndDate) {
        toast.warning("❌ Please select the leave end date.");
        return;
      }

      formData.append("leaveStartDate", leaveStartDate);
      formData.append("leaveEndDate", leaveEndDate);

      const startDate = new Date(leaveStartDate).toLocaleDateString();
      const endDate = new Date(leaveEndDate).toLocaleDateString();
      formData.set(
        "description",
        `${description} (Leave from ${startDate} to ${endDate})`,
      );
    }

    setSubmitting(true);
    try {
      const response = await api.post("/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        response.data.message || "✅ Document uploaded successfully.",
      );

      // Reset form
      setDescription("");
      setFile(null);
      setAttendanceDates("");
      setLeaveStartDate("");
      setLeaveEndDate("");
      setSelectedSubjects([]);
      setSelectAllSubjects(false);
      const fileInput = document.getElementById("fileInput");
      if (fileInput) {
        fileInput.value = "";
      }
      await loadDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(error.response?.data?.error || "Unable to upload document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        documentType: editingDoc.documentType,
        description: editingDoc.description,
      };

      if (editingDoc.documentType === "attendance-correction") {
        updatedData.priorPermission = editingDoc.priorPermission || false;
        if (editingDoc.dates && editingDoc.dates.length > 0) {
          updatedData.dates = editingDoc.dates;
        }
        if (editingDoc.subjects && editingDoc.subjects.length > 0) {
          updatedData.subjects = editingDoc.subjects.map((s) => s._id || s);
        }
      }

      if (editingDoc.documentType === "leave") {
        if (editingDoc.leaveStartDate) {
          updatedData.leaveStartDate = editingDoc.leaveStartDate;
        }
        if (editingDoc.leaveEndDate) {
          updatedData.leaveEndDate = editingDoc.leaveEndDate;
        }
      }

      const response = await api.put(
        `/documents/edit/${editingDoc._id}`,
        updatedData,
      );

      toast.success(
        response.data.message || "✅ Document updated successfully.",
      );
      setShowEditModal(false);
      setEditingDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error(error.response?.data?.error || "Unable to update document.");
    }
  };

  const handleDeleteClick = (docId) => {
    setDeleteTargetId(docId);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      const response = await api.delete(`/documents/delete/${deleteTargetId}`);
      toast.success(
        response.data.message || "✅ Document deleted successfully.",
      );
      setShowConfirm(false);
      setDeleteTargetId(null);
      await loadDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(error.response?.data?.error || "Unable to delete document.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status, overallStatus, documentType) => {
    if (documentType === "leave" && status === "mentor-approved") {
      return <Badge bg="success">✅ Completed</Badge>;
    }

    if (
      documentType === "attendance-correction" &&
      status === "mentor-approved"
    ) {
      return <Badge bg="info">⏳ Under Faculty Review</Badge>;
    }

    const displayStatus = overallStatus || status;
    const variants = {
      pending: "warning",
      "mentor-approved": "info",
      "mentor-rejected": "danger",
      "faculty-approved": "primary",
      completed: "success",
      "Pending Mentor Review": "warning",
      "Pending Faculty Review": "info",
      Pending: "warning",
      Approved: "success",
      Rejected: "danger",
      Completed: "success",
    };

    const labels = {
      pending: "⏳ Pending Mentor Review",
      "mentor-approved": "⏳ Under Faculty Review",
      "mentor-rejected": "❌ Rejected by Mentor",
      "faculty-approved": "⏳ Faculty Processing",
      completed: "✅ Completed",
      "Pending Mentor Review": "⏳ Pending Mentor Review",
      "Pending Faculty Review": "⏳ Pending Faculty Review",
      Pending: "⏳ Pending",
      Approved: "✅ Approved",
      Rejected: "❌ Rejected",
      Completed: "✅ Completed",
    };

    return (
      <Badge bg={variants[displayStatus] || "secondary"}>
        {labels[displayStatus] || displayStatus}
      </Badge>
    );
  };

  const openEditModal = (doc) => {
    setEditingDoc({
      ...doc,
      leaveStartDate: doc.leaveStartDate
        ? new Date(doc.leaveStartDate).toISOString().split("T")[0]
        : "",
      leaveEndDate: doc.leaveEndDate
        ? new Date(doc.leaveEndDate).toISOString().split("T")[0]
        : "",
    });
    setShowEditModal(true);
  };

  const handleDocumentTypeChange = (selectedType) => {
    setDocumentType(selectedType);
    setAttendanceDates("");
    setLeaveStartDate("");
    setLeaveEndDate("");
    setSelectedSubjects([]);
    setSelectAllSubjects(false);
    setFile(null);
    setDescription("");
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const getDisplayType = (doc) => {
    if (doc.documentType === "attendance-correction")
      return "Attendance Correction";
    if (doc.documentType === "leave") return "Leave Application";
    return doc.documentType;
  };

  const getDateDisplay = (doc) => {
    if (doc.documentType === "attendance-correction") {
      if (doc.dates && doc.dates.length > 0) {
        return doc.dates
          .map((date) => new Date(date).toLocaleDateString())
          .join(", ");
      }
      return doc.attendanceDate
        ? new Date(doc.attendanceDate).toLocaleDateString()
        : "-";
    }
    if (
      doc.documentType === "leave" &&
      doc.leaveStartDate &&
      doc.leaveEndDate
    ) {
      return `${new Date(doc.leaveStartDate).toLocaleDateString()} - ${new Date(
        doc.leaveEndDate,
      ).toLocaleDateString()}`;
    }
    return "-";
  };

  // ✅ FIXED: Show per-subject approval status if available
  const getSubjectsDisplay = (doc) => {
    if (doc.documentType !== "attendance-correction") return "-";

    // ✅ Prefer subjectApprovals (new per-subject tracking)
    if (doc.subjectApprovals && doc.subjectApprovals.length > 0) {
      return (
        <div>
          {doc.subjectApprovals.map((sa, idx) => (
            <div key={idx} className="d-flex align-items-center gap-1 small">
              <Badge
                bg={
                  sa.status === "Approved"
                    ? "success"
                    : sa.status === "Rejected"
                      ? "danger"
                      : "warning"
                }
              >
                {sa.status === "Approved"
                  ? "✅"
                  : sa.status === "Rejected"
                    ? "❌"
                    : "⏳"}{" "}
                {sa.subjectName}
              </Badge>
              {sa.status === "Rejected" && sa.remarks && (
                <small className="text-danger">
                  — {sa.remarks} ({sa.facultyName || "Faculty"})
                </small>
              )}
              {sa.status === "Approved" && sa.facultyName && (
                <small className="text-muted">— {sa.facultyName}</small>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Fallback to old rendering
    if (!doc.subjects || doc.subjects.length === 0) return "All Subjects";
    return doc.subjects
      .map((s) => {
        if (typeof s === "object") {
          return s.subjectName || s.name || s._id || s;
        }
        return s;
      })
      .join(", ");
  };

  const isEditable = (doc) => {
    return (
      doc.status === "pending" || doc.overallStatus === "Pending Mentor Review"
    );
  };

  const isDeletable = (doc) => {
    const status = doc.status || "";
    const documentType = doc.documentType || "";

    if (documentType === "leave" && status === "mentor-approved") {
      return true;
    }

    if (documentType === "attendance-correction" && status === "completed") {
      return true;
    }

    if (status === "pending") {
      return true;
    }

    return false;
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return <FaFile />;
    const ext = fileName.split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return <FaFilePdf className="text-danger" />;
    if (["jpg", "jpeg", "png", "gif"].includes(ext))
      return <FaFileImage className="text-success" />;
    return <FaFile />;
  };

  // ✅ Mobile Card View
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {documents.length === 0 ? (
        <div className="text-center py-4">
          <FaFileAlt size={24} className="mb-2 d-block text-muted" />
          <p className="text-muted">No documents uploaded yet.</p>
        </div>
      ) : (
        documents.map((doc, index) => (
          <Card key={doc._id} className="mb-3 shadow-sm border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Badge bg="secondary">#{index + 1}</Badge>
                    <Badge bg="secondary">{getDisplayType(doc)}</Badge>
                  </div>
                  <div className="small text-muted">
                    <div
                      className="text-truncate"
                      style={{ maxWidth: "200px" }}
                    >
                      <strong>Description:</strong> {doc.description}
                    </div>
                    {doc.fileName && (
                      <div>
                        <a
                          href={`${baseUrl}/uploads/documents/${doc.fileName}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-decoration-none"
                        >
                          {getFileIcon(doc.fileName)} View File
                        </a>
                      </div>
                    )}
                    <div>
                      <strong>Subjects:</strong> {getSubjectsDisplay(doc)}
                    </div>
                    <div>
                      <strong>Dates:</strong> {getDateDisplay(doc)}
                    </div>
                    <div className="mt-1">
                      {getStatusBadge(
                        doc.status,
                        doc.overallStatus,
                        doc.documentType,
                      )}
                    </div>
                    <div>
                      <strong>Remarks:</strong>{" "}
                      {doc.mentorRemarks ||
                        doc.facultyRemarks ||
                        doc.remarks ||
                        "-"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                {isEditable(doc) ? (
                  <>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => openEditModal(doc)}
                      title="Edit Document"
                    >
                      <FaEdit className="me-1" /> Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteClick(doc._id)}
                      title="Delete Document"
                    >
                      <FaTrash className="me-1" /> Delete
                    </Button>
                  </>
                ) : isDeletable(doc) ? (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteClick(doc._id)}
                    title="Delete Document"
                  >
                    <FaTrash className="me-1" /> Delete
                  </Button>
                ) : (
                  <span className="text-muted">-</span>
                )}
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
          <p className="mt-3 text-muted">Loading your documents...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaFileAlt className="me-2 text-primary" />
          My Documents
        </h2>

        {/* Upload Document Card */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">
              <FaUpload className="me-2" /> Upload New Document
            </h5>
          </Card.Header>
          <Card.Body className="p-3 p-md-4">
            {/* Document Type Toggle */}
            <div className="btn-group mb-4 w-100" role="group">
              <Button
                variant={
                  documentType === "leave" ? "primary" : "outline-primary"
                }
                className="flex-fill"
                onClick={() => handleDocumentTypeChange("leave")}
              >
                <FaCalendarAlt className="me-1" /> Leave Application
              </Button>
              <Button
                variant={
                  documentType === "attendance-correction"
                    ? "primary"
                    : "outline-primary"
                }
                className="flex-fill"
                onClick={() =>
                  handleDocumentTypeChange("attendance-correction")
                }
              >
                <FaBook className="me-1" /> Attendance Correction
              </Button>
            </div>

            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                {/* Description */}
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label className="fw-bold">
                      Reason / Description{" "}
                      <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="4"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      placeholder="Provide detailed reason for your request..."
                    />
                  </Form.Group>
                </Col>

                {documentType === "attendance-correction" ? (
                  <>
                    {/* Subject Selection */}
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-bold">
                          Select Subjects{" "}
                          <span className="text-muted">
                            (Optional - leave empty for ALL subjects)
                          </span>
                        </Form.Label>
                        {subjectLoading ? (
                          <div className="text-center py-2">
                            <Spinner animation="border" size="sm" />
                            <span className="ms-2">Loading subjects...</span>
                          </div>
                        ) : availableSubjects.length > 0 ? (
                          <Card className="border">
                            <Card.Body>
                              <Form.Check
                                type="checkbox"
                                id="selectAllSubjects"
                                checked={selectAllSubjects}
                                onChange={handleSelectAll}
                                label={<strong>All Subjects</strong>}
                              />
                              <hr />
                              <Row>
                                {availableSubjects.map((subject) => {
                                  const subjectId =
                                    subject.subjectId?._id ||
                                    subject._id ||
                                    subject.id;
                                  const subjectName =
                                    subject.subjectId?.name ||
                                    subject.subjectName ||
                                    subject.name;
                                  const subjectCode =
                                    subject.subjectId?.code ||
                                    subject.code ||
                                    "";

                                  if (!subjectId) return null;

                                  return (
                                    <Col md={4} sm={6} key={subjectId}>
                                      <Form.Check
                                        type="checkbox"
                                        id={`subject-${subjectId}`}
                                        checked={selectedSubjects.includes(
                                          subjectId,
                                        )}
                                        onChange={() =>
                                          handleSubjectToggle(subjectId)
                                        }
                                        disabled={selectAllSubjects}
                                        label={`${subjectName}${subjectCode ? ` (${subjectCode})` : ""}`}
                                      />
                                    </Col>
                                  );
                                })}
                              </Row>
                            </Card.Body>
                          </Card>
                        ) : (
                          <Alert variant="info">
                            No subjects available. Please contact your mentor.
                          </Alert>
                        )}
                      </Form.Group>
                    </Col>

                    {/* Attendance Dates */}
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-bold">
                          Attendance Dates{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows="3"
                          value={attendanceDates}
                          onChange={(e) => setAttendanceDates(e.target.value)}
                          required
                          placeholder="Enter dates (one per line or comma separated)&#10;Example:&#10;2026-07-30&#10;2026-07-31&#10;2026-08-01"
                        />
                        <Form.Text className="text-muted">
                          Enter dates in YYYY-MM-DD format. One per line or
                          comma separated.
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    {/* File Upload */}
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-bold">
                          Medical Certificate{" "}
                          <span className="text-muted">(Optional)</span>
                        </Form.Label>
                        <Form.Control
                          id="fileInput"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                        <Form.Text className="text-muted">
                          You may attach a medical certificate if available
                          (PDF, PNG, JPG)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </>
                ) : (
                  <>
                    {/* Leave Application */}
                    <Col xs={12} sm={6}>
                      <Form.Group>
                        <Form.Label className="fw-bold">
                          Leave Start Date{" "}
                          <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Group>
                        <Form.Label className="fw-bold">
                          Leave End Date <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={leaveEndDate}
                          onChange={(e) => setLeaveEndDate(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </>
                )}
              </Row>

              <div className="mt-4">
                <Button
                  variant="primary"
                  type="submit"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaUpload className="me-2" /> Upload Document
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>

        {/* Documents List */}
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-secondary text-white">
            <h5 className="mb-0">
              <FaFileAlt className="me-2" /> Your Uploaded Documents
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
                      <th>Type</th>
                      <th>Description</th>
                      <th>Subjects</th>
                      <th>Dates</th>
                      <th className="text-center">Status</th>
                      <th>Remarks</th>
                      <th className="text-center">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, index) => (
                      <tr key={doc._id}>
                        <td>{index + 1}</td>
                        <td>
                          <Badge bg="secondary">{getDisplayType(doc)}</Badge>
                        </td>
                        <td>
                          <div
                            className="text-truncate"
                            style={{ maxWidth: "150px" }}
                          >
                            {doc.description}
                          </div>
                          {doc.fileName && (
                            <div className="mt-1">
                              <a
                                href={`${baseUrl}/uploads/documents/${doc.fileName}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-decoration-none"
                              >
                                {getFileIcon(doc.fileName)} View File
                              </a>
                            </div>
                          )}
                        </td>
                        <td>{getSubjectsDisplay(doc)}</td>
                        <td>{getDateDisplay(doc)}</td>
                        <td className="text-center">
                          {getStatusBadge(
                            doc.status,
                            doc.overallStatus,
                            doc.documentType,
                          )}
                        </td>
                        <td>
                          <small>
                            {doc.mentorRemarks ||
                              doc.facultyRemarks ||
                              doc.remarks ||
                              "-"}
                          </small>
                        </td>
                        <td className="text-center">
                          {isEditable(doc) ? (
                            <div className="d-flex justify-content-center gap-1 flex-wrap">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => openEditModal(doc)}
                                title="Edit Document"
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteClick(doc._id)}
                                title="Delete Document"
                              >
                                <FaTrash />
                              </Button>
                            </div>
                          ) : isDeletable(doc) ? (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteClick(doc._id)}
                              title="Delete Document"
                            >
                              <FaTrash /> Delete
                            </Button>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaEdit className="me-2" /> Edit Document
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEdit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Document Type</Form.Label>
              <Form.Select
                value={editingDoc?.documentType || "leave"}
                onChange={(e) =>
                  setEditingDoc({
                    ...editingDoc,
                    documentType: e.target.value,
                  })
                }
              >
                <option value="leave">Leave Application</option>
                <option value="attendance-correction">
                  Attendance Correction
                </option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows="3"
                value={editingDoc?.description || ""}
                onChange={(e) =>
                  setEditingDoc({
                    ...editingDoc,
                    description: e.target.value,
                  })
                }
                required
              />
            </Form.Group>

            {editingDoc?.documentType === "attendance-correction" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">
                    Subjects <span className="text-muted">(Optional)</span>
                  </Form.Label>
                  <Alert variant="info">
                    {editingDoc?.subjects && editingDoc.subjects.length > 0
                      ? editingDoc.subjects.map((s) => s.name || s).join(", ")
                      : "All Subjects"}
                  </Alert>
                  <Form.Text className="text-muted">
                    To change subjects, please create a new document.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Dates</Form.Label>
                  <Alert variant="info">
                    {editingDoc?.dates && editingDoc.dates.length > 0
                      ? editingDoc.dates
                          .map((date) => new Date(date).toLocaleDateString())
                          .join(", ")
                      : "No dates selected"}
                  </Alert>
                  <Form.Text className="text-muted">
                    To change dates, please create a new document.
                  </Form.Text>
                </Form.Group>
              </>
            )}

            {editingDoc?.documentType === "leave" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Leave Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={editingDoc?.leaveStartDate || ""}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        leaveStartDate: e.target.value,
                      })
                    }
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Leave End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={editingDoc?.leaveEndDate || ""}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        leaveEndDate: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <FaEdit className="me-1" /> Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ✅ Confirm Delete Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setDeleteTargetId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
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

export default StudentDocumentsPage;
