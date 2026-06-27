import {config} from 'dotenv';
config({ quiet: true }); // was: config();
import express from 'express';
import {pool} from './db';

const app = express();
// new Number(x) -> creates a wrapper object 
// Number(x) -> primitive number
// any value coming out of process.env is ALWAYS a string so its necessary to convert it Number(..) 
const PORT: number = Number(process.env.PORT) || 3000;
//const PORT:number=3000; // when you pass PORT into app.listen(PORT,...) Node's underlying .listen() signature expects the PRIMITIVE number type specifically and TS rejects Number-typed value  - convention is never use the capitalized wrapper types as type annotations 


app.get('/', (req, res) => {
    res.send('Welcome to typescript backend! :3');
});

app.get('/api/users', async (req, res) => {
    try{
    const r = await pool.query('SELECT * FROM users');
    res.json(r.rows);

    //console.log('user:', r.rows);
    } catch(err){
          console.error('DB query failed:', err);
    res.status(500).json({error: 'Failed to fetch users'});
        //console.error(err); err can leak internal details (stack traces, query text, etc)

    }
})

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
console.log(`The application is listening on http://localhost:${PORT}`);});

