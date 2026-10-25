import React, { useState } from "react";
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
  ProgressBar,
} from "react-bootstrap";
import {
  FaUpload,
  FaDownload,
  FaFileExcel,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaSync,
  FaFile,
  FaUsers,
  FaBook,
  FaChalkboardTeacher,
  FaTicketAlt,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ErrorMessage from "../components/ErrorMessage";

const BulkUploadPage = () => {
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState("students");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const toast = useToast(); // ✅ Use global toast

  const uploadTypes = [
    { value: "students", label: "Students", icon: FaUsers, color: "primary" },
    { value: "subjects", label: "Subjects", icon: FaBook, color: "info" },
    {
      value: "faculty",
      label: "Faculty Allocation",
      icon: FaChalkboardTeacher,
      color: "warning",
    },
    {
      value: "halltickets",
      label: "Hall Tickets",
      icon: FaTicketAlt,
      color: "success",
    },
  ];

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(`/bulk/template/${uploadType}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${uploadType}_template.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("✅ Template downloaded successfully!");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error(error.response?.data?.error || "Failed to download template");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.warning("Please select a file first");
      return;
    }

    // Validate file type
    const validTypes = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    if (!validTypes.includes(fileExtension)) {
      toast.warning("Please upload an Excel file (.xlsx, .xls) or CSV file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("File size must be less than 5MB");
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post(`/bulk/upload/${uploadType}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setResults(response.data.data);
        toast.success(
          response.data.message || "✅ Upload completed successfully!",
        );
        setFile(null);
        document.getElementById("fileInput").value = "";
        setUploadProgress(0);
      } else {
        throw new Error(response.data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading:", error);
      setError(error.response?.data?.error || "Upload failed");
      toast.error(
        error.response?.data?.error ||
          "Upload failed. Please check your file and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = () => {
    const found = uploadTypes.find((t) => t.value === uploadType);
    return found ? found.label : "Students";
  };

  const getTypeIcon = () => {
    const found = uploadTypes.find((t) => t.value === uploadType);
    return found ? found.icon : FaUsers;
  };

  const StatCard = ({ icon: Icon, title, value, color, bgColor }) => (
    <Col xs={6} md={4}>
      <Card
        className={`${bgColor || "bg-primary"} text-white shadow-sm border-0`}
      >
        <Card.Body className="text-center p-3">
          <h6 className="text-white-50 small mb-1">{title}</h6>
          <h2 className="mb-0">{value || 0}</h2>
        </Card.Body>
      </Card>
    </Col>
  );

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaUpload className="me-2 text-primary" />
          Bulk Upload
        </h2>

        {/* Upload Steps */}
        <Row className="g-4">
          {/* Step 1: Select Upload Type */}
          <Col xs={12} md={4}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">1. Select Upload Type</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Label className="fw-bold">Upload Type</Form.Label>
                  <Form.Select
                    value={uploadType}
                    onChange={(e) => {
                      setUploadType(e.target.value);
                      setResults(null);
                      setFile(null);
                      document.getElementById("fileInput").value = "";
                    }}
                  >
                    {uploadTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Form.Select>
                  <div className="mt-2">
                    <Badge bg="info">
                      <FaInfoCircle className="me-1" />
                      {getTypeLabel()} upload
                    </Badge>
                  </div>
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>

          {/* Step 2: Download Template */}
          <Col xs={12} md={4}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Header className="bg-success text-white">
                <h5 className="mb-0">2. Download Template</h5>
              </Card.Header>
              <Card.Body>
                <Button
                  variant="success"
                  className="w-100"
                  onClick={handleDownloadTemplate}
                >
                  <FaDownload className="me-2" />
                  Download {getTypeLabel()} Template
                </Button>
                <p className="text-muted mt-2 small">
                  <FaInfoCircle className="me-1" />
                  Fill the template with your data and save as .xlsx or .csv
                </p>
                <div className="mt-2">
                  <small className="text-muted">
                    <strong>Format:</strong> Excel (.xlsx, .xls) or CSV
                  </small>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Step 3: Upload File */}
          <Col xs={12} md={4}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Header className="bg-warning text-white">
                <h5 className="mb-0">3. Upload File</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Control
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files[0])}
                    disabled={loading}
                  />
                  {file && (
                    <div className="mt-2">
                      <Badge bg="info">
                        <FaFile className="me-1" />
                        {file.name}
                      </Badge>
                      <small className="text-muted d-block mt-1">
                        Size: {(file.size / 1024).toFixed(2)} KB
                      </small>
                    </div>
                  )}
                </Form.Group>

                {loading && (
                  <div className="mt-3">
                    <ProgressBar
                      now={uploadProgress}
                      label={`${uploadProgress}%`}
                      variant="primary"
                      striped
                      animated
                    />
                    <small className="text-muted mt-1 d-block">
                      Uploading... {uploadProgress}%
                    </small>
                  </div>
                )}

                <Button
                  variant="success"
                  className="w-100 mt-3"
                  onClick={handleUpload}
                  disabled={loading || !file}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaUpload className="me-2" />
                      Upload File
                    </>
                  )}
                </Button>

                {file && !loading && (
                  <p className="text-muted mt-2 small">
                    <FaCheckCircle className="text-success me-1" />
                    File ready to upload
                  </p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Results Section */}
        {results && (
          <Card className="mt-4 shadow-sm border-0">
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">
                <FaCheckCircle className="me-2" /> Upload Results
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-3 mb-4">
                <StatCard
                  icon={FaFile}
                  title="Total Records"
                  value={results.total}
                  bgColor="bg-primary"
                />
                <StatCard
                  icon={FaCheckCircle}
                  title="Success"
                  value={results.success}
                  bgColor="bg-success"
                />
                <StatCard
                  icon={FaTimesCircle}
                  title="Errors"
                  value={results.errors}
                  bgColor="bg-danger"
                />
              </Row>

              {/* Error Details */}
              {results.errorDetails && results.errorDetails.length > 0 && (
                <div className="mt-3">
                  <h6 className="text-danger">
                    <FaExclamationTriangle className="me-2" />
                    Error Details ({results.errorDetails.length})
                  </h6>
                  <div className="table-responsive">
                    <Table bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th>Row</th>
                          <th>Errors</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.errorDetails.map((err, idx) => (
                          <tr key={idx}>
                            <td>{err.row}</td>
                            <td>
                              {err.errors.map((e, i) => (
                                <Badge
                                  bg="danger"
                                  className="me-1 mb-1"
                                  key={i}
                                >
                                  {e}
                                </Badge>
                              ))}
                            </td>
                            <td>
                              <pre
                                className="small mb-0"
                                style={{ maxWidth: "200px", overflow: "auto" }}
                              >
                                {JSON.stringify(err.data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Success Details */}
              {results.successDetails && results.successDetails.length > 0 && (
                <div className="mt-3">
                  <h6 className="text-success">
                    <FaCheckCircle className="me-2" />
                    Success Details ({results.successDetails.length})
                  </h6>
                  <div className="table-responsive">
                    <Table bordered hover size="sm">
                      <thead className="table-light">
                        <tr>
                          <th>Row</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.successDetails.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.row}</td>
                            <td>
                              <pre
                                className="small mb-0"
                                style={{ maxWidth: "300px", overflow: "auto" }}
                              >
                                {JSON.stringify(item, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Summary Message */}
              <Alert
                variant={results.errors > 0 ? "warning" : "success"}
                className="mt-3"
              >
                <FaInfoCircle className="me-2" />
                {results.errors > 0
                  ? `${results.success} records uploaded successfully, ${results.errors} records failed. Please check the error details above.`
                  : `All ${results.total} records uploaded successfully!`}
              </Alert>
            </Card.Body>
          </Card>
        )}

        {/* Upload Tips */}
        <Card className="mt-4 shadow-sm border-0 bg-light">
          <Card.Body>
            <h6>
              <FaInfoCircle className="me-2 text-primary" />
              Upload Tips
            </h6>
            <ul className="mb-0 small">
              <li>
                Maximum file size: <strong>5MB</strong>
              </li>
              <li>
                Supported formats: <strong>.xlsx, .xls, .csv</strong>
              </li>
              <li>
                Maximum <strong>500 records</strong> per upload
              </li>
              <li>Download the template first and follow the format</li>
              <li>
                Include the Department column in templates for multi-department
                uploads
              </li>
              <li>All required fields must be filled</li>
              <li>Data validation is performed before upload</li>
              <li>
                <strong>For Faculty Upload:</strong> Use the faculty's
                registered email. Pending faculty will be auto-approved.
              </li>
            </ul>
          </Card.Body>
        </Card>
      </Container>

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

export default BulkUploadPage;
