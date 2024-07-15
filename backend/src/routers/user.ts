import 'dotenv/config'
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../utils/middleware';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'



const router = Router();
const prismaClient = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET!
const bucketName = "decentralize-web3-saas";
const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!
    }
});

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

router.get('/presignedUrl', authMiddleware, async (req, res) => {

    try {
        // @ts-ignore
        const userId = req.userId;
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: `saas-obj/${userId}/${Math.random()}/image/jpg`,
            ContentType: 'img/jpg'
        });
        // const preSignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        const { url, fields } = await createPresignedPost(s3Client, {
            Bucket: bucketName,
            Key: `saas-obj/${userId}/${Math.random()}/image/jpg`,
            Conditions: [
                ['content-length-range', 0, 5 * 1024 * 1024]
            ],
            Fields: {
                success_action_status: '201',
                'Content-Type': 'image/jpg'
            },
            Expires: 3600
        })

        res.json({
            success: true,
            preSignedUrl: url,
            fields
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            error
        })
    }
})

export default router