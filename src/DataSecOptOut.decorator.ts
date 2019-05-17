import { DATA_FILTER_OPT_OUT_KEY as DATA_SEC_OPT_OUT_KEY } from "./constants";

/**
 * A controller or handler method with this decorator will be ignored by
 * `DataSecInterceptor` and passed straight through without inspection
 * or modification.
 */
export function DataSecOptOut() {
  return (_target: any, _key: string, descriptor: any)  =>{
    if (!(descriptor.value)) {
      throw new Error("Descriptor failed to build correctly; value was undefined?")
    }

    Reflect.defineMetadata(DATA_SEC_OPT_OUT_KEY, true, descriptor.value);
  }
}
