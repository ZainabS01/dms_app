const Department = require('../models/Department');
const User = require('../models/User');

// POST /api/departments/add
exports.addDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and Code are required' });
    }

    const uppercaseCode = code.trim().toUpperCase();
    const existing = await Department.findOne({
      $or: [
        { name: new RegExp('^' + name.trim() + '$', 'i') },
        { code: uppercaseCode }
      ]
    });

    if (existing) {
      return res.status(400).json({ message: 'Department with this name or code already exists' });
    }

    const dept = new Department({
      name: name.trim(),
      code: uppercaseCode
    });

    await dept.save();
    res.json({ message: 'Department created successfully', department: dept });
  } catch (err) {
    console.error('Create Department Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/departments
exports.getDepartments = async (req, res) => {
  try {
    const depts = await Department.find().sort({ name: 1 });
    
    // Dynamically calculate studentCount for each department
    const deptsWithCounts = await Promise.all(depts.map(async (dept) => {
      const cleanName = dept.name.replace(/^(BS\s+|BS)/i, '').trim();
      const searchRegexes = [
        new RegExp('^' + dept.code + '$', 'i'),
        new RegExp('^' + dept.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i'),
        new RegExp('^' + cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i')
      ];

      const studentCount = await User.countDocuments({
        role: 'student',
        department: { $in: searchRegexes }
      });

      return {
        ...dept.toObject(),
        studentCount
      };
    }));

    res.json(deptsWithCounts);
  } catch (err) {
    console.error('Get Departments Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/departments/:code/users
exports.getDeptUsers = async (req, res) => {
  try {
    const { code } = req.params;
    
    // Find department first to fetch full name
    const dept = await Department.findOne({ code: new RegExp('^' + code + '$', 'i') });
    
    // Set up search queries that match code, name, or cleaned name
    let queryArr = [code];
    if (dept) {
      queryArr.push(dept.name);
      // Clean "BS" prefix
      const cleanName = dept.name.replace(/^(BS\s+|BS)/i, '').trim();
      queryArr.push(cleanName);
    }
    
    // Map to case-insensitive exact matching regexes
    const searchRegexes = queryArr.map(q => new RegExp('^' + q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i'));

    const students = await User.find({
      role: 'student',
      department: { $in: searchRegexes }
    }).select('name email roll_no semester').sort({ roll_no: 1 });

    const teachers = await User.find({
      role: 'teacher',
      department: { $in: searchRegexes }
    }).select('name email').sort({ name: 1 });

    res.json({ students, teachers });
  } catch (err) {
    console.error('Get Dept Users Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/departments/:code
exports.updateDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const dept = await Department.findOne({ code: new RegExp('^' + req.params.code + '$', 'i') });
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const existing = await Department.findOne({
      name: new RegExp('^' + name.trim() + '$', 'i'),
      _id: { $ne: dept._id }
    });
    if (existing) {
      return res.status(400).json({ message: 'Another department with this name already exists' });
    }

    dept.name = name.trim();
    await dept.save();
    res.json({ message: 'Department updated successfully', department: dept });
  } catch (err) {
    console.error('Update Department Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/departments/:code
exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findOne({ code: new RegExp('^' + req.params.code + '$', 'i') });
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    await Department.deleteOne({ _id: dept._id });
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    console.error('Delete Department Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
