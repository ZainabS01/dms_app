const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student',
  },
  department: {
    type: String,
    trim: true,
  },
  semester: {
    type: String,
    trim: true,
  },
  roll_no: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined values without triggering unique constraint errors for teachers/admins
    trim: true,
    uppercase: true,
  },
  rollNo: {
    type: String,
    trim: true,
    uppercase: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: function() {
      return this.role === 'admin';
    }
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'REJECTED'],
    default: function() {
      return this.role === 'admin' ? 'ACTIVE' : 'PENDING';
    }
  },
  isHOD: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  }
}, { timestamps: true });

userSchema.pre('save', function() {
  if (this.roll_no && !this.rollNo) {
    this.rollNo = this.roll_no;
  } else if (this.rollNo && !this.roll_no) {
    this.roll_no = this.rollNo;
  }
});

module.exports = mongoose.model('User', userSchema);
