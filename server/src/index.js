import dotenv from 'dotenv'; 
import app from './app.js';

dotenv.config(); //reads env and loads its variables into node's process.env object

const PORT = process.env.port || 5000;

app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`);}); //server listening for connections