const Timetable = require('../models/Timetable');
const path = require('path');
const fs = require('fs');

// POST /api/timetables
exports.uploadTimetable = async (req, res) => {
  try {
    const { department, semester } = req.body;
    if (!department || !semester) return res.status(400).json({ message: 'Missing fields' });
    if (!req.file) return res.status(400).json({ message: 'File is required' });

    const semDigit = semester.match(/\d+/)?.[0] || semester;
    const fileUrl = `uploads\\${req.file.filename}`;
    
    // Check if exists
    let timetable = await Timetable.findOne({ department, semester: semDigit });
    if (timetable) {
      timetable.fileUrl = fileUrl;
      timetable.createdAt = Date.now();
      await timetable.save();
    } else {
      timetable = new Timetable({ department, semester: semDigit, fileUrl });
      await timetable.save();
    }

    res.json({ message: 'Timetable uploaded', timetable });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/timetables/:department/:semester
exports.getTimetable = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const semDigit = semester.match(/\d+/)?.[0] || semester;
    const timetable = await Timetable.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semDigit + '$', 'i')
    });
    res.json(timetable);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/timetables/:id
exports.deleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return res.status(404).json({ message: 'Timetable not found' });
    
    // Delete file from uploads directory
    const filePath = path.join(__dirname, '..', timetable.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ message: 'Timetable deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
