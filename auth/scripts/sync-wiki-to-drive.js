/**
 * 把本機 wiki/teachers/** 上傳到 Google Drive 根資料夾。
 * 用法：cd auth && node scripts/sync-wiki-to-drive.js
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });
process.env.PROJECT_ROOT = projectRoot;

const drive = await import('../lib/drive.js');

if (!drive.isDriveConfigured()) {
  console.error('Drive 未設定（GOOGLE_DRIVE_FOLDER_ID / 服務帳號）');
  process.exit(1);
}

const teachersRoot = path.join(projectRoot, 'wiki', 'teachers');
if (!fs.existsSync(teachersRoot)) {
  console.error('找不到', teachersRoot);
  process.exit(1);
}

const rootId = drive.getDriveFolderId();
const teachersFolder = await drive.ensureFolder(rootId, 'teachers');
console.log('Drive teachers:', teachersFolder.id);

let uploaded = 0;
const teacherDirs = fs.readdirSync(teachersRoot, { withFileTypes: true }).filter((e) => e.isDirectory());

for (const t of teacherDirs) {
  const teacherId = t.name;
  const teacherPath = path.join(teachersRoot, teacherId);
  const teacherFolder = await drive.ensureFolder(teachersFolder.id, teacherId);
  console.log(`\n→ ${teacherId}`);

  const teacherMeta = path.join(teacherPath, '_meta.json');
  if (fs.existsSync(teacherMeta)) {
    const existing = await drive.findChildByName(teacherFolder.id, '_meta.json');
    await drive.writeTextFile(
      teacherFolder.id,
      '_meta.json',
      fs.readFileSync(teacherMeta, 'utf8'),
      existing?.id || null,
    );
    uploaded += 1;
    console.log('  ✓ _meta.json');
  }

  const subjects = fs.readdirSync(teacherPath, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const s of subjects) {
    const subjectId = s.name;
    const subjectPath = path.join(teacherPath, subjectId);
    const subjectFolder = await drive.ensureFolder(teacherFolder.id, subjectId);
    console.log(`  · ${subjectId}`);

    for (const name of fs.readdirSync(subjectPath)) {
      const full = path.join(subjectPath, name);
      if (!fs.statSync(full).isFile()) continue;
      if (!(name.endsWith('.md') || name === '_meta.json')) continue;
      const existing = await drive.findChildByName(subjectFolder.id, name);
      const content = fs.readFileSync(full, 'utf8');
      if (name.endsWith('.md')) {
        await drive.upsertTeacherMarkdown(teacherId, subjectId, name, content);
      } else {
        await drive.writeTextFile(subjectFolder.id, name, content, existing?.id || null);
      }
      uploaded += 1;
      console.log(`    ✓ ${name}`);
    }
  }
}

console.log(`\n完成：上傳／更新 ${uploaded} 個檔案到 Drive。`);
console.log('網站顯示請確認本機 wiki/ 已有這些檔，並重新整理 npm run dev。');
