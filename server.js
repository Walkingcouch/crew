require('dotenv').config();
const path        = require('path');
const express     = require('express');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

app.use(cookieParser());
app.use(express.json());

app.use(helmet({
  contentSecurityPolicy: false,  // set manually below so it matches vercel.json
  crossOriginEmbedderPolicy: false,
}));

// Rate limit all requests (100 req / 15 min per IP)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Security headers (mirrors vercel.json)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  next();
});

// Service worker: no-cache
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(ROOT, 'sw.js'));
});

// Clean URLs: strip .html extension
app.use((req, res, next) => {
  const map = {
    '/login':          '/auth.html',
    '/signin':         '/auth.html',
    '/portal':         '/Customer_Portal.html',
    '/rewards':        '/rewards.html',
    '/rewards/tc':     '/rewards-tc.html',
    '/dashboard':      '/CrewBase_Dashboard.html',
    '/command':        '/Command_Center_Desktop.html',
    '/command/tablet': '/Command_Center_Tablet.html',
    '/report':         '/report.html',
    '/customer':       '/Crew_App_Customer_Role.html',
    '/contractor':     '/Crew_App_Crew_Member.html',
    '/manager':        '/Crew_App_Crew_Manager.html',
    '/field':          '/CrewBase_Field_Worker_App.html',
    '/supervisor':     '/CrewBase_Supervisor_App.html',
  };
  const dest = map[req.path];
  if (dest) return res.sendFile(path.join(ROOT, dest));
  next();
});

// Static files
app.use(express.static(ROOT, {
  extensions: ['html'],
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// AI proxy → Ollama local inference (reduces external API token spend)
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const AI_PROMPTS = {
  'search': (q) =>
    `You are a friendly support agent for Crew, an Australian service marketplace. Answer the question below using only the FAQ knowledge provided. Be concise (1-3 sentences) and helpful.\n\nFAQ knowledge:\n- Escrow payments: Customer funds are held securely until the job is confirmed complete. Released to contractor within 24 hours of completion.\n- Contractor verification: All contractors have a verified ABN, government-issued photo ID, and active public liability insurance before accepting jobs.\n- Booking: Use the Customer Portal to book. Choose service type, date, and location. You will be matched with an available verified contractor.\n- Cancellation: Free cancellation up to 2 hours before the job start time. A 25% fee applies for later cancellations.\n- Payments: All major cards accepted. GST (10%) is included in all displayed prices. No cash payments.\n- Disputes: Raise a dispute within 48 hours of job completion via the app. Our team reviews job evidence and mediates fairly. Funds are held until resolved.\n- Ratings: Rate your contractor after each completed job. Contractors below 4.0★ are automatically paused for review.\n- Refunds: Full refund if the job is not completed. Partial refunds are assessed case-by-case for quality issues.\n- Account: Update your details in Settings. Delete your account from Settings → Account → Delete. Data deleted within 30 days per Australian Privacy Act.\n- Jobs not completed: If a contractor does not show up or complete the work, the escrow is not released and you pay nothing.\n\nQuestion: ${q}\n\nAnswer:`,

  'job-description': (details) =>
    `You are a professional copywriter for a service marketplace. Write a clear, professional 2-sentence job description based on these details. Be specific and practical. Output only the description text, nothing else.\n\nJob details: ${details}`,

  'summarise': (text) =>
    `Summarise the following in 1-2 clear sentences. Output only the summary.\n\n${text}`,

  'notification': (event) =>
    `Write a short, friendly push notification (under 100 characters) for this event: ${event}\nOutput only the notification text, no quotes.`,

  'suggest-tags': (desc) =>
    `Pick exactly 3 tags from this list that best match the job. Output only those 3 tags separated by commas, nothing else.\n\nTags: Lawn mowing, Garden maintenance, House cleaning, Office cleaning, Pest control, Plumbing, Electrical, Painting, Handyman, Pressure washing, Window cleaning, Pool maintenance, Tree removal, Rubbish removal\n\nJob: ${desc}\n\n3 tags:`,
};

app.post('/api/ai', aiLimiter, async (req, res) => {
  const { task = 'search', input, model = 'llama3.2:1b' } = req.body || {};

  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return res.status(400).json({ error: 'input is required' });
  }
  if (input.length > 2000) {
    return res.status(400).json({ error: 'input too long (max 2000 chars)' });
  }
  const promptFn = AI_PROMPTS[task];
  if (!promptFn) {
    return res.status(400).json({ error: `unknown task "${task}". Valid: ${Object.keys(AI_PROMPTS).join(', ')}` });
  }

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: promptFn(input.trim()),
        stream: false,
        options: { temperature: 0.3, num_predict: 250 },
      }),
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama responded ${ollamaRes.status}`);
    }

    const data = await ollamaRes.json();
    const result = (data.response || '').trim();
    res.json({ result, model, task });
  } catch (err) {
    console.error('[/api/ai]', err.message);
    res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
});

// 404
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, '404.html')));

app.listen(PORT, () => console.log(`Crew dev server → http://localhost:${PORT}`));
