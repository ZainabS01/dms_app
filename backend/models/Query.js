const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rollNumber: { type: String },
  studentName: { type: String },
  department: { type: String },
  semester: { type: String },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  recipient: { type: String, default: 'teacher' },
  reply: { type: String },
  adminReply: { type: String },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Query', querySchema);
