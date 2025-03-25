import {
  createFlowUnionType,
  createTSUnionType,
  createUnionTypeAnnotation,
  isFlowType,
  isTSType,
} from "@babel/types";
import type * as t from "@babel/types";

export function createUnionType(
  types: (t.FlowType | t.TSType)[],
): t.FlowType | t.TSType | undefined {
  if (process.env.BABEL_8_BREAKING) {
    if (types.every(v => isFlowType(v))) {
      return createFlowUnionType(types);
    }
    if (types.every(v => isTSType(v))) {
      return createTSUnionType(types);
    }
  } else {
    if (types.every(v => isFlowType(v))) {
      if (createFlowUnionType) {
        return createFlowUnionType(types);
      }

      return createUnionTypeAnnotation(types);
    } else if (types.every(v => isTSType(v))) {
      if (createTSUnionType) {
        return createTSUnionType(types);
      }
    }
  }
}
