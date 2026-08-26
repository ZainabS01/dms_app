const Result = require('../models/Result');
const User = require('../models/User');

// GET /api/results/students/:department/:semester
exports.getClassRosterWithResults = async (req, res) => {
  try {
    const { department, semester } = req.params;
    
    // Find all students in this class
    const students = await User.find({
      role: 'student',
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).select('-password').sort({ roll_no: 1 });

    // Find if results already exist for this class
    const classResult = await Result.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    });

    // Map students and attach existing gpa/cgpa if they exist
    const studentsWithResults = students.map(student => {
      let gpa = '';
      let cgpa = '';
      if (classResult) {
        const record = classResult.records.find(rec => rec.studentId.toString() === student._id.toString());
        if (record) {
          gpa = record.gpa !== undefined ? record.gpa.toString() : '';
          cgpa = record.cgpa !== undefined ? record.cgpa.toString() : '';
        }
      }
      return {
        _id: student._id,
        name: student.name,
        rollNo: student.roll_no || student.rollNo || '',
        gpa,
        cgpa
      };
    });

    res.json(studentsWithResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/results
exports.publishResults = async (req, res) => {
  try {
    const { department, semester, records } = req.body;

    if (!department || !semester || !records) {
      return res.status(400).json({ message: 'Please provide department, semester, and records' });
    }

    let result = await Result.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    });

    if (result) {
      result.records = records;
      result.updatedAt = Date.now();
      await result.save();
      res.json({ message: 'Results updated successfully', result });
    } else {
      result = new Result({
        department,
        semester,
        records
      });
      await result.save();
      res.json({ message: 'Results published successfully', result });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/results/class/:department/:semester
exports.getClassResults = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const result = await Result.findOne({ 
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).populate('records.studentId', 'name roll_no rollNo');
    
    if (result) {
      const formatted = result.records.map(rec => ({
        _id: rec._id,
        studentId: rec.studentId ? rec.studentId._id : null,
        rollNo: rec.studentId ? (rec.studentId.roll_no || rec.studentId.rollNo) : '',
        name: rec.studentId ? rec.studentId.name : '',
        gpa: rec.gpa,
        cgpa: rec.cgpa,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      }));
      res.json(formatted);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/results/student/:rollNo
exports.getStudentResults = async (req, res) => {
  try {
    const { rollNo } = req.params;
    const student = await User.findOne({
      $or: [
        { roll_no: new RegExp('^' + rollNo + '$', 'i') },
        { rollNo: new RegExp('^' + rollNo + '$', 'i') }
      ]
    });
    
    if (!student) {
      return res.json([]);
    }

    const classResults = await Result.find({
      'records.studentId': student._id
    });

    const studentResults = classResults.map(r => {
      const record = r.records.find(rec => rec.studentId.toString() === student._id.toString());
      return {
        _id: r._id,
        department: r.department,
        semester: r.semester,
        gpa: record ? record.gpa : 0,
        cgpa: record ? record.cgpa : 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      };
    });

    res.json(studentResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/results/department/:department
exports.getDeptResults = async (req, res) => {
  try {
    const { department } = req.params;
    const results = await Result.find({
      department: new RegExp('^' + department + '$', 'i')
    }).populate('records.studentId', 'name roll_no rollNo');
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/results/record
exports.updateStudentResultRecord = async (req, res) => {
  try {
    const { department, semester, studentId, gpa, cgpa } = req.body;
    if (!department || !semester || !studentId) {
      return res.status(400).json({ message: 'Please provide department, semester, and studentId' });
    }

    let result = await Result.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    });

    if (!result) {
      // Create a new result sheet if it doesn't exist
      result = new Result({
        department,
        semester,
        records: []
      });
    }

    const recordIndex = result.records.findIndex(rec => rec.studentId.toString() === studentId.toString());
    if (recordIndex !== -1) {
      result.records[recordIndex].gpa = Number(gpa);
      result.records[recordIndex].cgpa = Number(cgpa);
    } else {
      result.records.push({
        studentId,
        gpa: Number(gpa),
        cgpa: Number(cgpa)
      });
    }

    result.updatedAt = Date.now();
    await result.save();

    // Find the student info to return updated format
    const updatedResult = await Result.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    }).populate('records.studentId', 'name roll_no rollNo');

    const formattedRecord = updatedResult.records.find(rec => rec.studentId && rec.studentId._id.toString() === studentId.toString());

    res.json({ 
      message: 'Result updated successfully', 
      record: formattedRecord ? {
        _id: formattedRecord._id,
        studentId: formattedRecord.studentId._id,
        rollNo: formattedRecord.studentId.roll_no || formattedRecord.studentId.rollNo || '',
        name: formattedRecord.studentId.name,
        gpa: formattedRecord.gpa,
        cgpa: formattedRecord.cgpa
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/results/record/:department/:semester/:studentId
exports.deleteStudentResultRecord = async (req, res) => {
  try {
    const { department, semester, studentId } = req.params;
    let result = await Result.findOne({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    result.records = result.records.filter(rec => rec.studentId && rec.studentId.toString() !== studentId.toString());
    result.updatedAt = Date.now();
    await result.save();

    res.json({ message: 'Result deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
