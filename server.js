// multi-portal-proxy-server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3001;

// Enable CORS with credentials support
app.use(cors({
    origin: function (origin, callback) {
        // Allow all origins in development
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-TBO-Cookie'],
    exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (your HTML, CSS, JS)
app.use(express.static('.'));

// Handle missing images gracefully (return empty image)
app.get(['/images/*', '/Images/*'], (req, res) => {
    // Return a 1x1 transparent gif for missing images
    const emptyGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(emptyGif);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Multi-portal proxy server is running' });
});

// ===========================
// TRAVCLAN ENDPOINT
// ===========================
app.post('/api/travclan/flights', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Travclan flight search request - Page ${req.body.page}`);
    
    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        
        const response = await fetch('https://aggregator-flights-v1.travclan.com/api/v3/flights/search/', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': req.headers.authorization,
                'authorization-mode': 'AWSCognito',
                'content-type': 'application/json',
                'source': 'website',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                'origin': 'https://www.travclan.com',
                'referer': 'https://www.travclan.com/'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        console.log(`[${new Date().toISOString()}] Travclan response received - Status: ${response.status}`);
        
        res.status(response.status).json(data);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Travclan Error:`, error.message);
        res.status(500).json({ 
            error: 'Travclan proxy error', 
            message: error.message,
            details: error.stack 
        });
    }
});

// ===========================
// TRIPJACK ENDPOINT
// ===========================
app.post('/api/tripjack/flights', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Tripjack flight search request`);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        
        const response = await fetch('https://tripjack.com/xms/v1/backend', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': req.headers.authorization,
                'browsername': 'chrome',
                'browserversion': '137.0.0',
                'channeltype': 'DESKTOP',
                'content-type': 'application/json',
                'currenv': 'prod',
                'origin': 'https://tripjack.com',
                'referer': 'https://tripjack.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                'whitelabel': ''
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        console.log(`[${new Date().toISOString()}] Tripjack response received - Status: ${response.status}`);
        console.log(`[${new Date().toISOString()}] Response has payload: ${!!data?.payload}`);
        
        res.status(response.status).json(data);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Tripjack Error:`, error.message);
        res.status(500).json({ 
            error: 'Tripjack proxy error', 
            message: error.message,
            details: error.stack 
        });
    }
});

// ===========================
// TBO ENDPOINT - FIXED TO MATCH EXACT CURL
// ===========================
app.post('/api/tbo/flights', async (req, res) => {
    console.log(`[${new Date().toISOString()}] TBO flight search request`);
    console.log('Headers received:', req.headers);
    console.log('Form data received:', JSON.stringify(req.body, null, 2));
    
    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        
        // Get cookies from custom header (to avoid CORS issues with Cookie header)
        const cookies = req.headers['x-tbo-cookie'] || '';
        
        if (!cookies) {
            console.log(`[${new Date().toISOString()}] No cookies provided`);
            return res.status(401).json({ 
                error: 'No TBO cookies provided', 
                message: 'Please provide TBO session cookies in X-TBO-Cookie header'
            });
        }
        
        // Build form data EXACTLY as TBO expects
        // Data comes pre-encoded from client, so we just join with &
        const formDataParts = [];
        Object.keys(req.body).forEach(key => {
            formDataParts.push(`${key}=${req.body[key]}`);
        });
        const formDataString = formDataParts.join('&');
        
        console.log(`[${new Date().toISOString()}] Sending TBO request`);
        console.log(`[${new Date().toISOString()}] Cookie length: ${cookies.length}`);
        console.log(`[${new Date().toISOString()}] Form data preview: ${formDataString.substring(0, 200)}...`);
        
        const response = await fetch('https://m.travelboutiqueonline.com/FlightSearchResult.aspx', {
            method: 'POST',
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'max-age=0',
                'content-type': 'application/x-www-form-urlencoded',
                'cookie': cookies,
                'origin': 'https://m.travelboutiqueonline.com',
                'priority': 'u=0, i',
                'referer': 'https://m.travelboutiqueonline.com/FlightSearchResult.aspx',
                'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
            },
            body: formDataString,
            redirect: 'manual', // Don't follow redirects automatically
            compress: true
        });

        // Get response as buffer first to handle encoding properly
        const buffer = await response.buffer();
        const htmlContent = buffer.toString('utf-8');
        
        console.log(`[${new Date().toISOString()}] TBO response received - Status: ${response.status}`);
        console.log(`[${new Date().toISOString()}] Response HTML length: ${htmlContent.length} characters`);
        
        // Log response headers for debugging
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        console.log(`[${new Date().toISOString()}] Response headers:`, responseHeaders);
        
        // Check for redirects
        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('location');
            console.log(`[${new Date().toISOString()}] TBO returned redirect to: ${location}`);
            
            if (location && (location.includes('login') || location.includes('Login'))) {
                return res.status(401).json({ 
                    error: 'TBO session expired', 
                    message: 'Please login to TBO and update your session cookies',
                    redirect: location
                });
            }
        }
        
        // Check content for login page indicators
        if (response.status !== 200 || 
            htmlContent.includes('Session has expired') || 
            htmlContent.includes('Please login') ||
            (htmlContent.includes('login') && htmlContent.length < 10000)) {
            console.log(`[${new Date().toISOString()}] Response appears to be a login page or session expired`);
            console.log(`[${new Date().toISOString()}] First 500 chars:`, htmlContent.substring(0, 500));
            return res.status(401).json({ 
                error: 'TBO session expired or invalid', 
                message: 'Please login to TBO and update your session cookies',
                htmlLength: htmlContent.length
            });
        }
        
        // Check if we got flight results
        const hasFlightResults = htmlContent.includes('flightresult') || 
                               htmlContent.includes('result_p') || 
                               htmlContent.includes('flight-result') ||
                               htmlContent.includes('FlightResult');
                               
        if (!hasFlightResults && htmlContent.length > 10000) {
            console.log(`[${new Date().toISOString()}] No flight results indicators found, but page is large enough`);
            console.log(`[${new Date().toISOString()}] Checking for "No flights" message...`);
            
            if (htmlContent.includes('No flights') || htmlContent.includes('no results')) {
                console.log(`[${new Date().toISOString()}] No flights available for this route/date`);
            }
        }
        
        // Set proper content type and send the HTML
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(htmlContent);
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] TBO Error:`, error.message);
        console.error(`[${new Date().toISOString()}] Error stack:`, error.stack);
        res.status(500).json({ 
            error: 'TBO proxy error', 
            message: error.message,
            details: error.stack 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 Multi-Portal Flight Search Proxy Server Started');
    console.log('='.repeat(60));
    console.log(`✅ Server running at: http://localhost:${PORT}`);
    console.log(`📄 Place your HTML, CSS, and JS files in the same directory`);
    console.log(`🌐 Open your HTML at: http://localhost:${PORT}/flight-search.html`);
    console.log('');
    console.log('📍 API Endpoints:');
    console.log(`   - Travclan: http://localhost:${PORT}/api/travclan/flights`);
    console.log(`   - Tripjack: http://localhost:${PORT}/api/tripjack/flights`);
    console.log(`   - TBO:      http://localhost:${PORT}/api/tbo/flights`);
    console.log('');
    console.log('📝 Files needed in the same directory:');
    console.log('   - index.html');
    console.log('   - style.css');
    console.log('   - script.js');
    console.log('   - server.js (this file itself)');
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down proxy server...');
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

/* 
Installation and Usage:
======================

1. Create a new directory for your project:
   mkdir multi-portal-flight-search
   cd multi-portal-flight-search

2. Save these files in the directory:
   - multi-portal-proxy-server.js (this file)
   - flight-search.html
   - flight-search.css
   - flight-search.js

3. Initialize npm and install dependencies:
   npm init -y
   npm install express@4.18.2 cors@2.8.5 node-fetch@3.3.0

4. Start the proxy server:
   node multi-portal-proxy-server.js

5. Open your browser to:
   http://localhost:3001/flight-search.html

6. For each portal:
   - Travclan: Enter bearer token
   - Tripjack: Enter bearer token
   - TBO: Login to TBO, copy all cookies from browser dev tools

7. Enter flight details and search!

Note: DO NOT use VS Code Live Server - use the proxy server URL only
*/