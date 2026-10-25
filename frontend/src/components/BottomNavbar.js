import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUserGraduate,
  FaBook,
  FaClipboardList,
  FaTicketAlt,
  FaFileAlt,
  FaHistory,
  FaUsers,
  FaCheckCircle,
  FaBell,
  FaGraduationCap,
  FaUser,
  FaBuilding,
  FaUserShield,
} from "react-icons/fa";

const BottomNavbar = ({ auth }) => {
  const location = useLocation();

  // Hidden on landing, login, register
  const isPublicPage = ["/", "/login", "/register"].includes(location.pathname);
  const hasNoRole = !auth?.role;

  if (isPublicPage || hasNoRole) return null;

  const role = auth.role;

  // ✅ Active state checker
  const isActive = (path) => {
    // Dashboard paths: exact match only
    const dashboardPaths = [
      "/hod",
      "/faculty",
      "/mentor",
      "/student",
      "/super-admin",
    ];
    if (dashboardPaths.includes(path)) {
      return location.pathname === path;
    }
    // Other paths: prefix match
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return location.pathname === path;
  };

  // ✅ Per-role bottom nav items
  const getItemsForRole = () => {
    switch (role) {
      case "HOD":
        return [
          { to: "/hod", icon: FaHome, label: "Home" },
          { to: "/hod/students", icon: FaUserGraduate, label: "Students" },
          { to: "/hod/allocations", icon: FaBook, label: "Allocations" },
          { to: "/hod/exam-management", icon: FaClipboardList, label: "Exams" },
          {
            to: "/hod/hall-ticket-management",
            icon: FaTicketAlt,
            label: "Tickets",
          },
        ];

      case "Faculty":
        return [
          { to: "/faculty", icon: FaHome, label: "Home" },
          { to: "/faculty/attendance", icon: FaBook, label: "Attendance" },
          { to: "/faculty/history", icon: FaHistory, label: "History" },
          { to: "/faculty/documents", icon: FaFileAlt, label: "Docs" },
          { to: "/notifications", icon: FaBell, label: "Alerts" },
        ];

      case "Mentor":
        return [
          { to: "/mentor", icon: FaHome, label: "Home" },
          { to: "/mentor/mentees", icon: FaUsers, label: "Mentees" },
          { to: "/mentor/documents", icon: FaFileAlt, label: "Docs" },
          {
            to: "/mentor/hall-ticket-approval",
            icon: FaCheckCircle,
            label: "Approve",
          },
          { to: "/notifications", icon: FaBell, label: "Alerts" },
        ];

      case "Student":
        return [
          { to: "/student", icon: FaHome, label: "Home" },
          { to: "/student/documents", icon: FaFileAlt, label: "Docs" },
          { to: "/student/halltickets", icon: FaTicketAlt, label: "Ticket" },
          {
            to: "/attendance-progress",
            icon: FaClipboardList,
            label: "Progress",
          },
          { to: "/notifications", icon: FaBell, label: "Alerts" },
        ];

      // ✅ UPDATED: SuperAdmin now has 4 items
      case "SuperAdmin":
        return [
          { to: "/super-admin", icon: FaHome, label: "Home" },
          {
            to: "/super-admin/departments",
            icon: FaBuilding,
            label: "Depts",
          },
          { to: "/super-admin/activity", icon: FaHistory, label: "Activity" },
          { to: "/super-admin/users", icon: FaUserShield, label: "Users" },
        ];

      default:
        return [];
    }
  };

  const items = getItemsForRole();

  if (items.length === 0) return null;

  return (
    <nav className="mobile-bottom-nav d-lg-none" aria-label="Mobile navigation">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={idx}
            to={item.to}
            className={`mobile-nav-item ${active ? "active" : ""}`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavbar;
