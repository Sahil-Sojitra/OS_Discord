import dotenv from 'dotenv';
import { z } from 'zod';

// Load env variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string({
    required_error: 'MONGO_URI is required',
  }),
  FRONTEND_URL: z.string({
    required_error: 'FRONTEND_URL is required',
  }),
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required',
  }),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment configuration validation failed:');
    result.error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
