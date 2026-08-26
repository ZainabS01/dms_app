const mongoose = require('mongoose');

const resultRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gpa: {
    type: Number,
    default: 0
  },
  cgpa: {
    type: Number,
    default: 0
  }
});

const resultSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  records: [resultRecordSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Result', resultSchema);
