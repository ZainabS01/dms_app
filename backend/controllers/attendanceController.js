const Attendance = require('../models/Attendance');
const LeaveApplication = require('../models/LeaveApplication');
const User = require('../models/User');

// GET /api/attendance/students/:department/:semester
exports.getStudents = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const students = await User.find({
      role: 'student',
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).select('-password');
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/attendance
exports.saveAttendance = async (req, res) => {
  try {
    const { department, semester, date, records } = req.body;

    if (!department || !semester || !date || !records) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let attendance = await Attendance.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i'),
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (attendance) {
      attendance.records = records;
      await attendance.save();
      return res.json({ message: 'Attendance updated successfully', attendance });
    } else {
      attendance = new Attendance({
        department,
        semester,
        date: startOfDay,
        records
      });
      await attendance.save();
      return res.json({ message: 'Attendance saved successfully', attendance });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/attendance/class/:department/:semester
exports.getClassAttendance = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const attendanceRecords = await Attendance.find({ 
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).populate('records.studentId', 'name roll_no rollNo').sort({ date: -1 });
    res.json(attendanceRecords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/attendance/student/:studentId
exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const attendanceRecords = await Attendance.find({
      'records.studentId': studentId
    }).sort({ date: -1 });

    const summary = { present: 0, absent: 0, leave: 0, total: 0, records: [] };
    
    attendanceRecords.forEach(att => {
      summary.total += 1;
      const studentRecord = att.records.find(r => r.studentId.toString() === studentId);
      if (studentRecord) {
        if (studentRecord.status === 'present') summary.present += 1;
        else if (studentRecord.status === 'absent') summary.absent += 1;
        else if (studentRecord.status === 'leave') summary.leave += 1;
        
        summary.records.push({
          date: att.date,
          status: studentRecord.status
        });
      }
    });

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/attendance/leave
exports.applyLeave = async (req, res) => {
  try {
    const { studentId, department, semester, startDate, endDate, reason } = req.body;
    if (!studentId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const leave = new LeaveApplication({
      studentId, department, semester, startDate, endDate, reason
    });
    await leave.save();
    res.json({ message: 'Leave application submitted', leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/attendance/leave/student/:studentId
exports.getStudentLeaves = async (req, res) => {
  try {
    const leaves = await LeaveApplication.find({ studentId: req.params.studentId }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/attendance/leave/class/:department/:semester
exports.getClassLeaves = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const leaves = await LeaveApplication.find({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).populate('studentId', 'name roll_no rollNo').sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/attendance/leave/:id/status
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const leave = await LeaveApplication.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave application not found' });

    leave.status = status;
    await leave.save();

    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
