# SentenceLearner 概要设计说明书 (HLD-lite) v1.0

> 范围说明: 本项目是本地优先单页 Web 应用, fork 自 Qwerty Learner (QL), 在其打字引擎之上扩展"中译英句子练习"。无后端、无服务器数据库, 数据存浏览器 IndexedDB。因此本 HLD 只做"模块边界 + 技术选型 + 集成点", 不展开企业级部署/网络架构。

## 1. 系统定位
- 目标: 通过"看中文 → 写英文 → 听发音 → 纠错 → 复习"循环, 把工作常用英文句子的拼写、语序、语感练成肌肉记忆。
- 形态: 开源 Web 应用 (GPL-3.0), 本地优先, 后续可选 VSCode 插件。
- 约束: 桌面端为主 (QL 明确拦截移动端, 正契合用户 PC 练习场景)。

## 2. 技术选型 (沿用 QL, 已核实依赖)
| 层 | 选型 | 备注 |
|----|------|------|
| 框架 | React 18 + TypeScript + Vite + Tailwind CSS | 继承 QL |
| 状态管理 | jotai | 原子化, 新增状态只加 atom, 耦合低 |
| 本地存储 | dexie (IndexedDB 封装) | QL 已依赖 |
| Excel 解析 | xlsx 0.18.5 | QL 已依赖, 导入 template.xlsx 零成本 |
| 音频播放 | howler + use-sound | QL 已依赖 (单词朗读) |
| 整句语音合成 | Web Speech API (speechSynthesis) | 离线/免费/无密钥, MVP 新增 |
| 许可 | GPL-3.0 | 衍生作品须同协议开源 (见 ADR-002) |

## 3. 模块划分 (相对 QL 的新增/改动)
- **句子数据层**: `src/resources/sentenceLibraries.ts` + 由 xlsx 生成的 `sentences.json`
- **练习页 (复制 Typing)**: `src/pages/SentenceTyping/` (`index.tsx`, `hooks/useSentenceList.ts`, `components/SentencePanel/`)
- **整句 TTS hook**: `src/hooks/useSentenceTTS.ts`
- **错句本扩展**: `src/pages/ErrorBook/` (复用 QL, 扩展记录类型 `sentence`)
- **统计/分级**: 复用 QL `Progress` + `ResultScreen`, 新增 `level` 字段筛选
- **设置**: 复用 `pronunciationConfigAtom` (rate / us / uk)
- **保留不动**: QL 原有单词模式、词典、VSCode 插件框架

## 4. fork 集成点 (已核实的插入位置)
| 能力 | 接入点 | 做法 |
|------|--------|------|
| 路由 | QL 路由表 | 新增 `/sentence` → `SentenceTyping` |
| 数据加载 | `useWordList` | 仿写 `useSentenceList`, 数据源从 `dictionary.url` 切到 `sentences.json` |
| 默写模式 | `wordDictationConfigAtom` | 默认 `type='hideAll'` (只显中文, 隐英文) |
| 打字引擎 | `WordPanel` / `Word.tsx` | 句子 = 超长 `word`, 复用字符级比对 + 强制纠错 |
| 朗读 | `WordPronunciationIcon` | UI 复用, 事件改为调用 `useSentenceTTS` 朗读整句 |

## 5. 组件树 (MVP 练习页)
```
App → Router → SentenceTyping
  ├─ LevelSwitch        (初级/高级)
  ├─ CategoryFilter     (分类筛选)
  ├─ ChinesePrompt      (中文意思, hideAll 模式)
  ├─ SentencePanel      (逐字符输入 + 红绿反馈, 复用 Word.tsx)
  ├─ ActionBar          (朗读 / 提示 / 提交 / 收藏 / 下一题)
  └─ StatsBar           (WPM / 正确率 / 进度, 复用 Progress + ResultScreen)
```
详细交互见 `LLD.md`、`wireframe-practice.svg` (v2 宽松版)。

## 6. 非功能需求
- 离线可用: 句子库本地导入, 数据存 IndexedDB。
- 响应: 按键反馈 < 100ms。
- 兼容: Chrome / Edge / Firefox 现代版本。
- 隐私: 默认不上传用户数据。