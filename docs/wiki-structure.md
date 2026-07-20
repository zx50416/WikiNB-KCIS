# Wiki 資料夾結構速查

完整需求與資安見 [REQUIREMENTS_AND_TECH.md](./REQUIREMENTS_AND_TECH.md)。

## 目錄樹

```text
wiki/
├── README.md
├── index.md
└── teachers/
    └── {teacher_id}/
        ├── _meta.json
        └── {subject_id}/
            ├── _meta.json
            └── {note-slug}.md
```

## 固定 keywords

每個科目與每篇筆記都應能對應：

1. **老師名字**（顯示用）→ frontmatter `teacher` / meta `name`
2. **科目**（顯示用）→ frontmatter `subject` / meta `name`

技術 id：`teacher_id`、`subject_id`（路徑用 slug）。

## 筆記 frontmatter 最小集合

```yaml
---
title: 標題
description: 一句話
teacher: 陳老師
teacher_id: demo-chen
subject: 數學
subject_id: math
keywords:
  - 陳老師
  - 數學
status: published
date: YYYY-MM-DD
---
```

## 狀態

| status | 含義 |
|--------|------|
| `draft` | 僅老師可見（登入實作後強制） |
| `published` | 學生／搜尋可見 |

初版網站為方便預覽，會顯示 `published` 筆記；尚未做權限過濾。

## 命名

- `teacher_id` / `subject_id` / 檔名：小寫英文、數字、`-`
- 顯示名稱：繁體中文放在 meta／frontmatter
