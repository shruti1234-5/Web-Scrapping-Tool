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
  'http://localhost:5173' // local dev
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true // if you ever use cookies/auth
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
