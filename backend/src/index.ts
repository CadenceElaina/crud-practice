import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {PORT} from './config/env';
import usersRoutes from './routes/usersRoutes';
import noteRoutes from './routes/noteRoutes';

const app = express();

//Sets a handful of HTTP headers (X-Content-Type-Options, a default
// Content-Security-Policy, etc.) 
// X-Content-Type-Options https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
// that browsers use to reduce a class of
// common attacks. Cheap to add, costs nothing for a JSON API.
app.use(helmet());

//app.use(cors());
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*', // TODO: restrict in production
}));

// Without this, req.body is unedfined and this middle ware reads the
// raw request body, parses it as JSON, and attaches the result to req.body.
app.use(express.json());

//Brute-force protection on login: cap repeated attempts per IP within a
// time window. Cheapest meaningful security win for an auth endpoint.
// otherwise a script can try thousands of passwords against one email per minute.

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: 'Toom many login attempts, please try again later'},
});
app.use('/api/login', loginLimiter);
app.use('/api', usersRoutes);
app.use('/api', noteRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({status: 'UP', timestamp: new Date().toISOString()});
});

app.listen(PORT, '0.0.0.0', () =>{
    console.log(`The application is listening on http://localhost:${PORT}`);
});