const Query = require('../models/Query');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// POST /api/queries
exports.createQuery = async (req, res) => {
  try {
    const { studentId, rollNumber, studentName, department, semester, subject, message, recipient, teacherId } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required' });

    const query = new Query({ 
      studentId, 
      rollNumber: rollNumber || 'N/A', 
      studentName, 
      department, 
      semester: semester || 'N/A', 
      subject, 
      message, 
      recipient: recipient || 'teacher', 
      teacherId 
    });
    await query.save();

    // Send Notification
    if (recipient === 'admin') {
      const adminNotif = new Notification({
        userId: 'admin',
        role: 'admin',
        title: 'New Student Query',
        message: `Student ${studentName} sent a query: "${subject}"`,
        type: 'query',
        targetScreen: '/(admin)/queries'
      });
      await adminNotif.save();
    } else if (teacherId) {
      const teacherNotif = new Notification({
        userId: teacherId.toString(),
        role: 'teacher',
        title: 'New Student Query',
        message: `Student ${studentName} sent a query: "${subject}"`,
        type: 'query',
        targetScreen: '/(teacher)/queries'
      });
      await teacherNotif.save();
    }

    res.json({ message: 'Query sent', query });
  } catch (err) {
    console.error('Create Query Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/queries/student/:rollNumber
exports.getStudentQueries = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    let queryObj = {};
    if (mongoose.Types.ObjectId.isValid(rollNumber)) {
      queryObj = { $or: [{ studentId: rollNumber }, { rollNumber: rollNumber }] };
    } else {
      queryObj = { rollNumber: new RegExp('^' + rollNumber + '$', 'i') };
    }
    const queries = await Query.find(queryObj).sort({ createdAt: -1 });
    res.json(queries);
  } catch (err) {
    console.error('Fetch Student Queries Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/queries/class/:department/:semester
exports.getClassQueries = async (req, res) => {
  try {
    const queries = await Query.find({ 
      department: new RegExp('^' + req.params.department + '$', 'i'),
      semester: new RegExp('^' + req.params.semester + '$', 'i')
    }).sort({ createdAt: -1 });
    res.json(queries);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/queries/teacher/:teacherId
exports.getTeacherQueries = async (req, res) => {
  try {
    const queries = await Query.find({ teacherId: req.params.teacherId }).sort({ createdAt: -1 });
    res.json(queries);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/queries/:id/reply
exports.replyToQuery = async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: 'Reply is required' });

    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Not found' });

    query.reply = reply;
    query.status = 'RESOLVED';
    await query.save();

    // Send Notification to Student
    let studentUser;
    if (query.studentId) {
      studentUser = await User.findById(query.studentId);
    }
    if (!studentUser && query.rollNumber) {
      studentUser = await User.findOne({ 
        $or: [
          { roll_no: new RegExp('^' + query.rollNumber + '$', 'i') },
          { rollNo: new RegExp('^' + query.rollNumber + '$', 'i') }
        ]
      });
    }
    if (studentUser) {
      const notif = new Notification({
        userId: studentUser._id.toString(),
        role: 'student',
        title: 'Query Resolved',
        message: `Teacher replied to your query: "${query.subject}"`,
        type: 'query',
        targetScreen: '/(student)/queries'
      });
      await notif.save();
    }
    
    res.json({ message: 'Reply sent', query });
  } catch (err) {
    console.error('Teacher Reply Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/queries/admin
exports.getAdminQueries = async (req, res) => {
  try {
    const queries = await Query.find({ recipient: 'admin' }).sort({ createdAt: -1 });
    res.json(queries);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/queries/:id/admin-reply
exports.replyToQueryAdmin = async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: 'Reply is required' });

    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Not found' });

    query.adminReply = reply;
    query.status = 'RESOLVED';
    await query.save();

    // Send Notification to Student
    let studentUser;
    if (query.studentId) {
      studentUser = await User.findById(query.studentId);
    }
    if (!studentUser && query.rollNumber) {
      studentUser = await User.findOne({ 
        $or: [
          { roll_no: new RegExp('^' + query.rollNumber + '$', 'i') },
          { rollNo: new RegExp('^' + query.rollNumber + '$', 'i') }
        ]
      });
    }
    if (studentUser) {
      const notif = new Notification({
        userId: studentUser._id.toString(),
        role: 'student',
        title: 'Query Resolved by Admin',
        message: `Admin replied to your query: "${query.subject}"`,
        type: 'query',
        targetScreen: '/(student)/queries'
      });
      await notif.save();
    }
    
    res.json({ message: 'Reply sent', query });
  } catch (err) {
    console.error('Admin Reply Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/queries/:id
exports.deleteQuery = async (req, res) => {
  try {
    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Query not found' });

    await Query.deleteOne({ _id: req.params.id });
    res.json({ message: 'Query deleted successfully' });
  } catch (err) {
    console.error('Delete Query Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/queries/:id
exports.updateQuery = async (req, res) => {
  try {
    const { subject, message, adminReply, reply, status } = req.body;
    const query = await Query.findById(req.params.id);
    if (!query) return res.status(404).json({ message: 'Query not found' });

    const oldStatus = query.status;
    const isNowResolved = status === 'RESOLVED' && oldStatus !== 'RESOLVED';

    if (subject !== undefined) query.subject = subject;
    if (message !== undefined) query.message = message;
    if (adminReply !== undefined) query.adminReply = adminReply;
    if (reply !== undefined) query.reply = reply;
    if (status !== undefined) query.status = status;

    await query.save();

    if (isNowResolved || adminReply || reply) {
      let studentUser;
      if (query.studentId) {
        studentUser = await User.findById(query.studentId);
      }
      if (!studentUser && query.rollNumber) {
        studentUser = await User.findOne({ 
          $or: [
            { roll_no: new RegExp('^' + query.rollNumber + '$', 'i') },
            { rollNo: new RegExp('^' + query.rollNumber + '$', 'i') }
          ]
        });
      }
      if (studentUser) {
        const notif = new Notification({
          userId: studentUser._id.toString(),
          role: 'student',
          title: query.recipient === 'admin' ? 'Query Resolved by Admin' : 'Query Resolved',
          message: query.recipient === 'admin' 
            ? `Admin replied to your query: "${query.subject}"`
            : `Teacher replied to your query: "${query.subject}"`,
          type: 'query',
          targetScreen: '/(student)/queries'
        });
        await notif.save();
      }
    }

    res.json({ message: 'Query updated successfully', query });
  } catch (err) {
    console.error('Update Query Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
