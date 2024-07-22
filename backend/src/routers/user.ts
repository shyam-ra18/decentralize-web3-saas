import 'dotenv/config'
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../utils/middleware';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { createTaskInput } from '../types';
import { TOTAL_DECIMALS } from '../utils/helper';



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
const DEFAULT_TITLE = "Select the most clickable thumbnail"

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

router.post('/task', authMiddleware, async (req, res) => {
    //validate the inputs from the user
    //@ts-ignore
    const userId = req.userId
    const body = req.body;
    const parseData = createTaskInput.safeParse(body);

    if (!parseData.success) {
        return res.status(411).json({
            success: false,
            message: 'Input validation failed'
        })
    }

    //parse the signature here to ensure the person has paid whatever X amount

    try {

        const response = await prismaClient.$transaction(async tx => {
            const response = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount: 1 * TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            })

            await tx.option.createMany({
                data: parseData.data.options.map(x => ({
                    image_url: x.imageUrl,
                    task_id: response.id
                }))
            })
            return response;
        })

        res.json({
            success: true,
            id: response.id
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

router.get('/task', authMiddleware, async (req, res) => {

    //@ts-ignore
    const taskId: string = req.query.taskId;
    //@ts-ignore
    const userId: string = req.userId;

    const taskDetails = await prismaClient.task.findFirst({
        where: {
            user_id: Number(userId),
            id: Number(taskId)
        },
        include: {
            options: true
        }
    })

    if (!taskDetails) {
        return res.status(411).json({
            success: false,
            message: "You do not have access to this task"
        })
    }

    //todo: make faster
    const response = await prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId)
        },
        include: {
            option: true
        }
    })

    const result: Record<string, {
        count: number,
        option: {
            imageUrl: string
        }
    }> = {};

    taskDetails.options.forEach(option => {
        if (!result[option.id]) {
            result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url
                }
            }
        }
        else {
            result[option.id].count++
        }
    })

    response.forEach(r => {
        result[r.option_id].count++
    })

    res.status(200).json({
        success: true,
        result
    })
})

export default router