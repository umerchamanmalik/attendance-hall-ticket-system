import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
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
  Tabs,
  Tab,
} from "react-bootstrap";
import {
  FaFileAlt,
  FaUserCheck,
  FaUserTimes,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaTrash,
  FaEdit,
  FaSearch,
  FaFilter,
  FaSync,
  FaInfoCircle,
  FaExclamationTriangle,
  FaFilePdf,
  FaUpload,
  FaDownload,
  FaPrint,
} from "react-icons/fa";
import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const DocumentsPage = () => {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    mentorApproved: 0,
    completed: 0,
    rejected: 0,
    total: 0,
  });
  const [filter, setFilter] = useState("all");
  const location = useLocation();
  const isFacultyRoute = location.pathname === "/faculty/documents";
  const [reviewType, setReviewType] = useState(
    isFacultyRoute ? "faculty" : "mentor",
  );
  const [facultyPendingDocs, setFacultyPendingDocs] = useState([]);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmRemarks, setConfirmRemarks] = useState("");
  const [priorPermission, setPriorPermission] = useState(false);
  const [priorPermissionDetails, setPriorPermissionDetails] = useState(null);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [checkingPriorPermission, setCheckingPriorPermission] = useState(false);
  const reviewPanelRef = useRef(null);

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null); // ✅ ADDED

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

  const scrollToReviewPanel = () => {
    setTimeout(() => {
      if (reviewPanelRef.current) {
        reviewPanelRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 200);
  };

  const checkPriorPermission = async (doc) => {
    if (doc.documentType !== "attendance-correction") return;

    setCheckingPriorPermission(true);
    try {
      const response = await api.get(
        `/documents/check-prior-permission/${doc._id}`,
      );

      if (response.data.success) {
        setPriorPermission(response.data.data.hasPriorPermission);
        setPriorPermissionDetails(response.data.data);
      } else {
        setPriorPermission(false);
        setPriorPermissionDetails(null);
      }
    } catch (error) {
      console.error("Error checking prior permission:", error);
      setPriorPermission(false);
      setPriorPermissionDetails(null);
      toast.warning("Failed to check prior permission");
    } finally {
      setCheckingPriorPermission(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/documents/review";
      let statsUrl = "/documents/stats";

      if (isFacultyRoute) {
        url = "/documents/faculty-pending";
        statsUrl = "/documents/stats";
      } else if (filter !== "all") {
        url = `/documents/review?status=${filter}`;
      }

      let docsResponse, statsResponse, facultyPendingResponse;

      if (isFacultyRoute) {
        docsResponse = await api.get("/documents/faculty-pending");
        // ✅ FIXED: Use faculty-specific stats endpoint
        const facultyStatsResponse = await api.get("/documents/faculty-stats");
        facultyPendingResponse = docsResponse;

        const facultyStats = facultyStatsResponse.data.data || {
          pending: 0,
          approved: 0,
          rejected: 0,
          total: 0,
        };

        setStats({
          pending: facultyStats.pending,
          mentorApproved: facultyStats.approved, // reuse "Approved" card slot
          completed: facultyStats.approved, // or use `total` if you want
          rejected: facultyStats.rejected,
          total: facultyStats.total,
        });

        setDocuments(docsResponse.data.data || []);
        setFacultyPendingDocs(docsResponse.data.data || []);
      } else {
        docsResponse = await api.get(url);
        statsResponse = await api.get("/documents/stats");
        facultyPendingResponse = { data: { data: [] } };

        const docsData = docsResponse.data.data || [];
        const pendingCount = docsData.filter(
          (d) => d.status === "pending",
        ).length;
        const mentorApprovedCount = docsData.filter(
          (d) => d.status === "mentor-approved",
        ).length;
        const completedCount = docsData.filter(
          (d) => d.status === "completed",
        ).length;
        const rejectedCount = docsData.filter(
          (d) => d.status === "mentor-rejected",
        ).length;
        const totalCount = docsData.length;

        setStats({
          pending: pendingCount,
          mentorApproved: mentorApprovedCount,
          completed: completedCount,
          rejected: rejectedCount,
          total: totalCount,
        });

        setDocuments(docsData);
        setFacultyPendingDocs(facultyPendingResponse.data.data || []);
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
    setReviewType(isFacultyRoute ? "faculty" : "mentor");
    setSelectedDoc(null);
    setRemarks("");
    setPriorPermission(false);
    setPriorPermissionDetails(null);
  }, [isFacultyRoute]);

  useEffect(() => {
    loadDocuments();
  }, [filter, isFacultyRoute]);

  const handleMentorReview = async (status) => {
    if (!selectedDoc) {
      toast.warning("Please select a document first.");
      return;
    }

    try {
      const response = await api.put(`/documents/review/${selectedDoc._id}`, {
        status,
        remarks,
        priorPermission,
      });

      toast.success(
        response.data.message ||
          `Document ${status.toLowerCase()} successfully.`,
      );
      setRemarks("");
      setPriorPermission(false);
      setPriorPermissionDetails(null);
      setSelectedDoc(null);
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to review document.");
      console.error(error);
    }
  };

  const handleDeleteDocument = (docId) => {
    setConfirmation({
      title: "Delete Document",
      message: "Are you sure you want to delete this document?",
      confirmLabel: "Delete",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/documents/delete/${docId}`);
          toast.success("Document deleted successfully.");
          await loadDocuments();
        } catch (error) {
          toast.error(
            error.response?.data?.error || "Unable to delete document.",
          );
          console.error(error);
        }
      },
    });
  };

  // ✅ FIXED: Takes doc + subjectId directly (avoids async state issue)
  const handleFacultyReview = async (status, subjectId, doc) => {
    if (!doc) {
      toast.warning("Please select a document first.");
      return;
    }
    if (!subjectId) {
      toast.warning("Please select a subject first.");
      return;
    }

    setSelectedDoc(doc); // ✅ set state for the modal
    setConfirmAction(status);
    setConfirmRemarks(remarks);
    setSelectedSubjectId(subjectId);
    setShowConfirmPopup(true);
  };

  const confirmFacultyReview = async () => {
    try {
      const response = await api.put(
        `/documents/faculty-review/${selectedDoc._id}`,
        {
          status: confirmAction,
          remarks: confirmRemarks || remarks,
          subjectId: selectedSubjectId,
        },
      );

      toast.success(
        response.data.message ||
          `Subject ${confirmAction.toLowerCase()} successfully.`,
      );
      setRemarks("");
      setSelectedDoc(null);
      setSelectedSubjectId(null);
      setShowConfirmPopup(false);
      setConfirmAction(null);
      setConfirmRemarks("");
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to review document.");
      console.error(error);
    }
  };

  const getStatusBadge = (doc) => {
    const status = doc?.status || "";
    const documentType = doc?.documentType || "";
    const overallStatus = doc?.overallStatus || "";

    if (documentType === "leave" && status === "mentor-approved") {
      return <Badge bg="success">✅ Completed</Badge>;
    }

    if (
      documentType === "attendance-correction" &&
      status === "mentor-approved"
    ) {
      return <Badge bg="info">⏳ Under Faculty</Badge>;
    }

    // ✅ ADDED: Partially approved state
    if (status === "partially-approved") {
      return <Badge bg="warning">⏳ Partially Approved</Badge>;
    }

    if (status === "completed") {
      // ✅ Show distinct badge based on overall status
      if (overallStatus === "Partially Completed") {
        return <Badge bg="info">⚠️ Partially Completed</Badge>;
      }
      if (overallStatus === "Rejected") {
        return <Badge bg="danger">❌ Rejected</Badge>;
      }
      return <Badge bg="success">✅ Completed</Badge>;
    }

    const variants = {
      pending: "warning",
      "mentor-approved": "info",
      "mentor-rejected": "danger",
      "partially-approved": "warning",
      "faculty-approved": "primary",
      completed: "success",
    };

    const labels = {
      pending: "⏳ Pending",
      "mentor-approved": "⏳ Under Faculty",
      "mentor-rejected": "❌ Rejected",
      "partially-approved": "⏳ Partially Approved",
      "faculty-approved": "⏳ Processing",
      completed: "✅ Completed",
    };

    const displayStatus = overallStatus || status;
    return (
      <Badge bg={variants[status] || "secondary"}>
        {labels[status] || displayStatus}
      </Badge>
    );
  };

  const isPendingReviewDocument = (doc) => {
    const statusValue = (doc?.status || "").toLowerCase();
    const overallValue = (doc?.overallStatus || "").toLowerCase();
    return (
      statusValue === "pending" ||
      statusValue === "mentor-pending" ||
      overallValue === "pending mentor review" ||
      overallValue === "pending"
    );
  };

  const isReviewedDocument = (doc) => {
    const statusValue = (doc?.status || "").toLowerCase();
    return (
      statusValue === "mentor-approved" ||
      statusValue === "mentor-rejected" ||
      statusValue === "partially-approved" ||
      statusValue === "completed"
    );
  };

  const getFilteredCount = (status) => {
    if (status === "all") return documents.length;
    return documents.filter((doc) => {
      const docStatus = doc.overallStatus || doc.status;
      return docStatus === status;
    }).length;
  };

  const getFacultyPendingCount = () => {
    // ✅ Count total subject rows across all faculty pending documents
    return facultyPendingDocs.reduce(
      (sum, d) => sum + (d.subjectApprovals?.length || 0),
      0,
    );
  };

  const getDisplayType = (doc) => {
    if (!doc) return "Unknown Document";
    if (doc.documentType === "attendance-correction")
      return "Attendance Correction";
    if (doc.documentType === "leave") return "Leave Application";
    return doc.documentType;
  };

  // ✅ FIXED: Handle populated objects (subjectName), legacy (name), and raw ObjectIds
  const getSubjectsDisplay = (doc) => {
    if (!doc || doc.documentType !== "attendance-correction") return "-";
    if (!doc.subjects || doc.subjects.length === 0) return "All Subjects";

    return doc.subjects
      .map((s) => {
        // Case 1: Populated object with subjectName (Subject model's real field)
        if (s && typeof s === "object" && s.subjectName) return s.subjectName;
        // Case 2: Populated object with legacy 'name' field
        if (s && typeof s === "object" && s.name) return s.name;
        // Case 3: Populated object with only subjectCode
        if (s && typeof s === "object" && s.subjectCode) return s.subjectCode;
        // Case 4: Plain string
        if (typeof s === "string") return s;
        // Case 5: Raw ObjectId — show short form so React doesn't render "[object Object]"
        if (s && typeof s.toString === "function") {
          const str = s.toString();
          return str.length > 12 ? `Subject#${str.slice(-6)}` : str;
        }
        return "Unknown";
      })
      .join(", ");
  };

  const getDateDisplay = (doc) => {
    if (!doc) return "-";
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

  const toggleExpand = (docId) => {
    setExpandedDoc(expandedDoc === docId ? null : docId);
  };

  const StatCard = ({ icon: Icon, title, value, color, bgColor, onClick }) => (
    <Col xs={6} md={3}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0 h-100`}
        style={{ cursor: onClick ? "pointer" : "default" }}
        onClick={onClick}
      >
        <Card.Body className="text-center p-3">
          <h6 className="text-white-50 mb-1">
            <Icon className="me-1" /> {title}
          </h6>
          <h2 className="mb-0 fw-bold">{value || 0}</h2>
        </Card.Body>
      </Card>
    </Col>
  );

  // ✅ Mobile Card View for Documents
  const renderMobileCards = () => (
    <div className="d-block d-md-none">
      {documents.length === 0 ? (
        <div className="text-center py-4">
          <FaFileAlt size={24} className="mb-2 d-block text-muted" />
          <p className="text-muted">No documents found.</p>
        </div>
      ) : (
        documents.map((doc, index) => {
          const isPending = isPendingReviewDocument(doc);
          const isReviewed = isReviewedDocument(doc);

          return (
            <Card key={doc._id} className="mb-3 shadow-sm border-0">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <Badge bg="secondary">#{index + 1}</Badge>
                      {getStatusBadge(doc)}
                    </div>
                    <h6 className="mb-1">
                      {doc.studentId?.studentName || "Unknown"}
                    </h6>
                    <div className="small text-muted">
                      <div>
                        <strong>USN:</strong>{" "}
                        {doc.studentId?.rollNumber || "N/A"}
                      </div>
                      <div>
                        <strong>Type:</strong> {getDisplayType(doc)}
                      </div>
                      <div>
                        <strong>Subjects:</strong> {getSubjectsDisplay(doc)}
                      </div>
                      <div>
                        <strong>Dates:</strong> {getDateDisplay(doc)}
                      </div>
                      <div
                        className="text-truncate"
                        style={{ maxWidth: "200px" }}
                      >
                        <strong>Description:</strong> {doc.description}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2 flex-wrap">
                  {doc.fileName && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      href={`${baseUrl}/uploads/documents/${doc.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FaEye className="me-1" /> View File
                    </Button>
                  )}
                  {isPending && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setPriorPermission(doc.priorPermission || false);
                        setPriorPermissionDetails(null);
                        setRemarks("");
                        checkPriorPermission(doc);
                        scrollToReviewPanel();
                      }}
                    >
                      <FaEdit className="me-1" /> Review
                    </Button>
                  )}
                  {isReviewed && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc._id)}
                    >
                      <FaTrash className="me-1" /> Delete
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          );
        })
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
          <p className="mt-3 text-muted">Loading documents...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaFileAlt className="me-2 text-primary" />
          {isFacultyRoute ? "Faculty Document Review" : "Document Review"}
        </h2>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaClock}
            title={isFacultyRoute ? "My Pending" : "Pending"}
            value={stats.pending}
            bgColor="bg-warning"
            onClick={() => !isFacultyRoute && setFilter("Pending")}
          />
          <StatCard
            icon={FaUserCheck}
            title={isFacultyRoute ? "My Approved" : "Approved"}
            value={stats.mentorApproved}
            bgColor="bg-info"
            onClick={() => !isFacultyRoute && setFilter("mentor-approved")}
          />
          <StatCard
            icon={FaCheckCircle}
            title="Total"
            value={stats.total}
            bgColor="bg-success"
            onClick={() => !isFacultyRoute && setFilter("Completed")}
          />
          <StatCard
            icon={FaTimesCircle}
            title={isFacultyRoute ? "My Rejected" : "Rejected"}
            value={stats.rejected}
            bgColor="bg-danger"
            onClick={() => !isFacultyRoute && setFilter("Rejected")}
          />
        </Row>

        {/* Stats Summary */}
        <Card className="bg-light mb-3 border-0">
          <Card.Body className="py-2">
            <small className="text-muted">
              <FaInfoCircle className="me-1" />
              {isFacultyRoute ? (
                <>
                  My Subjects — Pending:{" "}
                  <strong className="text-warning">{stats.pending}</strong> |
                  Approved:{" "}
                  <strong className="text-info">{stats.mentorApproved}</strong>{" "}
                  | Rejected:{" "}
                  <strong className="text-danger">{stats.rejected}</strong> |
                  Total: <strong>{stats.total}</strong>
                </>
              ) : (
                <>
                  Total Documents: <strong>{stats.total}</strong> | Pending:{" "}
                  <strong className="text-warning">{stats.pending}</strong> |
                  Approved:{" "}
                  <strong className="text-info">{stats.mentorApproved}</strong>{" "}
                  | Completed:{" "}
                  <strong className="text-success">{stats.completed}</strong> |
                  Rejected:{" "}
                  <strong className="text-danger">{stats.rejected}</strong>
                </>
              )}
            </small>
          </Card.Body>
        </Card>

        {/* Review Type Tabs */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Body className="p-3">
            <Tabs
              activeKey={reviewType}
              onSelect={(k) => setReviewType(k)}
              className="mb-0"
            >
              {!isFacultyRoute && (
                <Tab
                  eventKey="mentor"
                  title={`Mentor Review (${stats.pending})`}
                />
              )}
              {isFacultyRoute && (
                <Tab
                  eventKey="faculty"
                  title={`Faculty Review (${getFacultyPendingCount()})`}
                />
              )}
            </Tabs>
          </Card.Body>
        </Card>

        {/* Filter Buttons - Only for Mentor View */}
        {!isFacultyRoute && reviewType === "mentor" && (
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button
              variant={filter === "all" ? "primary" : "outline-primary"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({stats.total})
            </Button>
            <Button
              variant={filter === "Pending" ? "warning" : "outline-warning"}
              size="sm"
              onClick={() => setFilter("Pending")}
            >
              Pending ({stats.pending})
            </Button>
            <Button
              variant={filter === "mentor-approved" ? "info" : "outline-info"}
              size="sm"
              onClick={() => setFilter("mentor-approved")}
            >
              Approved ({stats.mentorApproved})
            </Button>
            <Button
              variant={filter === "Completed" ? "success" : "outline-success"}
              size="sm"
              onClick={() => setFilter("Completed")}
            >
              Completed ({stats.completed})
            </Button>
            <Button
              variant={filter === "Rejected" ? "danger" : "outline-danger"}
              size="sm"
              onClick={() => setFilter("Rejected")}
            >
              Rejected ({stats.rejected})
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadDocuments}
            >
              <FaSync /> Refresh
            </Button>
          </div>
        )}

        {/* Documents Table / Cards - Mentor View */}
        {reviewType === "mentor" && (
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-secondary text-white">
              <h5 className="mb-0">
                <FaFileAlt className="me-2" /> Documents List
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {documents.length === 0 ? (
                <div className="text-center py-4">
                  <Alert variant="info" className="m-3">
                    No documents found.
                  </Alert>
                </div>
              ) : /* Mobile Card View */
              isMobile ? (
                renderMobileCards()
              ) : (
                /* Desktop Table View */
                <div className="table-responsive d-none d-md-block">
                  <Table bordered hover className="mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>USN</th>
                        <th>Type</th>
                        <th>Subjects</th>
                        <th>Dates</th>
                        <th>Description</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">File</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, index) => {
                        const isPending = isPendingReviewDocument(doc);
                        const isReviewed = isReviewedDocument(doc);

                        return (
                          <tr
                            key={doc._id}
                            className={
                              selectedDoc?._id === doc._id ? "table-active" : ""
                            }
                            style={{
                              cursor: isPending ? "pointer" : "default",
                            }}
                            onClick={() => {
                              if (isPending) {
                                setSelectedDoc(doc);
                                setPriorPermission(
                                  doc.priorPermission || false,
                                );
                                setPriorPermissionDetails(null);
                                setRemarks("");
                                checkPriorPermission(doc);
                                scrollToReviewPanel();
                              }
                            }}
                          >
                            <td>{index + 1}</td>
                            <td>
                              <strong>
                                {doc.studentId?.studentName || "Unknown"}
                              </strong>
                              <br />
                              <small className="text-muted">
                                Sem {doc.studentId?.semester} - Sec{" "}
                                {doc.studentId?.section}
                              </small>
                            </td>
                            <td>{doc.studentId?.rollNumber || "N/A"}</td>
                            <td>
                              <Badge
                                bg={
                                  doc.documentType === "attendance-correction"
                                    ? "info"
                                    : "secondary"
                                }
                              >
                                {getDisplayType(doc)}
                              </Badge>
                              {doc.priorPermission &&
                                doc.documentType ===
                                  "attendance-correction" && (
                                  <Badge bg="success" className="ms-1">
                                    Prior
                                  </Badge>
                                )}
                            </td>
                            <td>
                              <small>{getSubjectsDisplay(doc)}</small>
                            </td>
                            <td>
                              <small>{getDateDisplay(doc)}</small>
                            </td>
                            <td>
                              <div
                                className="text-truncate"
                                style={{ maxWidth: "120px" }}
                              >
                                {doc.description}
                              </div>
                            </td>
                            <td className="text-center">
                              {getStatusBadge(doc)}
                            </td>
                            <td className="text-center">
                              {doc.fileName ? (
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  href={`${baseUrl}/uploads/documents/${doc.fileName}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FaEye /> View
                                </Button>
                              ) : (
                                <span className="text-muted">No file</span>
                              )}
                            </td>
                            <td className="text-center">
                              {isPending && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDoc(doc);
                                    setPriorPermission(
                                      doc.priorPermission || false,
                                    );
                                    setPriorPermissionDetails(null);
                                    setRemarks("");
                                    checkPriorPermission(doc);
                                    scrollToReviewPanel();
                                  }}
                                >
                                  <FaEdit /> Review
                                </Button>
                              )}
                              {isReviewed && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDocument(doc._id);
                                  }}
                                >
                                  <FaTrash /> Delete
                                </Button>
                              )}
                              {!isPending && !isReviewed && (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="bg-white">
              <small className="text-muted">
                <FaInfoCircle className="me-1" />
                Total: {documents.length} documents
              </small>
            </Card.Footer>
          </Card>
        )}

        {/* Mentor Review Panel */}
        {reviewType === "mentor" &&
          selectedDoc &&
          isPendingReviewDocument(selectedDoc) && (
            <Card
              ref={reviewPanelRef}
              className="shadow-sm border-primary mb-4"
            >
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">
                  <FaEdit className="me-2" /> Mentor Review
                </h5>
              </Card.Header>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={3}>
                    <strong>Student:</strong>
                    <div>{selectedDoc.studentId?.studentName}</div>
                    <small className="text-muted">
                      {selectedDoc.studentId?.rollNumber}
                    </small>
                  </Col>
                  <Col md={3}>
                    <strong>Document Type:</strong>
                    <div>{getDisplayType(selectedDoc)}</div>
                  </Col>
                  <Col md={3}>
                    <strong>Subjects:</strong>
                    <div>{getSubjectsDisplay(selectedDoc)}</div>
                  </Col>
                  <Col md={3}>
                    <strong>Dates:</strong>
                    <div>{getDateDisplay(selectedDoc)}</div>
                  </Col>
                </Row>
                <Row className="mb-3">
                  <Col xs={12}>
                    <strong>Description:</strong>
                    <div className="p-2 bg-light rounded">
                      {selectedDoc.description}
                    </div>
                  </Col>
                </Row>

                {/* Prior Permission Detection */}
                {selectedDoc.documentType === "attendance-correction" && (
                  <Card className="mb-3 border">
                    <Card.Body>
                      <h6 className="mb-2">📌 Prior Permission Status</h6>
                      {checkingPriorPermission ? (
                        <div className="text-center py-2">
                          <Spinner animation="border" size="sm" />
                          <span className="ms-2">
                            Checking prior permission records...
                          </span>
                        </div>
                      ) : priorPermissionDetails?.hasPriorPermission ? (
                        <>
                          <Alert variant="success">
                            <strong>✅ Prior Permission Found</strong>
                            <br />
                            <small>
                              The student has prior permission for the specified
                              dates.
                            </small>
                          </Alert>
                          <div className="table-responsive">
                            <Table size="sm" bordered>
                              <thead className="table-light">
                                <tr>
                                  <th>Absence Date</th>
                                  <th>Leave Start</th>
                                  <th>Leave End</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {priorPermissionDetails.details.map(
                                  (detail, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        {new Date(
                                          detail.date,
                                        ).toLocaleDateString()}
                                      </td>
                                      <td>
                                        {new Date(
                                          detail.leaveStartDate,
                                        ).toLocaleDateString()}
                                      </td>
                                      <td>
                                        {new Date(
                                          detail.leaveEndDate,
                                        ).toLocaleDateString()}
                                      </td>
                                      <td>
                                        <Badge bg="success">Verified</Badge>
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </Table>
                          </div>
                          <Form.Check
                            type="checkbox"
                            checked={Boolean(priorPermission)}
                            onChange={(e) =>
                              setPriorPermission(e.target.checked)
                            }
                            id="priorPermission"
                            label={
                              <>
                                <strong>
                                  ✅ Confirm: Student had prior permission for
                                  these dates
                                </strong>
                                <br />
                                <small className="text-muted">
                                  By checking this, you confirm that the student
                                  had valid prior permission.
                                </small>
                              </>
                            }
                          />
                        </>
                      ) : (
                        <>
                          <Alert variant="danger">
                            <strong>❌ No Prior Permission Record Found</strong>
                            <br />
                            <small>
                              The student does not have any approved leave
                              application for the specified dates.
                            </small>
                          </Alert>
                          <Form.Check
                            type="checkbox"
                            checked={Boolean(priorPermission)}
                            onChange={(e) =>
                              setPriorPermission(e.target.checked)
                            }
                            id="priorPermission"
                            label={
                              <>
                                <strong>
                                  ⚠️ Override: Grant prior permission manually
                                </strong>
                                <br />
                                <small className="text-muted">
                                  Only check this if you have verified with the
                                  student and confirm they had prior permission.
                                </small>
                              </>
                            }
                          />
                        </>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* Leave Application Info */}
                {selectedDoc.documentType === "leave" && (
                  <Alert variant="info" className="mb-3">
                    <strong>📌 Leave Application</strong>
                    <br />
                    <small>
                      This is a leave application. The student is requesting
                      leave from{" "}
                      <strong>
                        {new Date(
                          selectedDoc.leaveStartDate,
                        ).toLocaleDateString()}
                      </strong>{" "}
                      to{" "}
                      <strong>
                        {new Date(
                          selectedDoc.leaveEndDate,
                        ).toLocaleDateString()}
                      </strong>
                      .
                    </small>
                  </Alert>
                )}

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows="3"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add your remarks here..."
                  />
                </Form.Group>

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    variant="success"
                    onClick={() => handleMentorReview("Approved")}
                  >
                    <FaCheckCircle className="me-1" /> Approve
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleMentorReview("Rejected")}
                  >
                    <FaTimesCircle className="me-1" /> Reject
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedDoc(null);
                      setRemarks("");
                      setPriorPermission(false);
                      setPriorPermissionDetails(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

        {/* ✅ FIXED: Faculty Pending List — one row per (document, my-subject) */}
        {reviewType === "faculty" && facultyPendingDocs.length > 0 && (
          <Card className="shadow-sm border-info mb-4">
            <Card.Header className="bg-info text-white">
              <h5 className="mb-0">
                <FaUserCheck className="me-2" />
                Pending Faculty Review ({getFacultyPendingCount()} subjects)
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Student</th>
                      <th>USN</th>
                      <th>Subject</th>
                      <th>Dates</th>
                      <th>Reason</th>
                      <th>Prior</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyPendingDocs.flatMap((doc) =>
                      (doc.subjectApprovals || []).map((sa) => (
                        <tr key={`${doc._id}-${sa.subjectId}`}>
                          <td>
                            <strong>
                              {doc.studentId?.studentName || "Unknown"}
                            </strong>
                          </td>
                          <td>{doc.studentId?.rollNumber || "N/A"}</td>
                          <td>
                            <Badge bg="primary">{sa.subjectName}</Badge>
                          </td>
                          <td>
                            <small>{getDateDisplay(doc)}</small>
                          </td>
                          <td>
                            <div
                              className="text-truncate"
                              style={{ maxWidth: "160px" }}
                            >
                              {doc.description}
                            </div>
                          </td>
                          <td className="text-center">
                            {doc.priorPermission ? (
                              <Badge bg="success">Yes</Badge>
                            ) : (
                              <Badge bg="secondary">No</Badge>
                            )}
                          </td>
                          <td className="text-center">
                            <Button
                              variant="success"
                              size="sm"
                              className="me-1"
                              onClick={() => {
                                setRemarks("");
                                handleFacultyReview(
                                  "Approved",
                                  sa.subjectId,
                                  doc,
                                );
                              }}
                            >
                              <FaCheckCircle /> Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setRemarks("");
                                handleFacultyReview(
                                  "Rejected",
                                  sa.subjectId,
                                  doc,
                                );
                              }}
                            >
                              <FaTimesCircle /> Reject
                            </Button>
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )}
      </Container>

      {/* Faculty Confirmation Modal */}
      <Modal
        show={showConfirmPopup}
        onHide={() => setShowConfirmPopup(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <FaExclamationTriangle className="me-2" />
            Confirm Attendance Correction
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>⚠️ Please Review Carefully Before Confirming</strong>
            <br />
            <small>
              This action will update attendance records permanently.
            </small>
          </Alert>

          <Card className="mb-3">
            <Card.Body>
              <Row>
                <Col md={6}>
                  <strong>Student:</strong>
                  <div>{selectedDoc?.studentId?.studentName}</div>
                  <small className="text-muted">
                    {selectedDoc?.studentId?.rollNumber}
                  </small>
                </Col>
                <Col md={6}>
                  <strong>Semester:</strong>
                  <div>Semester {selectedDoc?.studentId?.semester}</div>
                  <small className="text-muted">
                    Section {selectedDoc?.studentId?.section}
                  </small>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Body>
              <Row>
                <Col md={6}>
                  <strong>📚 Subject:</strong>
                  <div>
                    {selectedSubjectId
                      ? selectedDoc?.subjectApprovals?.find(
                          (sa) =>
                            sa.subjectId?.toString() ===
                            selectedSubjectId?.toString(),
                        )?.subjectName || "-"
                      : "-"}
                  </div>
                </Col>
                <Col md={6}>
                  <strong>📅 Dates:</strong>
                  <div>{getDateDisplay(selectedDoc)}</div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Body>
              <strong>📝 Reason:</strong>
              <div className="p-2 bg-light rounded mt-1">
                {selectedDoc?.description}
              </div>
            </Card.Body>
          </Card>

          <Alert variant="info">
            <strong>📌 Action:</strong> You are about to{" "}
            <span
              className={`fw-bold ${confirmAction === "Approved" ? "text-success" : "text-danger"}`}
            >
              {confirmAction === "Approved" ? "APPROVE" : "REJECT"}
            </span>{" "}
            this subject's attendance correction.
            {confirmAction === "Approved" && (
              <div className="mt-2">
                <small>
                  ✅ This will update attendance to <strong>Present</strong> for
                  this subject on all dates.
                </small>
              </div>
            )}
          </Alert>

          <Form.Group>
            <Form.Label className="fw-bold">Remarks</Form.Label>
            <Form.Control
              as="textarea"
              rows="2"
              value={confirmRemarks}
              onChange={(e) => setConfirmRemarks(e.target.value)}
              placeholder="Add any additional remarks..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowConfirmPopup(false)}
          >
            Cancel
          </Button>
          <Button
            variant={confirmAction === "Approved" ? "success" : "danger"}
            onClick={confirmFacultyReview}
            size="lg"
          >
            {confirmAction === "Approved"
              ? "✅ Confirm & Update"
              : "❌ Confirm Reject"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel || "Confirm"}
        confirmVariant={confirmation?.confirmVariant || "primary"}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => {
          const onConfirm = confirmation?.onConfirm;
          setConfirmation(null);
          await onConfirm?.();
        }}
      />
    </>
  );
};

export default DocumentsPage;
