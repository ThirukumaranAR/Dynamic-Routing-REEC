"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_readline_1 = require("node:readline");
const node_crypto_1 = require("node:crypto");
const db_1 = require("../services/db");
const auth_1 = require("../services/auth");
const ask = (question) => new Promise(resolve => {
    const readline = (0, node_readline_1.createInterface)({ input: process.stdin, output: process.stdout });
    readline.question(question, answer => {
        readline.close();
        resolve(answer.trim());
    });
});
const askHidden = (question) => new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
        reject(new Error('A terminal is required to securely enter the initial password.'));
        return;
    }
    process.stdout.write(question);
    let value = '';
    const stdin = process.stdin;
    const onData = (buffer) => {
        for (const char of buffer.toString('utf8')) {
            if (char === '\r' || char === '\n') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                process.stdout.write('\n');
                resolve(value);
                return;
            }
            if (char === '\u0003') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                reject(new Error('Password entry cancelled.'));
                return;
            }
            if (char === '\u007f' || char === '\b')
                value = value.slice(0, -1);
            else if (char >= ' ')
                value += char;
        }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
});
const main = async () => {
    await (0, db_1.connectDatabase)();
    const existing = await db_1.prisma.user.findFirst({ where: { role: 'CHAIRMAN', isActive: true } });
    if (existing)
        throw new Error('An active Chairman already exists. No account was changed.');
    const name = await ask('Initial Chairman full name: ');
    const email = (await ask('Initial Chairman email: ')).toLowerCase();
    const dept = (await ask('Department [Executive Office]: ')) || 'Executive Office';
    const password = await askHidden('Initial password (input hidden): ');
    if (!name || !email || password.length < 12) {
        throw new Error('Name and email are required; password must contain at least 12 characters.');
    }
    const emailExists = await db_1.prisma.user.findUnique({ where: { email } });
    if (emailExists)
        throw new Error('That email address is already registered.');
    const id = (0, node_crypto_1.randomUUID)();
    const now = new Date().toISOString();
    await db_1.prisma.user.create({
        data: {
            id,
            name,
            email,
            passwordHash: await (0, auth_1.hashPassword)(password),
            role: 'CHAIRMAN',
            dept,
            company: 'FlowNexus',
            businessUnit: 'Executive Office',
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    });
    await (0, db_1.writeAuditEvent)({
        actorId: id,
        actorName: name,
        actorRole: 'CHAIRMAN',
        action: 'Initial Chairman account bootstrapped',
        targetType: 'User',
        targetId: id
    });
    console.log('Initial Chairman account created. The password was not stored or displayed.');
};
main().then(() => process.exit(0)).catch(error => {
    console.error(error instanceof Error ? error.message : 'Chairman bootstrap failed.');
    process.exit(1);
});
