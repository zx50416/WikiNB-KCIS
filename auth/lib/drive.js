/**
 * Google Drive 儲存層（老師筆記真實來源）
 *
 * 環境變數：
 * - GOOGLE_DRIVE_FOLDER_ID：Shared Drive／資料夾 ID（必填）
 * - GOOGLE_SERVICE_ACCOUNT_FILE：服務帳號 JSON 路徑（建議）
 * - 或 GOOGLE_SERVICE_ACCOUNT_JSON：服務帳號 JSON 字串
 *
 * 未設定憑證時 isDriveConfigured()=false，wiki.js 會退回本機快取並提示。
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { getGoogleAccessToken, resolveServiceAccountPath } from './google-auth.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export function getDriveFolderId() {
  return String(process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
}

export function isDriveConfigured() {
  if (!getDriveFolderId()) return false;
  if (String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()) return true;
  const p = resolveServiceAccountPath();
  return Boolean(p && fs.existsSync(p));
}

async function getAccessToken() {
  return getGoogleAccessToken(DRIVE_SCOPE);
}

async function driveFetch(url, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      detail = JSON.parse(text)?.error?.message || text;
    } catch {
      /* ignore */
    }
    throw new Error(`Drive API ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function supportsAllDrives(params = {}) {
  return {
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    ...params,
  };
}

function toQuery(params) {
  const q = new URLSearchParams(supportsAllDrives(params));
  return q.toString();
}

/** 在 parent 下找名為 name 的資料夾；沒有則建立 */
export async function ensureFolder(parentId, name) {
  const safeName = String(name).replace(/'/g, "\\'");
  const q = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listed = await driveFetch(
    `${DRIVE_API}/files?${toQuery({ q, fields: 'files(id,name)', pageSize: '5' })}`,
  );
  if (listed?.files?.length) return listed.files[0];

  return driveFetch(`${DRIVE_API}/files?${toQuery({ fields: 'id,name' })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

export async function listChildren(parentId, { mimeType } = {}) {
  let q = `'${parentId}' in parents and trashed=false`;
  if (mimeType) q += ` and mimeType='${mimeType}'`;
  const listed = await driveFetch(
    `${DRIVE_API}/files?${toQuery({
      q,
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: '200',
      orderBy: 'name',
    })}`,
  );
  return listed?.files || [];
}

export async function findChildByName(parentId, name) {
  const safeName = String(name).replace(/'/g, "\\'");
  const q = `name='${safeName}' and '${parentId}' in parents and trashed=false`;
  const listed = await driveFetch(
    `${DRIVE_API}/files?${toQuery({ q, fields: 'files(id,name,mimeType)', pageSize: '5' })}`,
  );
  return listed?.files?.[0] || null;
}

export async function readFileText(fileId) {
  return driveFetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`);
}

export async function writeTextFile(parentId, filename, content, existingFileId = null) {
  const metadata = {
    name: filename,
    mimeType: 'text/markdown',
  };
  if (!existingFileId) metadata.parents = [parentId];

  const boundary = `wikinb_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/markdown; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const token = await getAccessToken();
  const url = existingFileId
    ? `${UPLOAD_API}/files/${existingFileId}?${toQuery({ uploadType: 'multipart', fields: 'id,name' })}`
    : `${UPLOAD_API}/files?${toQuery({ uploadType: 'multipart', fields: 'id,name' })}`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive 寫入失敗 ${res.status}: ${text}`);
  }
  return res.json();
}

export async function deleteFile(fileId) {
  const id = String(fileId || '').trim();
  if (!id) return { ok: true, skipped: true };
  try {
    await driveFetch(`${DRIVE_API}/files/${id}?${toQuery({})}`, {
      method: 'DELETE',
    });
    return { ok: true };
  } catch (err) {
    const msg = String(err.message || err);
    // Shared Drive 上永久刪除偶發 404；改丟進垃圾桶
    if (/404|not found/i.test(msg)) {
      try {
        await driveFetch(`${DRIVE_API}/files/${id}?${toQuery({ fields: 'id,trashed' })}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
        return { ok: true, trashed: true };
      } catch (err2) {
        const msg2 = String(err2.message || err2);
        if (/404|not found/i.test(msg2)) return { ok: true, skipped: true, reason: 'already-gone' };
        throw err2;
      }
    }
    // 其他錯誤：再試 trash 一次
    try {
      await driveFetch(`${DRIVE_API}/files/${id}?${toQuery({ fields: 'id,trashed' })}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
      return { ok: true, trashed: true };
    } catch {
      throw err;
    }
  }
}

export async function deleteTeacherMarkdown(teacherId, subjectId, filename) {
  const ids = await getTeacherSubjectFolderIds(teacherId, subjectId, { create: false });
  if (!ids) return { ok: true, skipped: true, reason: 'no-folder' };

  let file = await findChildByName(ids.subjectFolderId, filename);
  if (!file) return { ok: true, skipped: true, reason: 'not-on-drive' };

  try {
    await deleteFile(file.id);
  } catch (err) {
    // 再找一次（可能 ID 過期）；仍失敗則視為已不在 Drive（本機刪除仍會做）
    file = await findChildByName(ids.subjectFolderId, filename);
    if (!file) return { ok: true, skipped: true, reason: 'already-gone' };
    const msg = String(err.message || err);
    if (/404|not found/i.test(msg)) {
      return { ok: true, skipped: true, reason: 'already-gone' };
    }
    throw err;
  }

  // 確認同名檔已不在
  const still = await findChildByName(ids.subjectFolderId, filename);
  if (still) {
    try {
      await deleteFile(still.id);
    } catch {
      /* ignore */
    }
  }

  return { ok: true, filename, path: `teachers/${teacherId}/${subjectId}/${filename}` };
}

/**
 * 確保 wiki 根結構：
 * {DRIVE_ROOT}/teachers/{teacherId}/_meta.json
 * {DRIVE_ROOT}/teachers/{teacherId}/general/_meta.json
 */
export async function provisionTeacherOnDrive({ teacherId, nickname, name }) {
  if (!isDriveConfigured()) {
    return { ok: false, skipped: true, reason: 'Drive 未設定' };
  }
  const rootId = getDriveFolderId();
  const teachers = await ensureFolder(rootId, 'teachers');
  const teacherFolder = await ensureFolder(teachers.id, teacherId);
  const displayName = String(nickname || name || teacherId).trim();

  const metaName = '_meta.json';
  const existingMeta = await findChildByName(teacherFolder.id, metaName);
  const metaJson = JSON.stringify(
    {
      id: teacherId,
      name: displayName,
      displayName,
      subjects: ['general'],
      status: 'active',
    },
    null,
    2,
  );
  await writeTextFile(teacherFolder.id, metaName, metaJson, existingMeta?.id || null);

  const subjectFolder = await ensureFolder(teacherFolder.id, 'general');
  const subjectMetaName = '_meta.json';
  const existingSubjectMeta = await findChildByName(subjectFolder.id, subjectMetaName);
  const subjectMeta = JSON.stringify(
    {
      id: 'general',
      name: '一般筆記',
      nameEn: 'General',
      teacherId,
      keywords: [displayName, '一般筆記'],
    },
    null,
    2,
  );
  await writeTextFile(
    subjectFolder.id,
    subjectMetaName,
    subjectMeta,
    existingSubjectMeta?.id || null,
  );

  return {
    ok: true,
    teacherId,
    folderId: teacherFolder.id,
    path: `teachers/${teacherId}`,
  };
}

export async function updateTeacherDisplayNameOnDrive(teacherId, displayName) {
  if (!isDriveConfigured()) return { ok: false, skipped: true };
  const rootId = getDriveFolderId();
  const teachers = await ensureFolder(rootId, 'teachers');
  const teacherFolder = await ensureFolder(teachers.id, teacherId);
  const existingMeta = await findChildByName(teacherFolder.id, '_meta.json');
  let meta = { id: teacherId, subjects: ['general'], status: 'active' };
  if (existingMeta) {
    try {
      meta = { ...meta, ...JSON.parse(await readFileText(existingMeta.id)) };
    } catch {
      /* ignore */
    }
  }
  meta.name = displayName;
  meta.displayName = displayName;
  await writeTextFile(
    teacherFolder.id,
    '_meta.json',
    JSON.stringify(meta, null, 2),
    existingMeta?.id || null,
  );
  return { ok: true };
}

export async function getTeacherSubjectFolderIds(teacherId, subjectId, { create = true } = {}) {
  const rootId = getDriveFolderId();
  if (create) {
    const teachers = await ensureFolder(rootId, 'teachers');
    const teacherFolder = await ensureFolder(teachers.id, teacherId);
    const subjectFolder = await ensureFolder(teacherFolder.id, subjectId);
    return { teacherFolderId: teacherFolder.id, subjectFolderId: subjectFolder.id };
  }
  const teachers = await findChildByName(rootId, 'teachers');
  if (!teachers) return null;
  const teacherFolder = await findChildByName(teachers.id, teacherId);
  if (!teacherFolder) return null;
  const subjectFolder = await findChildByName(teacherFolder.id, subjectId);
  if (!subjectFolder) return null;
  return { teacherFolderId: teacherFolder.id, subjectFolderId: subjectFolder.id };
}

/**
 * 列出科目下 .md。預設不建立資料夾（列表用），避免對空科目狂打 Drive。
 * 寫入請用 upsert（create:true）。
 */
export async function listTeacherMarkdownFiles(teacherId, subjectId, { create = false } = {}) {
  const ids = await getTeacherSubjectFolderIds(teacherId, subjectId, { create });
  if (!ids) return [];
  const files = await listChildren(ids.subjectFolderId);
  return files
    .filter((f) => f.name?.endsWith('.md') && f.mimeType !== 'application/vnd.google-apps.folder')
    .map((f) => ({
      id: f.id,
      filename: f.name,
      slug: f.name.replace(/\.md$/i, ''),
      modifiedTime: f.modifiedTime,
      path: `teachers/${teacherId}/${subjectId}/${f.name}`,
    }));
}

export async function readTeacherMarkdown(teacherId, subjectId, slug) {
  const ids = await getTeacherSubjectFolderIds(teacherId, subjectId, { create: false });
  if (!ids) throw new Error(`找不到科目資料夾：${subjectId}`);
  const filename = `${slug}.md`;
  const file = await findChildByName(ids.subjectFolderId, filename);
  if (!file) throw new Error(`找不到 ${filename}`);
  const content = await readFileText(file.id);
  return { id: file.id, filename, content, path: `teachers/${teacherId}/${subjectId}/${filename}` };
}

export async function upsertTeacherMarkdown(teacherId, subjectId, filename, content) {
  const { subjectFolderId } = await getTeacherSubjectFolderIds(teacherId, subjectId, { create: true });
  const existing = await findChildByName(subjectFolderId, filename);
  const saved = await writeTextFile(subjectFolderId, filename, content, existing?.id || null);
  return {
    ok: true,
    id: saved.id,
    filename,
    path: `teachers/${teacherId}/${subjectId}/${filename}`,
    storage: 'google-drive',
  };
}

export function getDriveStatus() {
  return {
    configured: isDriveConfigured(),
    folderId: getDriveFolderId() || null,
    serviceAccountFile: resolveServiceAccountPath() || null,
  };
}
