import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({
    show: false,
    message: "",
    variant: "success",
  });
  const [timer, setTimer] = useState(null);

  const showToast = useCallback(
    (message, variant = "success", duration = 5000) => {
      // Clear existing timer
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }

      setToast({ show: true, message, variant });

      // Auto-hide for success messages
      if (
        variant === "success" ||
        variant === "info" ||
        variant === "warning"
      ) {
        const newTimer = setTimeout(() => {
          setToast({ show: false, message: "", variant: "success" });
        }, duration);
        setTimer(newTimer);
      }
      // Error messages stay until dismissed
    },
    [timer],
  );

  const hideToast = useCallback(() => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    setToast({ show: false, message: "", variant: "success" });
  }, [timer]);

  const success = useCallback(
    (message, duration = 5000) => {
      showToast(message, "success", duration);
    },
    [showToast],
  );

  const error = useCallback(
    (message, duration = null) => {
      showToast(message, "danger", duration);
    },
    [showToast],
  );

  const warning = useCallback(
    (message, duration = 5000) => {
      showToast(message, "warning", duration);
    },
    [showToast],
  );

  const info = useCallback(
    (message, duration = 5000) => {
      showToast(message, "info", duration);
    },
    [showToast],
  );

  const value = {
    toast,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};

export default ToastProvider;
