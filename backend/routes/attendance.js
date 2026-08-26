const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// GET /api/attendance/students/:department/:semester
router.get('/students/:department/:semester', attendanceController.getStudents);

// POST /api/attendance
router.post('/', attendanceController.saveAttendance);

// GET /api/attendance/class/:department/:semester
router.get('/class/:department/:semester', attendanceController.getClassAttendance);

// GET /api/attendance/student/:studentId
router.get('/student/:studentId', attendanceController.getStudentAttendance);

// POST /api/attendance/leave
router.post('/leave', attendanceController.applyLeave);

// GET /api/attendance/leave/student/:studentId
router.get('/leave/student/:studentId', attendanceController.getStudentLeaves);

// GET /api/attendance/leave/class/:department/:semester
router.get('/leave/class/:department/:semester', attendanceController.getClassLeaves);

// PUT /api/attendance/leave/:id/status
router.put('/leave/:id/status', attendanceController.updateLeaveStatus);

module.exports = router;
