const Task = require('../models/Task');
const path = require('path');
const fs = require('fs');

// POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.json({ message: 'Task created', task });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/tasks/class/:department/:semester
exports.getClassTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      department: new RegExp('^' + req.params.department + '$', 'i'),
      semester: new RegExp('^' + req.params.semester + '$', 'i')
    }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/tasks/:id/submit
exports.submitTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    if (!req.file) return res.status(400).json({ message: 'File is required' });

    const { studentId, studentName } = req.body;
    
    // Check if student already submitted, then update, else push
    const existingIndex = task.submissions.findIndex(s => s.studentId && s.studentId.toString() === studentId);
    
    const submissionData = {
      studentId,
      studentName,
      fileUrl: `uploads\\${req.file.filename}`,
      status: 'Submitted'
    };

    if (existingIndex > -1) {
      task.submissions[existingIndex] = { ...task.submissions[existingIndex], ...submissionData };
    } else {
      task.submissions.push(submissionData);
    }

    await task.save();
    res.json({ message: 'Task submitted', task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/tasks/:id/grade/:studentId
exports.gradeSubmission = async (req, res) => {
  try {
    const { grade, remarks } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const sub = task.submissions.find(s => s.studentId && s.studentId.toString() === req.params.studentId);
    if (!sub) return res.status(404).json({ message: 'Submission not found' });

    sub.grade = grade;
    sub.remarks = remarks;
    sub.status = 'Checked';
    
    await task.save();
    res.json({ message: 'Graded successfully', task });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const { title, description, subject, taskType, issueDate, dueDate } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, subject, taskType, issueDate, dueDate },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task updated successfully', task });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    // Also delete submission files from disk if any exist
    if (task.submissions && task.submissions.length > 0) {
      task.submissions.forEach(sub => {
        if (sub.fileUrl) {
          const filePath = path.join(__dirname, '../', sub.fileUrl);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error('Failed to delete file on task delete:', err);
            }
          }
        }
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/tasks/:id/submission/:studentId
exports.deleteSubmission = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const subIndex = task.submissions.findIndex(s => s.studentId && s.studentId.toString() === req.params.studentId);
    if (subIndex === -1) return res.status(404).json({ message: 'Submission not found' });

    const sub = task.submissions[subIndex];
    if (sub.fileUrl) {
      const filePath = path.join(__dirname, '../', sub.fileUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('File unlink error:', e);
        }
      }
    }

    // Remove submission from array
    task.submissions.splice(subIndex, 1);
    await task.save();

    res.json({ message: 'Submission deleted successfully', task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
