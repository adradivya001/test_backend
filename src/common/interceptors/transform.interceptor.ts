import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    // Do not transform responses from workflow endpoints
    if (request.url.includes('/workflows') || request.url.includes('/api/workflows')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
