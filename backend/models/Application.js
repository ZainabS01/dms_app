const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: { type: String, required: true },
  reason: { type: String, required: true },
  startDate: { type: String },
  endDate: { type: String },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'PENDING' },
  teacherRemarks: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Application', applicationSchema);
