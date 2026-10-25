import React, { useState, useEffect, useRef } from "react";
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
  Form,
  Image,
} from "react-bootstrap";
import {
  FaUser,
  FaEnvelope,
  FaIdCard,
  FaCalendarAlt,
  FaBook,
  FaPhone,
  FaMapMarkerAlt,
  FaUserGraduate,
  FaUserTie,
  FaEdit,
  FaSave,
  FaTimes,
  FaUpload,
  FaTrash,
  FaFileAlt,
  FaTicketAlt,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
} from "react-icons/fa";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";

const StudentProfilePage = () => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast(); // ✅ Use global toast
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Confirm Dialog States
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [formData, setFormData] = useState({
    contactNumber: "",
    address: "",
    guardianName: "",
    guardianContact: "",
    guardianRelation: "",
    emergencyContact: "",
    emergencyContactName: "",
    dateOfBirth: "",
    gender: "",
  });

  const baseUrl = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api$/, "")
    : "http://localhost:5000";

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/students/profile/me");

      if (response.data.success) {
        const data = response.data.data;
        setStudent(data);
        setFormData({
          contactNumber: data.contactNumber || "",
          address: data.address || "",
          guardianName: data.guardianName || "",
          guardianContact: data.guardianContact || "",
          guardianRelation: data.guardianRelation || "",
          emergencyContact: data.emergencyContact || "",
          emergencyContactName: data.emergencyContactName || "",
          dateOfBirth: data.dateOfBirth?.split("T")[0] || "",
          gender: data.gender || "",
        });
      } else {
        throw new Error(response.data.message || "Failed to load profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError(error.response?.data?.error || "Failed to load profile");
      toast.error(error.response?.data?.error || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put("/students/profile/me", formData);

      if (response.data.success) {
        toast.success(
          response.data.message || "✅ Profile updated successfully!",
        );
        setEditMode(false);
        await fetchProfile();
      } else {
        throw new Error(response.data.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > 2 * 1024 * 1024) {
      toast.warning("❌ Photo size must be less than 2MB");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.warning("❌ Only JPG, PNG, GIF, and WEBP images are allowed");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("photo", file);

    try {
      const response = await api.post("/students/profile/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        toast.success(
          response.data.message || "✅ Photo uploaded successfully!",
        );
        await fetchProfile();
      } else {
        throw new Error(response.data.message || "Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error(error.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhotoClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDeletePhoto = async () => {
    setConfirmLoading(true);
    try {
      const response = await api.delete("/students/profile/photo");

      if (response.data.success) {
        toast.success(
          response.data.message || "✅ Photo deleted successfully!",
        );
        setShowConfirm(false);
        await fetchProfile();
      } else {
        throw new Error(response.data.message || "Failed to delete photo");
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error(error.response?.data?.error || "Failed to delete photo");
    } finally {
      setConfirmLoading(false);
    }
  };

  const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="d-flex align-items-start mb-2">
      <Icon className="text-primary me-2 mt-1" size={16} />
      <div>
        <small className="text-muted d-block">{label}</small>
        <strong>{value || "Not provided"}</strong>
      </div>
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
          <h5 className="mt-3 text-muted">Loading profile...</h5>
        </div>
      </Container>
    );
  }

  if (error && !student) {
    return (
      <Container className="mt-4">
        <ErrorMessage message={error} onRetry={fetchProfile} />
      </Container>
    );
  }

  if (!student) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Student profile not found</Alert>
      </Container>
    );
  }

  const photoUrl = student.photoPath ? `${baseUrl}${student.photoPath}` : null;

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <h2 className="mb-4">
          <FaUser className="me-2 text-primary" />
          My Profile
        </h2>

        <Row className="g-4">
          {/* Left Column - Profile Photo & Basic Info */}
          <Col lg={4}>
            {/* Profile Photo Card */}
            <Card className="shadow-sm border-0 mb-4">
              <Card.Body className="text-center p-4">
                <div className="mb-3 position-relative">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt="Profile"
                      roundedCircle
                      className="border"
                      style={{
                        width: "150px",
                        height: "150px",
                        objectFit: "cover",
                        border: "3px solid #ddd",
                      }}
                    />
                  ) : (
                    <div
                      className="rounded-circle mx-auto d-flex align-items-center justify-content-center bg-light border"
                      style={{
                        width: "150px",
                        height: "150px",
                        border: "3px solid #ddd",
                      }}
                    >
                      <FaUser size={60} className="text-secondary" />
                    </div>
                  )}
                </div>

                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-1"
                        />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FaUpload className="me-1" /> Upload Photo
                      </>
                    )}
                  </Button>
                  {photoUrl && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDeletePhotoClick}
                    >
                      <FaTrash className="me-1" /> Remove
                    </Button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: "none" }}
                  onChange={handlePhotoUpload}
                />
                <Form.Text className="text-muted d-block mt-2">
                  Max size: 2MB (JPG, PNG, GIF, WEBP)
                </Form.Text>
              </Card.Body>
            </Card>

            {/* Student Info Card */}
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaIdCard className="me-2 text-primary" /> Student Information
                </h6>
              </Card.Header>
              <Card.Body>
                <InfoItem
                  icon={FaUser}
                  label="Name"
                  value={student.studentName}
                />
                <InfoItem
                  icon={FaIdCard}
                  label="Roll Number"
                  value={student.rollNumber}
                />
                <InfoItem
                  icon={FaEnvelope}
                  label="Email"
                  value={student.email}
                />
                {/* ✅ NEW: Department */}
                <InfoItem
                  icon={FaBook}
                  label="Department"
                  value={
                    student.department
                      ? `${student.department} — ${
                          {
                            CS: "Computer Science & Engineering",
                            EC: "Electronics & Communication Engineering",
                            MECH: "Mechanical Engineering",
                            CIVIL: "Civil Engineering",
                            EEE: "Electrical & Electronics Engineering",
                            ISE: "Information Science & Engineering",
                            AIML: "AI & Machine Learning",
                            AIDS: "AI & Data Science",
                          }[student.department] || student.department
                        }`
                      : "Not Assigned"
                  }
                />
                <InfoItem
                  icon={FaBook}
                  label="Academic Year"
                  value={student.academicYear}
                />
                <InfoItem
                  icon={FaCalendarAlt}
                  label="Semester"
                  value={student.semester}
                />
                <InfoItem
                  icon={FaBook}
                  label="Section"
                  value={student.section}
                />
                <InfoItem
                  icon={FaUserTie}
                  label="Mentor"
                  value={student.mentorName || "Not Assigned"}
                />
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column - Profile Details */}
          <Col lg={8}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaUser className="me-2 text-primary" /> Profile Details
                </h5>
                {!editMode ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setEditMode(true)}
                  >
                    <FaEdit className="me-1" /> Edit Profile
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditMode(false)}
                  >
                    <FaTimes className="me-1" /> Cancel
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                {!editMode ? (
                  // View Mode
                  <Row>
                    <Col md={6}>
                      <InfoItem
                        icon={FaPhone}
                        label="Contact Number"
                        value={student.contactNumber}
                      />
                      <InfoItem
                        icon={FaMapMarkerAlt}
                        label="Address"
                        value={student.address}
                      />
                      <InfoItem
                        icon={FaCalendarAlt}
                        label="Date of Birth"
                        value={
                          student.dateOfBirth
                            ? new Date(student.dateOfBirth).toLocaleDateString()
                            : "Not provided"
                        }
                      />
                      <InfoItem
                        icon={FaUser}
                        label="Gender"
                        value={student.gender || "Not provided"}
                      />
                    </Col>
                    <Col md={6}>
                      <InfoItem
                        icon={FaUserTie}
                        label="Guardian Name"
                        value={student.guardianName}
                      />
                      <InfoItem
                        icon={FaPhone}
                        label="Guardian Contact"
                        value={student.guardianContact}
                      />
                      <InfoItem
                        icon={FaUser}
                        label="Relation"
                        value={student.guardianRelation}
                      />
                      <InfoItem
                        icon={FaPhone}
                        label="Emergency Contact"
                        value={student.emergencyContact}
                      />
                      <InfoItem
                        icon={FaUser}
                        label="Emergency Contact Name"
                        value={student.emergencyContactName}
                      />
                    </Col>
                  </Row>
                ) : (
                  // Edit Mode
                  <Form onSubmit={handleUpdateProfile}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaPhone className="me-1 text-primary" /> Contact
                            Number
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="contactNumber"
                            value={formData.contactNumber}
                            onChange={handleInputChange}
                            placeholder="Enter contact number"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaCalendarAlt className="me-1 text-primary" /> Date
                            of Birth
                          </Form.Label>
                          <Form.Control
                            type="date"
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaUser className="me-1 text-primary" /> Gender
                          </Form.Label>
                          <Form.Select
                            name="gender"
                            value={formData.gender}
                            onChange={handleInputChange}
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaMapMarkerAlt className="me-1 text-primary" />{" "}
                            Address
                          </Form.Label>
                          <Form.Control
                            as="textarea"
                            rows="2"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="Enter your address"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaUserTie className="me-1 text-primary" /> Guardian
                            Name
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="guardianName"
                            value={formData.guardianName}
                            onChange={handleInputChange}
                            placeholder="Enter guardian name"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaPhone className="me-1 text-primary" /> Guardian
                            Contact
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="guardianContact"
                            value={formData.guardianContact}
                            onChange={handleInputChange}
                            placeholder="Enter guardian contact"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaUser className="me-1 text-primary" /> Relation
                            with Guardian
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="guardianRelation"
                            value={formData.guardianRelation}
                            onChange={handleInputChange}
                            placeholder="e.g., Father, Mother"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaUser className="me-1 text-primary" /> Emergency
                            Contact Name
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="emergencyContactName"
                            value={formData.emergencyContactName}
                            onChange={handleInputChange}
                            placeholder="Enter emergency contact name"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaPhone className="me-1 text-primary" /> Emergency
                            Contact Number
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="emergencyContact"
                            value={formData.emergencyContact}
                            onChange={handleInputChange}
                            placeholder="Enter emergency contact number"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <div className="d-flex gap-2 mt-3">
                      <Button variant="success" type="submit" disabled={saving}>
                        {saving ? (
                          <>
                            <Spinner
                              animation="border"
                              size="sm"
                              className="me-1"
                            />
                            Saving...
                          </>
                        ) : (
                          <>
                            <FaSave className="me-1" /> Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditMode(false)}
                      >
                        <FaTimes className="me-1" /> Cancel
                      </Button>
                    </div>
                  </Form>
                )}
              </Card.Body>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-sm border-0 mt-4">
              <Card.Body>
                <h6 className="mb-3">
                  <FaInfoCircle className="me-2 text-primary" /> Quick Actions
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    as={Link}
                    to="/student/documents"
                    variant="outline-primary"
                  >
                    <FaFileAlt className="me-1" /> My Documents
                  </Button>
                  <Button
                    as={Link}
                    to="/student/halltickets"
                    variant="outline-success"
                  >
                    <FaTicketAlt className="me-1" /> My Hall Ticket
                  </Button>
                  <Button
                    as={Link}
                    to="/attendance-progress"
                    variant="outline-info"
                  >
                    <FaBook className="me-1" /> Attendance Progress
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* ✅ Confirm Delete Photo Dialog */}
      <ConfirmDialog
        show={showConfirm}
        onHide={() => setShowConfirm(false)}
        onConfirm={handleConfirmDeletePhoto}
        title="Delete Profile Photo"
        message="Are you sure you want to delete your profile photo? This action cannot be undone."
        confirmText="Delete Photo"
        variant="danger"
        loading={confirmLoading}
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

export default StudentProfilePage;
