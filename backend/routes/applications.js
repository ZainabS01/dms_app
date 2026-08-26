const express = require('express');
const router = express.Router();
const applicationsController = require('../controllers/applicationsController');

// POST /api/applications
router.post('/', applicationsController.applyApplication);

// GET /api/applications/student/:studentId
router.get('/student/:studentId', applicationsController.getStudentApplications);

// GET /api/applications
router.get('/', applicationsController.getAllApplications);

// GET /api/applications/teacher/:teacherId
router.get('/teacher/:teacherId', applicationsController.getTeacherApplications);

// PUT /api/applications/:id
router.put('/:id', applicationsController.updateApplication);

module.exports = router;
