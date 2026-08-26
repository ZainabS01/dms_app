const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/verify-otp
router.post('/verify-otp', authController.verifyOTP);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', authController.resetPassword);

// GET /api/auth/teachers/:department
router.get('/teachers/:department', authController.getTeachers);

// GET /api/auth/users
router.get('/users', authController.getUsers);

// DELETE /api/auth/users/:id
router.delete('/users/:id', authController.deleteUser);

// PUT /api/auth/users/:id
router.put('/users/:id', authController.updateUser);

// GET /api/auth/stats
router.get('/stats', authController.getStats);

// GET /api/auth/teachers-pending
router.get('/teachers-pending', authController.getTeachersPending);

// PUT /api/auth/teachers/:id/approve
router.put('/teachers/:id/approve', authController.approveTeacher);

// PUT /api/auth/teachers/:id/reject
router.put('/teachers/:id/reject', authController.rejectTeacher);

// GET /api/auth/students-dept/:department
router.get('/students-dept/:department', authController.getStudentsDept);

// PUT /api/auth/students/:id/status
router.put('/students/:id/status', authController.updateStudentStatus);

// GET /api/auth/approve-request
router.get('/approve-request', authController.approveRequest);

// GET /api/auth/download
router.get('/download', authController.downloadFile);

module.exports = router;
