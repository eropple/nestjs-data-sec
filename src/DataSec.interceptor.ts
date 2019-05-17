import * as Bunyan from "bunyan";
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from "@nestjs/common";
import { ResponseMetadata } from "@nestjs/swagger";
import { DECORATORS as SWAGGER_DECORATORS } from "@nestjs/swagger/dist/constants";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ServerResponse } from "http";

import { RETURN_AS_KEY, DATA_FILTER_OPT_OUT_KEY } from "./constants";


/**
 * Uses `ApiModelProperty()` types to figure out what type is being returned from this
 * method, then checks that type against the _actual_ type returned for `ReturnAs()`
 * decorators. If the type in `ApiModelProperty()` is present in `ReturnAs()`
 * entries, then transforms them according to the appropriate method.
 */
@Injectable()
export class DataSecInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: Bunyan
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<any> | Promise<Observable<any>> {
    const handler = context.getHandler();

    const optedOut = Reflect.getMetadata(DATA_FILTER_OPT_OUT_KEY, handler);
    if (optedOut) {
      return next.handle();
    }

    const apiResponseData: { [code: string]: ResponseMetadata } = Reflect.getMetadata(SWAGGER_DECORATORS.API_RESPONSE, handler);

    return (
      next
        .handle()
        .pipe(
          map((v: any) => {
            const response: ServerResponse = context.switchToHttp().getResponse();
            let logger = this.logger.child({ handler: handler.name, statusCode: response.statusCode });

            const apiResponseMetadata = apiResponseData[response.statusCode.toString()];
            if (!apiResponseMetadata) {
              if (response.statusCode < 200 || 300 <= response.statusCode) {
                logger.debug("No handler available, but is an error; passing through.");
                return v;
              } else {
                // it's a valid response and we don't have a type for it, so scream and die
                logger.error("Handler returned an error code it doesn't have API metadata for.");
                throw new HttpException(`Handler metadata error.`, 500);
              }
            } else {
              const entityType = v.constructor;
              const transforms: Map<any, any> | undefined = Reflect.getMetadata(RETURN_AS_KEY, entityType);
              const desiredType = apiResponseMetadata.type;
              logger = logger.child({ entityType: entityType.name, desiredType: desiredType.name });

              if (!transforms) {
                logger.error("No transforms on entity.");
                throw new HttpException(`Handler metadata error.`, 500);
              }
              const transform = transforms.get(desiredType);

              if (!transform) {
                logger.error("Desired type has no transform on entity.");
                throw new HttpException(`Handler metadata error.`, 500);
              }

              const ret = transform(v);
              return ret;
            }
          })
        )
    );
  }
}
