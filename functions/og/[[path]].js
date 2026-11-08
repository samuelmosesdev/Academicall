import { proxyOgImage } from "../_shared/og.mjs";

export async function onRequest(context) {
  return proxyOgImage(context);
}
