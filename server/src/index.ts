import express from "express";
import cors from "cors";
import { uploadroute } from "./route/upload.js";

const app=express();
app.use(express.json());

app.use(cors({
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST"],
}));

app.use("/api",uploadroute);

app.listen(3000);
