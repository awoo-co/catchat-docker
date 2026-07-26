const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3030;

// Serve all static files (style.css, script.js, images, etc.) from the root directory
app.use(express.static(__dirname));

// Serve index.html on the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});