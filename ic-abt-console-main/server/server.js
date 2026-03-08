import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;
const dbFilePath = path.join(__dirname, '..', 'data', 'db.json');

app.use(cors());
app.use(express.json({limit: '50mb'}));

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

app.get('/api/db', (req, res) => {
    if (fs.existsSync(dbFilePath)) {
        res.sendFile(dbFilePath);
    } else {
        res.json({});
    }
});

app.post('/api/db', (req, res) => {
    fs.writeFile(dbFilePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Failed to save database.' });
        }
        res.status(200).json({ message: 'Database saved successfully.' });
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
