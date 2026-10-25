const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAttendanceUpdateTargets,
} = require("../src/controllers/documentController");

test("resolveAttendanceUpdateTargets uses selected subject ids when present", () => {
  const document = {
    subjects: [{ _id: "subject-1" }, { _id: "subject-2" }],
    dates: ["2026-08-01", "2026-08-02"],
  };

  const result = resolveAttendanceUpdateTargets(document, []);

  assert.deepEqual(result.subjectIds, ["subject-1", "subject-2"]);
  assert.equal(result.datesToUpdate.length, 2);
  assert.equal(
    result.datesToUpdate[0].toISOString().slice(0, 10),
    "2026-08-01",
  );
  assert.equal(
    result.datesToUpdate[1].toISOString().slice(0, 10),
    "2026-08-02",
  );
});

test("resolveAttendanceUpdateTargets falls back to all allocations when no subjects are selected", () => {
  const document = {
    studentId: { _id: "student-1", semester: 3, section: "A" },
    subjects: [],
    dates: ["2026-08-03"],
  };

  const allocations = [{ subjectId: "subject-9" }, { subjectId: "subject-10" }];

  const result = resolveAttendanceUpdateTargets(document, allocations);

  assert.deepEqual(result.subjectIds, ["subject-9", "subject-10"]);
  assert.equal(result.datesToUpdate.length, 1);
  assert.equal(
    result.datesToUpdate[0].toISOString().slice(0, 10),
    "2026-08-03",
  );
});
