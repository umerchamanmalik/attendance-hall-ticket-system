const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────
// Helper: Find student photo with multiple path attempts
// ─────────────────────────────────────────────
const findStudentPhoto = (photoPath) => {
  if (!photoPath) return null;

  const possiblePaths = [
    path.join(process.cwd(), photoPath),
    path.join(process.cwd(), "uploads", "students", path.basename(photoPath)),
    path.join(
      process.cwd(),
      photoPath.replace(/^\/uploads\/students\//, "uploads/students/"),
    ),
    path.join(
      process.cwd(),
      photoPath.replace(/^uploads\/students\//, "uploads/students/"),
    ),
    photoPath,
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > 0) {
        return p;
      }
    } catch (err) {
      // ignore
    }
  }
  return null;
};

// ─────────────────────────────────────────────
// Helper: Get department display name
// ─────────────────────────────────────────────
const getDepartmentName = (code) => {
  const map = {
    CS: "Computer Science & Engineering",
    EC: "Electronics & Communication Engineering",
    MECH: "Mechanical Engineering",
    CIVIL: "Civil Engineering",
    EEE: "Electrical & Electronics Engineering",
    ISE: "Information Science & Engineering",
    AIML: "AI & Machine Learning",
    AIDS: "AI & Data Science",
  };
  return map[code] || code || "Computer Science & Engineering";
};

// ─────────────────────────────────────────────
// Main PDF Generator
// ─────────────────────────────────────────────
const generateHallTicketPDF = async (hallTicket) => {
  return new Promise(async (resolve, reject) => {
    try {
      await hallTicket.populate(
        "studentId",
        "studentName rollNumber academicYear semester section photoPath department",
      );
      await hallTicket.populate(
        "examId",
        "examName academicYear semester section startDate endDate department",
      );

      const student = hallTicket.studentId;
      const exam = hallTicket.examId;

      // ✅ Determine department (from exam, then hall ticket, then student)
      const studentDept = (
        exam?.department ||
        hallTicket.department ||
        student?.department ||
        "CS"
      )
        .toString()
        .trim()
        .toUpperCase();
      const departmentDisplay = `${studentDept} — ${getDepartmentName(studentDept)}`;

      // ──────────────────────────────────────
      // ✅ PHOTO CHECK
      // ──────────────────────────────────────
      const studentPhotoPath = findStudentPhoto(student.photoPath);
      const hasPhoto = !!studentPhotoPath;

      if (!hasPhoto) {
        console.log(
          `⚠️ No photo for student ${student.studentName}. PDF will use placeholder.`,
        );
      }

      // ──────────────────────────────────────
      // Setup Document
      // ──────────────────────────────────────
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        layout: "portrait",
        autoFirstPage: true,
      });

      const dir = path.join(process.cwd(), "uploads", "halltickets");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filename = `hallticket_${student._id}_${exam._id}.pdf`;
      const filePath = path.join(dir, filename);
      const relativePath = `uploads/halltickets/${filename}`;

      console.log("📁 Generating PDF at:", filePath);

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const PAGE_WIDTH = 595.28;
      const PAGE_MARGIN = 40;
      const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

      // ============================================
      // HEADER — Logo + College Details
      // ============================================
      let currentY = 40;

      const logoPath = path.join(process.cwd(), "uploads/logo.jpg");
      let logoWidth = 0;

      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, PAGE_MARGIN, currentY, { width: 70 });
          logoWidth = 85;
          console.log("✅ Logo placed");
        } catch (err) {
          console.log("⚠️ Could not place logo:", err.message);
        }
      } else {
        console.log("ℹ️ Logo not found at:", logoPath);
      }

      const headerX = PAGE_MARGIN + logoWidth;
      const headerWidth = CONTENT_WIDTH - logoWidth;

      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text("INTERNAL EXAM HALL TICKET", headerX, currentY + 5, {
          align: "center",
          width: headerWidth,
        });

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(
          "Jain College Of Engineering And Research Belagavi",
          headerX,
          currentY + 27,
          {
            align: "center",
            width: headerWidth,
          },
        );

      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor("#555")
        .text(
          "Approved by AICTE, New Delhi | Affiliated to VTU Belagavi",
          headerX,
          currentY + 45,
          {
            align: "center",
            width: headerWidth,
          },
        );

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#777")
        .text("Udyambagh, Belagavi - 590008", headerX, currentY + 58, {
          align: "center",
          width: headerWidth,
        });

      // Divider
      const headerEnd = currentY + 78;
      doc
        .moveTo(PAGE_MARGIN, headerEnd)
        .lineTo(PAGE_WIDTH - PAGE_MARGIN, headerEnd)
        .lineWidth(1)
        .strokeColor("#333")
        .stroke();

      doc.fillColor("#000");

      // ============================================
      // STUDENT PHOTO + DETAILS
      // ============================================
      const sectionStartY = headerEnd + 20;

      // ── Photo Box (Left) ──
      const photoBoxX = PAGE_MARGIN;
      const photoBoxY = sectionStartY;
      const photoBoxW = 100;
      const photoBoxH = 120;

      if (hasPhoto) {
        try {
          const image = doc.openImage(studentPhotoPath);
          const imgWidth = image.width;
          const imgHeight = image.height;

          const boxAspect = photoBoxW / photoBoxH;
          const imgAspect = imgWidth / imgHeight;

          let drawW, drawH, drawX, drawY;

          if (imgAspect > boxAspect) {
            drawW = photoBoxW;
            drawH = photoBoxW / imgAspect;
            drawX = photoBoxX;
            drawY = photoBoxY + (photoBoxH - drawH) / 2;
          } else {
            drawH = photoBoxH;
            drawW = photoBoxH * imgAspect;
            drawX = photoBoxX + (photoBoxW - drawW) / 2;
            drawY = photoBoxY;
          }

          doc.image(studentPhotoPath, drawX, drawY, {
            width: drawW,
            height: drawH,
          });
          console.log("✅ Photo placed with proper aspect ratio");
        } catch (err) {
          console.log("⚠️ Could not place photo:", err.message);
          drawPhotoPlaceholder(doc, photoBoxX, photoBoxY, photoBoxW, photoBoxH);
        }
      } else {
        drawPhotoPlaceholder(doc, photoBoxX, photoBoxY, photoBoxW, photoBoxH);
      }

      // Border around photo box
      doc
        .rect(photoBoxX, photoBoxY, photoBoxW, photoBoxH)
        .lineWidth(1)
        .strokeColor("#333")
        .stroke();

      // ── Student Details Table (Right) — NOW 5 ROWS ──
      const tableX = photoBoxX + photoBoxW + 15;
      const tableY = photoBoxY;
      const tableW = PAGE_WIDTH - PAGE_MARGIN - tableX;
      const rowH = 24; // slightly smaller to fit 5 rows in 120px

      const totalRows = 5;

      // Draw table border
      doc
        .rect(tableX, tableY, tableW, rowH * totalRows)
        .lineWidth(1)
        .strokeColor("#333")
        .stroke();

      // Horizontal dividers
      for (let i = 1; i < totalRows; i++) {
        doc
          .moveTo(tableX, tableY + rowH * i)
          .lineTo(tableX + tableW, tableY + rowH * i)
          .stroke();
      }

      // Vertical divider (label | value)
      const labelWidth = 110;
      doc
        .moveTo(tableX + labelWidth, tableY)
        .lineTo(tableX + labelWidth, tableY + rowH * totalRows)
        .stroke();

      // Row content helper
      const drawRow = (rowIndex, label, value) => {
        const y = tableY + rowH * rowIndex;

        doc
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .fillColor("#333")
          .text(label, tableX + 8, y + 7, { width: labelWidth - 12 });

        doc
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor("#000")
          .text(value || "—", tableX + labelWidth + 8, y + 7, {
            width: tableW - labelWidth - 16,
          });
      };

      // Row 0: Student Name
      drawRow(0, "Student Name", student.studentName);

      // Row 1: USN / Roll No
      drawRow(1, "USN / Roll No", student.rollNumber);

      // ✅ Row 2: Department (NEW)
      drawRow(2, "Department", departmentDisplay);

      // Row 3: Academic Year | Sem | Sec
      drawRow(
        3,
        "Academic Year",
        `${student.academicYear || ""} | Sem ${student.semester || ""} | Sec ${student.section || ""}`,
      );

      // Row 4: Exam
      drawRow(
        4,
        "Exam",
        `${exam.examName || ""}  (${new Date(exam.startDate).toLocaleDateString()} - ${new Date(exam.endDate).toLocaleDateString()})`,
      );

      // ============================================
      // SUBJECT ELIGIBILITY TABLE
      // ============================================
      let nextY = Math.max(
        photoBoxY + photoBoxH + 25,
        tableY + rowH * totalRows + 25,
      );

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text("Subject Eligibility", PAGE_MARGIN, nextY);

      nextY += 18;

      const subColWidths = [220, 130, 165];
      const subRowHeight = 26;
      const subTableWidth = subColWidths.reduce((a, b) => a + b, 0);

      // Header row
      doc
        .rect(PAGE_MARGIN, nextY, subTableWidth, subRowHeight)
        .fillAndStroke("#f0f0f0", "#333");

      let dividerX = PAGE_MARGIN;
      for (let i = 0; i < subColWidths.length - 1; i++) {
        dividerX += subColWidths[i];
        doc
          .moveTo(dividerX, nextY)
          .lineTo(dividerX, nextY + subRowHeight)
          .lineWidth(0.5)
          .strokeColor("#333")
          .stroke();
      }

      let colX = PAGE_MARGIN;
      const headers = ["Subject Name", "Eligibility", "Invigilator Signature"];
      headers.forEach((h, i) => {
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#000")
          .text(h, colX + 6, nextY + 8, {
            width: subColWidths[i] - 12,
            align: "center",
          });
        colX += subColWidths[i];
      });

      nextY += subRowHeight;

      const seenSubjects = new Set();
      const uniqueSubjects = [];

      (hallTicket.subjectEligibility || []).forEach((subject) => {
        const key = (subject.subjectName || "").trim().toLowerCase();
        if (!seenSubjects.has(key)) {
          seenSubjects.add(key);
          uniqueSubjects.push(subject);
        }
      });

      if (uniqueSubjects.length === 0) {
        doc.rect(PAGE_MARGIN, nextY, subTableWidth, subRowHeight).stroke();

        let emptyDivX = PAGE_MARGIN;
        for (let i = 0; i < subColWidths.length - 1; i++) {
          emptyDivX += subColWidths[i];
          doc
            .moveTo(emptyDivX, nextY)
            .lineTo(emptyDivX, nextY + subRowHeight)
            .lineWidth(0.5)
            .strokeColor("#333")
            .stroke();
        }

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#999")
          .text("No subjects available", PAGE_MARGIN, nextY + 8, {
            width: subTableWidth,
            align: "center",
          });

        nextY += subRowHeight;
      } else {
        uniqueSubjects.forEach((subject, index) => {
          const isEven = index % 2 === 0;
          const rowColor = isEven ? "#ffffff" : "#fafafa";

          doc
            .rect(PAGE_MARGIN, nextY, subTableWidth, subRowHeight)
            .fillAndStroke(rowColor, "#333");

          let rowDivX = PAGE_MARGIN;
          for (let i = 0; i < subColWidths.length - 1; i++) {
            rowDivX += subColWidths[i];
            doc
              .moveTo(rowDivX, nextY)
              .lineTo(rowDivX, nextY + subRowHeight)
              .lineWidth(0.5)
              .strokeColor("#333")
              .stroke();
          }

          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#000")
            .text(subject.subjectName || "—", PAGE_MARGIN + 8, nextY + 8, {
              width: subColWidths[0] - 16,
            });

          const eligibilityText = subject.eligible
            ? "Eligible"
            : "Not Eligible";
          const eligibilityColor = subject.eligible ? "#0a7" : "#c00";
          doc
            .fontSize(9)
            .font("Helvetica-Bold")
            .fillColor(eligibilityColor)
            .text(
              eligibilityText,
              PAGE_MARGIN + subColWidths[0] + 6,
              nextY + 8,
              {
                width: subColWidths[1] - 12,
                align: "center",
              },
            );

          nextY += subRowHeight;
        });
      }

      // ============================================
      // FOOTER — Issue Date, Status, Remarks
      // ============================================
      nextY += 20;

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#333")
        .text(
          `Issue Date: ${new Date().toLocaleDateString()}`,
          PAGE_MARGIN,
          nextY,
        );

      const statusText =
        hallTicket.approvalStatus === "Approved"
          ? "Approved"
          : hallTicket.approvalStatus === "Rejected"
            ? "Rejected"
            : "Pending";

      const statusColor =
        hallTicket.approvalStatus === "Approved"
          ? "#0a7"
          : hallTicket.approvalStatus === "Rejected"
            ? "#c00"
            : "#c80";

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(statusColor)
        .text(`Status: ${statusText}`, 300, nextY);

      if (hallTicket.mentorRemarks && hallTicket.mentorRemarks !== "N/A") {
        nextY += 15;
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#555")
          .text(`Remarks: ${hallTicket.mentorRemarks}`, PAGE_MARGIN, nextY, {
            width: CONTENT_WIDTH,
          });
      }

      // ============================================
      // SIGNATURES
      // ============================================
      const sigY = 700;

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text("Student Signature", 60, sigY, { width: 140, align: "center" });

      doc.text("Mentor Signature", 220, sigY, { width: 140, align: "center" });
      doc.text("HOD Signature", 400, sigY, { width: 140, align: "center" });

      doc
        .moveTo(40, sigY + 30)
        .lineTo(200, sigY + 30)
        .strokeColor("#333")
        .stroke();
      doc
        .moveTo(220, sigY + 30)
        .lineTo(380, sigY + 30)
        .stroke();
      doc
        .moveTo(400, sigY + 30)
        .lineTo(560, sigY + 30)
        .stroke();

      doc
        .fontSize(7)
        .font("Helvetica-Oblique")
        .fillColor("#888")
        .text(
          "This hall ticket is valid only if presented with a valid ID card. | Please carry this hall ticket to every exam session.",
          40,
          790,
          { width: CONTENT_WIDTH, align: "center" },
        );

      doc.end();

      writeStream.on("finish", () => {
        console.log("✅ PDF generated successfully:", filePath);
        resolve(relativePath);
      });

      writeStream.on("error", (err) => {
        console.error("❌ Error writing PDF:", err);
        reject(err);
      });
    } catch (error) {
      console.error("❌ Error generating PDF:", error);
      reject(error);
    }
  });
};

// ─────────────────────────────────────────────
// Helper: Draw placeholder when no photo
// ─────────────────────────────────────────────
const drawPhotoPlaceholder = (doc, x, y, width, height) => {
  doc.rect(x, y, width, height).fillAndStroke("#f5f5f5", "#333");

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#888")
    .text("📷", x + width / 2 - 10, y + height / 2 - 20, {
      width: 20,
      align: "center",
    });

  doc
    .fontSize(7)
    .fillColor("#999")
    .text("No Photo", x + 10, y + height / 2 + 5, {
      width: width - 20,
      align: "center",
    });

  doc.fillColor("#000");
};

module.exports = {
  generateHallTicketPDF,
};
