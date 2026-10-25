import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
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
  FaUserCheck,
  FaUserTimes,
  FaUsers,
  FaCalendarAlt,
  FaBook,
  FaSync,
  FaHistory,
  FaSave,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import ErrorMessage from "../components/ErrorMessage";

const AttendancePage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [date, setDate] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const attendanceThreshold = students[0]?.attendanceThreshold ?? 85;

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    loadClasses();
    const today = new Date().toISOString().split("T")[0];
    setDate(today);

    // ✅ Handle resize for mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadClasses = async () => {
    setLoadingClasses(true);
    setError(null);
    try {
      const response = await api.get("/attendance/classes");
      if (response.data.success) {
        setClasses(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to load classes");
      }
    } catch (error) {
      console.error("Error loading classes:", error);
      setError(error.message || "Failed to load classes. Please refresh.");
      toast.error(error.response?.data?.error || "Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  };

  // Load Students
  const handleLoadStudents = async () => {
    if (!selectedClass || !date) {
      toast.warning("Please select a class and date");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/students/class", {
        params: {
          academicYear: selectedClass.academicYear,
          semester: selectedClass.semester,
          section: selectedClass.section,
        },
      });

      const studentList = response.data.data || [];

      if (studentList.length === 0) {
        toast.info("No students found for this class.");
        setStudents([]);
        setLoading(false);
        return;
      }

      const existingRes = await api.get("/attendance", {
        params: {
          subjectName: selectedClass.subjectName,
          attendanceDate: date,
        },
      });

      const existingRecords = existingRes.data.data || [];
      setHasExisting(existingRecords.length > 0);

      const statusMap = {};
      const idMap = {};
      existingRecords.forEach((record) => {
        const studentId = record.studentId?._id || record.studentId;
        if (studentId) {
          statusMap[studentId] = record.status;
          idMap[studentId] = record._id;
        }
      });

      const studentsWithAttendance = await Promise.all(
        studentList.map(async (student) => {
          try {
            const attendanceRes = await api.get("/attendance", {
              params: {
                studentId: student._id,
                subjectName: selectedClass.subjectName,
              },
            });

            const records = attendanceRes.data.data || [];
            const total = records.length;
            const present = records.filter(
              (r) => r.status === "Present",
            ).length;
            const percentage =
              total > 0 ? Math.round((present / total) * 100) : 0;

            const todayRecord = records.find(
              (r) =>
                new Date(r.attendanceDate).toDateString() ===
                new Date(date).toDateString(),
            );

            return {
              ...student,
              status:
                statusMap[student._id] || todayRecord?.status || "Present",
              attendancePercentage: percentage,
              totalClasses: total,
              presentClasses: present,
              attendanceId: idMap[student._id] || todayRecord?._id || null,
              hasExistingRecord: !!idMap[student._id] || !!todayRecord,
            };
          } catch (e) {
            console.error(
              `Error loading attendance for student ${student._id}:`,
              e,
            );
            return {
              ...student,
              status: "Present",
              attendancePercentage: 0,
              totalClasses: 0,
              presentClasses: 0,
              attendanceId: null,
              hasExistingRecord: false,
            };
          }
        }),
      );

      setStudents(studentsWithAttendance);

      if (existingRecords.length > 0) {
        toast.info(
          "📋 Existing attendance loaded. Click status buttons to toggle, then click 'Update Attendance' to save.",
        );
      } else {
        toast.success(
          `Loaded ${studentsWithAttendance.length} students. Mark attendance and submit.`,
        );
      }
    } catch (error) {
      console.error("Error loading students:", error);
      setError(error.response?.data?.error || "Unable to load students");
      toast.error(error.response?.data?.error || "Unable to load students");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (studentId) => {
    setStudents((prev) =>
      prev.map((student) =>
        student._id === studentId
          ? {
              ...student,
              status: student.status === "Present" ? "Absent" : "Present",
            }
          : student,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!selectedClass || !date) {
      toast.warning("Please select a class and date");
      return;
    }

    if (students.length === 0) {
      toast.warning("No students to mark attendance for.");
      return;
    }

    setSubmitting(true);
    try {
      const hasExistingRecords = students.some((s) => s.hasExistingRecord);

      if (hasExistingRecords) {
        const updatePromises = students
          .filter((s) => s.hasExistingRecord && s.attendanceId)
          .map(async (student) => {
            await api.put(`/attendance/${student.attendanceId}`, {
              status: student.status,
            });
          });

        await Promise.all(updatePromises);
        toast.success("✅ Attendance updated successfully!");
      } else {
        await api.post("/attendance", {
          subjectName: selectedClass.subjectName,
          academicYear: selectedClass.academicYear,
          semester: selectedClass.semester,
          section: selectedClass.section,
          attendanceDate: date,
          attendance: students.map((student) => ({
            studentId: student._id,
            status: student.status,
          })),
        });
        toast.success("✅ Attendance saved successfully!");
      }

      await handleLoadStudents();
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error(error.response?.data?.error || "Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const markAllPresent = () => {
    if (students.length === 0) {
      toast.warning("No students to mark present.");
      return;
    }
    setStudents((prev) =>
      prev.map((student) => ({ ...student, status: "Present" })),
    );
    toast.success("All students marked as Present");
  };

  const markAllAbsent = () => {
    if (students.length === 0) {
      toast.warning("No students to mark absent.");
      return;
    }
    setStudents((prev) =>
      prev.map((student) => ({ ...student, status: "Absent" })),
    );
    toast.success("All students marked as Absent");
  };

  const presentCount = students.filter((s) => s.status === "Present").length;
  const absentCount = students.filter((s) => s.status === "Absent").length;
  const totalCount = students.length;
  const hasExistingRecords = students.some((s) => s.hasExistingRecord);
  const todayPercentage =
    totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  if (loadingClasses) {
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
          <p className="mt-3 text-muted">Loading your classes...</p>
        </div>
      </Container>
    );
  }

  if (error && classes.length === 0) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={loadClasses} />
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaUserCheck className="me-2 text-primary" />
          Take Attendance
        </h2>

        <Card className="shadow-sm border-0 mb-4">
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col xs={12} md={5}>
                <Form.Group>
                  <Form.Label className="fw-bold">
                    <FaBook className="me-1" /> Assigned Class
                  </Form.Label>
                  <Form.Select
                    onChange={(e) => {
                      const index = e.target.value;
                      if (index !== "") {
                        setSelectedClass(classes[index]);
                      } else {
                        setSelectedClass(null);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">Select a class</option>
                    {classes.map((item, index) => (
                      <option key={index} value={index}>
                        {`${item.subjectName} | Sem ${item.semester} | ${item.section}`}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold">
                    <FaCalendarAlt className="me-1" /> Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} md={2}>
                <Button
                  variant="primary"
                  className="w-100"
                  onClick={handleLoadStudents}
                  disabled={loading}
                  title="Load students for this class and date"
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Loading...
                    </>
                  ) : (
                    "Load Students"
                  )}
                </Button>
              </Col>
              <Col xs={12} md={2}>
                <Button
                  variant="outline-info"
                  className="w-100"
                  onClick={() => navigate("/faculty/history")}
                  title="View attendance history"
                >
                  <FaHistory className="me-1" /> History
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {students.length > 0 && (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <div className="d-flex gap-2 flex-wrap mb-2 mb-md-0">
                <Badge bg="success" className="p-2">
                  <FaUserCheck className="me-1" /> Present: {presentCount}
                </Badge>
                <Badge bg="danger" className="p-2">
                  <FaUserTimes className="me-1" /> Absent: {absentCount}
                </Badge>
                <Badge bg="secondary" className="p-2">
                  <FaUsers className="me-1" /> Total: {totalCount}
                </Badge>
                <Badge
                  bg={
                    todayPercentage >= attendanceThreshold
                      ? "success"
                      : "warning"
                  }
                  className="p-2"
                >
                  📊 Today: {todayPercentage}%
                </Badge>
                {hasExistingRecords && (
                  <Badge bg="warning" text="dark" className="p-2">
                    <FaInfoCircle className="me-1" /> Existing Record
                  </Badge>
                )}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Button
                  variant="success"
                  size="sm"
                  onClick={markAllPresent}
                  title="Mark all students as present"
                >
                  <FaCheck className="me-1" /> All Present
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={markAllAbsent}
                  title="Mark all students as absent"
                >
                  <FaTimes className="me-1" /> All Absent
                </Button>
                <Button
                  variant={hasExistingRecords ? "warning" : "success"}
                  onClick={handleSubmit}
                  disabled={submitting}
                  title={
                    hasExistingRecords
                      ? "Update existing attendance"
                      : "Save new attendance"
                  }
                >
                  {submitting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-1" />
                      {hasExistingRecords
                        ? "Update Attendance"
                        : "Submit Attendance"}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleLoadStudents}
                  disabled={loading}
                  title="Refresh student list"
                >
                  <FaSync className={loading ? "fa-spin" : ""} />
                </Button>
              </div>
            </div>

            {/* ✅ Mobile Card View - 3 Columns */}
            {isMobile ? (
              <div className="d-block d-md-none">
                {students.map((student, index) => {
                  const isPresent = student.status === "Present";
                  const percentage = student.attendancePercentage || 0;
                  const isLowAttendance =
                    percentage <
                      (student.attendanceThreshold ?? attendanceThreshold) &&
                    percentage > 0;

                  return (
                    <Card key={student._id} className="mb-2 shadow-sm border-0">
                      <Card.Body className="p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2">
                              <Badge bg="secondary">{student.rollNumber}</Badge>
                              {isLowAttendance && (
                                <FaExclamationTriangle
                                  className="text-warning"
                                  title="Low attendance"
                                />
                              )}
                            </div>
                            <div className="mt-1">
                              <strong>{student.studentName}</strong>
                            </div>
                          </div>
                          <Button
                            variant={isPresent ? "success" : "danger"}
                            size="sm"
                            className="px-3 py-2"
                            onClick={() => toggleStatus(student._id)}
                            style={{ minWidth: "80px" }}
                            title={
                              isPresent ? "Mark as absent" : "Mark as present"
                            }
                          >
                            {isPresent ? <FaCheck /> : <FaTimes />}
                            <span className="ms-1">
                              {isPresent ? "Present" : "Absent"}
                            </span>
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // ✅ Desktop Table View
              <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                  <div className="table-responsive">
                    <Table bordered hover className="mb-0">
                      <thead className="table-dark">
                        <tr>
                          <th>#</th>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>Attendance %</th>
                          <th>Present / Total</th>
                          <th style={{ minWidth: "120px" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, index) => {
                          const isPresent = student.status === "Present";
                          const percentage = student.attendancePercentage || 0;
                          const studentThreshold =
                            student.attendanceThreshold ?? attendanceThreshold;
                          const isLowAttendance =
                            percentage < studentThreshold && percentage > 0;

                          return (
                            <tr
                              key={student._id}
                              className={isLowAttendance ? "table-warning" : ""}
                            >
                              <td>{index + 1}</td>
                              <td>{student.rollNumber}</td>
                              <td>
                                {student.studentName}
                                {isLowAttendance && (
                                  <FaExclamationTriangle
                                    className="text-warning ms-1"
                                    title="Low attendance"
                                  />
                                )}
                              </td>
                              <td>
                                <Badge
                                  bg={
                                    percentage >= studentThreshold
                                      ? "success"
                                      : percentage > 0
                                        ? "danger"
                                        : "secondary"
                                  }
                                >
                                  {percentage > 0 ? `${percentage}%` : "N/A"}
                                </Badge>
                              </td>
                              <td>
                                {student.presentClasses || 0} /{" "}
                                {student.totalClasses || 0}
                              </td>
                              <td>
                                <Button
                                  variant={isPresent ? "success" : "danger"}
                                  size="sm"
                                  className="w-100"
                                  onClick={() => toggleStatus(student._id)}
                                  title={
                                    isPresent
                                      ? "Click to mark as absent"
                                      : "Click to mark as present"
                                  }
                                >
                                  {isPresent ? <FaCheck /> : <FaTimes />}
                                  {isPresent ? " Present" : " Absent"}
                                </Button>
                                {student.hasExistingRecord && (
                                  <div className="text-muted small text-center mt-1">
                                    ✓ Saved
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            )}

            {hasExistingRecords && (
              <Alert variant="info" className="mt-3">
                <FaInfoCircle className="me-2" />
                Click <strong>Present/Absent</strong> buttons to toggle status,
                then click <strong>"Update Attendance"</strong> to save changes.
              </Alert>
            )}
          </>
        )}

        {!loading && students.length === 0 && selectedClass && date && (
          <Alert variant="info" className="mt-3">
            <FaInfoCircle className="me-2" />
            No students loaded. Click <strong>"Load Students"</strong> to fetch
            students for this class.
          </Alert>
        )}

        {classes.length === 0 && !loadingClasses && (
          <Alert variant="warning" className="mt-3">
            <FaExclamationTriangle className="me-2" />
            No classes assigned to you. Please contact your HOD.
          </Alert>
        )}
      </Container>

      {/* Global Toast Notification */}
      <ToastNotification
        show={toast.toast?.show || false}
        message={toast.toast?.message || ""}
        variant={toast.toast?.variant || "success"}
        onClose={toast.hideToast}
      />
    </>
  );
};

export default AttendancePage;
