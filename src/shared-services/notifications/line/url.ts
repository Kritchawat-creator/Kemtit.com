/**
 * ลิงก์ที่ส่งใน LINE ต้องเปิดใน browser หลักของเครื่อง ไม่ใช่ in-app browser ของ LINE (R3)
 * → ต่อ openExternalBrowser=1 ทุกครั้ง ห้ามประกอบ URL เอง
 */
export function lineOpenUrl(appUrl: string, path = "/dashboard"): string {
  const url = new URL(path, appUrl.endsWith("/") ? appUrl : `${appUrl}/`);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}
