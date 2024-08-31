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
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types");
const helper_1 = require("../utils/helper");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const jwtSecret = process.env.JWT_SECRET;
const bucketName = "decentralize-web3-saas";
const s3Client = new client_s3_1.S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});
const DEFAULT_TITLE = "Select the most clickable thumbnail";
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //todo: add signin verification logic here
    // const hardcodeWalletAddress = "HvsdhfbshdbfytGYusbdjnda1jk32v4jh23v5bk24j5msknd9j";
    const address = req.body.signature;
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: address
        }
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id
        }, jwtSecret);
        res.json({
            success: true,
            token
        });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: address
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id
        }, jwtSecret);
        res.json({
            success: true,
            token
        });
    }
}));
router.get('/presignedUrl', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const userId = req.userId;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucketName,
            Key: `saas-obj/${userId}/${Math.random()}/image/jpg`,
            ContentType: 'img/jpg'
        });
        // const preSignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
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
        });
        res.json({
            success: true,
            preSignedUrl: url,
            fields
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error
        });
    }
}));
router.post('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //validate the inputs from the user
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parseData = types_1.createTaskInput.safeParse(body);
    if (!parseData.success) {
        return res.status(411).json({
            success: false,
            message: 'Input validation failed'
        });
    }
    //parse the signature here to ensure the person has paid whatever X amount
    try {
        const response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const response = yield tx.task.create({
                data: {
                    title: (_a = parseData.data.title) !== null && _a !== void 0 ? _a : DEFAULT_TITLE,
                    amount: 1 * helper_1.TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            });
            yield tx.option.createMany({
                data: parseData.data.options.map(x => ({
                    image_url: x.imageUrl,
                    task_id: response.id
                }))
            });
            return response;
        }));
        res.json({
            success: true,
            id: response.id
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}));
router.get('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const taskId = req.query.taskId;
    //@ts-ignore
    const userId = req.userId;
    const taskDetails = yield prismaClient.task.findFirst({
        where: {
            user_id: Number(userId),
            id: Number(taskId)
        },
        include: {
            options: true
        }
    });
    if (!taskDetails) {
        return res.status(411).json({
            success: false,
            message: "You do not have access to this task"
        });
    }
    //todo: make faster
    const response = yield prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId)
        },
        include: {
            option: true
        }
    });
    const result = {};
    taskDetails.options.forEach(option => {
        if (!result[option.id]) {
            result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url
                }
            };
        }
        else {
            result[option.id].count++;
        }
    });
    response.forEach(r => {
        result[r.option_id].count++;
    });
    res.status(200).json({
        success: true,
        result
    });
}));
exports.default = router;
