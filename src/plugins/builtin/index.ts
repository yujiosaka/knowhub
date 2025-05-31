import { HttpPlugin } from "./http.js";
import { LocalPlugin } from "./local.js";

export type { LocalPluginConfig } from "./local.js";
export { LocalPlugin } from "./local.js";
export type { HttpPluginConfig } from "./http.js";
export { HttpPlugin } from "./http.js";

export const plugins = [new LocalPlugin(), new HttpPlugin()];
