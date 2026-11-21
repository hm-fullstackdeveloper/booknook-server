
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";
import multer from "multer";


const app = express();
const port = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

/**
 * Uploads an in-memory file buffer to ImgBB and returns its public URL.
 *
 * The buffer never touches the disk, so no temporary path can leak into
 * MongoDB — only the hosted URL is stored on the document.
 */
async function uploadImageToImgBB(file) {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error("Image upload is not configured on the server");
  }

  const formData = new URLSearchParams();
  formData.append("image", file.buffer.toString("base64"));

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    { method: "POST", body: formData }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error("ImgBB Error:", result);
    throw new Error("Image upload failed");
  }

  return result.data.display_url;
}

// MongoDB Connection
const client = new MongoClient(process.env.MONGO_CLIENT_DB_URL);

// const borrowsCollection = db.collection("borrows_projects");


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

const db = client.db("booknook_project");

const books = db.collection("books");
console.log('add user server_booknook_project')



const dbs = client.db("borrows_projects");
const book = dbs.collection("borrows");
console.log('add user server_booknook_project')



// Home Route
app.get('/', (req, res) => {
  res.send('Hello World!');
});



// GET borrows
app.get('/borrows', async (req, res) => {
  const cursor = book.find({})
  const allborrows = await cursor.toArray();
   console.log("All borrows:", allborrows);
  res.send(allborrows);
});


app.post('/borrows', async (req, res) => {
  const borrow = req.body;
  const result = await book.insertOne(borrow);
  console.log('Borrow is defined', result);
  res.send(result);
});


app.delete('/borrows/:_id', async (req, res) => {
  const id = req.params._id;
  const query = { _id: new ObjectId(id) };
  const result = await book.deleteOne(query);
  res.send(result);
});


// PATCH Borrows - Return Book
app.patch('/borrows/:_id', async (req, res) => {
  const id = req.params._id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Borrow ID"
    });
  }

  const result = await book.updateOne(
    {
      _id: new ObjectId(id),
      status: "borrowed"
    },
    {
      $set: {
        status: "returned"
      }
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).send({
      message: "Borrow not found or already returned"
    });
  }

  res.send({
    message: "Book returned successfully",
    result
  });
});





// GET Books
app.get('/books', async (req, res) => {
  const cursor = books.find({})
  const allBooks = await cursor.toArray();
   console.log("All Books:", allBooks);
  res.send(allBooks);
});

// GET Single Book
app.get('/books/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(404).send({
      message: "Book not found"
    });
  }

  try {
    const book = await books.findOne({ _id: new ObjectId(id) });

    if (!book) {
      return res.status(404).send({
        message: "Book not found"
      });
    }

    res.send(book);
  } catch (error) {
    console.error("GET /books/:id Error:", error);

    res.status(500).send({
      message: "Failed to load book"
    });
  }
});

// POST Books with ImgBB Image Upload
app.post('/books', upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      copies,
      description,
      userName,
      userEmail
    } = req.body;

    console.log("Received Book Data:", req.body);

    // Check Image
    if (!req.file) {
      return res.status(400).send({
        message: "Book image is required"
      });
    }

    // Upload Image to ImgBB
    const image = await uploadImageToImgBB(req.file);

    // Prepare Book Data
    const bookData = {
      title,
      author,
      category,
      copies: Number(copies),
      description,
      userName,
      userEmail,
      image,
      dateAdded: new Date(),
    };

    // Insert into MongoDB
    const result = await books.insertOne(bookData);

    console.log("MongoDB Insert Result:", result);

    res.status(201).send({
      message: "Book added successfully",
      result
    });

  } catch (error) {
    console.error("POST /books Error:", error);

    res.status(500).send({
      message: "Failed to add book"
    });
  }
});


// DELETE Books
app.delete('/books/:_id', async (req, res) => {
  const id = req.params._id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID"
    });
  }

  try {
    const result = await books.deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Book not found"
      });
    }

    res.send({
      message: "Book deleted successfully",
      result
    });
  } catch (error) {
    console.error("DELETE /books/:id Error:", error);

    res.status(500).send({
      message: "Failed to delete book"
    });
  }
});




// PATCH Book - edit details and/or replace the image
app.patch('/books/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID"
    });
  }

  try {
    const { title, author, category, copies, description } = req.body;
    const update = {};

    if (typeof title === "string" && title.trim()) update.title = title.trim();
    if (typeof author === "string" && author.trim()) update.author = author.trim();
    if (typeof category === "string" && category.trim()) update.category = category.trim();
    if (typeof description === "string") update.description = description.trim();

    if (copies !== undefined && copies !== "") {
      const parsed = Number(copies);

      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).send({
          message: "Copies must be a positive number"
        });
      }

      update.copies = parsed;
    }

    // A new picture replaces the old one; without a file the old URL is kept.
    if (req.file) {
      update.image = await uploadImageToImgBB(req.file);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).send({
        message: "Nothing to update"
      });
    }

    const updated = await books.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).send({
        message: "Book not found"
      });
    }

    res.send(updated);
  } catch (error) {
    console.error("PATCH /books/:id Error:", error);

    res.status(500).send({
      message: error.message || "Failed to update book"
    });
  }
});


// PATCH Book copies - borrow decrements one available copy
app.patch('/books/:id/copies', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID"
    });
  }

  const result = await books.updateOne(
    {
      _id: new ObjectId(id),
      copies: { $gt: 0 }
    },
    {
      $inc: { copies: -1 }
    }
  );

  if (result.matchedCount === 0) {
    return res.status(400).send({
      message: "Book not found or no copies available"
    });
  }

  res.send(result);
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
