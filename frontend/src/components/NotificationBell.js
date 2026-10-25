import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Dropdown, Spinner } from "react-bootstrap";
import {
  FaBell,
  FaBullhorn,
  FaChartLine,
  FaFileAlt,
  FaTicketAlt,
} from "react-icons/fa";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

const getTypeIcon = (type) => {
  if (type === "attendance_alert") return <FaChartLine className="me-2" />;
  if (type.startsWith("hallticket_")) return <FaTicketAlt className="me-2" />;
  if (type.startsWith("document_")) return <FaFileAlt className="me-2" />;
  return <FaBullhorn className="me-2" />;
};

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

const NotificationBell = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get("/notifications/unread-count");
      setUnreadCount(response.data.data?.count || 0);
    } catch (error) {
      toast.error(error.userMessage || "Unable to load notification count.");
    }
  }, [toast]);

  const fetchRecentNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/notifications", {
        params: { page: 1, limit: 5 },
      });
      setNotifications(response.data.data?.notifications || []);
      setUnreadCount(response.data.data?.unreadCount || 0);
    } catch (error) {
      toast.error(error.userMessage || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchUnreadCount]);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await api.put(`/notifications/${notification._id}/read`);
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        toast.error(
          error.userMessage || "Unable to mark notification as read.",
        );
      }
    }
    navigate(notification.actionUrl || "/notifications");
  };

  return (
    <Dropdown
      align="end"
      onToggle={(isOpen) => {
        if (isOpen) fetchRecentNotifications();
      }}
    >
      <Dropdown.Toggle
        variant="link"
        className="text-white text-decoration-none position-relative px-2 py-2"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        title="Notifications"
      >
        <FaBell size={19} />
        {unreadCount > 0 && (
          <Badge
            bg="danger"
            pill
            className="position-absolute top-0 start-75 translate-middle"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="shadow border-0 mt-2 p-0"
        style={{ width: 340 }}
      >
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
          <strong>Notifications</strong>
          {unreadCount > 0 && <Badge bg="primary">{unreadCount} unread</Badge>}
        </div>
        {loading ? (
          <div className="text-center py-4">
            <Spinner size="sm" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-muted small py-4">
            You're all caught up.
          </div>
        ) : (
          notifications.map((notification) => (
            <Dropdown.Item
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              className="text-wrap px-3 py-2 border-bottom"
              style={{
                borderLeft: `3px solid ${getPriorityColor(notification.priority)}`,
                backgroundColor: notification.isRead ? "#fff" : "#f2f7ff",
              }}
            >
              <div className="d-flex align-items-start">
                <span className="text-primary mt-1">
                  {getTypeIcon(notification.type)}
                </span>
                <div className="min-w-0 flex-grow-1">
                  <div className="d-flex justify-content-between gap-2">
                    <strong className="text-dark">{notification.title}</strong>
                    {!notification.isRead && (
                      <span
                        className="rounded-circle bg-primary mt-1 flex-shrink-0"
                        style={{ width: 8, height: 8 }}
                      />
                    )}
                  </div>
                  <div
                    className="small text-muted"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {notification.message}
                  </div>
                  <small className="text-muted">
                    {timeAgo(notification.createdAt)}
                  </small>
                </div>
              </div>
            </Dropdown.Item>
          ))
        )}
        <div className="p-2">
          <Button
            variant="outline-primary"
            size="sm"
            className="w-100"
            onClick={() => navigate("/notifications")}
          >
            View All
          </Button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationBell;
