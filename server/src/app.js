import express from 'express';
import cors from 'cors';

const app = express(); //initialize

app.use(cors()); //attaches cors to allow cross origin requests

app.use(express.json()); // parses incoming json request bodies to read data with req.body

app.get('/api/health',(req,res)=> {res.status(200).json({status: 'ok',message: 'Pulsenet api is healthy',uptime: process.uptime()});}); //200 means ok, sends out json object w message
export default app; //exports app so other files (server launcher and test runners can use it)