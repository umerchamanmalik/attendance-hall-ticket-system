import React, { useEffect } from "react";
import { Toast, ToastContainer } from "react-bootstrap";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

const ToastNotification = ({
  show,
  message,
  variant = "success",
  onClose,
  duration = 5000,
}) => {
  // Auto-hide after duration (for non-error messages)
  useEffect(() => {
    if (show && variant !== "danger" && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, variant, duration, onClose]);

  const getIcon = () => {
    switch (variant) {
      case "success":
        return <FaCheckCircle className="me-2" size={18} />;
      case "danger":
        return <FaTimesCircle className="me-2" size={18} />;
      case "warning":
        return <FaExclamationTriangle className="me-2" size={18} />;
      case "info":
        return <FaInfoCircle className="me-2" size={18} />;
      default:
        return <FaInfoCircle className="me-2" size={18} />;
    }
  };

  const getToastClass = () => {
    switch (variant) {
      case "success":
        return "app-toast-success";
      case "danger":
        return "app-toast-error";
      case "warning":
        return "app-toast-warning";
      case "info":
        return "app-toast-info";
      default:
        return "app-toast-success";
    }
  };

  // Don't render if not showing
  if (!show) return null;

  return (
    <ToastContainer
      position="top-end"
      className="p-3"
      style={{
        zIndex: 9999,
        position: "fixed",
        top: "20px",
        right: "20px",
        maxWidth: "420px",
        width: "100%",
      }}
    >
      <Toast
        show={show}
        onClose={onClose}
        delay={variant === "danger" ? null : duration}
        autohide={variant !== "danger"}
        className={`app-toast ${getToastClass()} shadow-lg border-0`}
        style={{
          borderRadius: "12px",
          animation: "slideInRight 0.3s ease-out",
        }}
      >
        <Toast.Header
          closeButton={false} /* ✅ ADDED: prevents duplicate ✕ */
          className="border-0"
          style={{
            borderRadius: "12px 12px 0 0",
            backgroundColor: "transparent",
            padding: "12px 16px",
          }}
        >
          <strong className="me-auto d-flex align-items-center text-white">
            {getIcon()}
            {variant.charAt(0).toUpperCase() + variant.slice(1)}
          </strong>
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={onClose}
            aria-label="Close"
          />
        </Toast.Header>
        <Toast.Body
          className="py-3 px-4 text-white"
          style={{ fontSize: "14px" }}
        >
          {message}
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default ToastNotification;
