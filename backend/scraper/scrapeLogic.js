const axios = require('axios');
const cheerio = require('cheerio');
const Company = require('../models/Company');
const puppeteer = require('puppeteer'); // Add Puppeteer for dynamic scraping
const fs = require('fs'); // For logging
const path = require('path');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const CLEARBIT_API_KEY = process.env.CLEARBIT_API_KEY;
const CONCURRENCY_LIMIT = 5;

// Configurable scraping options (selectors, delays, etc.)
const SCRAPER_CONFIG_PATH = path.join(__dirname, 'scraper.config.json');
let SCRAPER_CONFIG = {};
try {
  if (fs.existsSync(SCRAPER_CONFIG_PATH)) {
    SCRAPER_CONFIG = JSON.parse(fs.readFileSync(SCRAPER_CONFIG_PATH, 'utf-8'));
  }
} catch (e) {
  console.error('Failed to load scraper config:', e.message);
}

const DEFAULT_SELECTORS = {
  name: ['meta[property="og:site_name"]', 'meta[name="application-name"]', 'title', 'h1'],
  overview: ['meta[name="description"]', 'meta[property="og:description"]'],
  // Add more as needed
};

const RATE_LIMIT_DELAY = SCRAPER_CONFIG.delayMs || 2000; // ms between requests
const MAX_PAGES = SCRAPER_CONFIG.maxPages || 3; // Pagination limit
const USE_PUPPETEER = true; // Toggle for dynamic scraping

function logScrapeEvent(event, data) {
  console.log(`[${event}]`, data);
}

function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text.match(emailRegex) || []).filter(Boolean);
}

function extractPhones(text) {
  const phoneRegex = /\+?\d[\d\s().-]{7,}\d/g;
  return (text.match(phoneRegex) || []).filter(Boolean);
}

function extractSocialLinks($) {
  const social = {};
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (/linkedin\.com\//i.test(href)) social.linkedin = href;
    if (/twitter\.com\//i.test(href)) social.twitter = href;
    if (/facebook\.com\//i.test(href)) social.facebook = href;
    if (/instagram\.com\//i.test(href)) social.instagram = href;
  });
  return social;
}

function extractTagline($) {
  // Look for company tagline/slogan in specific locations
  let tagline = '';

  // Try meta description first (often contains tagline)
  const metaDesc = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || '';

  // Look for tagline in specific elements
  const taglineSelectors = [
    '.tagline', '.slogan', '.hero-subtitle', '.company-tagline',
    '[class*="tagline"]', '[class*="slogan"]', '.subtitle',
    'h2:first-of-type', 'h3:first-of-type'
  ];

  for (const selector of taglineSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 5 && text.length < 200) {
      tagline = text;
      break;
    }
  }

  // If no specific tagline found, try to extract from meta description
  if (!tagline && metaDesc) {
    // Clean up meta description to make it more tagline-like
    tagline = metaDesc.replace(/\.$/, '').trim();
    if (tagline.length > 100) {
      // If too long, take first sentence
      tagline = tagline.split('.')[0].trim();
    }
  }

  // Validate tagline quality
  if (tagline) {
    // Remove common navigation phrases
    const navPhrases = [
      'home', 'about', 'contact', 'services', 'products', 'login', 'sign up', 'menu', 'search',
      'privacy', 'terms', 'cookie', 'accessibility', 'skip', 'navigate'
    ];
    const lowerTagline = tagline.toLowerCase();
    if (navPhrases.some(phrase => lowerTagline.includes(phrase))) {
      return '';
    }

    // Filter out financial/quarterly data
    const financialPatterns = [
      /Q[1-4]FY\d{2}-\d{2}/i,  // Q1FY25-26
      /FY\d{2}-\d{2}/i,         // FY25-26
      /Q[1-4]\s*\d{4}/i,        // Q1 2024
      /\d{4}-\d{2}/i,           // 2024-25
      /quarter\s*\d/i,           // quarter 1
      /fiscal\s*year/i           // fiscal year
    ];

    if (financialPatterns.some(pattern => pattern.test(tagline))) {
      return '';
    }

    // Filter out dates and time references
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,  // MM/DD/YYYY
      /\d{4}-\d{2}-\d{2}/,         // YYYY-MM-DD
      /\d{1,2}:\d{2}/,             // HH:MM
      /today|yesterday|tomorrow/i
    ];

    if (datePatterns.some(pattern => pattern.test(tagline))) {
      return '';
    }

    // Filter out technical/development terms
    const technicalTerms = [
      'api', 'sdk', 'version', 'release', 'update', 'patch', 'beta', 'alpha',
      'debug', 'test', 'staging', 'production', 'development', 'deployment'
    ];

    if (technicalTerms.some(term => lowerTagline.includes(term))) {
      return '';
    }

    // Must be reasonable length
    if (tagline.length < 5 || tagline.length > 150) {
      return '';
    }

    // Must contain meaningful words (not just numbers/symbols)
    const words = tagline.split(/\s+/).filter(word => word.length > 0);
    const meaningfulWords = words.filter(word => /[a-zA-Z]/.test(word));
    if (meaningfulWords.length < 2) {
      return '';
    }
  }

  return tagline;
}

function extractProduct($) {
  // Look for company products/services in specific locations
  let product = '';

  // Try to find product information in structured data
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data.name && !product) {
        product = data.name;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Look for product in specific elements
  const productSelectors = [
    '.product-title', '.service-title', '.main-product', '.hero-title',
    'h1', '.company-product', '[class*="product"]', '[class*="service"]',
    '.main-heading', '.primary-title', '.hero-heading'
  ];

  for (const selector of productSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 3 && text.length < 100) {
      // Validate it's not navigation
      const lowerText = text.toLowerCase();
      const navWords = ['home', 'about', 'contact', 'login', 'sign', 'menu', 'search', 'privacy', 'terms'];
      if (!navWords.some(word => lowerText.includes(word))) {
        product = text;
        break;
      }
    }
  }

  // If still no product, try to extract from page title
  if (!product) {
    const title = $('title').text().trim();
    if (title && title.length < 80) {
      // Clean up title
      product = title.replace(/ - .*$/, '').replace(/ \| .*$/, '').trim();
    }
  }

  // Validate product quality
  if (product) {
    // Filter out descriptions that are too long
    if (product.length > 50) {
      return '';
    }

    // Filter out sentences that sound like descriptions
    if (product.includes(' is ') || product.includes(' are ') || product.includes(' to ')) {
      return '';
    }

    // Filter out technical/development terms
    const technicalTerms = [
      'api', 'sdk', 'version', 'release', 'update', 'patch', 'beta', 'alpha',
      'debug', 'test', 'staging', 'production', 'development', 'deployment'
    ];

    const lowerProduct = product.toLowerCase();
    if (technicalTerms.some(term => lowerProduct.includes(term))) {
      return '';
    }

    // Must contain meaningful words
    const words = product.split(/\s+/).filter(word => word.length > 0);
    const meaningfulWords = words.filter(word => /[a-zA-Z]/.test(word));
    if (meaningfulWords.length < 1) {
      return '';
    }
  }

  return product;
}

function extractOverview($) {
  // Extract company overview/description
  let overview = '';

  // Try structured data first
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data.description && !overview) {
        overview = data.description;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Look for overview in specific sections
  const overviewSelectors = [
    '.about', '.overview', '.company-overview', '.description',
    '[class*="about"]', '[class*="overview"]', '[class*="description"]',
    '.hero-description', '.main-description', '.company-description'
  ];

  for (const selector of overviewSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 20 && text.length < 500) {
      overview = text;
      break;
    }
  }

  // If no specific overview found, try meta description
  if (!overview) {
    overview = $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') || '';
  }

  // Clean and validate overview
  if (overview) {
    // Remove excessive whitespace
    overview = overview.replace(/\s+/g, ' ').trim();

    // Must be reasonable length
    if (overview.length < 20 || overview.length > 400) {
      return '';
    }

    // Check for navigation content
    const navPhrases = [
      'click here', 'learn more', 'read more', 'contact us', 'get started',
      'skip', 'navigate', 'press tab', 'submenu', 'menu', 'search',
      'privacy', 'terms', 'cookie', 'accessibility', 'overview'
    ];
    const lowerOverview = overview.toLowerCase();
    if (navPhrases.some(phrase => lowerOverview.includes(phrase))) {
      return '';
    }

    // Filter out technical/development terms
    const technicalTerms = [
      'api', 'sdk', 'version', 'release', 'update', 'patch', 'beta', 'alpha',
      'debug', 'test', 'staging', 'production', 'development', 'deployment'
    ];

    if (technicalTerms.some(term => lowerOverview.includes(term))) {
      return '';
    }
  }

  return overview;
}

function extractTechStack($) {
  const techStack = [];

  // Enhanced technology keywords with categories
  const techKeywords = {
    'Frontend': ['react', 'angular', 'vue', 'javascript', 'typescript', 'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind'],
    'Backend': ['node.js', 'python', 'java', 'php', 'ruby', 'go', 'c#', '.net', 'django', 'flask', 'express', 'spring'],
    'Database': ['mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra', 'dynamodb'],
    'Cloud': ['aws', 'azure', 'gcp', 'heroku', 'digitalocean', 'linode', 'vultr'],
    'DevOps': ['docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'gitlab', 'github', 'bitbucket'],
    'Analytics': ['google analytics', 'mixpanel', 'amplitude', 'hotjar', 'segment'],
    'Marketing': ['hubspot', 'salesforce', 'mailchimp', 'sendgrid', 'twilio', 'stripe', 'paypal'],
    'Communication': ['slack', 'microsoft teams', 'zoom', 'discord', 'telegram'],
    'Project Management': ['jira', 'confluence', 'trello', 'asana', 'notion', 'monday.com'],
    'CMS': ['wordpress', 'drupal', 'shopify', 'squarespace', 'wix']
  };

  const pageText = $.text().toLowerCase();

  // Check for technologies in page content
  Object.values(techKeywords).flat().forEach(tech => {
    if (pageText.includes(tech.toLowerCase())) {
      techStack.push(tech);
    }
  });

  // Look for tech stack in specific elements
  const techSelectors = [
    '.tech-stack', '.technologies', '.stack', '.tools',
    '[class*="tech"]', '[class*="stack"]', '[class*="technology"]',
    '.built-with', '.powered-by', '.technology-stack'
  ];

  techSelectors.forEach(selector => {
    $(selector).each((i, el) => {
      const techText = $(el).text().toLowerCase();
      Object.values(techKeywords).flat().forEach(tech => {
        if (techText.includes(tech.toLowerCase()) && !techStack.includes(tech)) {
          techStack.push(tech);
        }
      });
    });
  });

  // Look for "Built with" or "Powered by" sections
  $('*').each((i, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('built with') || text.includes('powered by') || text.includes('technology stack')) {
      Object.values(techKeywords).flat().forEach(tech => {
        if (text.includes(tech.toLowerCase()) && !techStack.includes(tech)) {
          techStack.push(tech);
        }
      });
    }
  });

  // Remove duplicates and limit to top 10 most relevant
  return [...new Set(techStack)].slice(0, 10);
}

function extractIndustry($) {
  // Extract industry information more accurately
  let industry = '';

  // Look for industry in structured data
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data.industry && !industry) {
        industry = data.industry;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Look for industry in specific elements
  const industrySelectors = [
    '.industry', '.sector', '.category', '.business-type',
    '[class*="industry"]', '[class*="sector"]', '[class*="category"]',
    '.company-industry', '.business-category'
  ];

  for (const selector of industrySelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 2 && text.length < 50) {
      industry = text;
      break;
    }
  }

  // Clean and validate industry
  if (industry) {
    industry = industry.replace(/\s+/g, ' ').trim();

    // Must be reasonable length and not navigation
    if (industry.length < 2 || industry.length > 50) {
      return '';
    }

    const navWords = ['home', 'about', 'contact', 'services', 'products'];
    const lowerIndustry = industry.toLowerCase();
    if (navWords.some(word => lowerIndustry.includes(word))) {
      return '';
    }
  }

  return industry;
}

function extractYearFounded($) {
  // Extract founding year more accurately
  let yearFounded = '';

  // Look for founding year in structured data
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data.foundingDate && !yearFounded) {
        yearFounded = data.foundingDate;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Look for founding year in specific elements
  const foundedSelectors = [
    '.founded', '.year-founded', '.established', '.since',
    '[class*="founded"]', '[class*="established"]', '[class*="since"]',
    '.company-founded', '.founding-year'
  ];

  for (const selector of foundedSelectors) {
    const text = $(selector).first().text().trim();
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      yearFounded = yearMatch[0];
      break;
    }
  }

  // If not found, search in page text with context
  if (!yearFounded) {
    const pageText = $.text();
    // Look for founding year with context
    const foundingPatterns = [
      /founded\s+in\s+(\d{4})/i,
      /established\s+in\s+(\d{4})/i,
      /since\s+(\d{4})/i,
      /started\s+in\s+(\d{4})/i,
      /created\s+in\s+(\d{4})/i
    ];

    for (const pattern of foundingPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        yearFounded = match[1];
        break;
      }
    }

    // If still not found, look for any year that could be founding year
    if (!yearFounded) {
      const yearMatch = pageText.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        // Only accept reasonable years (not current year or future)
        if (year >= 1800 && year <= new Date().getFullYear()) {
          yearFounded = yearMatch[0];
        }
      }
    }
  }

  return yearFounded;
}

function extractProjects($) {
  // Extract current projects/focus areas
  let projects = '';

  // Look for projects in specific sections
  const projectSelectors = [
    '.projects', '.focus-areas', '.initiatives', '.current-work',
    '[class*="project"]', '[class*="focus"]', '[class*="initiative"]',
    '.company-projects', '.work-focus', '.areas-of-focus'
  ];

  for (const selector of projectSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 10 && text.length < 300) {
      projects = text;
      break;
    }
  }

  // Clean and validate projects
  if (projects) {
    projects = projects.replace(/\s+/g, ' ').trim();

    // Must be reasonable length
    if (projects.length < 10 || projects.length > 250) {
      return '';
    }

    // Check for navigation content
    const navPhrases = [
      'click here', 'learn more', 'read more', 'contact us', 'get started',
      'skip', 'navigate', 'previous', 'next', 'slide', 'menu', 'search',
      'privacy', 'terms', 'cookie', 'accessibility'
    ];
    const lowerProjects = projects.toLowerCase();
    if (navPhrases.some(phrase => lowerProjects.includes(phrase))) {
      return '';
    }
  }

  return projects;
}

function extractMarketPosition($) {
  // Extract market positioning information
  let marketPosition = '';

  // Look for market position in specific sections
  const positionSelectors = [
    '.market-position', '.positioning', '.competitive-advantage',
    '[class*="position"]', '[class*="advantage"]', '[class*="competitive"]',
    '.company-position', '.market-advantage', '.competitive-edge'
  ];

  for (const selector of positionSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 10 && text.length < 200) {
      marketPosition = text;
      break;
    }
  }

  // Clean and validate market position
  if (marketPosition) {
    marketPosition = marketPosition.replace(/\s+/g, ' ').trim();

    // Must be reasonable length
    if (marketPosition.length < 10 || marketPosition.length > 150) {
      return '';
    }

    // Check for navigation content
    const navPhrases = [
      'click here', 'learn more', 'read more', 'contact us', 'get started',
      'skip', 'navigate', 'previous', 'next', 'slide', 'menu', 'search',
      'privacy', 'terms', 'cookie', 'accessibility'
    ];
    const lowerPosition = marketPosition.toLowerCase();
    if (navPhrases.some(phrase => lowerPosition.includes(phrase))) {
      return '';
    }
  }

  return marketPosition;
}

function extractCompetitors($) {
  // Extract competitor information more accurately
  const competitors = [];

  // Look for competitor mentions in text
  const pageText = $.text().toLowerCase();
  const competitorKeywords = ['competitor', 'competition', 'alternative', 'similar to', 'compared to'];

  // Look for competitor links
  $('a').each((i, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href');

    if (href && competitorKeywords.some(keyword => text.includes(keyword))) {
      // Extract domain from href
      try {
        const url = new URL(href, 'https://example.com');
        if (url.hostname && url.hostname !== 'example.com') {
          competitors.push(url.hostname);
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    }
  });

  // Look for competitor mentions in specific sections
  const competitorSelectors = [
    '.competitors', '.competition', '.alternatives',
    '[class*="competitor"]', '[class*="competition"]', '[class*="alternative"]'
  ];

  competitorSelectors.forEach(selector => {
    $(selector).each((i, el) => {
      const text = $(el).text();
      // Extract company names from text (basic approach)
      const words = text.split(/\s+/);
      words.forEach(word => {
        if (word.length > 3 && /^[A-Z]/.test(word)) {
          competitors.push(word);
        }
      });
    });
  });

  // Remove duplicates and limit to top 5
  return [...new Set(competitors)].slice(0, 5);
}

function cleanField(value, maxLen = 200) {
  if (!value) return undefined;
  // Remove excessive whitespace and line breaks
  let cleaned = value.replace(/\s+/g, ' ').trim();
  // Truncate to maxLen
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen) + '...';
  return cleaned;
}

function cleanAddress(value) {
  if (!value) return undefined;
  // Accept only if it looks like an address (has number, street, city, etc.)
  const addr = value.replace(/\s+/g, ' ').trim();
  if (/\d+/.test(addr) && /[a-zA-Z]{2,}/.test(addr) && addr.length < 120) return addr;
  return undefined;
}

function cleanIndustry(value) {
  if (!value) return undefined;
  // Only accept if it's a few words, not a paragraph
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.split(' ').length <= 6 && cleaned.length < 60) return cleaned;
  return undefined;
}

function cleanMarketPosition(value) {
  if (!value) return undefined;
  // Only accept if it's a short phrase
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.split(' ').length <= 10 && cleaned.length < 80) return cleaned;
  return undefined;
}

function isLikelyNavigation(text) {
  if (!text) return false;
  const navPhrases = [
    'click here', 'press enter', 'go to homepage', 'what we do', 'who we are',
    'insights', 'careers', 'newsroom', 'investors', 'overview', 'press tab',
    'submenu', 'expand here', 'menu', 'leadership', 'corporate', 'sustainability',
    'diversity', 'alliances', 'research', 'brand', 'extraordinary', 'results',
    'discover', 'expert', 'customer stories', 'perspectives', 'global studies',
    'topics', 'join our team', 'india', 'americas', 'europe', 'asia pacific',
    'middle east', 'africa', 'united kingdom', 'localized', 'press releases',
    'recent news', 'events', 'media kit', 'stock information', 'subsidiaries',
    'overview press', 'expand', 'collapse', 'navigation', 'open in new tab'
  ];
  const lower = text.toLowerCase();
  if (navPhrases.some(phrase => lower.includes(phrase))) return true;
  // Hide if too long (over 300 chars)
  if (lower.length > 300) return true;
  return false;
}

function isAcronymMatch(query, name) {
  if (!query || !name) return false;
  // Get initials from name (e.g., Tata Consultancy Services => TCS)
  const initials = name.split(/\s+/).map(w => w[0]).join('').toLowerCase();
  return initials === query.toLowerCase();
}

async function enrichWithKnowledgeGraph({ name, website }) {
  try {
    if (!name && !website) return {};
    const params = {
      api_key: SERPAPI_KEY,
      engine: 'google_kg',
      q: name || website,
      type: 'Organization',
      limit: 1
    };
    const serpApiUrl = 'https://serpapi.com/search';
    const response = await axios.get(serpApiUrl, { params });
    const data = response.data;
    if (data && data.knowledge_graph) {
      const kg = data.knowledge_graph;
      return {
        industry: kg.industry || undefined,
        description: kg.description || undefined,
        type: kg.type || undefined,
        headquarters: kg.headquarters || undefined,
        founded: kg.founded || undefined,
        employees: kg.employees || undefined,
        founders: kg.founders || undefined,
        subsidiaries: kg.subsidiaries || undefined,
        parent_organization: kg.parent_organization || undefined
      };
    }
    return {};
  } catch (err) {
    console.error('KG enrichment error:', err.message);
    return {};
  }
}

async function enrichWithClearbit(domain) {
  try {
    if (!CLEARBIT_API_KEY || !domain) return {};

    const response = await axios.get(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
      headers: {
        'Authorization': `Bearer ${CLEARBIT_API_KEY}`
      },
      timeout: 10000
    });

    const data = response.data;
    return {
      name: data.name,
      tagline: data.tagline,
      description: data.description,
      industry: data.category?.industry,
      companySize: data.metrics?.employees,
      yearFounded: data.foundedYear,
      techstack: data.tech || [],
      product: data.category?.subIndustry || data.category?.industry
    };
  } catch (err) {
    console.error('Clearbit enrichment error:', err.message);
    return {};
  }
}

// Helper: Wait for a given ms
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Helper: Proxy support (stub)
function getProxyOptions() {
  // Return proxy config if needed (future enhancement)
  return {};
}

// Puppeteer-based dynamic fetch and extract
async function fetchAndExtractDynamic(url, selectors = DEFAULT_SELECTORS, pageLimit = MAX_PAGES) {
  let browser;
  let results = [];
  try {
    browser = await puppeteer.launch({ headless: true, ...getProxyOptions() });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 }); // 10s timeout
    await page.waitForTimeout(2000); // Wait for dynamic content
    let currentPage = 1;
    while (currentPage <= pageLimit) {
      const html = await page.content();
      const $ = cheerio.load(html);
      // Use selectors from config or default
      let name = '';
      for (const sel of (selectors.name || DEFAULT_SELECTORS.name)) {
        name = $(sel).first().text().trim() || $(sel).attr('content') || '';
        if (name) break;
      }
      // Validate and clean company name
      const genericNames = [
        'home', 'index', 'u.s.', 'us', 'welcome', 'main', 'default', 'india', 'untitled', 'page', 'start', 'root', 'dashboard', 'site', 'webpage', 'website', 'portal', 'profile', 'feed', 'explore', 'discover', 'search', 'news', 'about', 'contact', 'login', 'sign in', 'sign up', 'register', 'account', 'settings', 'menu', 'help', 'support', 'privacy', 'terms', 'cookie', 'accessibility', 'skip', 'navigate'
      ];
      let cleanedName = name ? name.trim() : '';
      if (
        !cleanedName ||
        cleanedName.length < 3 ||
        cleanedName.length > 80 ||
        genericNames.includes(cleanedName.toLowerCase()) ||
        /^(\W|\d)+$/.test(cleanedName) // only symbols/numbers
      ) {
        // Fallback to domain
        try {
          const domain = new URL(url).hostname.replace(/^www\./, '');
          cleanedName = domain.split('.')[0];
          cleanedName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
        } catch {
          cleanedName = 'Unknown Company';
        }
      }
      name = cleanedName;
      // Debug: Log name extraction
      console.log('Name extraction:', {
        ogSiteName: $(`meta[property="og:site_name"]`).attr('content'),
        appName: $(`meta[name="application-name"]`).attr('content'),
        title: $('title').text(),
        h1: $('h1').first().text(),
        finalName: name
      });
      // Emails
      let emails = [];
      $('a[href^="mailto:"]').each((i, el) => {
        const email = $(el).attr('href').replace(/^mailto:/, '').split('?')[0];
        if (email) emails.push(email);
      });
      if (emails.length === 0) emails = extractEmails($.text());
      emails = [...new Set(emails)].filter(Boolean);
      // Social
      const social = extractSocialLinks($);
      // TechStack
      let techStack = extractTechStack($);
      // Enhanced Additional fields using improved extraction functions
      let address = $("address").first().text().trim() ||
        $('[itemprop="address"]').first().text().trim() ||
        $("[class*='address']").first().text().trim() ||
        $("[class*='location']").first().text().trim() ||
        $("footer").text().match(/\d{1,5} [\w\s.,-]+,? [\w\s.,-]+,? [A-Z]{2,}/)?.[0] ||
        undefined;
      address = cleanAddress(address);

      // Use improved extraction functions
      let overview = extractOverview($);
      let yearFounded = extractYearFounded($);
      let industry = extractIndustry($);
      let projects = extractProjects($);
      let marketPosition = extractMarketPosition($);
      // Tagline extraction
      let tagline = extractTagline($);

      // Competitors: use improved extraction
      let competitors = extractCompetitors($);
      if (competitors.length === 0) competitors = undefined;

      // Additional filtering for navigation content
      if (isLikelyNavigation(address)) address = undefined;
      // --- Enrichment with SerpAPI Knowledge Graph ---
      let kgData = {};
      try {
        kgData = await enrichWithKnowledgeGraph({ name, website: url });
        if (kgData.industry && (!industry || kgData.industry.length < industry.length)) industry = kgData.industry;
        if (kgData.description && (!overview || kgData.description.length < overview.length)) overview = kgData.description;
        if (kgData.marketPosition && (!marketPosition || kgData.marketPosition.length < marketPosition.length)) marketPosition = kgData.marketPosition;
      } catch (e) {
        console.error('KG enrichment error:', e.message);
      }
      // --- Enrichment with Clearbit ---
      let clearbitData = {};
      try {
        clearbitData = await enrichWithClearbit(new URL(url).hostname);
        if (clearbitData.name && (!name || clearbitData.name.length < name.length)) name = clearbitData.name;
        if (clearbitData.description && (!overview || clearbitData.description.length < overview.length)) overview = clearbitData.description;
        if (clearbitData.industry && (!industry || clearbitData.industry.length < industry.length)) industry = clearbitData.industry;
        if (clearbitData.companySize && (!yearFounded || clearbitData.companySize < yearFounded)) yearFounded = clearbitData.companySize;
        if (clearbitData.techstack && techStack.length < clearbitData.techstack.length) techStack = clearbitData.techstack;
      } catch (e) {
        console.error('Clearbit enrichment error:', e.message);
      }
      // Debug logs for field extraction
      console.log('Scraped:', {
        url,
        address,
        overview,
        industry,
        projects,
        competitors,
        marketPosition,
        kgData,
        clearbitData
      });
      // Extract canonical homepage or root domain
      let homepage = '';
      homepage = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || '';
      if (homepage) {
        // Clean up: ensure it's absolute
        try {
          homepage = new URL(homepage, url).origin;
        } catch {
          homepage = '';
        }
      }
      if (!homepage) {
        // Fallback to root domain
        try {
          const u = new URL(url);
          homepage = u.origin;
        } catch {
          homepage = url;
        }
      }
      console.log('[SCRAPER] Extracted homepage:', homepage, 'from', url);
      if (!homepage) {
        console.warn('[SCRAPER] No canonical or og:url found, using root domain for', url);
      }
      // In the result object and DB save, set website: homepage
      const result = {
        name: name.trim() || undefined,
        website: homepage,
        tagline: tagline || undefined,
        email: emails.length ? emails.join(' | ') : undefined,
        linkedin: social.linkedin || undefined,
        twitter: social.twitter || undefined,
        facebook: social.facebook || undefined,
        instagram: social.instagram || undefined,
        address: address || undefined,
        overview: overview || undefined,
        yearFounded: yearFounded || undefined,
        industry: industry || undefined,
        projects: projects || undefined,
        competitors: competitors || undefined,
        marketPosition: marketPosition || undefined,
        techstack: techStack || undefined
      };
      // Only push result if both website and name are present
      if (result.website && result.name) {
        results.push(result);
        // If this is a homepage/domain match, return immediately
        if (isDomainMatch(result, name)) {
          await browser.close();
          return [result];
        }
      }
      // Pagination: look for next page link
      const nextLink = $(SCRAPER_CONFIG.paginationSelector || 'a[rel="next"], a.next, .pagination-next').attr('href');
      if (nextLink && currentPage < pageLimit) {
        const nextUrl = new URL(nextLink, url).href;
        await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 10000 });
        await page.waitForTimeout(2000);
        currentPage++;
      } else {
        break;
      }
    }
    logScrapeEvent('dynamic_scrape_success', { url, pages: currentPage });
    return results;
  } catch (err) {
    logScrapeEvent('dynamic_scrape_error', { url, error: err.message });
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// Main fetchAndExtract: tries Puppeteer, falls back to Cheerio/axios
async function fetchAndExtract(url, selectors = DEFAULT_SELECTORS) {
  if (USE_PUPPETEER) {
    const dynamicResults = await fetchAndExtractDynamic(url, selectors, MAX_PAGES);
    if (dynamicResults.length > 0) return dynamicResults[0]; // Return first page result for now
  }
  // Fallback: original Cheerio/axios logic
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);

    // Extract company name more accurately
    let name = '';
    for (const sel of (selectors.name || DEFAULT_SELECTORS.name)) {
      name = $(sel).first().text().trim() || $(sel).attr('content') || '';
      if (name) break;
    }
    // Validate and clean company name
    const genericNames = [
      'home', 'index', 'u.s.', 'us', 'welcome', 'main', 'default', 'untitled', 'page', 'start', 'root', 'dashboard', 'site', 'webpage', 'website', 'portal', 'profile', 'feed', 'explore', 'discover', 'search', 'news', 'about', 'contact', 'login', 'sign in', 'sign up', 'register', 'account', 'settings', 'menu', 'help', 'support', 'privacy', 'terms', 'cookie', 'accessibility', 'skip', 'navigate'
    ];
    let cleanedName = name ? name.trim() : '';
    if (
      !cleanedName ||
      cleanedName.length < 3 ||
      cleanedName.length > 80 ||
      genericNames.includes(cleanedName.toLowerCase()) ||
      /^(\W|\d)+$/.test(cleanedName) // only symbols/numbers
    ) {
      // Fallback to domain
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        cleanedName = domain.split('.')[0];
        cleanedName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
      } catch {
        cleanedName = 'Unknown Company';
      }
    }
    name = cleanedName;
    // Debug: Log name extraction
    console.log('Name extraction:', {
      ogSiteName: $(`meta[property="og:site_name"]`).attr('content'),
      appName: $(`meta[name="application-name"]`).attr('content'),
      title: $('title').text(),
      h1: $('h1').first().text(),
      finalName: name
    });
    // Emails
    let emails = [];
    $('a[href^="mailto:"]').each((i, el) => {
      const email = $(el).attr('href').replace(/^mailto:/, '').split('?')[0];
      if (email) emails.push(email);
    });
    if (emails.length === 0) emails = extractEmails($.text());
    emails = [...new Set(emails)].filter(Boolean);
    // Social
    const social = extractSocialLinks($);
    // TechStack
    let techStack = extractTechStack($);
    // Enhanced Additional fields using improved extraction functions
    let address = $("address").first().text().trim() ||
      $('[itemprop="address"]').first().text().trim() ||
      $("[class*='address']").first().text().trim() ||
      $("[class*='location']").first().text().trim() ||
      $("footer").text().match(/\d{1,5} [\w\s.,-]+,? [\w\s.,-]+,? [A-Z]{2,}/)?.[0] ||
      undefined;
    address = cleanAddress(address);

    // Use improved extraction functions
    let overview = extractOverview($);
    let yearFounded = extractYearFounded($);
    let industry = extractIndustry($);
    let projects = extractProjects($);
    let marketPosition = extractMarketPosition($);
    // Tagline extraction
    let tagline = extractTagline($);

    // Competitors: use improved extraction
    let competitors = extractCompetitors($);
    if (competitors.length === 0) competitors = undefined;

    // Additional filtering for navigation content
    if (isLikelyNavigation(address)) address = undefined;
    // --- Enrichment with SerpAPI Knowledge Graph ---
    let kgData = {};
    try {
      kgData = await enrichWithKnowledgeGraph({ name, website: url });
      if (kgData.industry && (!industry || kgData.industry.length < industry.length)) industry = kgData.industry;
      if (kgData.description && (!overview || kgData.description.length < overview.length)) overview = kgData.description;
      if (kgData.marketPosition && (!marketPosition || kgData.marketPosition.length < marketPosition.length)) marketPosition = kgData.marketPosition;
    } catch (e) {
      console.error('KG enrichment error:', e.message);
    }
    // --- Enrichment with Clearbit ---
    let clearbitData = {};
    try {
      clearbitData = await enrichWithClearbit(new URL(url).hostname);
      if (clearbitData.name && (!name || clearbitData.name.length < name.length)) name = clearbitData.name;
      if (clearbitData.description && (!overview || clearbitData.description.length < overview.length)) overview = clearbitData.description;
      if (clearbitData.industry && (!industry || clearbitData.industry.length < industry.length)) industry = clearbitData.industry;
      if (clearbitData.companySize && (!yearFounded || clearbitData.companySize < yearFounded)) yearFounded = clearbitData.companySize;
      if (clearbitData.techstack && techStack.length < clearbitData.techstack.length) techStack = clearbitData.techstack;
    } catch (e) {
      console.error('Clearbit enrichment error:', e.message);
    }
    // Debug logs for field extraction
    console.log('Scraped:', {
      url,
      address,
      overview,
      industry,
      projects,
      competitors,
      marketPosition,
      kgData,
      clearbitData
    });
    // Extract canonical homepage or root domain
    let homepage = '';
    homepage = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || '';
    if (homepage) {
      // Clean up: ensure it's absolute
      try {
        homepage = new URL(homepage, url).origin;
      } catch {
        homepage = '';
      }
    }
    if (!homepage) {
      // Fallback to root domain
      try {
        const u = new URL(url);
        homepage = u.origin;
      } catch {
        homepage = url;
      }
    }
    // In DB save, set website: homepage
    try {
      const company = new Company({
        name: name.trim() || undefined,
        website: homepage,
        tagline: tagline || undefined,
        email: emails.length ? emails.join(' | ') : undefined,
        linkedin: social.linkedin || undefined,
        twitter: social.twitter || undefined,
        facebook: social.facebook || undefined,
        instagram: social.instagram || undefined,
        address,
        overview,
        yearFounded,
        industry,
        projects,
        competitors,
        marketPosition,
        techstack: techStack
      });
      await company.save();
      // console.log('[SCRAPER] Saved to DB:', name.trim(), homepage);
    } catch (dbError) {
      console.error('[SCRAPER] Database save error:', dbError);
    }
    // Only include fields if found - use actual extracted data
    const result = {
      name: name.trim() || undefined,
      website: homepage,
      tagline: tagline || undefined,
      email: emails.length ? emails.join(' | ') : undefined,
      linkedin: social.linkedin || undefined,
      twitter: social.twitter || undefined,
      facebook: social.facebook || undefined,
      instagram: social.instagram || undefined,
      address: address || undefined,
      overview: overview || undefined,
      yearFounded: yearFounded || undefined,
      industry: industry || undefined,
      projects: projects || undefined,
      competitors: competitors || undefined,
      marketPosition: marketPosition || undefined,
      techstack: techStack || undefined
    };
    if (!(result.website && result.name)) {
      console.warn('[SCRAPER] Skipping result due to missing name or website:', result);
    }
    // Only return result if both website and name are present
    if (result.website && result.name) {
      return result;
    } else {
      return null;
    }
  } catch (err) {
    console.error('Error scraping', url, err.message);
    return { website: url, error: err.message };
  }
}

async function getUrlsFromQuery(query) {
  if (!SERPAPI_KEY) throw new Error('SerpAPI key missing');
  // Use SerpAPI's Google Search
  const params = {
    q: query,
    api_key: SERPAPI_KEY,
    engine: 'google',
    num: 10 // fetch as many as possible
  };
  const serpApiUrl = 'https://serpapi.com/search';
  const response = await axios.get(serpApiUrl, { params });
  const data = response.data;
  const urls = [];
  if (data.organic_results && Array.isArray(data.organic_results)) {
    for (const result of data.organic_results) {
      if (result.link) urls.push(result.link);
    }
  }
  // After collecting urls[]
  // Prioritize homepages/domains that match the query
  const domainMatch = urls.find(u => {
    try {
      const hostname = new URL(u).hostname.replace(/^www\./, '');
      return hostname.startsWith(query.toLowerCase());
    } catch {
      return false;
    }
  });
  // If found, move it to the front
  if (domainMatch) {
    urls.splice(urls.indexOf(domainMatch), 1);
    urls.unshift(domainMatch);
  }
  // Determine if query is broad (multi-word)
  const isBroadQuery = query.trim().split(/\s+/).length > 2;
  // Limit to top 10 for broad queries, else 3
  return urls.slice(0, isBroadQuery ? 10 : 3);
}

// Helper: stopwords for filtering
const STOPWORDS = new Set(['the','in','on','at','of','for','and','to','a','an','by','with','from','as','is','are','was','were','be','been','it','that','this','these','those','but','or','not','so','if','then','than','too','very','can','will','just','about','into','over','under','out','up','down','off','all','any','each','few','more','most','other','some','such','no','nor','only','own','same','s','t','now','d','ll','m','o','re','ve','y']);

function isRelevantResult(result, query) {
  if (!result || !query) return false;
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w && !STOPWORDS.has(w));
  if (words.length > 1) {
    // For broad queries, match if any significant word is present
    return words.some(word =>
      (result.name && result.name.toLowerCase().includes(word)) ||
      (result.website && result.website.toLowerCase().includes(word)) ||
      (result.overview && result.overview.toLowerCase().includes(word))
    );
  }
  // For short queries, use original logic
  return (
    (result.name && (
      result.name.toLowerCase().includes(q) ||
      isAcronymMatch(q, result.name)
    )) ||
    (result.website && result.website.toLowerCase().includes(q)) ||
    (result.overview && result.overview.toLowerCase().includes(q))
  );
}

// Helper to check if domain matches query
function isDomainMatch(result, query) {
  if (!result || !result.website || !query) return false;
  try {
    const hostname = new URL(result.website).hostname.replace(/^www\./, '');
    return hostname.startsWith(query.toLowerCase());
  } catch {
    return false;
  }
}

async function scrapeCompanies({ query, urls, config }) {
  let targets = urls;
  if (query) {
    targets = await getUrlsFromQuery(query);
  }
  if (!targets || !Array.isArray(targets)) return [];
  const validUrls = targets.filter(u => {
    try {
      const urlObj = new URL(u);
      if (/wikipedia\.org|wikidata\.org|wikimedia\.org|wikiwand\.com/i.test(urlObj.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  });
  const results = [];
  let idx = 0;
  let progress = 0;
  async function worker() {
    while (idx < validUrls.length) {
      const myIdx = idx++;
      const url = validUrls[myIdx];
      const res = await fetchAndExtract(url, config?.selectors || DEFAULT_SELECTORS);
      results[myIdx] = res;
      progress = Math.round(((myIdx + 1) / validUrls.length) * 100);
      logScrapeEvent('progress', { progress, url });
      await delay(RATE_LIMIT_DELAY); // Rate limiting
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, validUrls.length) }, worker);
  await Promise.all(workers);
  // Only return results with both website and name
  const filteredResults = results.filter(r => r && r.website && r.name);
  // Always include results where the domain matches the query
  let homepageResults = filteredResults.filter(r => isDomainMatch(r, query));
  let otherResults = filteredResults.filter(r => !isDomainMatch(r, query));
  if (query) {
    // Combine homepage results (always included) with other relevant results
    return [...homepageResults, ...otherResults.filter(r => isRelevantResult(r, query))];
  }
  return filteredResults;
}

module.exports = { scrapeCompanies }; 
