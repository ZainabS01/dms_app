const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// POST /api/feedback/submit
router.post('/submit', feedbackController.submitFeedback);

// GET /api/feedback/view
router.get('/view', feedbackController.getAllFeedback);

// GET /api/feedback/student/:studentId
router.get('/student/:studentId', feedbackController.getStudentFeedback);

// PUT /api/feedback/:id/react
router.put('/:id/react', feedbackController.reactToFeedback);

// DELETE /api/feedback/:id
router.delete('/:id', feedbackController.deleteFeedback);

module.exports = router;
