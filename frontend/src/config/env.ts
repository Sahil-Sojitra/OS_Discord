import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1, 'NEXT_PUBLIC_API_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parseEnv = () => {
  const envVars = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  const result = envSchema.safeParse(envVars);
  if (!result.success) {
    console.error('❌ Frontend environment configuration validation failed:');
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });

    if (typeof window === 'undefined') {
      process.exit(1);
    } else {
      throw new Error(
        `Frontend env validation failed: ${result.error.issues.map((e) => e.message).join(', ')}`
      );
    }
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
