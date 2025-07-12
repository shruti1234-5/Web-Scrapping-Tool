require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const scrapeRouter = require('./routes/scrape');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/companies';

const allowedOrigins = [
  'https://web-scrapping-tool.vercel.app', // deployed frontend
  'http://localhost:5173', // local dev
  'http://localhost:3000', // alternative local dev port
  'http://127.0.0.1:5173', // local dev with IP
  'http://127.0.0.1:3000' // alternative local dev with IP
];

app.use(cors({
  origin: function (origin, callback) {
    // Debug: Log the origin being checked
    console.log('CORS check - Origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin provided, allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('Origin blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/scrape', scrapeRouter);

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
