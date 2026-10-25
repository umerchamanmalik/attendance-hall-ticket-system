import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Pagination,
  Row,
  Spinner,
} from "react-bootstrap";
import {
  FaBullhorn,
  FaChartLine,
  FaCheck,
  FaCheckDouble,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaSync,
  FaTicketAlt,
  FaTrash,
} from "react-icons/fa";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import ToastNotification from "../components/ToastNotification";

const notificationTypes = [
  { value: "attendance_alert", label: "Attendance" },
  { value: "hallticket_generated", label: "Hall Ticket Generated" },
  { value: "hallticket_approved", label: "Hall Ticket Approved" },
  { value: "hallticket_rejected", label: "Hall Ticket Rejected" },
  { value: "document_approved", label: "Document Approved" },
  { value: "document_rejected", label: "Document Rejected" },
  { value: "document_status", label: "Document Status" },
  { value: "general", label: "General" },
];

const getTypeIcon = (type) => {
  if (type === "attendance_alert") return <FaChartLine />;
  if (type.startsWith("hallticket_")) return <FaTicketAlt />;
  if (type.startsWith("document_")) return <FaFileAlt />;
  if (type === "general") return <FaBullhorn />;
  return <FaClipboardList />;
};

const getTypeLabel = (type) =>
  notificationTypes.find((item) => item.value === type)?.label ||
  "Notification";

const getPriorityColor = (priority) => {
  if (priority === "urgent") return "#dc3545";
  if (priority === "high") return "#fd7e14";
  if (priority === "low") return "#6c757d";
  return "#0d6efd";
};

const timeAgo = (value) => {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const limit = 20;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (status === "unread") params.status = "unread";
      if (type) params.type = type;
      const response = await api.get("/notifications", { params });
      setNotifications(response.data.data?.notifications || []);
      setPagination(
        response.data.data?.pagination || { page: 1, pages: 0, total: 0 },
      );
      setUnreadCount(response.data.data?.unreadCount || 0);
    } catch (requestError) {
      const message =
        requestError.userMessage ||
        requestError.response?.data?.error ||
        "Unable to load notifications.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, status, type, toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notification) => {
    if (notification.isRead) return;
    try {
      const response = await api.put(`/notifications/${notification._id}/read`);
      const updated = response.data.data?.notification;
      setNotifications((items) =>
        items.map((item) =>
          item._id === notification._id
            ? updated || { ...item, isRead: true }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      toast.error(requestError.userMessage || "Unable to mark as read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((items) =>
        items.map((item) => ({ ...item, isRead: true, readAt: new Date() })),
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read.");
    } catch (requestError) {
      toast.error(
        requestError.userMessage || "Unable to mark notifications as read.",
      );
    }
  };

  const handleDelete = async (notification) => {
    try {
      await api.delete(`/notifications/${notification._id}`);
      setNotifications((items) =>
        items.filter((item) => item._id !== notification._id),
      );
      setPagination((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));
      if (!notification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      toast.success("Notification deleted.");
    } catch (requestError) {
      toast.error(requestError.userMessage || "Unable to delete notification.");
    }
  };

  const openNotification = async (notification) => {
    await handleMarkRead(notification);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const changeType = (value) => {
    setType(value);
    setPage(1);
  };

  const paginationItems = [];
  for (let pageNumber = 1; pageNumber <= pagination.pages; pageNumber += 1) {
    paginationItems.push(
      <Pagination.Item
        key={pageNumber}
        active={pageNumber === page}
        onClick={() => setPage(pageNumber)}
      >
        {pageNumber}
      </Pagination.Item>,
    );
  }

  return (
    <>
      <Container fluid className="px-3 px-md-4 mt-3 mt-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h2 className="mb-1">
              <FaBullhorn className="me-2 text-primary" /> Notifications
            </h2>
            <small className="text-muted">
              {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
            </small>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadNotifications}
              disabled={loading}
            >
              <FaSync className="me-1" /> Refresh
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <FaCheckDouble className="me-1" /> Mark All Read
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="warning" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card className="shadow-sm border-0 mb-3">
          <Card.Body>
            <Row className="g-2 align-items-center">
              <Col xs={12} md="auto">
                <div
                  className="btn-group w-100"
                  role="group"
                  aria-label="Notification status"
                >
                  <Button
                    size="sm"
                    variant={status === "all" ? "primary" : "outline-primary"}
                    onClick={() => changeStatus("all")}
                    className="flex-grow-1"
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      status === "unread" ? "primary" : "outline-primary"
                    }
                    onClick={() => changeStatus("unread")}
                    className="flex-grow-1"
                  >
                    Unread
                  </Button>
                </div>
              </Col>
              <Col xs={12} md={4}>
                <Form.Select
                  size="sm"
                  aria-label="Filter notifications by type"
                  value={type}
                  onChange={(event) => changeType(event.target.value)}
                >
                  <option value="">All Types</option>
                  {notificationTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col className="text-md-end text-muted small">
                {pagination.total} notification
                {pagination.total === 1 ? "" : "s"}
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : notifications.length === 0 ? (
          <Alert variant="info" className="text-center py-5">
            <FaBullhorn size={28} className="mb-2 d-block mx-auto" />
            {status === "unread"
              ? "You have no unread notifications."
              : "You don't have any notifications yet."}
          </Alert>
        ) : (
          <div className="d-flex flex-column gap-2">
            {notifications.map((notification) => (
              <Card
                key={notification._id}
                className="shadow-sm notification-card"
                style={{
                  borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                  backgroundColor: notification.isRead ? "#fff" : "#f8fbff",
                }}
              >
                <Card.Body>
                  <div className="d-flex gap-3 align-items-start">
                    <div className="text-primary fs-5 mt-1 d-none d-sm-block">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <h5
                          className={`mb-0 notification-title ${
                            notification.isRead ? "" : "fw-bold"
                          }`}
                        >
                          {notification.title}
                        </h5>
                        {!notification.isRead && (
                          <span
                            className="rounded-circle bg-primary"
                            aria-label="Unread"
                            title="Unread"
                            style={{ width: 8, height: 8 }}
                          />
                        )}
                        <Badge bg="light" text="dark" className="border">
                          {getTypeLabel(notification.type)}
                        </Badge>
                        {notification.priority !== "normal" && (
                          <Badge
                            style={{
                              backgroundColor: getPriorityColor(
                                notification.priority,
                              ),
                            }}
                          >
                            {notification.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="mb-2 text-break notification-message">
                        {notification.message}
                      </p>
                      <small className="text-muted">
                        {timeAgo(notification.createdAt)}
                        {notification.senderName &&
                          notification.senderName !== "System" &&
                          ` · ${notification.senderName}`}
                      </small>

                      {/* ✅ FIXED: Mobile-friendly action buttons */}
                      <div className="notification-actions mt-2">
                        {notification.actionUrl && (
                          <Button
                            as={Link}
                            to={notification.actionUrl}
                            size="sm"
                            variant="primary"
                            onClick={() => handleMarkRead(notification)}
                          >
                            {notification.actionText || "View"}
                          </Button>
                        )}
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            title="Mark as read"
                            aria-label="Mark notification as read"
                            onClick={() => handleMarkRead(notification)}
                          >
                            <FaCheck />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline-danger"
                          title="Delete notification"
                          aria-label="Delete notification"
                          onClick={() => handleDelete(notification)}
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="d-flex justify-content-center mt-4">
            <Pagination className="flex-wrap">
              <Pagination.Prev
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              />
              {paginationItems}
              <Pagination.Next
                disabled={page >= pagination.pages}
                onClick={() =>
                  setPage((current) => Math.min(pagination.pages, current + 1))
                }
              />
            </Pagination>
          </div>
        )}
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

export default NotificationsPage;
