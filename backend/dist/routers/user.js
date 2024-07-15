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
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //todo: add signin verification logic here
    const hardcodeWalletAddress = "HvsdhfbshdbfytGYusbdjnda1jk32v4jh23v5bk24j5msknd9j";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: hardcodeWalletAddress
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
                address: hardcodeWalletAddress
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
            url,
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
exports.default = router;
