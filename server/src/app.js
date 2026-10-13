import express from 'express';
import cors from 'cors';
import pool from './db/pool.js';
import authRoutes from './routes/auth.routes.js';
import {notfound, errorhandler} from './middleware/errorhandler.js';

const app = express(); //initialize

app.use(cors()); //attaches cors to allow cross origin requests

app.use(express.json()); // parses incoming json request bodies to read data with req.body

//Mount routes
app.use('/api/auth',authRoutes)
app.get('/api/health',async(req,res)=> {
    try{
        await pool.query('SELECT 1'); //whether database is functioning
        res.status(200).json({
            status:'ok',
            message:'pulsenet api is healthy',
            database: 'connected',
            uptime: process.uptime(),
        });
    }catch (err) {
        console.log(err);
        res.status(500).json({error: 'database connection failed'}); //500=internal error
    }
});

//app.get('/api/health',(req,res)=> {res.status(200).json({status: 'ok',message: 'Pulsenet api is healthy',uptime: process.uptime()});});
//200 means ok, sends out json object w message *old line*

app.use(notfound);
app.use(errorhandler);

export default app; //exports app so other files (server launcher and test runners can use it)