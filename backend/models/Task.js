const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentName: { type: String },
  fileUrl: { type: String },
  grade: { type: String },
  remarks: { type: String },
  status: { type: String, default: 'Submitted' }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teacherName: { type: String },
  subject: { type: String },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  taskType: { type: String },
  issueDate: { type: Date },
  dueDate: { type: Date },
  submissionFile: { type: String },
  status: { type: String, default: 'Pending' },
  grade: { type: String },
  teacherRemarks: { type: String },
  submissions: [submissionSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);
