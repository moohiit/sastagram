import mongoose from "mongoose";
import { Post } from "../models/post.model.js";

// Best-effort Atlas Vector Search index for semantic post search. Fails
// quietly on local/standalone MongoDB or when the index already exists —
// search then falls back to caption regex.
const ensureIndexes = async () => {
  try {
    await Post.collection.createSearchIndex({
      name: "post_embedding_index",
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "vector", path: "embedding", numDimensions: 768, similarity: "cosine" },
        ],
      },
    });
    console.log("Vector search index ensured (post_embedding_index)");
  } catch (error) {
    // "already exists" or "not supported on this deployment" — log once, move on
    console.log(`Vector search index not created: ${error.message}`);
  }
};

const connectDb = async () => {
  try {
    const response = await mongoose.connect(process.env.MONGO_URI);
    if (response) {
      console.log(`MongoDB Connected...`);
      console.log(`Host: ${response.connection.host}`);
    }
    await ensureIndexes();
  } catch (error) {
    console.log("Coonection Error: ",error);

  }
}

export default connectDb;