import { linkifyText } from "../lib/linkifyText";

export default function LinkifiedText({ text, className = "" }) {
  return <span className={className}>{linkifyText(text)}</span>;
}
