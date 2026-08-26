const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // ID of the user, or 'admin' for admin notifications
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info' }, // 'query', 'feedback', 'request', 'notice'
  targetScreen: { type: String, default: '' }, // route path (e.g. '/(admin)/queries')
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.pre('validate', function() {
  if (this.role) {
    this.role = this.role.toLowerCase();
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
