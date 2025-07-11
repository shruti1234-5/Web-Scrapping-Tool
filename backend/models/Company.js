const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: { type: String },
  website: { type: String },
  email: { type: String },
  linkedin: { type: String },
  twitter: { type: String },
  facebook: { type: String },
  instagram: { type: String },
  // Extended Contact Information
  address: { type: String }, // Physical address or location
  tagline: { type: String }, // Company tagline or slogan

  // Company Overview
  overview: { type: String }, // Brief description or overview

  // Lead-Generation Specifics
  // (products/services field can be represented by 'projects')

  // Technical & Operational Details
  techstack: { type: [String] }, // Technologies, frameworks, tools
  yearFounded: { type: String }, // Year founded or operational status
  industry: { type: String }, // Industry or market sector
  projects: { type: String }, // Current projects or focus areas

  // Competitive Landscape
  competitors: { type: [String] }, // List of competitors
  marketPosition: { type: String }, // Market positioning (e.g., leader, challenger)

  // Data Enrichment
  companySize: { type: String }, // Company size (enriched)
  fundingStage: { type: String }, // Funding stage (enriched)
  marketPerformance: { type: String }, // Market performance (enriched)
  scrapedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', CompanySchema); 