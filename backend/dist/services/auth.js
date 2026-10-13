"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySessionToken = exports.createSessionToken = exports.verifyPassword = exports.hashPassword = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32 || secret === 'northstar_workflow_secret_2026') {
        throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
};
exports.getJwtSecret = getJwtSecret;
const hashPassword = (password) => bcryptjs_1.default.hash(password, 12);
exports.hashPassword = hashPassword;
const verifyPassword = (password, hash) => bcryptjs_1.default.compare(password, hash);
exports.verifyPassword = verifyPassword;
const createSessionToken = (user) => jsonwebtoken_1.default.sign({ sub: user.id, email: user.email }, (0, exports.getJwtSecret)(), { expiresIn: '8h', issuer: 'flownexus' });
exports.createSessionToken = createSessionToken;
const verifySessionToken = (token) => jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)(), { issuer: 'flownexus' });
exports.verifySessionToken = verifySessionToken;
