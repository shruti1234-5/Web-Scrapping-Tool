const express = require('express');
const router = express.Router();
const { scrapeCompanies } = require('../scraper/scrapeLogic');

// POST /scrape
router.post('/', async (req, res) => {
  try {
    const { query, urls } = req.body;
    if (!query && (!urls || !Array.isArray(urls) || urls.length === 0)) {
      return res.status(400).json({ error: 'Provide a search query or a list of URLs.' });
    }
    const results = await scrapeCompanies({ query, urls });
    res.json({ results });
  } catch (err) {
    console.error('Scrape error:', err);
    res.status(500).json({ error: 'Failed to scrape companies.' });
  }
});

module.exports = router; 