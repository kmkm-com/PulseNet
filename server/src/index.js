import './config/env.js';    // loads server/.env
import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`);}); //server listening for connections
