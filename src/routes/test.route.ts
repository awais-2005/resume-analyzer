import { Request, Response, Router } from "express";

export const testRouter = Router();

testRouter.get("/", (req: Request, res: Response): void => {
    res.send({data: "Received"});
})