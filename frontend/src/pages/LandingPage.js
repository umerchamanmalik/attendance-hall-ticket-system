import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Navbar,
  Nav,
  Badge,
} from "react-bootstrap";
import {
  FaGraduationCap,
  FaTicketAlt,
  FaCheckCircle,
  FaBell,
  FaFileAlt,
  FaChartLine,
  FaUsers,
  FaSignInAlt,
  FaUserPlus,
  FaBars,
  FaTimes,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
} from "react-icons/fa";

// ✅ Change this to your college photo path
const COLLEGE_PHOTO = "/images/jcer.jpg";

// ✅ Change to your college name + details
const COLLEGE_NAME = "Jain College Of Engineering And Research Belagavi";
const COLLEGE_TAGLINE = "Department of Computer Science & Engineering";
const COLLEGE_EMAIL = "principal@jcer.in";
const COLLEGE_PHONE = "099448693987";
const COLLEGE_ADDRESS = "Udhyambhag, Belagavi, Karnataka";
const CURRENT_YEAR = new Date().getFullYear();

const LandingPage = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ✅ Sticky navbar on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ✅ Smooth scroll to section
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  };

  const services = [
    {
      icon: FaUsers,
      title: "Attendance Tracking",
      desc: "Faculty mark attendance per subject. Students view real-time percentages with threshold alerts.",
      color: "#3b82f6",
    },
    {
      icon: FaTicketAlt,
      title: "Hall Ticket Generation",
      desc: "Auto-generate hall tickets with subject-wise eligibility based on department attendance thresholds.",
      color: "#10b981",
    },
    {
      icon: FaFileAlt,
      title: "Document Correction",
      desc: "Students submit leave / attendance-correction requests. Mentor & faculty review with per-subject tracking.",
      color: "#f59e0b",
    },
    {
      icon: FaBell,
      title: "Smart Notifications",
      desc: "In-app + email alerts for hall ticket status, document approvals, and low-attendance warnings.",
      color: "#8b5cf6",
    },
    {
      icon: FaGraduationCap,
      title: "Multi-Department",
      desc: "Supports CS, EC, MECH, CIVIL, EEE — each with its own HOD, faculty, students, and thresholds.",
      color: "#ef4444",
    },
    {
      icon: FaChartLine,
      title: "Analytics & Reports",
      desc: "Track attendance trends, downloadable reports, hall ticket PDFs, and exportable audit logs.",
      color: "#06b6d4",
    },
  ];

  const steps = [
    {
      icon: FaSignInAlt,
      title: "Login with your account",
      desc: "Use your college credentials. Roles: Student, Faculty, Mentor, HOD, or SuperAdmin.",
    },
    {
      icon: FaCheckCircle,
      title: "Track attendance & apply corrections",
      desc: "View subject-wise attendance. Submit leave or attendance-correction requests if needed.",
    },
    {
      icon: FaTicketAlt,
      title: "Download your hall ticket",
      desc: "Once eligible, your hall ticket is generated. Download as PDF with verified photo and subjects.",
    },
  ];

  return (
    <div className="landing-page">
      {/* ============================== */}
      {/* PUBLIC NAVBAR */}
      {/* ============================== */}
      <Navbar
        expand="lg"
        className={`landing-navbar ${scrolled ? "landing-navbar-scrolled" : ""}`}
        fixed="top"
      >
        <Container>
          <Navbar.Brand
            onClick={() => scrollTo("hero")}
            className="landing-brand"
            style={{ cursor: "pointer" }}
          >
            <FaGraduationCap className="me-2" size={24} />
            <strong>AHS</strong>
          </Navbar.Brand>

          <button
            className="landing-mobile-toggle d-lg-none"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            {mobileNavOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
          </button>

          <Nav
            className={`ms-auto landing-nav-links ${mobileNavOpen ? "open" : ""}`}
          >
            <Nav.Link onClick={() => scrollTo("hero")}>Home</Nav.Link>
            <Nav.Link onClick={() => scrollTo("about")}>About</Nav.Link>
            <Nav.Link onClick={() => scrollTo("services")}>Services</Nav.Link>
            <Nav.Link onClick={() => scrollTo("contact")}>Contact</Nav.Link>
            <Link to="/login" className="nav-login-btn">
              <FaSignInAlt className="me-1" size={12} /> Login
            </Link>
            <Link to="/register" className="nav-register-btn">
              <FaUserPlus className="me-1" size={12} /> Register
            </Link>
          </Nav>
        </Container>
      </Navbar>

      {/* ============================== */}
      {/* HERO SECTION */}
      {/* ============================== */}
      <section id="hero" className="landing-hero">
        <div
          className="landing-hero-bg"
          style={{ backgroundImage: `url(${COLLEGE_PHOTO})` }}
        />
        <div className="landing-hero-overlay" />
        <Container className="landing-hero-content">
          <Row className="align-items-center">
            <Col lg={8} className="text-white">
              <Badge bg="light" text="dark" className="mb-3 px-3 py-2">
                {COLLEGE_NAME} • {COLLEGE_TAGLINE}
              </Badge>
              <h1 className="landing-hero-title">
                <span className="text-warning">Attendance Hall Ticket </span>
                <span className="text-warning">System</span>
              </h1>
              <p className="landing-hero-subtitle">
                A unified platform for students, faculty, mentors, and HODs to
                track attendance, generate hall tickets, and manage document
                corrections — All in one place.
              </p>
              <div className="landing-hero-actions">
                <Link to="/login">
                  <Button size="lg" variant="warning" className="me-3 mb-2">
                    <FaSignInAlt className="me-2" /> Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="outline-light" className="mb-2">
                    <FaUserPlus className="me-2" /> Register
                  </Button>
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ============================== */}
      {/* ABOUT SECTION */}
      {/* ============================== */}
      <section id="about" className="landing-section landing-about">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <h6 className="landing-section-eyebrow">About the System</h6>
              <h2 className="landing-section-title">
                Built for the way colleges actually work
              </h2>
              <p className="landing-section-text">
                Managing attendance, hall tickets, and correction requests
                across multiple departments used to mean messy spreadsheets and
                endless follow-ups. AHS replaces that with a role-based,
                multi-department system that keeps everyone on the same page.
              </p>
              <ul className="landing-about-list">
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  Real-time attendance tracking with department-specific
                  thresholds
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  Automatic hall ticket generation with subject-wise eligibility
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  Document correction flow: student → mentor → faculty
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  In-app + email notifications for every critical event
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  Export hall tickets as PDFs with verified photos
                </li>
              </ul>
            </Col>
            <Col lg={6}>
              <div className="landing-about-visual">
                <div className="landing-about-card">
                  <FaGraduationCap size={36} className="text-primary mb-2" />
                  <h5>For Students</h5>
                  <p className="mb-0 text-muted small">
                    Track attendance, apply corrections, download hall tickets.
                  </p>
                </div>
                <div className="landing-about-card">
                  <FaUsers size={36} className="text-success mb-2" />
                  <h5>For Faculty & Mentors</h5>
                  <p className="mb-0 text-muted small">
                    Mark attendance, review documents, approve hall tickets.
                  </p>
                </div>
                <div className="landing-about-card">
                  <FaChartLine size={36} className="text-warning mb-2" />
                  <h5>For HODs & Admin</h5>
                  <p className="mb-0 text-muted small">
                    Manage departments, faculty allocations, exams, and reports.
                  </p>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ============================== */}
      {/* SERVICES SECTION */}
      {/* ============================== */}
      <section id="services" className="landing-section landing-services">
        <Container>
          <div className="text-center mb-5">
            <h6 className="landing-section-eyebrow">Our Services</h6>
            <h2 className="landing-section-title">
              Everything your institution needs
            </h2>
            <p
              className="landing-section-text mx-auto"
              style={{ maxWidth: 620 }}
            >
              From attendance marking to hall ticket downloads, AHS covers the
              complete academic workflow for every role.
            </p>
          </div>
          <Row className="g-4">
            {services.map((service, idx) => {
              const Icon = service.icon;
              return (
                <Col md={6} lg={4} key={idx}>
                  <Card className="landing-service-card h-100">
                    <Card.Body>
                      <div
                        className="landing-service-icon"
                        style={{ background: service.color }}
                      >
                        <Icon size={24} color="#fff" />
                      </div>
                      <h5 className="mt-3 mb-2">{service.title}</h5>
                      <p className="text-muted mb-0">{service.desc}</p>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Container>
      </section>

      {/* ============================== */}
      {/* HOW IT WORKS */}
      {/* ============================== */}
      <section className="landing-section landing-steps">
        <Container>
          <div className="text-center mb-5">
            <h6 className="landing-section-eyebrow">How It Works</h6>
            <h2 className="landing-section-title">Get started in 3 steps</h2>
          </div>
          <Row className="g-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <Col md={4} key={idx}>
                  <div className="landing-step-card">
                    <div className="landing-step-number">{idx + 1}</div>
                    <Icon size={32} className="text-primary mb-3" />
                    <h5>{step.title}</h5>
                    <p className="text-muted mb-0">{step.desc}</p>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Container>
      </section>

      {/* ============================== */}
      {/* CTA SECTION */}
      {/* ============================== */}
      <section className="landing-cta">
        <Container className="text-center text-white">
          <h2 className="mb-3">Ready to get started?</h2>
          <p className="mb-4" style={{ opacity: 0.9 }}>
            Login with your college credentials or register a new account.
          </p>
          <Link to="/login">
            <Button size="lg" variant="warning" className="me-3 mb-2">
              <FaSignInAlt className="me-2" /> Login
            </Button>
          </Link>
          <Link to="/register">
            <Button size="lg" variant="outline-light" className="mb-2">
              <FaUserPlus className="me-2" /> Register
            </Button>
          </Link>
        </Container>
      </section>

      {/* ============================== */}
      {/* FOOTER */}
      {/* ============================== */}
      <footer id="contact" className="landing-footer">
        <Container>
          <Row className="g-4">
            <Col md={4}>
              <h5 className="text-white mb-3">
                <FaGraduationCap className="me-2" /> AHS
              </h5>
              <p className="text-white-50 small">
                Attendance Hall Ticket System for {COLLEGE_NAME}. Built as an
                academic project demonstrating multi-role, multi-department
                MERN-stack architecture.
              </p>
            </Col>
            <Col md={4}>
              <h6 className="text-white mb-3">Quick Links</h6>
              <ul className="landing-footer-links">
                <li>
                  <a onClick={() => scrollTo("hero")}>Home</a>
                </li>
                <li>
                  <a onClick={() => scrollTo("about")}>About</a>
                </li>
                <li>
                  <a onClick={() => scrollTo("services")}>Services</a>
                </li>
                <li>
                  <Link to="/login">Login</Link>
                </li>
                <li>
                  <Link to="/register">Register</Link>
                </li>
              </ul>
            </Col>
            <Col md={4}>
              <h6 className="text-white mb-3">Contact</h6>
              <ul className="landing-footer-links">
                <li>
                  <FaEnvelope className="me-2" /> {COLLEGE_EMAIL}
                </li>
                <li>
                  <FaPhone className="me-2" /> {COLLEGE_PHONE}
                </li>
                <li>
                  <FaMapMarkerAlt className="me-2" /> {COLLEGE_ADDRESS}
                </li>
              </ul>
            </Col>
          </Row>
          <hr className="border-secondary my-4" />
          <div className="text-center text-white-50 small">
            © {CURRENT_YEAR} {COLLEGE_NAME}. All rights reserved.
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default LandingPage;
