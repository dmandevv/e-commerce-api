import { config } from './config/index.js';
import { app } from './app.js';

app.listen(config.port, () => {
  console.log(`Health service running on port ${config.port}`);
});