const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const timetablesController = require('../controllers/timetablesController');

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

// POST /api/timetables
router.post('/', upload.single('file'), timetablesController.uploadTimetable);

// GET /api/timetables/:department/:semester
router.get('/:department/:semester', timetablesController.getTimetable);

// DELETE /api/timetables/:id
router.delete('/:id', timetablesController.deleteTimetable);

module.exports = router;
