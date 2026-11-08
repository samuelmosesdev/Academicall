/** "Good morning" / "Good afternoon" / "Good evening" for the viewer's local time. */
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
export function todayLabel(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}
