const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const subjectsController = require('../controllers/subjectsController');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// GET /api/subjects/:department/:semester
router.get('/:department/:semester', subjectsController.getDeptSubjects);

// GET /api/subjects
router.get('/', subjectsController.getAllSubjects);

// POST /api/subjects/add
router.post('/add', subjectsController.addSubject);

// PUT /api/subjects/:id
router.put('/:id', subjectsController.updateSubject);

// DELETE /api/subjects/:id
router.delete('/:id', subjectsController.deleteSubject);

// POST /api/subjects/:id/folders/add
router.post('/:id/folders/add', subjectsController.addFolder);

// PUT /api/subjects/:id/folders/:folderId
router.put('/:id/folders/:folderId', subjectsController.renameFolder);

// DELETE /api/subjects/:id/folders/:folderId
router.delete('/:id/folders/:folderId', subjectsController.deleteFolder);

// POST /api/subjects/:id/folders/:folderId/upload
router.post('/:id/folders/:folderId/upload', upload.single('file'), subjectsController.uploadFileToFolder);

// DELETE /api/subjects/:id/folders/:folderId/files/:fileId
router.delete('/:id/folders/:folderId/files/:fileId', subjectsController.deleteFileFromFolder);

module.exports = router;
