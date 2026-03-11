// LEGACY — local JSON file server from the db.json persistence era.
// The app now uses IndexedDB (local-first) + Firebase Firestore (sync).
// This file is retained only for historical reference and is NOT used by
// the current build, dev, or deploy paths. Do not start this server.
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const server = http.createServer(async (req, res) => {
    // Set CORS headers to allow requests from the frontend
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight CORS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/db') {
        if (req.method === 'GET') {
            try {
                const data = await fs.readFile(DB_PATH, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // If db.json doesn't exist, create it with an empty object
                    await fs.writeFile(DB_PATH, '{}');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end('{}');
                } else {
                    console.error('Failed to read database:', error);
                    res.writeHead(500);
                    res.end(JSON.stringify({ message: 'Failed to read database' }));
                }
            }
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    // Make sure the received data is valid JSON before writing
                    const parsedBody = JSON.parse(body);
                    await fs.writeFile(DB_PATH, JSON.stringify(parsedBody, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Database saved successfully' }));
                } catch (error) {
                    console.error('Failed to save database:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid JSON or failed to write file' }));
                }
            });
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Node.js server for database is listening on http://localhost:${PORT}`);
    console.log('It will store data in a `db.json` file in your project root.');
});
