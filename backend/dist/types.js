"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskInput = void 0;
const zod_1 = require("zod");
exports.createTaskInput = zod_1.z.object({
    options: zod_1.z.array(zod_1.z.object({
        imageUrl: zod_1.z.string()
    })),
    title: zod_1.z.string().optional(),
    signature: zod_1.z.string()
});
