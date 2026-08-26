const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  department: { type: String, required: true },
  semester: { type: String, required: true },
  fileUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Timetable', timetableSchema);
