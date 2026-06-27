import {config} from 'dotenv';
config({ quiet: true }); // was: config();
import express, {Request, Response, NextFunction} from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {pool} from './db';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json()); // without this req.body is undefined - this is middleware in express that reads a raw req body parses it as JSON and attaches the result to req.body
// new Number(x) -> creates a wrapper object 
// Number(x) -> primitive number
// any value coming out of process.env is ALWAYS a string so its necessary to convert it Number(..) 
const PORT: number = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.SECRET || 'fallback_jwt_secret_uwu_:3';
//const PORT:number=3000; // when you pass PORT into app.listen(PORT,...) Node's underlying .listen() signature expects the PRIMITIVE number type specifically and TS rejects Number-typed value  - convention is never use the capitalized wrapper types as type annotations 


// =========================================================================
// TYPES & MIDDLEWARE
// =========================================================================
interface AuthenticatedRequest extends Request {
    userId?: number; // Matching SERIAL (INT) user_id from Postgres
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
         res.status(401).json({error: 'Access token missing or invalid'});
         return;  // explicitly return void, not the res obj
    }

    try{
        const decoded = jwt.verify(token, JWT_SECRET) as {id: number};
        req.userId = decoded.id;
        next();
    } catch (err){
         res.status(403).json({error: 'Token is invalid or expired'});
         return;
    }
};

// =========================================================================
// USER ROUTES (GET & POST)
// =========================================================================

// GET all users (exclude password)
app.get('/api/users', async (req: Request, res: Response) => {
    try{
        const result = await pool.query(
            'SELECT user_id, name, email, created_at FROM users'
     
        );
               res.json(result.rows);
    } catch(err){
        res.status(500).json({error: err instanceof Error ? err.message : 'Database error'});
    }
});

// POST register user
app.post('/api/users', async (req: Request, res: Response) => {
    const {name, email, password} = req.body;
    try{
        const saltRounds = 10; // key strecthing 2^rounds 2^10 = 1024 operations - ~100ms to hash slow enough to block some brute-force attacks but still fast to not make a user notice lag
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING user_id, name, email, created_at',
            [name,email,passwordHash]
        );
        res.status(201).json(result.rows[0]);
    } catch(err){
        res.status(500).json({error: err instanceof Error ? err.message : 'Database error'});
    }
})

// POST user login
app.post('/api/login', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password){
        res.status(400).json({error: 'Email and password are required'});
        return;
    }

    try{
        // 1. SELECT user by email only
const userResult = await pool.query(
            'SELECT user_id, password FROM users WHERE email = $1',
            // update last login time? seems like acommon feature needed in most crud apps anything else?
            [email]
        );

    // 2. if no user found -> 401
    if(userResult.rows.length === 0) {
        res.status(401).json({ error: 'Invalid email or password'});
        return;
    }

    const user = userResult.rows[0];

    // 3. bycrypt.compare(password, user.password)
    const passwordCorrect = await bcrypt.compare(password, user.password);

    // 4. If no match -> 401
    if (!passwordCorrect) {
        // use same generic message to prevent user enumeration attacks
        res.status(401).json({error: 'Invalid email or password'});
        return;
    }

    // update last login time 
    await pool.query(
        'UPDATE users SET last_login = NOW() WHERE user_id = $1',
        [user.user_id]
    );

    // 5. jwt.sign({id: user.user_id}, JWT_SECRET)
    const secret = process.env.SECRET;
    if(!secret) {
        throw new Error('JWT Secret is missing environment variables');
    }

    const token = jwt.sign(
        {id: user.user_id},
        secret,
        {expiresIn: '1d'} 
    )

    // 6. Return token
    res.status(200).json({
        token,
        user: { id: user.user_id, email}
    })

} catch(err){
        res.status(500).json({error: err instanceof Error ? err.message : 'Database error'});
    }
});

// =========================================================================
// NOTES ROUTES (GET, POST, PUT, DELETE)
// =========================================================================

// GET all notes belonging to an authenticated user
app.get('/api/notes', authenticateToken, async (req: AuthenticatedRequest, res: Response) =>{
    try{
        const result = await pool.query(
            'SELECT * FROM notes where user_id = $1 ORDER BY created_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch(err) {
        res.status(500).json({error: err instanceof Error ? err.message : 'Database error'});
    }
});

// POST create a new note - optinally assign to a list
app.post('/api/notes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const {title, content, list_id} = req.body;

    try{
        // Start a transaction so if attaching a list fails, the note creation rolls back
        await pool.query('BEGIN');

        // 1. Insert the main note. - user_id comes from token
        const noteResult = await pool.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
            [req.userId, title, content]
        ); 
        const newNote = noteResult.rows[0];

        // 2. If provided a list_id link it in tthe junction table
        if(list_id){
            await pool.query('INSERT INTO note_lists (note_id, list_id) VALUES ($1, $2)',
            [newNote.note_id, list_id]
        );
        }
        await pool.query('COMMIT');
        res.status(201).json(newNote);
    } catch (err) {
        await pool.query('ROLLBACK'); // Cancel database actiosn if any step fails - ensures consistency in ACID principles
        res.status(500).json({error: err instanceof Error ? err.message: 'Database error'});
    }
});

// PUT update an existing note
app.put('/api/notes/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) =>{
    const noteId = req.params.id;
    const {title, content} = req.body;

    try{
        // Verify the note belongs to the user editing it - trigger function automatically updates updated_at on a note whenver a note is changed
const result = await pool.query(
            'UPDATE notes SET title = $1, content = $2 WHERE note_id = $3 AND user_id = $4 RETURNING *',
            [title, content, noteId, req.userId]
        );
if (result.rowCount === 0) {
             res.status(404).json({ error: 'Note not found or unauthorized' });
             return;
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
});

// DELETE a note
app.delete('/api/notes/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const noteId = req.params.id;

    try{
        // Enforce ownership check - deleting a note automatically cleans up record in note_tags and note_lists via ON DELETE CASCADE on junction tables in the schema.
        const result = await pool.query(
            'DELETE FROM notes WHERE note_id = $1 AND user_id = $2 RETURNING *',
            [noteId, req.userId]
        );

        if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Note not found or unauthorized' });
        }

        return res.status(200).json({message: 'note deleted succesfully'});
    } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
}
});

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`The application is listening on http://localhost:${PORT}`);
});