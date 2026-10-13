import mongoose from "mongoose";

export async function connectDatabase() {
    const uri = process.env.MONGODB_URI;
    if(!uri) {
        console.error("MONGODB_URI is not defined in environment variables.");
        process.exit(1);
    }

    try{
        mongoose.set('strictQuery', true);
        await mongoose.connect(uri);
        console.log(`[database] Connected to MongoDB: ${mongoose.connection.name}`)

    }

    catch(error) {
        console.error(`[database] Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
}

export async function disconnectDatabase() {
    await mongoose.connection.close();
    console.log("[database] MongoDB connection closed.");
}