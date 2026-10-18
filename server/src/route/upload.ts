import { Router } from "express";
import { uploadcontroller } from "../controller/uploadController.js";
import { upload } from "../utilites/multer.js";
const uploadroute=Router();

uploadroute.post("/upload",upload.single("file"),uploadcontroller);
export {uploadroute};