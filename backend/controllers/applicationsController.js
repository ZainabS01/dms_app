const Application = require('../models/Application');

// POST /api/applications
exports.applyApplication = async (req, res) => {
  try {
    const { studentId, subject, reason, startDate, endDate, teacherId } = req.body;
    if (!studentId || !subject || !reason) return res.status(400).json({ message: 'Missing fields' });

    const app = new Application({ studentId, subject, reason, startDate, endDate, teacherId });
    await app.save();
    res.json({ message: 'Application submitted', application: app });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/applications/student/:studentId
exports.getStudentApplications = async (req, res) => {
  try {
    const apps = await Application.find({ studentId: req.params.studentId }).sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/applications
exports.getAllApplications = async (req, res) => {
  try {
    const apps = await Application.find().populate('studentId', 'name roll_no rollNo department semester').sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/applications/teacher/:teacherId
exports.getTeacherApplications = async (req, res) => {
  try {
    const apps = await Application.find({ teacherId: req.params.teacherId }).populate('studentId', 'name roll_no rollNo department semester').sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/applications/:id
exports.updateApplication = async (req, res) => {
  try {
    const { status, teacherRemarks } = req.body;
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Not found' });

    if (status) app.status = status;
    if (teacherRemarks) app.teacherRemarks = teacherRemarks;
    app.updatedAt = Date.now();
    
    await app.save();
    res.json({ message: 'Application updated', application: app });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};
