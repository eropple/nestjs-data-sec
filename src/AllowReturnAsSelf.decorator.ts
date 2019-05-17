import { AllowReturnAs } from "./AllowReturnAs.decorator";

export function AllowReturnAsSelf(): ClassDecorator {
  return <TFunction extends Function>(target: TFunction) => {
    return AllowReturnAs(target as any, (v) => v)(target);
  };
}
