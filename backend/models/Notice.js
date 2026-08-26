const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  targetRole: {
    type: String,
    enum: ['student', 'teacher', 'all'],
    default: 'all'
  },
  department: {
    type: String,
    default: 'All'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notice', noticeSchema);
