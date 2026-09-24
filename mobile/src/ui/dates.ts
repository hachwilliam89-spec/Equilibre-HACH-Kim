/** Calendar dates stay local: UTC conversion can shift the selected day. */
export function localDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
export function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function nextDate(value: string): string {
  const date = localDate(value);
  date.setDate(date.getDate() + 1);
  return dateValue(date);
}
export function displayDate(value: string): string {
  return value.slice(0, 10).split("-").reverse().join("/");
}
