"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../utils/middleware");
const db_1 = require("../db");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const jwtSecret = process.env.JWT_SECRET_WORKER;
const TOTAL_SUBMISSIONS = 100;
router.post('/payout', middleware_1.authMiddlewareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: { id: Number(userId) }
    });
    if (!worker) {
        return res.status(400).json({
            success: false,
            message: 'Worker not found'
        });
    }
    const address = worker === null || worker === void 0 ? void 0 : worker.address;
    //logic here to create a txns
    //solana.web3.createTransaction
    const tnxId = "0x123b1j3b12414";
    //should add a lock here
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount
                },
                locked_amount: {
                    increment: worker.pending_amount
                }
            }
        });
        yield tx.payouts.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: 'Processing',
                signature: tnxId
            }
        });
    }));
    //send the tnx to solana blockchain
    res.status(200).json({
        success: true,
        message: 'Processing Payout',
        amount: worker.pending_amount
    });
}));
router.get('/balance', middleware_1.authMiddlewareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    });
    if (!worker) {
        return res.status(400).json({
            success: false,
            message: 'Worker not found'
        });
    }
    res.status(200).json({
        success: true,
        pendingAmount: worker.pending_amount,
        lockedAmount: worker.locked_amount,
    });
}));
router.post('/submission', middleware_1.authMiddlewareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const userId = req.userId;
        const body = req.body;
        const parseBody = types_1.createSubmissionInput.safeParse(body);
        if (!parseBody.success) {
            return res.status(411).json({
                success: false,
                message: 'Input validation failed'
            });
        }
        const task = yield (0, db_1.getNextTask)(Number(userId));
        if (!task || (task === null || task === void 0 ? void 0 : task.id) !== Number(parseBody.data.taskId)) {
            return res.status(411).json({
                success: false,
                message: 'Incorrect task id'
            });
        }
        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS);
        const submission = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const submission = yield tx.submission.create({
                data: {
                    option_id: Number(parseBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parseBody.data.taskId),
                    amount
                }
            });
            yield tx.worker.update({
                where: {
                    id: userId,
                },
                data: {
                    pending_amount: {
                        increment: Number(amount),
                    }
                }
            });
            return submission;
        }));
        const nextTask = yield (0, db_1.getNextTask)(userId);
        res.status(200).json({
            succes: true,
            nextTask,
            amount
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error || "Server error"
        });
    }
}));
router.get('/nextTask', middleware_1.authMiddlewareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const task = yield (0, db_1.getNextTask)(Number(userId));
    if (!task) {
        res.status(411).json({
            success: false,
            message: "No more task left for you to review"
        });
    }
    else {
        res.status(200).json({
            success: true,
            task
        });
    }
}));
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //todo: add signin verification logic here
    const hardcodeWalletAddress = "HvsdhfbshdbfytGYusbdjnda1jk32v4jh23v5bk24j5msknd9j";
    const existingWorker = yield prismaClient.worker.findFirst({
        where: {
            address: hardcodeWalletAddress
        }
    });
    if (existingWorker) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingWorker.id
        }, jwtSecret);
        res.json({
            success: true,
            token
        });
    }
    else {
        const worker = yield prismaClient.worker.create({
            data: {
                address: hardcodeWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: worker.id
        }, jwtSecret);
        res.json({
            success: true,
            token
        });
    }
}));
exports.default = router;
