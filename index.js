
import express from 'express';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(process.env.MONGO_CLIENT_DB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }
}

// Home Route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// GET Books
app.get('/books', (req, res) => {
  res.send('Tarek Rahman Hm!');
});

// POST Books
app.post('/books', (req, res) => {
  res.send('Hello World!');
});

// PUT Books
app.put('/books', (req, res) => {
  res.send('Hello World!');
});

// DELETE Books
app.delete('/books', (req, res) => {
  res.send('Hello World!');
});

// PATCH Books
app.patch('/books', (req, res) => {
  res.send('Hello World!');
});

// Start Server
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error);
  }
}

startServer();
