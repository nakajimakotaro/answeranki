import { PrismaClient } from '@prisma/client';

// Prisma Clientのインスタンスを初期化
// アプリケーション全体でこのインスタンスを再利用します
const prisma = new PrismaClient();

export default prisma;
