const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'leave'],
    default: 'present'
  }
});

const attendanceSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  records: [attendanceRecordSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
