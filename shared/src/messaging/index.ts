import amqplib from 'amqplib';

export async function connectWithRetry(url: string, maxRetries = 10): Promise<amqplib.ChannelModel> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await amqplib.connect(url);

      conn.on('error', (err) => {
        console.error('RabbitMQ publisher connection error:', err.message);
      });

      conn.on('close', () => {
        console.error('RabbitMQ publisher connection closed. Exiting for restart...');
        process.exit(1);
      });

      return conn;
    } catch {
      const delay = Math.min(attempt * 2000, 10000);
      console.log(`RabbitMQ publisher attempt ${attempt}/${maxRetries} failed, retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
}