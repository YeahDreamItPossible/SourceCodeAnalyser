import { dataToEsm } from "@rollup/pluginutils";
import { SPECIAL_QUERY_RE } from "../constants";
import type { Plugin } from "../plugin";
import { stripBomTag } from "../utils";

export interface JsonOptions {
  /**
   * Generate a named export for every property of the JSON object
   * @default true
   */
  namedExports?: boolean;
  /**
   * Generate performant output as JSON.parse("stringified").
   * Enabling this will disable namedExports.
   * @default false
   */
  stringify?: boolean;
}

// Custom json filter for vite
const jsonExtRE = /\.json(?:$|\?)(?!commonjs-(?:proxy|external))/;

const jsonLangs = `\\.(?:json|json5)(?:$|\\?)`;
const jsonLangRE = new RegExp(jsonLangs);
export const isJSONRequest = (request: string): boolean =>
  jsonLangRE.test(request);

// JSON插件
// 作用:
// 将 json 文件转换成 esm
export function jsonPlugin(
  options: JsonOptions = {},
  isBuild: boolean
): Plugin {
  return {
    name: "vite:json",

    transform(json, id) {
      if (!jsonExtRE.test(id)) return null;
      if (SPECIAL_QUERY_RE.test(id)) return null;

      json = stripBomTag(json);

      try {
        if (options.stringify) {
          if (isBuild) {
            return {
              // during build, parse then double-stringify to remove all
              // unnecessary whitespaces to reduce bundle size.
              code: `export default JSON.parse(${JSON.stringify(
                JSON.stringify(JSON.parse(json))
              )})`,
              map: { mappings: "" },
            };
          } else {
            return `export default JSON.parse(${JSON.stringify(json)})`;
          }
        }

        const parsed = JSON.parse(json);
        return {
          code: dataToEsm(parsed, {
            preferConst: true,
            namedExports: options.namedExports,
          }),
          map: { mappings: "" },
        };
      } catch (e) {
        const position = extractJsonErrorPosition(e.message, json.length);
        const msg = position
          ? `, invalid JSON syntax found at position ${position}`
          : `.`;
        this.error(`Failed to parse JSON file` + msg, position);
      }
    },
  };
}

export function extractJsonErrorPosition(
  errorMessage: string,
  inputLength: number
): number | undefined {
  if (errorMessage.startsWith("Unexpected end of JSON input")) {
    return inputLength - 1;
  }

  const errorMessageList = /at position (\d+)/.exec(errorMessage);
  return errorMessageList
    ? Math.max(parseInt(errorMessageList[1], 10) - 1, 0)
    : undefined;
}
