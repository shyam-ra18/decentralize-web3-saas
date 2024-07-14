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
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const jwtSecret = process.env.JWT_SECRET;
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
exports.default = router;
