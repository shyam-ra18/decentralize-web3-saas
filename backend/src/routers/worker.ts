import 'dotenv/config'
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from 'jsonwebtoken'
import { authMiddlewareWorker } from '../utils/middleware';
import { getNextTask } from '../db';
import { createSubmissionInput } from '../types';
import { TOTAL_DECIMALS } from '../utils/helper';

const router = Router();
const prismaClient = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET_WORKER!
const TOTAL_SUBMISSIONS = 100;

router.post('/payout', authMiddlewareWorker, async (req, res) => {
    //@ts-ignore
    const userId: string = req.userId;
    const worker = await prismaClient.worker.findFirst({
        where: { id: Number() }
    })

    if (!worker) {
        return res.status(400).json({
            success: false,
            message: 'Worker not found'
        })
    }
    const address = worker?.address

    //logic here to create a txns
    //solana.web3.createTransaction
    const tnxId = "0x123b1j3b12414";

})

router.get('/balance', authMiddlewareWorker, async (req, res) => {
    // @ts-ignore
    const userId: string = req.userId;

    const worker = await prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    })

    if (!worker) {
        return res.status(400).json({
            success: false,
            message: 'Worker not found'
        })
    }

    res.status(200).json({
        success: true,
        pendingAmount: worker.pending_amount,
        lockedAmount: worker.locked_amount,

    })

})

router.post('/submission', authMiddlewareWorker, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const body = req.body;
        const parseBody = createSubmissionInput.safeParse(body);

        if (!parseBody.success) {
            return res.status(411).json({
                success: false,
                message: 'Input validation failed'
            })
        }

        const task = await getNextTask(Number(userId))
        if (!task || task?.id !== Number(parseBody.data.taskId)) {
            return res.status(411).json({
                success: false,
                message: 'Incorrect task id'
            })
        }

        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS);

        const submission = await prismaClient.$transaction(async tx => {

            const submission = await tx.submission.create({
                data: {
                    option_id: Number(parseBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parseBody.data.taskId),
                    amount
                }
            })

            await tx.worker.update({
                where: {
                    id: userId,
                },
                data: {
                    pending_amount: {
                        increment: Number(amount),
                    }
                }
            })

            return submission
        })


        const nextTask = await getNextTask(userId);

        res.status(200).json({
            succes: true,
            nextTask,
            amount
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error || "Server error"
        })
    }

})

router.get('/nextTask', authMiddlewareWorker, async (req, res) => {
    //@ts-ignore
    const userId: string = req.userId;
    const task = await getNextTask(Number(userId))

    if (!task) {
        res.status(411).json({
            success: false,
            message: "No more task left for you to review"
        })
    }
    else {
        res.status(200).json({
            success: true,
            task
        })
    }
})

router.post('/signin', async (req, res) => {
    //todo: add signin verification logic here
    const hardcodeWalletAddress = "HvsdhfbshdbfytGYusbdjnda1jk32v4jh23v5bk24j5msknd9j";

    const existingWorker = await prismaClient.worker.findFirst({
        where: {
            address: hardcodeWalletAddress
        }
    })

    if (existingWorker) {
        const token = jwt.sign({
            userId: existingWorker.id
        }, jwtSecret)

        res.json({
            success: true,
            token
        })

    } else {
        const worker = await prismaClient.worker.create({
            data: {
                address: hardcodeWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        })
        const token = jwt.sign({
            userId: worker.id
        }, jwtSecret)

        res.json({
            success: true,
            token
        })
    }

})

export default router