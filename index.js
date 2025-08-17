import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";  // Tambah import cors
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const upload = multer({ dest: 'uploads/' });

// Fix __dirname untuk ES Modules
const __dirname = path.resolve();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ** Tambahkan serve static file middleware **
app.use(express.static('public'));

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.5-flash";

const PORT = process.env.PORT || 3000;

// Fungsi Helper
function extractText(resp) {
    try {
        const text =
        resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
        resp?.candidates?.[0]?.content?.parts?.[0]?.text ??
        resp?.response?.candidates?.[0]?.content?.text;

        return text ?? JSON.stringify(resp, null, 2);
    } catch (err) {
        console.error("Error extracting text:", err);
        return JSON.stringify(resp, null, 2);
    }
}

// ** Route GET / untuk load index.html **
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= CHATBOT ENDPOINT (BARU) =============
app.post("/api/chat", async (req, res) => {
    try {
        console.log('Received chat request:', req.body);
        
        const { messages } = req.body;
        
        // Validate input
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid input format. Expected messages array.'
            });
        }
        
        if (messages.length === 0) {
            return res.status(400).json({
                error: 'Messages array cannot be empty.'
            });
        }
        
        // Format messages for Gemini
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        
        console.log('Formatted messages:', JSON.stringify(formattedMessages, null, 2));
        
        // Get Gemini model
        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        
        // Generate response
        const result = await model.generateContent({
            contents: formattedMessages,
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 1024,
            },
        });
        
        const responseText = extractText(result);
        
        console.log('Gemini response:', responseText);
        
        res.json({ 
            result: responseText,
            status: 'success',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        
        // Handle specific Gemini API errors
        if (error.message?.includes('API_KEY')) {
            return res.status(401).json({
                error: 'Invalid API key or API key not configured',
                message: 'Please check your Gemini API key configuration'
            });
        }
        
        if (error.message?.includes('quota')) {
            return res.status(429).json({
                error: 'API quota exceeded',
                message: 'Please try again later'
            });
        }
        
        res.status(500).json({
            error: 'Failed to generate response',
            message: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Gemini AI Chatbot API is running',
        timestamp: new Date().toISOString()
    });
});

// ============= EXISTING ENDPOINTS =============

// 1. Endpoint untuk mengirimkan teks
app.post("/generate-text", async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
        return res.status(400).json({ error: "Tulis sebuah prompt!" });
        }

        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });

        const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        });

        const response = await result.response;
        res.json({ result: extractText(response) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Endpoint untuk mengirimkan gambar
app.post("/generate-from-image", upload.single("image"), async (req, res) => {
    const filePath = req.file?.path;
    try {
        const { prompt = "Deskripsikan Gambar Berikut:" } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ error: "File Gambar Dibutuhkan!" });
        }

        const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        
        const result = await model.generateContent({
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: req.file.mimetype, data: imageBase64 } }
                    ]
                }
            ]
        });

        const response = await result.response;
        res.json({ result: extractText(response) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath) {
            fs.unlinkSync(filePath);
        }
    }
});

// 3. Endpoint untuk mengirimkan dokumen
app.post("/generate-from-document", upload.single("document"), async (req, res) => {
    const filePath = req.file?.path;
    try {
        const { prompt = "Ringkaskan Dokumen Berikut:" } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ error: "File Dokumen Dibutuhkan!" });
        }

        const documentBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        
        const result = await model.generateContent({
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: { mimeType: req.file.mimetype, data: documentBase64 }
                        }
                    ]
                }
            ]
        });

        const response = await result.response;
        res.json({ result: extractText(response) });
    } catch (err) {
        console.error("Document processing error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath) {
            fs.unlinkSync(filePath);
        }
    }
});

// 4. Endpoint untuk mengirimkan audio
app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
    const filePath = req.file?.path;
    try {
        const { prompt = "Transkrip dan analisis audio berikut:" } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ error: "File Audio Dibutuhkan!" });
        }

        const audioBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        
        const result = await model.generateContent({
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: req.file.mimetype, data: audioBase64 } }
                    ]
                }
            ]
        });

        const response = await result.response;
        res.json({ result: extractText(response) });
    } catch (err) {
        console.error("Audio processing error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath) {
            fs.unlinkSync(filePath);
        }
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Gemini AI Server running on http://localhost:${PORT}`);
    console.log(`📱 Chat API: http://localhost:${PORT}/api/chat`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables!');
        console.log('Please create a .env file with your Gemini API key:');
        console.log('GEMINI_API_KEY=your_api_key_here');
    } else {
        console.log('✅ Gemini API key configured');
    }
});