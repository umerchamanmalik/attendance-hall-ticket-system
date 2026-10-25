import React from "react";
import { Modal, Button } from "react-bootstrap";
import {
  FaExclamationTriangle,
  FaCheck,
  FaTimes,
  FaInfoCircle,
} from "react-icons/fa";

const ConfirmDialog = ({
  show,
  onHide,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  icon = null,
}) => {
  const getIcon = () => {
    if (icon) return icon;
    if (variant === "danger") return <FaExclamationTriangle />;
    if (variant === "warning") return <FaExclamationTriangle />;
    if (variant === "success") return <FaCheck />;
    if (variant === "info") return <FaInfoCircle />;
    return <FaExclamationTriangle />;
  };

  const getVariantClass = () => {
    return variant;
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header
        closeButton
        className={`bg-${getVariantClass()} text-white`}
      >
        <Modal.Title>
          <span className="me-2">{getIcon()}</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="py-4">
        <p className="mb-0">{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onHide}
          disabled={loading}
          className="px-3"
        >
          <FaTimes className="me-1" /> {cancelText}
        </Button>
        <Button
          variant={getVariantClass()}
          onClick={onConfirm}
          disabled={loading}
          className="px-3"
        >
          {loading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              />
              Processing...
            </>
          ) : (
            <>
              <FaCheck className="me-1" /> {confirmText}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDialog;
