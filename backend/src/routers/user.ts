import 'dotenv/config'
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from 'jsonwebtoken'


const router = Router();
const prismaClient = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET!

router.post('/signin', async (req, res) => {
    //todo: add signin verification logic here
    const hardcodeWalletAddress = "HvsdhfbshdbfytGYusbdjnda1jk32v4jh23v5bk24j5msknd9j";

    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: hardcodeWalletAddress
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, jwtSecret)

        res.json({
            success: true,
            token
        })

    } else {
        const user = await prismaClient.user.create({
            data: {
                address: hardcodeWalletAddress
            }
        })
        const token = jwt.sign({
            userId: user.id
        }, jwtSecret)

        res.json({
            success: true,
            token
        })
    }

})

export default router