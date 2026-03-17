/**
 * 必须在任何读取 process.env 的模块之前加载，确保 .env 已生效
 */
import dotenv from 'dotenv';
dotenv.config();
