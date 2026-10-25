import React, { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("❌ ErrorBoundary caught an error:", error);
    console.error("❌ ErrorInfo:", errorInfo);

    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({
      showDetails: !prev.showDetails,
    }));
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === "development";

      return (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-6">
              <div className="card shadow-lg border-0">
                <div className="card-body text-center p-5">
                  {/* Error Icon */}
                  <div className="mb-4">
                    <span className="display-1" style={{ fontSize: "80px" }}>
                      😵
                    </span>
                  </div>

                  {/* Error Title */}
                  <h3 className="mb-3 text-danger">Something Went Wrong</h3>
                  <p className="text-muted mb-4">
                    We apologize for the inconvenience. An unexpected error
                    occurred. Please try refreshing the page or contact support
                    if the issue persists.
                  </p>

                  {/* Error Message */}
                  {this.state.error && (
                    <div className="alert alert-danger text-start">
                      <strong>Error:</strong> {this.state.error.toString()}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="d-flex flex-wrap gap-2 justify-content-center">
                    <button
                      className="btn btn-primary"
                      onClick={this.handleReset}
                    >
                      🔄 Refresh Page
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => window.history.back()}
                    >
                      ← Go Back
                    </button>
                    {isDevelopment && (
                      <button
                        className="btn btn-outline-info"
                        onClick={this.toggleDetails}
                      >
                        {this.state.showDetails ? "Hide" : "Show"} Details
                      </button>
                    )}
                  </div>

                  {/* Error Details (Development only) */}
                  {isDevelopment && this.state.showDetails && (
                    <div className="mt-4 text-start">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="fw-bold">Stack Trace:</h6>
                          <pre
                            className="small"
                            style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              maxHeight: "200px",
                              overflow: "auto",
                            }}
                          >
                            {this.state.errorInfo?.componentStack ||
                              this.state.error?.stack ||
                              "No stack trace available"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4">
                    <small className="text-muted">
                      If this issue continues, please contact support.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
