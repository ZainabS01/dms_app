const express = require('express');
const router = express.Router();
const noticesController = require('../controllers/noticesController');

// POST /api/notices/add
router.post('/add', noticesController.addNotice);

// GET /api/notices/admin
router.get('/admin', noticesController.getAdminNotices);

// DELETE /api/notices/:id
router.delete('/:id', noticesController.deleteNotice);

// PUT /api/notices/:id
router.put('/:id', noticesController.updateNotice);

// GET /api/notices/view/:role/:department
router.get('/view/:role/:department', noticesController.getUserNotices);

// GET /api/notices/:id
router.get('/:id', noticesController.getNoticeById);

module.exports = router;
