import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
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
} from "react-bootstrap";
import {
  FaChartLine,
  FaDownload,
  FaArrowLeft,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaBook,
  FaUserGraduate,
  FaCalendarAlt,
  FaTrophy,
  FaFire,
  FaShieldAlt,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

const AttendanceProgressPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);
  const [student, setStudent] = useState(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const studentResponse = await api.get("/students/me");
      const studentData = studentResponse.data.data;
      setStudent(studentData);

      if (studentData.showAttendanceProgress === false) {
        setError("Attendance progress feature is disabled by your mentor.");
        setLoading(false);
        return;
      }

      const studentId = studentData._id;
      const analyticsResponse = await api.get(
        `/students/analytics/${studentId}`,
      );

      if (analyticsResponse.data.success) {
        setAnalyticsData(analyticsResponse.data.data);
      } else {
        setError(analyticsResponse.data.error || "Failed to load analytics");
      }
    } catch (error) {
      if (error.response?.data?.disabled) {
        setError("Attendance progress feature is disabled by your mentor.");
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else if (error.response?.status === 404) {
        setError("Analytics endpoint not found. Please check backend routes.");
      } else if (error.response?.status === 403) {
        setError("You don't have permission to view this data.");
      } else {
        setError(
          error.message || "Failed to load attendance data. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!analyticsData) return;

    setExporting(true);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Attendance Analytics Report", pageWidth / 2, 20, {
        align: "center",
      });

      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text(`Student: ${analyticsData.student.name}`, 20, 35);
      doc.text(`Roll Number: ${analyticsData.student.rollNumber}`, 20, 42);
      doc.text(
        `Semester: ${analyticsData.student.semester} | Section: ${analyticsData.student.section}`,
        20,
        49,
      );
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, 20, 56);

      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text("Attendance Summary", 20, 68);

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      const summary = analyticsData.summary;
      doc.text(
        `Overall Attendance: ${summary.overallPercentage}% (${summary.overallStatus})`,
        20,
        76,
      );
      doc.text(`Total Classes: ${summary.totalRecords}`, 20, 83);
      doc.text(`Present: ${summary.presentRecords}`, 20, 90);
      doc.text(`Absent: ${summary.absentRecords}`, 20, 97);
      if (summary.safeToSkip > 0) {
        doc.text(`Safe to Skip: ${summary.safeToSkip} classes`, 20, 104);
      }
      if (summary.classesNeeded > 0) {
        doc.text(
          `Classes Needed to reach ${analyticsData.attendanceThreshold ?? 85}%: ${summary.classesNeeded}`,
          20,
          111,
        );
      }

      let yPos = 120;
      if (analyticsData.bestSubject) {
        doc.text(
          `Best Subject: ${analyticsData.bestSubject.subjectName} (${analyticsData.bestSubject.percentage}%)`,
          20,
          yPos,
        );
        yPos += 8;
      }
      if (analyticsData.worstSubject) {
        doc.text(
          `Needs Improvement: ${analyticsData.worstSubject.subjectName} (${analyticsData.worstSubject.percentage}%)`,
          20,
          yPos,
        );
        yPos += 8;
      }

      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text("Subject-wise Attendance", 20, yPos + 10);

      const tableData = analyticsData.subjectStats.map((subject) => [
        subject.subjectName,
        `${subject.percentage}%`,
        `${subject.present}/${subject.total}`,
        `${subject.absent}/${subject.total}`,
        subject.status,
      ]);

      doc.autoTable({
        startY: yPos + 15,
        head: [["Subject", "Attendance", "Present", "Absent", "Status"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [52, 73, 94], textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 25, halign: "center" },
          4: { cellWidth: 35, halign: "center" },
        },
      });

      const finalY = doc.lastAutoTable.finalY || 220;
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "This is a system-generated report.",
        pageWidth / 2,
        finalY + 20,
        { align: "center" },
      );

      doc.save(
        `Attendance_Report_${analyticsData.student.name}_${new Date().toISOString().split("T")[0]}.pdf`,
      );

      toast.success("✅ PDF report exported successfully!");
    } catch (error) {
      toast.error("❌ Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const getProgressColor = (percentage) => {
    const threshold = analyticsData?.attendanceThreshold ?? 85;
    if (percentage >= threshold) return "success";
    if (percentage >= threshold - 10) return "warning";
    return "danger";
  };

  const getStatusIcon = (percentage) => {
    const threshold = analyticsData?.attendanceThreshold ?? 85;
    if (percentage >= threshold) return "✅";
    if (percentage >= threshold - 10) return "⚠️";
    return "🔴";
  };

  const StatCard = ({ icon: Icon, title, value, color, bgColor, subtitle }) => (
    <Col xs={6} md={3}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0 h-100`}
      >
        <Card.Body className="text-center p-3">
          <h6 className="text-white-50 small mb-1">{title}</h6>
          <h2 className="mb-0">{value || 0}</h2>
          {subtitle && <small className="text-white-50">{subtitle}</small>}
        </Card.Body>
      </Card>
    </Col>
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
          <h5 className="mt-3 text-muted">Loading attendance analytics...</h5>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <ErrorMessage
          error={error}
          onRetry={loadData}
          onBack={() => navigate("/student")}
        />
      </Container>
    );
  }

  if (!analyticsData) {
    return (
      <Container className="py-4">
        <Alert variant="info" className="shadow-sm">
          <Alert.Heading as="h4">
            <FaInfoCircle className="me-2" /> No Data Available
          </Alert.Heading>
          <p>
            You don't have any attendance records yet. Please attend classes
            regularly.
          </p>
          <hr />
          <Button variant="secondary" onClick={() => navigate("/student")}>
            <FaArrowLeft className="me-1" /> Back to Dashboard
          </Button>
        </Alert>
      </Container>
    );
  }

  const {
    student: studentInfo,
    summary,
    subjectStats = [],
    trendData = [],
    bestSubject,
    worstSubject,
  } = analyticsData;
  const attendanceThreshold = analyticsData.attendanceThreshold ?? 85;

  // ✅ Check if data exists
  const hasSubjectData = subjectStats && subjectStats.length > 0;
  const hasTrendData = trendData && trendData.length > 0;

  // ✅ Subject Chart Data - with null checks
  const subjectChartData = {
    labels: hasSubjectData ? subjectStats.map((s) => s.subjectName) : [],
    datasets: [
      {
        label: "Attendance %",
        data: hasSubjectData ? subjectStats.map((s) => s.percentage) : [],
        backgroundColor: hasSubjectData
          ? subjectStats.map((s) =>
              s.percentage >= attendanceThreshold
                ? "#28a745"
                : s.percentage >= attendanceThreshold - 10
                  ? "#ffc107"
                  : "#dc3545",
            )
          : [],
        borderRadius: 5,
      },
    ],
  };

  // ✅ Distribution Chart Data - with null checks
  const eligibleCount = hasSubjectData
    ? subjectStats.filter((s) => s.percentage >= attendanceThreshold).length
    : 0;
  const atRiskCount = hasSubjectData
    ? subjectStats.filter(
        (s) =>
          s.percentage >= attendanceThreshold - 10 &&
          s.percentage < attendanceThreshold,
      ).length
    : 0;
  const needsAttentionCount = hasSubjectData
    ? subjectStats.filter(
        (s) => s.percentage < attendanceThreshold - 10 && s.percentage > 0,
      ).length
    : 0;
  const hasDistributionData =
    eligibleCount > 0 || atRiskCount > 0 || needsAttentionCount > 0;

  const distributionData = {
    labels: [
      `Eligible (≥${attendanceThreshold}%)`,
      `At Risk (${attendanceThreshold - 10}-${attendanceThreshold - 1}%)`,
      `Needs Attention (<${attendanceThreshold - 10}%)`,
    ],
    datasets: [
      {
        data: [eligibleCount, atRiskCount, needsAttentionCount],
        backgroundColor: ["#28a745", "#ffc107", "#dc3545"],
        borderWidth: 0,
      },
    ],
  };

  // ✅ Trend Chart Data - with null checks
  const trendChartData = {
    labels: hasTrendData ? trendData.map((t) => t.day) : [],
    datasets: [
      {
        label: "Attendance %",
        data: hasTrendData ? trendData.map((t) => t.percentage) : [],
        borderColor: "#007bff",
        backgroundColor: "rgba(0, 123, 255, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: hasTrendData
          ? trendData.map((t) =>
              t.percentage >= attendanceThreshold
                ? "#28a745"
                : t.percentage >= attendanceThreshold - 10
                  ? "#ffc107"
                  : "#dc3545",
            )
          : [],
        pointRadius: 5,
      },
    ],
  };

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">
              <FaChartLine className="me-2 text-primary" />
              Attendance Analytics Dashboard
            </h2>
            <p className="text-muted mb-0">
              <FaUserGraduate className="me-1" />
              {studentInfo?.name || "Student"} | Semester{" "}
              {studentInfo?.semester || "N/A"} | Section{" "}
              {studentInfo?.section || "N/A"}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap mt-2 mt-md-0">
            <Button variant="success" onClick={exportPDF} disabled={exporting}>
              {exporting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <FaDownload className="me-1" /> Export PDF Report
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/student")}>
              <FaArrowLeft className="me-1" /> Back
            </Button>
          </div>
        </div>

        <Alert variant="info" className="mb-4">
          <FaInfoCircle className="me-2" />
          Your department's attendance threshold is {attendanceThreshold}%.
        </Alert>

        {/* Summary Cards */}
        <Row className="g-3 mb-4">
          <StatCard
            icon={FaChartLine}
            title="Overall Attendance"
            value={`${summary?.overallPercentage || 0}%`}
            bgColor={`bg-${summary?.statusColor || "secondary"}`}
            subtitle={summary?.overallStatus || "No Data"}
          />
          <StatCard
            icon={FaBook}
            title="Total Classes"
            value={summary?.totalRecords || 0}
            bgColor="bg-primary"
          />
          <StatCard
            icon={FaCheckCircle}
            title="Present"
            value={summary?.presentRecords || 0}
            bgColor="bg-success"
          />
          <StatCard
            icon={FaTimesCircle}
            title="Absent"
            value={summary?.absentRecords || 0}
            bgColor="bg-danger"
          />
        </Row>

        {/* Insights Cards */}
        {(summary?.safeToSkip > 0 ||
          summary?.classesNeeded > 0 ||
          bestSubject ||
          worstSubject) && (
          <Row className="g-3 mb-4">
            {summary?.safeToSkip > 0 && (
              <Col md={4}>
                <Card className="border-success shadow-sm h-100">
                  <Card.Body className="text-center">
                    <FaFire className="text-success mb-2" size={24} />
                    <h5 className="text-success">✅ Safe to Skip</h5>
                    <h2 className="text-success">{summary.safeToSkip}</h2>
                    <small className="text-muted">classes you can skip</small>
                  </Card.Body>
                </Card>
              </Col>
            )}
            {summary?.classesNeeded > 0 && (
              <Col md={4}>
                <Card className="border-warning shadow-sm h-100">
                  <Card.Body className="text-center">
                    <FaClock className="text-warning mb-2" size={24} />
                    <h5 className="text-warning">🎯 Need to Attend</h5>
                    <h2 className="text-warning">{summary.classesNeeded}</h2>
                    <small className="text-muted">
                      more classes to reach {attendanceThreshold}%
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            )}
            {bestSubject && (
              <Col md={4}>
                <Card className="border-success shadow-sm h-100">
                  <Card.Body className="text-center">
                    <FaTrophy className="text-success mb-2" size={24} />
                    <h5 className="text-success">🏆 Best Subject</h5>
                    <h4 className="mb-1">{bestSubject.subjectName}</h4>
                    <h2 className="text-success">{bestSubject.percentage}%</h2>
                    <small className="text-muted">
                      {bestSubject.present}/{bestSubject.total} classes
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            )}
            {worstSubject && !bestSubject && (
              <Col md={4}>
                <Card className="border-danger shadow-sm h-100">
                  <Card.Body className="text-center">
                    <FaExclamationTriangle
                      className="text-danger mb-2"
                      size={24}
                    />
                    <h5 className="text-danger">📉 Needs Improvement</h5>
                    <h4 className="mb-1">{worstSubject.subjectName}</h4>
                    <h2 className="text-danger">{worstSubject.percentage}%</h2>
                    <small className="text-muted">
                      {worstSubject.present}/{worstSubject.total} classes
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        )}

        {/* Charts Section */}
        <Row className="g-3 mb-4">
          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaChartLine className="me-2 text-primary" /> Subject-wise
                  Attendance
                </h6>
              </Card.Header>
              <Card.Body>
                {hasSubjectData ? (
                  <Bar
                    data={subjectChartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            afterBody: function (context) {
                              const index = context[0].dataIndex;
                              const subject = subjectStats[index];
                              if (subject) {
                                return [
                                  `Total: ${subject.total}`,
                                  `Present: ${subject.present}`,
                                  `Absent: ${subject.absent}`,
                                ];
                              }
                              return [];
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          grid: { display: true },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="text-center py-4 text-muted">
                    <FaInfoCircle size={24} className="mb-2" />
                    <p>No subject data available</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaInfoCircle className="me-2 text-primary" /> Attendance
                  Distribution
                </h6>
              </Card.Header>
              <Card.Body className="d-flex justify-content-center">
                {hasDistributionData ? (
                  <div style={{ maxWidth: "300px", width: "100%" }}>
                    <Doughnut
                      data={distributionData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: "bottom",
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted">
                    <FaInfoCircle size={24} className="mb-2" />
                    <p>No distribution data available</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Weekly Trend */}
        <Row className="g-3 mb-4">
          <Col xs={12}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaCalendarAlt className="me-2 text-primary" /> Weekly
                  Attendance Trend (Last 30 Days)
                </h6>
              </Card.Header>
              <Card.Body>
                {hasTrendData ? (
                  <Line
                    data={trendChartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="text-center py-4 text-muted">
                    <FaInfoCircle size={24} className="mb-2" />
                    <p>No trend data available</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Subject-wise Details Table */}
        <Row className="g-3 mb-4">
          <Col xs={12}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaBook className="me-2 text-primary" /> Subject-wise Detailed
                  Breakdown
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                {hasSubjectData ? (
                  <div className="table-responsive">
                    <Table bordered hover className="mb-0">
                      <thead className="table-dark">
                        <tr>
                          <th>#</th>
                          <th>Subject</th>
                          <th>Total</th>
                          <th>Present</th>
                          <th>Absent</th>
                          <th>Attendance %</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectStats.map((subject, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{subject.subjectName}</td>
                            <td>{subject.total}</td>
                            <td className="text-success">{subject.present}</td>
                            <td className="text-danger">{subject.absent}</td>
                            <td>
                              <Badge bg={getProgressColor(subject.percentage)}>
                                {subject.percentage}%
                              </Badge>
                            </td>
                            <td>
                              <Badge bg={getProgressColor(subject.percentage)}>
                                {getStatusIcon(subject.percentage)}{" "}
                                {subject.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted">
                    <p>No subject data available</p>
                  </div>
                )}
              </Card.Body>
              <Card.Footer className="bg-white">
                <small className="text-muted">
                  <FaInfoCircle className="me-1" />
                  Total: {subjectStats?.length || 0} subjects
                </small>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>

      <ToastNotification
        show={toast.toast?.show || false}
        message={toast.toast?.message || ""}
        variant={toast.toast?.variant || "success"}
        onClose={toast.hideToast}
      />
    </>
  );
};

export default AttendanceProgressPage;
