const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Document Type with clean enum
    documentType: {
      type: String,
      required: true,
      enum: ["leave", "attendance-correction"],
      trim: true,
    },

    // Common fields
    description: {
      type: String,
      trim: true,
      required: true,
    },

    // File fields (optional for attendance-correction)
    fileName: {
      type: String,
      default: null,
    },
    filePath: {
      type: String,
      default: null,
    },

    // Subject selection for attendance correction
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    // If subjects array is empty → means ALL subjects

    // ✅ ADDED: Per-subject faculty approval tracking
    subjectApprovals: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },
        subjectName: {
          type: String,
          required: true,
        },
        facultyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        facultyName: {
          type: String,
          default: null,
        },
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Pending",
        },
        remarks: {
          type: String,
          trim: true,
          default: "",
        },
        reviewedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // Attendance Correction specific fields
    dates: {
      type: [Date],
      default: [],
    },
    priorPermission: {
      type: Boolean,
      default: false,
    },

    // Leave Application specific fields
    leaveStartDate: {
      type: Date,
      default: null,
    },
    leaveEndDate: {
      type: Date,
      default: null,
    },

    // Main status field (simplified)
    status: {
      type: String,
      enum: [
        "pending", // Student submitted, waiting for mentor
        "mentor-approved", // Mentor approved
        "mentor-rejected", // Mentor rejected
        "partially-approved", // ✅ ADDED: At least 1 faculty acted, others pending
        "faculty-approved", // Faculty approved (all)
        "completed", // All subjects resolved
      ],
      default: "pending",
    },

    // Status display text for UI
    statusDisplay: {
      type: String,
      default: "Pending Mentor Review",
    },

    // Mentor fields
    mentorRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    mentorReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    mentorReviewedAt: {
      type: Date,
      default: null,
    },

    // Faculty fields
    facultyRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    facultyReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    facultyConfirmedAt: {
      type: Date,
      default: null,
    },

    // Edit history for student edits
    editHistory: [
      {
        editedAt: {
          type: Date,
          default: Date.now,
        },
        changes: {
          type: Object,
          default: {},
        },
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Track if document was edited
    isEdited: {
      type: Boolean,
      default: false,
    },

    // Submission tracking
    submittedAt: {
      type: Date,
      default: Date.now,
    },

    // For leave applications - keep for backward compatibility
    correctionType: {
      type: String,
      enum: ["Absent to Present", null],
      default: null,
    },
    currentStatus: {
      type: String,
      enum: ["Present", "Absent", null],
      default: null,
    },

    // Legacy fields - keeping for backward compatibility
    mentorStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    facultyStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
    },
    overallStatus: {
      type: String,
      default: "Pending Mentor Review",
    },
    attendanceDate: {
      type: Date,
      default: null,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    department: {
      type: String,
      default: "CS",
      required: false,
      trim: true,
      uppercase: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for better query performance
documentSchema.index({ studentId: 1, status: 1 });
documentSchema.index({ mentorId: 1, status: 1 });
documentSchema.index({ department: 1, status: 1 });
documentSchema.index({ documentType: 1, status: 1 });
documentSchema.index({ submittedAt: -1 });
documentSchema.index({ "subjectApprovals.facultyId": 1 }); // ✅ ADDED

// Virtual to check if document is editable (pending status only)
documentSchema.virtual("isEditable").get(function () {
  return this.status === "pending";
});

// Virtual to check if document is deletable (pending status only)
documentSchema.virtual("isDeletable").get(function () {
  return this.status === "pending";
});

// Virtual to get display status
documentSchema.virtual("displayStatus").get(function () {
  const statusMap = {
    pending: "Pending Mentor Review",
    "mentor-approved": "Mentor Approved - Under Faculty Review",
    "mentor-rejected": "Mentor Rejected",
    "partially-approved": "Partially Approved - Awaiting Faculty",
    "faculty-approved": "Faculty Approved - Processing",
    completed: "Completed",
  };
  return statusMap[this.status] || this.status;
});

// Method to check if document is for all subjects
documentSchema.methods.isAllSubjects = function () {
  return !this.subjects || this.subjects.length === 0;
};

// ✅ ADDED: Method to compute overall progress across subject approvals
documentSchema.methods.getApprovalProgress = function () {
  const approvals = this.subjectApprovals || [];
  if (approvals.length === 0) {
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      allResolved: false,
    };
  }
  const approved = approvals.filter((a) => a.status === "Approved").length;
  const rejected = approvals.filter((a) => a.status === "Rejected").length;
  const pending = approvals.filter((a) => a.status === "Pending").length;
  return {
    total: approvals.length,
    approved,
    rejected,
    pending,
    allResolved: pending === 0,
  };
};

// Pre-save middleware to update statusDisplay + legacy fields
documentSchema.pre("save", function (next) {
  const statusMap = {
    pending: "Pending Mentor Review",
    "mentor-approved": "Mentor Approved - Under Faculty Review",
    "mentor-rejected": "Mentor Rejected",
    "partially-approved": "Partially Approved - Awaiting Faculty",
    "faculty-approved": "Faculty Approved - Processing",
    completed: "Completed",
  };
  this.statusDisplay = statusMap[this.status] || this.status;

  // Update legacy fields for backward compatibility
  if (this.status === "pending") {
    this.mentorStatus = "Pending";
    this.facultyStatus = "Pending";
    this.overallStatus = "Pending Mentor Review";
  } else if (this.status === "mentor-approved") {
    this.mentorStatus = "Approved";
    this.facultyStatus = "Pending";
    this.overallStatus = "Pending Faculty Review";
  } else if (this.status === "mentor-rejected") {
    this.mentorStatus = "Rejected";
    this.facultyStatus = "Rejected";
    this.overallStatus = "Rejected";
  } else if (this.status === "partially-approved") {
    this.mentorStatus = "Approved";
    this.facultyStatus = "Pending";
    this.overallStatus = "Partially Approved";
  } else if (this.status === "faculty-approved") {
    this.mentorStatus = "Approved";
    this.facultyStatus = "Approved";
    this.overallStatus = "Approved";
  } else if (this.status === "completed") {
    this.mentorStatus = "Approved";
    // ✅ FIXED: Determine overall completion state based on subject approvals
    const progress = this.getApprovalProgress();
    if (progress.total > 0 && progress.rejected === 0) {
      this.facultyStatus = "Completed";
      this.overallStatus = "Completed";
    } else if (progress.total > 0 && progress.rejected === progress.total) {
      this.facultyStatus = "Rejected";
      this.overallStatus = "Rejected";
    } else if (progress.total > 0) {
      this.facultyStatus = "Completed";
      this.overallStatus = "Partially Completed";
    } else {
      this.facultyStatus = "Completed";
      this.overallStatus = "Completed";
    }
  }

  next();
});

// Set toJSON to include virtuals
documentSchema.set("toJSON", { virtuals: true });
documentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Document", documentSchema);
