// server/src/index.ts
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
