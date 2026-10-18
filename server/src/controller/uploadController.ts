import type { Response, Request } from "express";
import { PDFParse } from "pdf-parse";
import { scgpa } from "../py-service/calculateSgpa.js";

type sub={
    code:string,
    name:string,
    grade:string
}

async function uploadcontroller(req: Request, res: Response) {
    try {
        if (!req.file) return res.status(400).json({ message: "file not found" });
        const parser = new PDFParse({ data: req.file.buffer });
        const data = await parser.getText();
        const regex = /^(?<title>.+?)\s+(?<code>\d?[A-Z]{2,3}\d*-?\d*#?)\s+(?<mid>\d+)(?:\s+(?<end>\d+))?\s*\*?\s*(?<grade>[A-F]\+*)\s*$/gm;
        const subjects:sub[]=[...data.text.matchAll(regex)].map(m=>({
            code:m.groups!.code!,
            name:m.groups!.title!,
            grade:m.groups!.grade!,
        }))
        const result=scgpa(subjects);
        res.status(200).json({
            message:result
        })
        await parser.destroy();
    }
    catch (e) {
        console.log(e);
        res.status(500).json({
            message: "something wrong"
        })
    }
}

export { uploadcontroller };