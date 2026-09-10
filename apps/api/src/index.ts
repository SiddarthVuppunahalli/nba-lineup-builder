import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Lineup Engine API listening on port ${port}`);
});
