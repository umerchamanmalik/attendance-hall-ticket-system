import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Navbar as BootstrapNavbar,
  Nav,
  Container,
  Dropdown,
  Badge,
} from "react-bootstrap";
import {
  FaHome,
  FaBook,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaFileAlt,
  FaTicketAlt,
  FaUsers,
  FaUpload,
  FaGraduationCap,
  FaHistory,
  FaClipboardList,
  FaUniversity,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCheckCircle,
  FaShieldAlt,
  FaBuilding,
  FaUserShield,
} from "react-icons/fa";
import NotificationBell from "./NotificationBell";
// ✅ FIXED: FacultyNotificationBell now handles Student + Faculty + Mentor
// (its API-driven bell works identically for all roles)
import FacultyNotificationBell from "./FacultyNotificationBell";

const Navbar = ({ auth, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const handleNavClick = () => {
    setExpanded(false);
  };

  const handleLogout = () => {
    onLogout();
    setExpanded(false);
    navigate("/login");
  };

  // ✅ FIXED: Dashboard links use exact match; others use prefix match
  const isActive = (path) => {
    const dashboardPaths = [
      "/hod",
      "/faculty",
      "/mentor",
      "/student",
      "/super-admin",
    ];

    // Dashboard links: only active on EXACT path
    if (dashboardPaths.includes(path)) {
      return location.pathname === path;
    }

    // Sub-routes: active on exact path OR any sub-path
    if (path !== "/" && location.pathname.startsWith(path)) return true;

    return location.pathname === path;
  };

  // Get user name and role from auth
  const userName = auth.user?.name || "User";
  const userRole = auth.role || "";

  // Get role icon
  const getRoleIcon = () => {
    switch (userRole) {
      case "HOD":
        return <FaUniversity className="me-1" />;
      case "Faculty":
        return <FaChalkboardTeacher className="me-1" />;
      case "Mentor":
        return <FaUsers className="me-1" />;
      case "Student":
        return <FaUserGraduate className="me-1" />;
      case "SuperAdmin":
        return <FaShieldAlt className="me-1" />;
      default:
        return <FaUser className="me-1" />;
    }
  };

  // Get role color
  const getRoleColor = () => {
    switch (userRole) {
      case "HOD":
        return "bg-primary";
      case "Faculty":
        return "bg-success";
      case "Mentor":
        return "bg-info";
      case "Student":
        return "bg-warning";
      case "SuperAdmin":
        return "bg-dark";
      default:
        return "bg-secondary";
    }
  };

  // Custom NavLink component
  const NavLink = ({ to, icon: Icon, children }) => {
    const isActiveLink = isActive(to);
    return (
      <Nav.Link
        as={Link}
        to={to}
        onClick={handleNavClick}
        className="px-3 py-2"
        style={{
          color: isActiveLink ? "#fff" : "rgba(255,255,255,0.75)",
          backgroundColor: isActiveLink
            ? "rgba(255,255,255,0.15)"
            : "transparent",
          borderLeft: isActiveLink ? "3px solid #fff" : "3px solid transparent",
          borderRadius: "0",
          transition: "all 0.2s ease",
          fontWeight: isActiveLink ? "600" : "400",
        }}
      >
        <Icon className="me-2" size={16} />
        {children}
      </Nav.Link>
    );
  };

  return (
    <BootstrapNavbar
      bg="dark"
      variant="dark"
      expand="lg"
      className="shadow-sm sticky-top"
      expanded={expanded}
      onToggle={setExpanded}
    >
      <Container fluid className="px-3 px-md-4">
        {/* Brand - EduTrack */}
        <BootstrapNavbar.Brand
          as={Link}
          to={
            auth.token
              ? userRole === "SuperAdmin"
                ? "/super-admin"
                : `/${userRole.toLowerCase()}`
              : "/"
          }
          className="fw-bold"
          onClick={handleNavClick}
        >
          <span className="d-none d-sm-inline">🎓 EduTrack</span>
          <span className="d-sm-none">🎓 ET</span>
        </BootstrapNavbar.Brand>

        {/* Toggle Button */}
        <BootstrapNavbar.Toggle
          aria-controls="navbarNav"
          className="border-0"
          onClick={() => setExpanded(!expanded)}
        >
          <FaBars />
        </BootstrapNavbar.Toggle>

        <BootstrapNavbar.Collapse id="navbarNav">
          <Nav className="me-auto mb-2 mb-lg-0">
            {auth.token && auth.role === "HOD" && (
              <>
                <NavLink to="/hod" icon={FaHome}>
                  Dashboard
                </NavLink>
                <NavLink to="/hod/allocations" icon={FaBook}>
                  Allocations
                </NavLink>
                <NavLink to="/hod/students" icon={FaUserGraduate}>
                  Students
                </NavLink>
                <NavLink to="/hod/exam-management" icon={FaClipboardList}>
                  Exams
                </NavLink>
                <NavLink to="/hod/hall-ticket-management" icon={FaTicketAlt}>
                  Hall Tickets
                </NavLink>
                <NavLink to="/hod/bulk-upload" icon={FaUpload}>
                  Bulk Upload
                </NavLink>
                <NavLink to="/hod/semester-management" icon={FaGraduationCap}>
                  Semesters
                </NavLink>
                <NavLink to="/hod/audit-logs" icon={FaHistory}>
                  Audit Logs
                </NavLink>
              </>
            )}

            {/* ✅ UPDATED: SuperAdmin now has 4 nav links */}
            {auth.token && auth.role === "SuperAdmin" && (
              <>
                <NavLink to="/super-admin" icon={FaHome}>
                  Home
                </NavLink>
                <NavLink to="/super-admin/departments" icon={FaBuilding}>
                  Departments
                </NavLink>
                <NavLink to="/super-admin/activity" icon={FaHistory}>
                  Activity
                </NavLink>
                <NavLink to="/super-admin/users" icon={FaUserShield}>
                  Users
                </NavLink>
              </>
            )}

            {auth.token && auth.role === "Faculty" && (
              <>
                <NavLink to="/faculty" icon={FaHome}>
                  Dashboard
                </NavLink>
                <NavLink to="/faculty/attendance" icon={FaBook}>
                  Attendance
                </NavLink>
                <NavLink to="/faculty/history" icon={FaHistory}>
                  History
                </NavLink>
                <NavLink to="/faculty/documents" icon={FaFileAlt}>
                  Documents
                </NavLink>
              </>
            )}

            {auth.token && auth.role === "Mentor" && (
              <>
                <NavLink to="/mentor" icon={FaHome}>
                  Dashboard
                </NavLink>
                <NavLink to="/mentor/mentees" icon={FaUsers}>
                  Mentees
                </NavLink>
                <NavLink to="/mentor/documents" icon={FaFileAlt}>
                  Documents
                </NavLink>
                <NavLink to="/mentor/halltickets" icon={FaTicketAlt}>
                  Hall Tickets
                </NavLink>
                <NavLink to="/mentor/hall-ticket-approval" icon={FaCheckCircle}>
                  Approvals
                </NavLink>
              </>
            )}

            {auth.token && auth.role === "Student" && (
              <>
                <NavLink to="/student" icon={FaHome}>
                  Dashboard
                </NavLink>
                <NavLink to="/student/profile" icon={FaUser}>
                  Profile
                </NavLink>
                <NavLink to="/student/documents" icon={FaFileAlt}>
                  Documents
                </NavLink>
                <NavLink to="/student/halltickets" icon={FaTicketAlt}>
                  Hall Ticket
                </NavLink>
              </>
            )}
          </Nav>

          {/* Right Side - User Profile */}
          <Nav className="align-items-center">
            {auth.token ? (
              <>
                {/* ✅ FIXED: Single unified bell for Student, Faculty, and Mentor */}
                {(auth.role === "Student" ||
                  auth.role === "Faculty" ||
                  auth.role === "Mentor") && (
                  <FacultyNotificationBell auth={auth} />
                )}

                <Dropdown align="end">
                  <Dropdown.Toggle
                    variant="link"
                    className="text-white text-decoration-none d-flex align-items-center gap-2 px-3 py-2"
                    style={{
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                    }}
                  >
                    <span className="d-none d-md-inline">{userName}</span>
                    <Badge
                      bg={getRoleColor().replace("bg-", "")}
                      className="d-none d-md-inline"
                    >
                      {userRole}
                    </Badge>
                    <FaUser size={20} />
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    align="end"
                    className="shadow-lg border-0 mt-2"
                  >
                    <Dropdown.Item className="d-flex align-items-center gap-2 py-2">
                      <FaUser size={16} />
                      <div>
                        <div className="fw-bold">{userName}</div>
                        <small className="text-muted">{userRole}</small>
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      className="d-flex align-items-center gap-2 py-2 text-danger"
                      onClick={handleLogout}
                    >
                      <FaSignOutAlt size={16} />
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <>
                <Nav.Link
                  as={Link}
                  to="/login"
                  onClick={handleNavClick}
                  className="text-white px-3 py-2"
                >
                  Login
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/register"
                  onClick={handleNavClick}
                  className="btn btn-light text-dark px-4 py-2 ms-2"
                  style={{ borderRadius: "8px" }}
                >
                  Register
                </Nav.Link>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;
