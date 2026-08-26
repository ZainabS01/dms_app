const express = require('express');
const router = express.Router();
const queriesController = require('../controllers/queriesController');

// POST /api/queries
router.post('/', queriesController.createQuery);

// GET /api/queries/student/:rollNumber
router.get('/student/:rollNumber', queriesController.getStudentQueries);

// GET /api/queries/class/:department/:semester
router.get('/class/:department/:semester', queriesController.getClassQueries);

// GET /api/queries/teacher/:teacherId
router.get('/teacher/:teacherId', queriesController.getTeacherQueries);

// PUT /api/queries/:id/reply
router.put('/:id/reply', queriesController.replyToQuery);

// GET /api/queries/admin
router.get('/admin', queriesController.getAdminQueries);

// PUT /api/queries/:id/admin-reply
router.put('/:id/admin-reply', queriesController.replyToQueryAdmin);

// DELETE /api/queries/:id
router.delete('/:id', queriesController.deleteQuery);

// PUT /api/queries/:id
router.put('/:id', queriesController.updateQuery);

module.exports = router;
