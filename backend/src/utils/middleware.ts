
import 'dotenv/config'
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] ?? "";


    try {
        const decoded = jwt.verify(authHeader, process.env.JWT_SECRET!)
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next()
        } else {
            return res.status(403).json({
                success: false,
                message: 'You are not logged in'
            })
        }

    } catch (error: any) {
        return res.status(403).json({
            success: false,
            message: 'You are not logged in'
        })
    }

}