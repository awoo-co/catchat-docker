const express = require('express');
const path = require('path');

const app = express();
const port = 3030;

// Serve index.html when visiting http://localhost:3030/
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Optional: Serve all other static files (CSS, JS, images) from the same folder
// app.use(express.static(__dirname));

// Start the server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});