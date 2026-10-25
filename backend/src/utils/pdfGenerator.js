const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateHallTicketPdf = async ({ student, hallTicket, outputPath }) => {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    doc
      .fillColor("#0d6efd")
      .fontSize(20)
      .text("Institution of Applied Sciences", {
        align: "center",
      });
    doc
      .fontSize(14)
      .fillColor("#212529")
      .text("Hall Ticket / Attendance Certificate", {
        align: "center",
        underline: true,
      });
    doc.moveDown();

    doc
      .fontSize(12)
      .fillColor("#495057")
      .text(`Student Name: ${student.studentName}`)
      .text(`Roll Number: ${student.rollNumber}`)
      .text(`Academic Year: ${student.academicYear}`)
      .text(`Semester: ${student.semester}`)
      .text(`Section: ${student.section}`)
      .moveDown();

    doc.fontSize(12).text("Attendance Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(
      `Attendance Percentage: ${hallTicket.attendancePercentage.toFixed(2)}%`,
    );
    doc.text(`Approval Status: ${hallTicket.approvalStatus}`);
    doc.text(
      `Generated Date: ${new Date(hallTicket.generatedDate).toLocaleDateString()}`,
    );
    doc.text(`Reviewed By: ${hallTicket.approvedBy || "Not yet approved"}`);
    doc.moveDown(1.5);

    doc.rect(doc.x, doc.y, 500, 1).fill("#dee2e6");
    doc.moveDown(2);

    doc
      .fontSize(11)
      .fillColor("#212529")
      .text(
        "This hall ticket certifies that the above student is eligible for the upcoming examination based on attendance records.",
        {
          align: "justify",
        },
      );
    doc.moveDown(2);

    doc.text("Principal Signature:", { continued: true });
    doc.moveDown(4);
    doc.text("______________________________");
    doc.moveDown(2);
    doc.text("College Stamp:", { continued: true });
    doc.moveDown(4);
    doc.text("______________________________");

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
};

module.exports = {
  generateHallTicketPdf,
};
