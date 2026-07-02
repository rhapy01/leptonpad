/** Vercel serverless entry — export Express app without listening. */
import "./loadEnv";
import app from "./app";

export default app;
