/**
 * Shared Type Definitions
 * 
 * Note: To keep project setup simple and avoid the complexity of monorepo packages,
 * types are duplicated across frontend and backend. Keep frontend and backend
 * type definition files manually in sync.
 */

export interface HealthCheckResponse {
  status: 'OK';
  timestamp: string;
  environment: string;
  uptime: number;
}
