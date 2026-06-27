
import express from 'express';

const app = express();
const PORT:number=3000; // when you pass PORT into app.listen(PORT,...) Node's underlying .listen() signature expects the PRIMITIVE number type specifically and TS rejects Number-typed value  - convention is never use the capitalized wrapper types as type annotations 


app.get('/', (req, res) => {
    res.send('Welcome to typescript backend! :3');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT,() => {
    console.log('The application is listening on port http://localhost/'+PORT);
});