import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Dropdown } from "react-bootstrap";
import {
  FaBell,
  FaTicketAlt,
  FaChartLine,
  FaFileAlt,
  FaBullhorn,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";
import api from "../services/api";

const FacultyNotificationBell = ({ auth }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  // ✅ Icon per notification type
  const getTypeIcon = (type) => {
    switch (type) {
      case "attendance_alert":
        return <FaChartLine className="text-warning" />;
      case "hallticket_generated":
      case "hallticket_approved":
      case "hallticket_rejected":
        return <FaTicketAlt className="text-info" />;
      case "document_approved":
        return <FaCheckCircle className="text-success" />;
      case "document_rejected":
        return <FaTimesCircle className="text-danger" />;
      case "document_status":
        return <FaFileAlt className="text-primary" />;
      case "general":
        return <FaBullhorn className="text-secondary" />;
      default:
        return <FaInfoCircle className="text-secondary" />;
    }
  };

  // ✅ Human-readable time ago
  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    return new Date(date).toLocaleDateString();
  };

  // ✅ Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/notifications/unread-count");
      if (isMountedRef.current) {
        setUnreadCount(response.data?.data?.count || 0);
      }
    } catch (err) {
      console.error("FacultyNotificationBell unread fetch error:", err.message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // ✅ Fetch latest 5 notifications (for dropdown)
  const fetchLatest = async () => {
    try {
      const response = await api.get("/notifications?limit=5");
      if (isMountedRef.current) {
        setLatest(response.data?.data?.notifications || []);
      }
    } catch (err) {
      console.error("FacultyNotificationBell latest fetch error:", err.message);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (!auth?.token) return;

    fetchUnreadCount();
    fetchLatest();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30s polling for count

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, [auth?.token]);

  // Re-fetch latest when dropdown opens
  const handleToggle = (isOpen) => {
    if (isOpen) {
      fetchLatest();
      fetchUnreadCount();
    }
  };

  const handleItemClick = async (notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await api.put(`/notifications/${notification._id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("Mark read failed:", err.message);
      }
    }
    // Navigate to action URL or notifications page
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else {
      navigate("/notifications");
    }
  };

  return (
    <Dropdown align="end" className="me-2" onToggle={handleToggle}>
      <Dropdown.Toggle
        variant="link"
        className="position-relative text-white text-decoration-none border-0 p-2"
        id="faculty-bell-dropdown"
        style={{ boxShadow: "none", overflow: "visible" }}
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "No new notifications"
        }
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-6px",
              background: "#dc3545",
              color: "#ffffff",
              borderRadius: "12px",
              minWidth: "16px",
              height: "16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.6rem",
              fontWeight: "700",
              padding: "0 4px",
              zIndex: 1000,
              lineHeight: 1,
              boxShadow: "0 0 0 2px #212529",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        align="end"
        className="shadow-lg border-0 mt-2"
        style={{ minWidth: "360px", maxWidth: "420px" }}
      >
        <Dropdown.Header className="fw-bold d-flex justify-content-between align-items-center">
          <span>
            <FaBell className="me-2" />
            Notifications
          </span>
          {unreadCount > 0 && (
            <Badge bg="danger" pill>
              {unreadCount} new
            </Badge>
          )}
        </Dropdown.Header>
        <Dropdown.Divider />

        {loading ? (
          <Dropdown.Item disabled>
            <small className="text-muted">Loading...</small>
          </Dropdown.Item>
        ) : latest.length === 0 ? (
          <Dropdown.Item disabled>
            <FaCheckCircle className="me-2 text-success" />
            <span className="text-success">All caught up!</span>
          </Dropdown.Item>
        ) : (
          <>
            {latest.map((n) => (
              <Dropdown.Item
                key={n._id}
                onClick={() => handleItemClick(n)}
                className="d-flex gap-2 py-2"
                style={{ whiteSpace: "normal" }}
              >
                <div className="mt-1">{getTypeIcon(n.type)}</div>
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div
                    className={`small ${!n.isRead ? "fw-bold" : "fw-normal"}`}
                  >
                    {n.title}
                  </div>
                  <div
                    className="text-muted"
                    style={{
                      fontSize: "0.75rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {n.message}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
                {!n.isRead && (
                  <span
                    className="badge bg-primary rounded-circle align-self-start mt-1"
                    style={{ width: 8, height: 8, padding: 0 }}
                  />
                )}
              </Dropdown.Item>
            ))}
            <Dropdown.Divider />
            <Dropdown.Item
              onClick={() => navigate("/notifications")}
              className="text-primary text-center fw-bold"
            >
              View All Notifications →
            </Dropdown.Item>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default FacultyNotificationBell;
