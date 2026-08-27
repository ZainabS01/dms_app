require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Initialize Express App
const app = express();

// Middleware
app.use(cors()); // Allow requests from mobile app/frontend
app.use(express.json()); // Parse JSON request bodies
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI === 'your_mongodb_atlas_connection_string_here') {
  console.error('❌ FATAL ERROR: MONGO_URI is not defined in .env file.');
  console.error('Please add your MongoDB Atlas Connection String to backend/.env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB Atlas');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/results', require('./routes/results'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/timetables', require('./routes/timetables'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/queries', require('./routes/queries'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notifications'));

// Root Route
app.get('/', (req, res) => {
  res.send('DMS Backend API is running!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
