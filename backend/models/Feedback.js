const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  studentRollNo: { type: String, required: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  subject: { type: String, required: true },
  category: { type: String, default: 'General' },
  message: { type: String, required: true },
  rating: { type: Number, default: 5 },
  status: { type: String, default: 'PENDING' }, // PENDING, REVIEWED, RESOLVED
  adminReply: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
