const Notification = require('../models/Notification');

// GET /api/notifications/:userId/:role
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId, role } = req.params;
    let query = { role: new RegExp('^' + role + '$', 'i') };

    if (role === 'admin') {
      query.userId = 'admin';
    } else {
      query.userId = userId;
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error('Get Notifications Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    await Notification.deleteOne({ _id: req.params.id });
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Delete Notification Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/notifications/clear/:userId/:role
exports.clearAllNotifications = async (req, res) => {
  try {
    const { userId, role } = req.params;
    let query = { role: new RegExp('^' + role + '$', 'i') };

    if (role === 'admin') {
      query.userId = 'admin';
    } else {
      query.userId = userId;
    }

    await Notification.deleteMany(query);
    res.json({ message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error('Clear All Notifications Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
