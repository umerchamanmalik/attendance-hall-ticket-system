import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  FaSync,
  FaPlus,
  FaEdit,
  FaTrash,
  FaDownload,
  FaArrowLeft,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle, // ✅ Added
  FaExclamationTriangle, // ✅ Added
  FaSave,
} from "react-icons/fa";
import api, { formatErrorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";

const ExamDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState(null);
  const [hallTickets, setHallTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [allocatedSubjects, setAllocatedSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");

  // State for editing dates
  const [editDates, setEditDates] = useState({
    startDate: "",
    endDate: "",
  });
  const [showDateEdit, setShowDateEdit] = useState(false);
  const [savingDates, setSavingDates] = useState(false);

  // Confirm Dialog States
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchExamDetails();
  }, [id]);

  const fetchExamDetails = async () => {
    setLoading(true);
    try {
      const examResponse = await api.get(`/exams/${id}`);
      const examData = examResponse.data.data;
      setExam(examData);

      setEditDates({
        startDate: examData.startDate?.split("T")[0] || "",
        endDate: examData.endDate?.split("T")[0] || "",
      });

      await fetchAllocatedSubjects(examData);

      try {
        const hallTicketResponse = await api.get(`/exams/${id}/halltickets`);
        setHallTickets(hallTicketResponse.data.data || []);
      } catch (hallError) {
        setHallTickets([]);
      }
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocatedSubjects = async (examData) => {
    try {
      const response = await api.get("/allocations");
      const allocated = response.data.data.filter(
        (a) =>
          a.semester === examData.semester && a.section === examData.section,
      );
      const subjectNames = allocated.map((a) => a.subjectName);
      setAllocatedSubjects(subjectNames);
      return subjectNames;
    } catch (error) {
      setAllocatedSubjects([]);
      return [];
    }
  };

  const handleSyncSubjects = async () => {
    setSyncing(true);
    try {
      const response = await api.put(`/exams/${id}/refresh-subjects`, {});
      toast.success(
        response.data.message || "✅ Subjects synced successfully!",
      );
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) {
      toast.warning("Please enter a subject name");
      return;
    }

    try {
      const response = await api.post(`/exams/${id}/subjects`, {
        subjectName: newSubject.trim(),
      });
      toast.success(response.data.message || "✅ Subject added successfully!");
      setNewSubject("");
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    }
  };

  const handleRemoveSubject = async (subjectName) => {
    setConfirmData({ subjectName });
    setConfirmAction("removeSubject");
    setShowConfirm(true);
  };

  const confirmRemoveSubject = async () => {
    if (!confirmData) return;
    setDeleteLoading(true);
    try {
      const response = await api.delete(`/exams/${id}/subjects`, {
        data: { subjectName: confirmData.subjectName },
      });
      toast.success(
        response.data.message || "✅ Subject removed successfully!",
      );
      setShowConfirm(false);
      setConfirmData(null);
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditSubject = (subjectName) => {
    setEditingSubject(subjectName);
    setEditSubjectName(subjectName);
  };

  const handleSaveSubjectEdit = async () => {
    if (!editSubjectName.trim()) {
      toast.warning("Please enter a valid subject name");
      return;
    }

    try {
      await api.delete(`/exams/${id}/subjects`, {
        data: { subjectName: editingSubject },
      });
      await api.post(`/exams/${id}/subjects`, {
        subjectName: editSubjectName.trim(),
      });
      toast.success("✅ Subject updated successfully!");
      setEditingSubject(null);
      setEditSubjectName("");
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    }
  };

  const handleGenerateHallTickets = async () => {
    setConfirmAction("generate");
    setShowConfirm(true);
  };

  const confirmGenerateHallTickets = async () => {
    setGenerating(true);
    try {
      const response = await api.post(`/exams/${id}/generate`, {});
      toast.success(
        response.data.message || "✅ Hall tickets generated successfully!",
      );
      setShowConfirm(false);
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateDates = async () => {
    if (!editDates.startDate || !editDates.endDate) {
      toast.warning("Please select both start and end dates");
      return;
    }

    if (new Date(editDates.endDate) < new Date(editDates.startDate)) {
      toast.warning("End date must be on or after the start date");
      return;
    }

    setSavingDates(true);
    try {
      const response = await api.put(`/exams/${id}`, {
        startDate: editDates.startDate,
        endDate: editDates.endDate,
      });

      toast.success(
        response.data.message || "✅ Exam dates updated successfully!",
      );
      setShowDateEdit(false);
      await fetchExamDetails();
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setSavingDates(false);
    }
  };

  const handleDeleteExam = () => {
    setConfirmAction("delete");
    setShowConfirm(true);
  };

  const confirmDeleteExam = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/exams/${id}`);
      toast.success("✅ Exam deleted successfully!");
      setShowConfirm(false);
      navigate("/hod/exam-management");
    } catch (error) {
      toast.error(formatErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  const isDraft = exam?.status === "DRAFT";
  const isGenerated = exam?.status === "GENERATED";
  const isCompleted = exam?.status === "COMPLETED";
  const canEdit = isDraft;
  const canGenerate = isDraft && exam?.subjects?.length > 0;
  const hasHallTickets = hallTickets.length > 0;
  const canEditDates = isDraft || isGenerated;

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
      <Badge bg={colors[status] || "secondary"} className="px-2 py-1 fs-6">
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
          <h5 className="mt-3 text-muted">Loading exam details...</h5>
        </div>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <FaExclamationTriangle className="me-2" />
          Exam not found
        </Alert>
        <Button as={Link} to="/hod/exam-management" variant="outline-primary">
          <FaArrowLeft className="me-1" /> Back to Exams
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">
              <FaCalendarAlt className="me-2 text-primary" />
              {exam.examName}
            </h2>
            <p className="text-muted mb-0">
              {exam.academicYear} | Semester {exam.semester} | Section{" "}
              {exam.section} | Department {exam.department || "CS"}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap mt-2 mt-md-0">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={fetchExamDetails}
            >
              <FaSync className="me-1" /> Refresh
            </Button>
            <Button
              as={Link}
              to="/hod/exam-management"
              variant="outline-primary"
              size="sm"
            >
              <FaArrowLeft className="me-1" /> Back
            </Button>
          </div>
        </div>

        {/* Exam Info Card */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row>
              <Col xs={12} md={3}>
                <div className="d-flex align-items-center mb-2 mb-md-0">
                  <FaInfoCircle className="text-primary me-2" />
                  <div>
                    <small className="text-muted d-block">Status</small>
                    <strong>{getStatusBadge(exam.status)}</strong>
                  </div>
                </div>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">Start Date</small>
                <strong>{new Date(exam.startDate).toLocaleDateString()}</strong>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">End Date</small>
                <strong>{new Date(exam.endDate).toLocaleDateString()}</strong>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">Students</small>
                <strong>{exam.studentCount || 0}</strong>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Date Edit Section */}
        {canEditDates && (
          <div className="mb-3">
            {!showDateEdit ? (
              <Button
                variant="outline-info"
                size="sm"
                onClick={() => setShowDateEdit(true)}
              >
                <FaEdit className="me-1" /> Edit Dates
              </Button>
            ) : (
              <Card className="border-info">
                <Card.Body>
                  <Row className="g-3 align-items-end">
                    <Col xs={12} sm={4}>
                      <Form.Group>
                        <Form.Label className="fw-bold small">
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={editDates.startDate}
                          onChange={(e) =>
                            setEditDates({
                              ...editDates,
                              startDate: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} sm={4}>
                      <Form.Group>
                        <Form.Label className="fw-bold small">
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={editDates.endDate}
                          onChange={(e) =>
                            setEditDates({
                              ...editDates,
                              endDate: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} sm={4}>
                      <div className="d-flex gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={handleUpdateDates}
                          disabled={savingDates}
                        >
                          {savingDates ? (
                            <>
                              <Spinner size="sm" className="me-1" /> Saving...
                            </>
                          ) : (
                            <>
                              <FaSave className="me-1" /> Save Dates
                            </>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowDateEdit(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </Col>
                  </Row>
                  {isGenerated && (
                    <Alert variant="info" className="mt-3 mb-0">
                      <FaInfoCircle className="me-2" />
                      Updating dates will automatically update hall ticket
                      validity for all {hallTickets.length} students.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>
        )}

        {/* Hall Tickets Section */}
        {(isGenerated || isCompleted) && hasHallTickets && (
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-light">
              <h5 className="mb-0">
                <FaDownload className="me-2 text-primary" />
                Hall Tickets ({hallTickets.length})
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Roll Number</th>
                      <th>Status</th>
                      <th>Eligible Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hallTickets.map((ticket, index) => {
                      const eligibleSubjects =
                        ticket.subjectEligibility?.filter((s) => s.eligible)
                          .length || 0;
                      const totalSubjects =
                        ticket.subjectEligibility?.length || 0;

                      return (
                        <tr key={ticket._id}>
                          <td>{index + 1}</td>
                          <td>{ticket.studentId?.studentName || "Unknown"}</td>
                          <td>{ticket.studentId?.rollNumber || "N/A"}</td>
                          <td>
                            <Badge
                              bg={
                                ticket.approvalStatus === "Approved"
                                  ? "success"
                                  : ticket.approvalStatus === "Rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {ticket.approvalStatus || "Pending"}
                            </Badge>
                          </td>
                          <td>
                            <span className="text-success">
                              {eligibleSubjects}
                            </span>
                            <span className="text-muted">/{totalSubjects}</span>
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
                Total: {hallTickets.length} hall tickets generated
              </small>
            </Card.Footer>
          </Card>
        )}

        {/* Subjects Section */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-center">
            <h5 className="mb-0">
              <FaCalendarAlt className="me-2 text-primary" />
              Subjects ({exam.subjects?.length || 0})
            </h5>
            <div className="d-flex gap-2 flex-wrap mt-2 mt-md-0">
              {allocatedSubjects.length > 0 && (
                <Button
                  variant={syncing ? "secondary" : "outline-warning"}
                  size="sm"
                  onClick={handleSyncSubjects}
                  disabled={syncing || !canEdit}
                  title="Sync subjects from FacultyAllocation"
                >
                  {syncing ? (
                    <>
                      <Spinner size="sm" className="me-1" /> Syncing...
                    </>
                  ) : (
                    <>
                      <FaSync className="me-1" /> Sync Subjects
                    </>
                  )}
                </Button>
              )}
              <Badge bg="secondary">
                Allocated: {allocatedSubjects.length}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            {canEdit && (
              <Form onSubmit={handleAddSubject} className="mb-3">
                <Row className="g-2">
                  <Col xs={12} md={8}>
                    <Form.Control
                      type="text"
                      placeholder="Enter subject name"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                    />
                  </Col>
                  <Col xs={12} md={4}>
                    <Button type="submit" variant="primary" className="w-100">
                      <FaPlus className="me-1" /> Add Subject
                    </Button>
                  </Col>
                </Row>
              </Form>
            )}

            {exam.subjects && exam.subjects.length > 0 ? (
              <div className="table-responsive">
                <Table bordered hover>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "10%" }}>#</th>
                      <th>Subject Name</th>
                      <th style={{ width: "30%" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.subjects.map((subject, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>
                          {editingSubject === subject ? (
                            <Form.Control
                              type="text"
                              value={editSubjectName}
                              onChange={(e) =>
                                setEditSubjectName(e.target.value)
                              }
                              autoFocus
                              size="sm"
                            />
                          ) : (
                            subject
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <div className="d-flex gap-1 flex-wrap">
                              {editingSubject === subject ? (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={handleSaveSubjectEdit}
                                  >
                                    <FaSave className="me-1" /> Save
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setEditingSubject(null);
                                      setEditSubjectName("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => handleEditSubject(subject)}
                                    title="Edit Subject"
                                  >
                                    <FaEdit />
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleRemoveSubject(subject)}
                                    title="Remove Subject"
                                  >
                                    <FaTrash />
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <Alert variant="warning" className="mb-0">
                No subjects added yet. {canEdit && "Add subjects above."}
              </Alert>
            )}

            {!canEdit && isGenerated && (
              <Alert variant="info" className="mt-3 mb-0">
                <FaInfoCircle className="me-2" />
                <strong>Note:</strong> Subjects cannot be edited after hall
                tickets are generated. You can only update exam dates.
              </Alert>
            )}
          </Card.Body>
        </Card>

        {/* Actions */}
        <Card className="shadow-sm border-0">
          <Card.Body>
            <div className="d-flex flex-wrap gap-2">
              {canGenerate && (
                <Button
                  variant="success"
                  onClick={handleGenerateHallTickets}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Spinner size="sm" className="me-1" /> Generating...
                    </>
                  ) : (
                    <>
                      <FaDownload className="me-1" /> Generate Hall Tickets
                    </>
                  )}
                </Button>
              )}

              {isGenerated && hasHallTickets && (
                <Button
                  as={Link}
                  to="/hod/hall-ticket-management"
                  variant="info"
                >
                  <FaDownload className="me-1" /> View All Hall Tickets
                </Button>
              )}

              <Button variant="danger" onClick={handleDeleteExam}>
                <FaTrash className="me-1" /> Delete Exam
              </Button>

              <Button
                as={Link}
                to="/hod/exam-management"
                variant="outline-secondary"
              >
                <FaArrowLeft className="me-1" /> Back to Exams
              </Button>
            </div>

            {isDraft && (
              <Alert variant="warning" className="mt-3 mb-0">
                <FaClock className="me-2" />
                <strong>Draft Mode:</strong> Add subjects and generate hall
                tickets when ready. You can edit subjects and dates freely.
              </Alert>
            )}

            {isGenerated && (
              <Alert variant="info" className="mt-3 mb-0">
                <FaCheckCircle className="me-2 text-success" />
                <strong>Hall Tickets Generated:</strong> {hallTickets.length}{" "}
                students have hall tickets. You can edit dates but not subjects.
              </Alert>
            )}

            {isCompleted && (
              <Alert variant="secondary" className="mt-3 mb-0">
                <FaTimesCircle className="me-2" />
                <strong>Completed:</strong> This exam is completed. No further
                edits allowed.
              </Alert>
            )}
          </Card.Body>
        </Card>
      </Container>

      <ConfirmDialog
        show={showConfirm}
        onHide={() => {
          setShowConfirm(false);
          setConfirmData(null);
        }}
        onConfirm={
          confirmAction === "delete"
            ? confirmDeleteExam
            : confirmAction === "generate"
              ? confirmGenerateHallTickets
              : confirmAction === "removeSubject"
                ? confirmRemoveSubject
                : confirmDeleteExam
        }
        title={
          confirmAction === "delete"
            ? "Delete Exam"
            : confirmAction === "generate"
              ? "Generate Hall Tickets"
              : "Remove Subject"
        }
        message={
          confirmAction === "delete"
            ? "Are you sure you want to delete this exam? This action cannot be undone. All associated hall tickets will also be deleted."
            : confirmAction === "generate"
              ? `Are you sure you want to generate hall tickets for all ${exam?.studentCount || 0} students? This will calculate attendance and create hall tickets.`
              : `Are you sure you want to remove "${confirmData?.subjectName}" from this exam?`
        }
        confirmText={
          confirmAction === "delete"
            ? "Delete Exam"
            : confirmAction === "generate"
              ? "Generate"
              : "Remove Subject"
        }
        variant={confirmAction === "delete" ? "danger" : "warning"}
        loading={deleteLoading || generating}
      />
    </>
  );
};

export default ExamDetailsPage;
