import "reflect-metadata";

import { RETURN_AS_KEY } from "./constants";

/**
 * Used to control the return of entity and domain types out of controllers.
 */
export function AllowReturnAs<T>(type: { new(...args: any[]): T}, fn: (value: any) => T): ClassDecorator {
  return (<TFunction extends Function>(target: TFunction) => {
    const currentMetadata = Reflect.getMetadata(RETURN_AS_KEY, target);
    if (currentMetadata && !(currentMetadata instanceof Map)) {
      throw new Error(`Precondition: currentMetadata on class ${target.name} must be a Map.`);
    }

    const metadata = currentMetadata ? new Map(currentMetadata) : new Map();
    metadata.set(type, fn);
    Reflect.defineMetadata(RETURN_AS_KEY, metadata, target);

    return target;
  });
}
