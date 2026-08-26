const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');

// POST /api/feedback/submit
exports.submitFeedback = async (req, res) => {
  try {
    const { studentId, studentName, studentRollNo, department, semester, subject, category, message, rating } = req.body;
    if (!studentId || !studentName || !studentRollNo || !department || !semester || !subject || !message) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const feedback = new Feedback({
      studentId,
      studentName,
      studentRollNo,
      department,
      semester,
      subject,
      category: category || 'General',
      message,
      rating: rating || 5
    });

    await feedback.save();

    // Send Notification to Admin
    const adminNotif = new Notification({
      userId: 'admin',
      role: 'admin',
      title: 'New Student Feedback',
      message: `Student ${studentName} submitted feedback: "${subject}"`,
      type: 'feedback',
      targetScreen: '/(admin)/feedback'
    });
    await adminNotif.save();

    res.json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    console.error('Submit Feedback Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/feedback/view
exports.getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error('Get Feedbacks Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/feedback/student/:studentId
exports.getStudentFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ studentId: req.params.studentId }).sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error('Get Student Feedbacks Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/feedback/:id/react
exports.reactToFeedback = async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (status) feedback.status = status;
    if (adminReply !== undefined) feedback.adminReply = adminReply;

    await feedback.save();

    // Send Notification to Student
    const notif = new Notification({
      userId: feedback.studentId,
      role: 'student',
      title: 'Admin Reacted to Feedback',
      message: `Admin responded to your feedback: "${feedback.subject}"`,
      type: 'feedback',
      targetScreen: '/(student)/feedback'
    });
    await notif.save();

    res.json({ message: 'Feedback updated with reaction', feedback });
  } catch (err) {
    console.error('Admin React Feedback Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/feedback/:id
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    await Feedback.deleteOne({ _id: req.params.id });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (err) {
    console.error('Delete Feedback Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
