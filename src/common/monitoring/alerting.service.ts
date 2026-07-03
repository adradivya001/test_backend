import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger('OperationalAlerting');

  triggerAlert(component: string, issue: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH') {
    const timestamp = new Date().toISOString();
    const alertMessage = `[OPERATIONAL ALERT] [${severity}] [${timestamp}] Component: "${component}". Issue: "${issue}".`;
    
    // Log to standard console error for log aggregation systems (Datadog, ElasticSearch, CloudWatch, etc.)
    console.error(alertMessage);
    
    // Also use the NestJS Logger utility
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.logger.error(alertMessage);
    } else {
      this.logger.warn(alertMessage);
    }
  }
}
