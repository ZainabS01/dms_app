const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tasksController = require('../controllers/tasksController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// POST /api/tasks
router.post('/', tasksController.createTask);

// GET /api/tasks/class/:department/:semester
router.get('/class/:department/:semester', tasksController.getClassTasks);

// POST /api/tasks/:id/submit
router.post('/:id/submit', upload.single('file'), tasksController.submitTask);

// PUT /api/tasks/:id/grade/:studentId
router.put('/:id/grade/:studentId', tasksController.gradeSubmission);

// PUT /api/tasks/:id
router.put('/:id', tasksController.updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', tasksController.deleteTask);

// DELETE /api/tasks/:id/submission/:studentId
router.delete('/:id/submission/:studentId', tasksController.deleteSubmission);

module.exports = router;
