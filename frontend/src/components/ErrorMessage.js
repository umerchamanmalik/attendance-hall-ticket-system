import React, { useState } from "react";

const ErrorMessage = ({
  error,
  title = "Error",
  onRetry,
  onDismiss,
  showDetails = false,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(showDetails);

  // ✅ If no error, don't render
  if (!error) return null;

  // ✅ Get error message
  const getErrorMessage = () => {
    if (typeof error === "string") return error;
    if (error.userMessage) return error.userMessage;
    if (error.message) return error.message;
    if (error.error) return error.error;
    return "An unexpected error occurred";
  };

  // ✅ Get error details
  const getErrorDetails = () => {
    if (typeof error === "string") return null;
    if (error.details) return error.details;
    if (error.errors) return error.errors;
    if (error.response?.data?.errors) return error.response.data.errors;
    return null;
  };

  // ✅ Get status code
  const getStatusCode = () => {
    if (typeof error === "string") return null;
    return error.statusCode || error.response?.status || null;
  };

  const message = getErrorMessage();
  const details = getErrorDetails();
  const statusCode = getStatusCode();

  // ✅ Determine icon based on error type
  const getIcon = () => {
    if (statusCode === 404) return "🔍";
    if (statusCode === 401 || statusCode === 403) return "🔒";
    if (statusCode === 413) return "📁";
    if (statusCode === 429) return "⏳";
    if (statusCode >= 500) return "⚡";
    return "❌";
  };

  // ✅ Determine color based on error type
  const getColor = () => {
    if (statusCode === 404) return "warning";
    if (statusCode === 401 || statusCode === 403) return "warning";
    if (statusCode >= 500) return "danger";
    return "danger";
  };

  const color = getColor();

  return (
    <div
      className={`alert alert-${color} alert-dismissible fade show ${className}`}
      role="alert"
    >
      <div className="d-flex align-items-start">
        <div className="me-3" style={{ fontSize: "24px" }}>
          {getIcon()}
        </div>
        <div className="flex-grow-1">
          <h5 className="alert-heading">{title}</h5>
          <p className="mb-1">{message}</p>

          {/* ✅ Show status code */}
          {statusCode && (
            <small className="text-muted">Error Code: {statusCode}</small>
          )}

          {/* ✅ Show details if available */}
          {details && (
            <div className="mt-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setExpanded(!expanded)}
                type="button"
              >
                {expanded ? "Hide" : "Show"} Details
              </button>

              {expanded && (
                <div className="mt-2 p-2 bg-light rounded">
                  {Array.isArray(details) ? (
                    <ul className="mb-0 ps-3">
                      {details.map((detail, index) => (
                        <li key={index}>
                          {typeof detail === "string"
                            ? detail
                            : detail.message ||
                              detail.error ||
                              JSON.stringify(detail)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="mb-0 small">
                      {typeof details === "string"
                        ? details
                        : JSON.stringify(details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ✅ Action buttons */}
          <div className="mt-3 d-flex flex-wrap gap-2">
            {onRetry && (
              <button className="btn btn-sm btn-primary" onClick={onRetry}>
                🔄 Retry
              </button>
            )}
            {onDismiss && (
              <button className="btn btn-sm btn-secondary" onClick={onDismiss}>
                Dismiss
              </button>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="btn-close"
            onClick={onDismiss}
            aria-label="Close"
          ></button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
