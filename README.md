# Company Web Scraper

## Features Implemented
- **Dynamic Content Handling:** Uses Puppeteer to scrape JavaScript-rendered content.
- **Pagination & URL Discovery:** Follows pagination links and discovers additional pages.
- **Customization:** Configurable selectors and scraping options via config file.
- **Rate Limiting & Proxy Handling:** Configurable delays, concurrency, and proxy stubs.
- **User Interface:** Modern React frontend with Bootstrap, glassmorphism, and responsive design.
- **Job Progress & Logging:** Backend logs scraping progress and errors.
- **Testing & Logging:** Logging for all scraping events; code is structured for easy testing.
- **Data Enrichment:** Integrates with external APIs (Clearbit, SerpAPI) for richer company data.
- **Relevance Filtering:** Ensures only relevant, high-quality company results are returned.
- **Multi-query Support:** Handles multiple keywords/URLs, returning one best result per query.

## Data Extraction Levels Demonstrated
- **Basic:** Company name, website, and email.
- **Medium:** Social media, address, year founded, industry, tech stack, overview, tagline, etc.
- **Advanced:** Competitors, market position, company size, funding stage, market performance, enriched data from APIs.

## Setup & Run Instructions

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (local or cloud)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd assignment
```

### 2. Backend Setup
```bash
cd backend
npm install
# Create a .env file with your API keys:
# SERPAPI_KEY=your_serpapi_key
# CLEARBIT_API_KEY=your_clearbit_key
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

### 4. Access the App
- Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Setup (Backend)
- **SerpAPI:** Used for Google search results. Get your key at [serpapi.com](https://serpapi.com/).
- **Clearbit:** Used for company enrichment. Get your key at [clearbit.com](https://clearbit.com/).
- Add both keys to your `backend/.env` file as shown above.

## Environment Variables (.env)

Create a `.env` file in the `backend` directory with the following variables:

```env
SERPAPI_KEY=your_serpapi_key
CLEARBIT_API_KEY=your_clearbit_key
PORT=5000
MONGO_URI=mongodb://localhost:27017/yourdbname
```

- `SERPAPI_KEY`: Your SerpAPI key for Google search results
- `CLEARBIT_API_KEY`: Your Clearbit key for company enrichment
- `PORT`: (Optional) The port for the backend server (default: 5000)
- `MONGO_URI`: MongoDB connection string (local or cloud)

## Design Decisions & Assumptions
- **Homepage Extraction:** Always tries to extract the canonical homepage; falls back to root domain if needed.
- **Company Name Cleaning:** Filters out generic/invalid names and falls back to domain-based names.
- **Relevance Filtering:** For broad queries, matches any significant word; for short queries, uses strict matching.
- **Responsiveness:** All UI elements are responsive and mobile-friendly.
- **Performance:** Limits the number of URLs scraped per query for speed, but increases for broad queries.
- **Error Handling:** Logs all errors and skips failing URLs without blocking the user.
- **No root package.json:** All dependencies are managed in frontend/backend folders only.
- **Sensitive files:** `.env` and `node_modules` are gitignored for security and cleanliness.

---

**For any issues or contributions, please open an issue or pull request on GitHub.** 