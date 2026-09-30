import app from './app.js';

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`Received ${signal}; closing the HTTP server.`);
    server.close((error) => {
      if (error) {
        console.error('Error while closing the HTTP server:', error);
        process.exitCode = 1;
      }
    });
  });
}
