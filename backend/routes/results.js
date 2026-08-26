const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');

// GET /api/results/students/:department/:semester
router.get('/students/:department/:semester', resultsController.getClassRosterWithResults);

// POST /api/results
router.post('/', resultsController.publishResults);

// GET /api/results/class/:department/:semester
router.get('/class/:department/:semester', resultsController.getClassResults);

// GET /api/results/student/:rollNo
router.get('/student/:rollNo', resultsController.getStudentResults);

// GET /api/results/department/:department
router.get('/department/:department', resultsController.getDeptResults);

// PUT /api/results/record
router.put('/record', resultsController.updateStudentResultRecord);

// DELETE /api/results/record/:department/:semester/:studentId
router.delete('/record/:department/:semester/:studentId', resultsController.deleteStudentResultRecord);

module.exports = router;
