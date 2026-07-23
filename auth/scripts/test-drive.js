/**
 * 本機測試 Google Drive 連線（讀寫 teachers/ 與 kainnne 資料夾）
 * 用法：cd auth && node scripts/test-drive.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
process.env.PROJECT_ROOT = path.resolve(__dirname, '../..');

const drive = await import('../lib/drive.js');

console.log('Drive status:', drive.getDriveStatus());
if (!drive.isDriveConfigured()) {
  console.error('尚未設定服務帳號 JSON');
  process.exit(1);
}

try {
  const root = drive.getDriveFolderId();
  const teachers = await drive.ensureFolder(root, 'teachers');
  console.log('✓ teachers 資料夾:', teachers.id);
  const result = await drive.provisionTeacherOnDrive({
    teacherId: 'kainnne',
    nickname: 'kainnne',
    name: 'Kaine',
  });
  console.log('✓ provision kainnne:', result);
  console.log('請到 Google Drive 的 wiki/teachers/kainnne 確認。');
} catch (err) {
  console.error('✗ 失敗:', err.message);
  console.error('請確認已把服務帳號加進 Drive 成員（Content manager）。');
  process.exit(2);
}
