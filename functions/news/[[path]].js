import { renderSocialPage } from "../_shared/og.mjs";

export async function onRequest(context) {
  return renderSocialPage(context);
}
