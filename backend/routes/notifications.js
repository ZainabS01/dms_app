const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');

// GET /api/notifications/:userId/:role
router.get('/:userId/:role', notificationsController.getUserNotifications);

// DELETE /api/notifications/:id
router.delete('/:id', notificationsController.deleteNotification);

// DELETE /api/notifications/clear/:userId/:role
router.delete('/clear/:userId/:role', notificationsController.clearAllNotifications);

module.exports = router;
