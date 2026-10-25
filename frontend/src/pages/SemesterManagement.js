import React, { useState, useEffect } from "react";
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
  Modal,
} from "react-bootstrap";
import {
  FaGraduationCap,
  FaUsers,
  FaBook,
  FaChalkboardTeacher,
  FaUserGraduate,
  FaPlus,
  FaEye,
  FaArrowRight,
  FaSync,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaUniversity,
  FaClipboardList,
  FaClock,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";
import ConfirmDialog from "../components/ConfirmDialog";

const SemesterManagement = () => {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  const [promoting, setPromoting] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [showStudents, setShowStudents] = useState(false);
  const [students, setStudents] = useState([]);
  const [promotingAll, setPromotingAll] = useState(false);
  const [showNextSteps, setShowNextSteps] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [semesterDetails, setSemesterDetails] = useState({});

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/semesters");
      if (response.data.success) {
        setSemesters(response.data.data || []);
        await fetchAllSemesterDetails(response.data.data);
      } else {
        throw new Error(
          response.data.message || "Failed to fetch semester data",
        );
      }
    } catch (error) {
      console.error("Error fetching semesters:", error);
      setError(error.response?.data?.error || "Failed to fetch semester data");
      toast.error(
        error.response?.data?.error || "Failed to fetch semester data",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSemesterDetails = async (semesterList) => {
    try {
      const details = {};
      for (const sem of semesterList) {
        try {
          const studentResponse = await api.get(
            `/semesters/${sem.semester}/students`,
          );
          const students = studentResponse.data.data || [];

          const allocationResponse = await api.get("/allocations");
          const allocations = allocationResponse.data.data || [];
          const semesterAllocations = allocations.filter(
            (a) => a.semester === sem.semester,
          );

          const subjects = [
            ...new Set(semesterAllocations.map((a) => a.subjectName)),
          ];
          const faculty = [
            ...new Set(semesterAllocations.map((a) => a.facultyName)),
          ];
          const studentsWithoutMentor = students.filter((s) => !s.mentorName);
          const subjectsWithoutFaculty = semesterAllocations.filter(
            (a) => !a.facultyName,
          );

          details[sem.semester] = {
            students: students.length,
            subjects: subjects.length,
            faculty: faculty.length,
            studentsWithoutMentor: studentsWithoutMentor.length,
            subjectsWithoutFaculty: subjectsWithoutFaculty.length,
            totalAllocations: semesterAllocations.length,
          };
        } catch (e) {
          console.error(
            `Error fetching details for semester ${sem.semester}:`,
            e,
          );
        }
      }
      setSemesterDetails(details);
    } catch (error) {
      console.error("Error fetching semester details:", error);
    }
  };

  const requestPromotion = (semester) => {
    setConfirmation({
      title: `Promote Semester ${semester}`,
      message: `Are you sure you want to promote Semester ${semester} students to Semester ${semester + 1}?`,
      action: () => handlePromote(semester),
      busy: promoting,
    });
  };

  const requestPromoteAll = () => {
    setConfirmation({
      title: "Promote all students",
      message:
        "Are you sure you want to promote all students to the next semester?",
      action: () => handlePromoteAll(),
      busy: promotingAll,
    });
  };

  const handlePromote = async (semester) => {
    setPromoting(true);
    try {
      const response = await api.post(`/semesters/${semester}/promote`);
      if (response.data.success) {
        const { nextSteps } = response.data.data;
        setShowNextSteps({
          semester: semester + 1,
          subjectsExist: nextSteps?.subjectsExist || false,
          subjectsCount: nextSteps?.subjectsCount || 0,
          facultyCount: nextSteps?.facultyCount || 0,
        });
        toast.success(
          response.data.message ||
            `✅ ${response.data.data.promotedCount} students promoted successfully!`,
        );
        await fetchSemesters();
      } else {
        throw new Error(response.data.message || "Failed to promote students");
      }
    } catch (error) {
      console.error("Error promoting students:", error);
      toast.error(error.response?.data?.error || "Failed to promote students");
    } finally {
      setPromoting(false);
    }
  };

  const handlePromoteAll = async () => {
    setPromotingAll(true);
    try {
      const response = await api.post("/semesters/promote-all");
      if (response.data.success) {
        toast.success(
          response.data.message ||
            `✅ ${response.data.data.totalPromoted} students promoted across all semesters!`,
        );
        await fetchSemesters();
      } else {
        throw new Error(response.data.message || "Failed to promote students");
      }
    } catch (error) {
      console.error("Error promoting all students:", error);
      toast.error(error.response?.data?.error || "Failed to promote students");
    } finally {
      setPromotingAll(false);
    }
  };

  const handleViewStudents = async (semester) => {
    setSelectedSemester(semester);
    setShowStudents(true);
    setLoadingStudents(true);
    try {
      const response = await api.get(`/semesters/${semester}/students`);
      if (response.data.success) {
        setStudents(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch students");
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error(error.response?.data?.error || "Failed to fetch students");
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Active: "success",
      Empty: "secondary",
      Inactive: "danger",
    };
    const labels = {
      Active: "✅ Active",
      Empty: "⏳ Empty",
      Inactive: "❌ Inactive",
    };
    return (
      <Badge bg={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getAcademicYearColor = (year) => {
    const colors = {
      "First Year": "primary",
      "Second Year": "info",
      "Third Year": "warning",
      "Final Year": "success",
    };
    return colors[year] || "text-muted";
  };

  const SemesterCard = ({ sem }) => {
    const isGraduating = sem.semester === 8;
    const canPromote = sem.status === "Active" && sem.semester < 8;
    const details = semesterDetails[sem.semester] || {};

    return (
      <Col xs={12} md={6} lg={4}>
        <Card className="app-section-card h-100">
          <Card.Header
            className={`d-flex justify-content-between align-items-center ${sem.status === "Active" ? "bg-primary text-white" : "bg-light"}`}
          >
            <h5 className="mb-0">
              <FaGraduationCap className="me-2" />
              Semester {sem.semester}
            </h5>
            {getStatusBadge(sem.status)}
          </Card.Header>
          <Card.Body>
            <p className={getAcademicYearColor(sem.academicYear)}>
              <strong>
                <FaCalendarAlt className="me-2" />
                {sem.academicYear}
              </strong>
            </p>
            <hr />
            <div className="d-flex flex-wrap gap-3">
              <div>
                <FaUsers className="text-primary me-1" />
                <strong>Students:</strong> {sem.studentCount || 0}
              </div>
              <div>
                <FaBook className="text-success me-1" />
                <strong>Subjects:</strong> {details.subjects || 0}
              </div>
              <div>
                <FaChalkboardTeacher className="text-info me-1" />
                <strong>Faculty:</strong> {details.faculty || 0}
              </div>
            </div>
          </Card.Body>
          <Card.Footer className="bg-white">
            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => handleViewStudents(sem.semester)}
                title="View Students"
              >
                <FaEye className="me-1" /> View
              </Button>

              <Button
                as={Link}
                to={`/hod/allocations`}
                variant="outline-warning"
                size="sm"
                title="Allocate Faculty"
              >
                <FaChalkboardTeacher className="me-1" /> Allocate
              </Button>

              <Button
                as={Link}
                to="/hod/students"
                variant="outline-success"
                size="sm"
                title="Add Student"
              >
                <FaPlus className="me-1" /> Add
              </Button>

              {canPromote && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => requestPromotion(sem.semester)}
                  disabled={promoting}
                >
                  {promoting ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <FaArrowRight className="me-1" />
                      Promote
                    </>
                  )}
                </Button>
              )}

              {isGraduating && (
                <Badge bg="info" className="p-2">
                  🎓 Graduating
                </Badge>
              )}
              {sem.status === "Empty" && sem.semester < 8 && (
                <span className="text-muted small align-self-center">
                  <FaInfoCircle className="me-1" /> No students
                </span>
              )}
            </div>
          </Card.Footer>
        </Card>
      </Col>
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
          <h5 className="mt-3 text-muted">Loading semester data...</h5>
        </div>
      </Container>
    );
  }

  if (error && semesters.length === 0) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={fetchSemesters} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <h2 className="mb-2 mb-md-0">
            <FaUniversity className="me-2 text-primary" />
            Semester Management
          </h2>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant="success"
              onClick={requestPromoteAll}
              disabled={promotingAll}
            >
              {promotingAll ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Promoting...
                </>
              ) : (
                <>
                  <FaArrowRight className="me-1" /> Promote All Students
                </>
              )}
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={fetchSemesters}
            >
              <FaSync className="me-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Next Steps Guidance */}
        {showNextSteps && (
          <Alert variant="info" className="mb-4">
            <Alert.Heading as="h5">
              <FaInfoCircle className="me-2" />
              Next Steps for Semester {showNextSteps.semester}
            </Alert.Heading>
            <p className="mb-2">
              {showNextSteps.subjectsExist
                ? `✅ ${showNextSteps.subjectsCount} subjects already added.`
                : "⚠️ No subjects added yet. Please add subjects."}
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Button
                as={Link}
                to="/hod/allocations"
                variant="primary"
                size="sm"
              >
                <FaChalkboardTeacher className="me-1" /> Allocate Faculty
              </Button>
              {!showNextSteps.subjectsExist && (
                <Button
                  as={Link}
                  to="/hod/bulk-upload"
                  variant="warning"
                  size="sm"
                >
                  <FaBook className="me-1" /> Add Subjects
                </Button>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowNextSteps(null)}
              >
                <FaTimesCircle className="me-1" /> Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {/* Semester Cards */}
        <Row className="g-4">
          {semesters.length === 0 ? (
            <Col xs={12}>
              <Alert variant="info">
                <FaInfoCircle className="me-2" />
                No semesters found. Please add students first.
              </Alert>
            </Col>
          ) : (
            semesters.map((sem) => (
              <SemesterCard key={sem.semester} sem={sem} />
            ))
          )}
        </Row>

        {/* Summary Stats */}
        {semesters.length > 0 && (
          <Card className="app-section-card mt-4">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between align-items-center">
                <div>
                  <small className="text-muted">
                    <FaInfoCircle className="me-1" />
                    Total Semesters: <strong>{semesters.length}</strong>
                  </small>
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <Badge bg="success">
                    <FaCheckCircle className="me-1" />
                    Active:{" "}
                    {semesters.filter((s) => s.status === "Active").length}
                  </Badge>
                  <Badge bg="secondary">
                    <FaTimesCircle className="me-1" />
                    Empty:{" "}
                    {semesters.filter((s) => s.status === "Empty").length}
                  </Badge>
                  <Badge bg="primary">
                    <FaUsers className="me-1" />
                    Total Students:{" "}
                    {semesters.reduce(
                      (sum, s) => sum + (s.studentCount || 0),
                      0,
                    )}
                  </Badge>
                </div>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* 📋 INFO SECTION - After Promotion Guide & Allocation Summary */}
        {semesters.length > 0 && (
          <Card className="app-section-card mt-4">
            <Card.Header className="bg-info text-white">
              <h5 className="mb-0">
                <FaClipboardList className="me-2" />
                Semester Management Guide
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-4">
                {/* After Promotion Guide */}
                <Col xs={12} md={6}>
                  <h6 className="text-primary">
                    <FaArrowRight className="me-2" />
                    After Promotion - Next Steps
                  </h6>
                  <div className="border rounded p-3">
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <FaBook className="text-success mt-1" />
                      <div>
                        <strong>1. Allocate Faculty</strong>
                        <br />
                        <small className="text-muted">
                          Assign faculty to subjects for the new semester
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <FaUserGraduate className="text-warning mt-1" />
                      <div>
                        <strong>2. Assign Mentors</strong>
                        <br />
                        <small className="text-muted">
                          Ensure all students have mentors assigned
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <FaClipboardList className="text-info mt-1" />
                      <div>
                        <strong>3. Create Exams</strong>
                        <br />
                        <small className="text-muted">
                          Schedule exams and generate hall tickets
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-start gap-2">
                      <FaCheckCircle className="text-success mt-1" />
                      <div>
                        <strong>4. Generate Hall Tickets</strong>
                        <br />
                        <small className="text-muted">
                          Generate hall tickets for eligible students
                        </small>
                      </div>
                    </div>
                  </div>
                </Col>

                {/* Previous Semesters Summary */}
                <Col xs={12} md={6}>
                  <h6 className="text-warning">
                    <FaClock className="me-2" />
                    Previous Semesters - What's Remaining?
                  </h6>
                  <div className="border rounded p-3">
                    {semesters
                      .filter(
                        (s) => s.status !== "Empty" && s.status !== "Inactive",
                      )
                      .slice(-3)
                      .map((sem) => {
                        const details = semesterDetails[sem.semester] || {};
                        const missingItems = [];

                        if (details.subjectsWithoutFaculty > 0) {
                          missingItems.push(
                            `${details.subjectsWithoutFaculty} subject(s) need faculty`,
                          );
                        }
                        if (details.studentsWithoutMentor > 0) {
                          missingItems.push(
                            `${details.studentsWithoutMentor} student(s) need mentors`,
                          );
                        }

                        return (
                          <div
                            key={sem.semester}
                            className="mb-2 pb-2 border-bottom"
                          >
                            <strong>Semester {sem.semester}</strong>
                            <div className="d-flex flex-wrap gap-3 mt-1">
                              <small>
                                <FaBook className="text-success me-1" />
                                Subjects: {details.subjects || 0}
                              </small>
                              <small>
                                <FaChalkboardTeacher className="text-info me-1" />
                                Faculty: {details.faculty || 0}
                              </small>
                              <small>
                                <FaUsers className="text-primary me-1" />
                                Students: {details.students || 0}
                              </small>
                            </div>
                            {missingItems.length > 0 ? (
                              <div className="mt-1">
                                <small className="text-warning">
                                  ⚠️ {missingItems.join(", ")}
                                </small>
                              </div>
                            ) : (
                              <small className="text-success mt-1 d-block">
                                ✅ All faculty and mentors assigned
                              </small>
                            )}
                          </div>
                        );
                      })}
                    {semesters.filter(
                      (s) => s.status !== "Empty" && s.status !== "Inactive",
                    ).length === 0 && (
                      <div className="text-muted text-center py-2">
                        No active semesters yet
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              {/* Allocation Summary Table */}
              <hr className="my-3" />
              <Row>
                <Col xs={12}>
                  <h6 className="text-primary">
                    <FaChalkboardTeacher className="me-2" />
                    Allocation Summary
                  </h6>
                  <div className="table-responsive">
                    <Table bordered size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Semester</th>
                          <th>Students</th>
                          <th>Subjects</th>
                          <th>Faculty</th>
                          <th>Mentors</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semesters.map((sem) => {
                          const details = semesterDetails[sem.semester] || {};
                          return (
                            <tr key={sem.semester}>
                              <td>Sem {sem.semester}</td>
                              <td>{details.students || 0}</td>
                              <td>{details.subjects || 0}</td>
                              <td>{details.faculty || 0}</td>
                              <td>
                                {(details.students || 0) -
                                  (details.studentsWithoutMentor || 0)}
                                /{details.students || 0}
                              </td>
                              <td>
                                {sem.status === "Active" ? (
                                  <Badge bg="success">✅ Active</Badge>
                                ) : (
                                  <Badge bg="secondary">⏳ Inactive</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  <small className="text-muted">
                    <FaInfoCircle className="me-1" />
                    Total: {semesters.length} semesters,{" "}
                    {semesters.reduce(
                      (sum, s) => sum + (s.studentCount || 0),
                      0,
                    )}{" "}
                    students
                  </small>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}
      </Container>

      {/* Students Modal */}
      <Modal
        show={showStudents}
        onHide={() => setShowStudents(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaUsers className="me-2" />
            Students - Semester {selectedSemester}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingStudents ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <Alert variant="info">
              <FaInfoCircle className="me-2" />
              No students in this semester.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table bordered hover size="sm">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>USN</th>
                    <th>Name</th>
                    <th>Section</th>
                    <th>Mentor</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student._id}>
                      <td>{index + 1}</td>
                      <td>
                        <Badge bg="secondary">{student.rollNumber}</Badge>
                      </td>
                      <td>{student.studentName}</td>
                      <td>{student.section}</td>
                      <td>{student.mentorName || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          {students.length > 0 && (
            <div className="mt-2">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Total: {students.length} student(s)
              </small>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStudents(false)}>
            Close
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        show={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel="Continue"
        confirmVariant="primary"
        busy={confirmation?.busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => {
          const action = confirmation?.action;
          setConfirmation(null);
          await action?.();
        }}
      />
    </>
  );
};

export default SemesterManagement;
