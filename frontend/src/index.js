import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider, useToast } from "./context/ToastContext";
import ToastNotification from "./components/ToastNotification";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

// ✅ ADDED: Bridge between ToastContext and ToastNotification component
const ToastHost = () => {
  const { toast, hideToast } = useToast();
  return (
    <ToastNotification
      show={toast.show}
      message={toast.message}
      variant={toast.variant}
      onClose={hideToast}
    />
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
        <ToastHost /> {/* ✅ ADDED: must be inside ToastProvider */}
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
