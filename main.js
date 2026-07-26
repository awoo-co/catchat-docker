const express = require('express');
const path = require('path');

const app = express();
// Use the PORT environment variable if available, fallback to 3030
const port = process.env.PORT || 3030;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});