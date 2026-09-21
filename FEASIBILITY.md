# SentenceLearner × Qwerty Learner 工程可行性评估

> 版本：v1.0
> 日期：2026-09-17
> 方法：环境禁止 git clone（GitHub egress 被沙箱代理 502 拦截），改用 GitHub Contents API + Raw 文件逐层拉取真实源码后评估。

---

## 0. 结论先行

**可行，风险低，复用度高（约 70%+ 现有机制可复用）。**

推荐方案：**fork Qwerty Learner（master 分支，GPL-3.0）**，在其打字引擎之上新增"句子练习"数据层与渲染模式，而非从零新建。核心依据是：QL 的引擎本质是对"一个 `word` 字符串做字符级比对"，而**一个英文句子可以建模为一个超长的 `word`**（英文句=`name`，中文义=`trans`），并默认开启它已经做好的"默写/隐藏英文"模式（`wordDictationConfigAtom` 的 `hideAll`）。

MVP 真实新增代码量约 **3–4 人日**（熟悉 React + 该仓库的前提下）。

---

## 1. 目标仓库真实架构（已核实）

### 1.1 技术栈（`package.json` 核实）
- React 18.2 + ReactDOM，react-router-dom 6.8（路由）
- **状态管理：jotai 2.0.3**（原子化，新增状态只需加 atom，耦合极低）
- **已依赖 `xlsx` 0.18.5** → 导入 `template.xlsx` 零额外成本
- **已依赖 `howler` + `use-sound`**（音效）+ 朗读 hook `usePronunciation`
- **已依赖 `dexie` + `dexie-react-hooks` + `dexie-export-import`**（IndexedDB 本地持久化，错词本底层）
- `react-hotkeys-hook`（快捷键）、`@radix-ui/*` + `tailwindcss`（UI）、`echarts`（统计页）、`framer-motion`/`animate.css`（动效）、`immer`/`use-immer`（不可变更新）、`lucide-react`（图标，含 `Volume2` 喇叭图标）

### 1.2 目录结构（已核实 `src/`）
```
src/
├── pages/
│   ├── Typing/                ← 核心打字练习页
│   │   ├── index.tsx          ← 编排组件（加载词、接线 reducer、渲染）
│   │   ├── store/             ← 页内 jotai store + typingReducer
│   │   ├── hooks/
│   │   │   ├── useWordList.ts ← 按 Dictionary.url 取词、切章
│   │   │   └── useConfetti.ts
│   │   └── components/
│   │       ├── WordPanel/     ← 渲染当前 word + 比对（核心引擎入口）
│   │       │   ├── index.tsx
│   │       │   └── components/Word.tsx ← 字符级比对 + 强制纠错（引擎核心）
│   │       ├── ResultScreen/  ← 完成结算（正确率/WPM）
│   │       ├── Progress/      ← 进度条
│   │       ├── WordDictationSwitcher/ ← 默写模式开关
│   │       ├── PronunciationSwitcher/ ← 发音(美/英)切换
│   │       └── ...（Setting/Switcher/WordList/ErrorBookButton 等）
│   ├── ErrorBook/             ← 错词本页（可复用作错句本）
│   ├── Analysis/              ← 数据统计页（可复用）
│   └── ...
├── components/
│   ├── WordPronunciationIcon/ ← 现成朗读图标（SoundIcon/VolumeIcon）
│   └── ...
├── resources/
│   ├── dictionary.ts          ← 词库注册表（103KB，id→Dictionary）
│   └── soundResource.ts       ← 音效资源映射
├── store/index.ts             ← 全局 jotai atoms（关键配置都在这）
├── typings/                   ← 类型定义（Word / Dictionary / 等）
└── utils/db/                  ← dexie 数据库（记录/复习数据）
```

### 1.3 核心数据模型（已核实 `src/typings`）
```ts
type Word = {
  name: string        // 英文（单词或句子）
  trans: string[]     // 中文释义（复数）
  usphone: string     // 美语音标
  ukphone: string     // 英语音标
  notation?: string
}

type Dictionary = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string         // 指向词库 JSON（Word[]）
  length: number
  language: LanguageType        // 含 'en' | 'code' | 'de' | 'ja' ...
  languageCategory: LanguageCategoryType
  chapterCount: number
  defaultPronIndex?: number
}
```
**重大利好**：`LanguageType` 已内置 `'code'`（代码词库，如 C# API）与 `'de'`（德语）。说明引擎本就按"语言单元"而非"英文单词"设计，句子只是另一种语言单元，泛化成本低。

### 1.4 关键 store（已核实 `src/store/index.ts`）
- `currentDictIdAtom` / `currentDictInfoAtom`：当前词库（解析 `idDictionaryMap`）
- `currentChapterAtom`：当前章节
- `wordDictationConfigAtom`：`{ isOpen, type: 'hideAll' | 'hideVowel' | 'hideConsonant' | 'randomHide' }` —— **`hideAll` 即"隐藏英文只显中文"，正是我们要的显示逻辑，已现成**
- `pronunciationConfigAtom`：`{ isOpen, volume, type:'us'|'uk', rate, isTransRead }` —— TTS/发音配置（含语速、美英音）
- `reviewModeInfoAtom` / `isReviewModeAtom`：错词复习模式（错句本可直接复用）
- `isIgnoreCaseAtom`：忽略大小写（句子模式需评估是否开启）

---

## 2. 引擎实际运行机制（已核实 `useWordList.ts` + `WordPanel`）

1. **取词**：`useWordList()` 读取 `currentDictInfo.url`，用 SWR + `wordListFetcher` 拉 JSON，按 `CHAPTER_LENGTH` 切章，返回 `WordWithIndex[]`。
2. **渲染**：`Typing/index.tsx` 把 `words` 灌入 `typingReducer`，`WordPanel` 渲染 `state.chapterData.words[index]` 这一个 `word`。
3. **比对**：`WordPanel/components/Word.tsx`（引擎核心）对 `word.name` 做**逐字符比对**，打错必须重打（强制纠错）；支持空格（词间）与标点。
4. **显示**：`WordPanel` 同时渲染 `Phonetic`（音标）与 `Translation`（`trans.join('；')` 中文）。`hideAll` 模式下 `Word` 组件隐藏英文 `name`，只显中文。
5. **推进**：当前 word 完成后 `onFinish` → `NEXT_WORD`；整章完成 → `ResultScreen` 结算 + `useSaveChapterRecord` 写 dexie。

**核心洞察**：引擎以"单个 word 字符串"为最小训练单位并做字符级处理。句子 = 一个包含空格/标点的长 `word.name`。因此：
- 句子可直接套用现有比对、强制纠错、WPM、正确率、`Progress`、`ResultScreen`、错词本。
- 只需把"单词级音标/逐词发音"替换为"整句 TTS 朗读"，并把 `hideAll` 作为句子模式的默认显示。

---

## 3. 插入点清单（具体到文件）

| 需求 | 复用 / 新增 | 具体文件 / 做法 |
|------|-------------|----------------|
| 句子词库 | 新增（结构复用） | 新增 `src/resources/sentenceLibraries.ts`（镜像 `dictionary.ts`），句子 JSON：`{name:英文句, trans:[中文义]}`；`idSentenceMap` 注册 |
| 导入 `template.xlsx` | 复用+少量 | 用已装的 `xlsx` 解析 `resource/template.xlsx` 5 列 → 生成句子 JSON / 或直接注入 dexie；写 `src/utils/sentenceImport.ts` |
| 显示中文、隐藏英文 | **直接复用** | 句子模式默认 `wordDictationConfigAtom.type='hideAll'`（`Word` 组件已支持隐藏 `name` 只显 `trans`） |
| 逐字符比对 + 强制纠错 | **直接复用** | `WordPanel/components/Word.tsx` 无需改（句子=长 `word.name`） |
| 小喇叭读整句（TTS） | 新增 hook | 新增 `useSentenceTTS(text)`：`window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`（Web Speech API，离线免费无密钥）；接线到 `WordPronunciationIcon` 或新 `SentenceSoundIcon` |
| 实时统计（WPM/正确率） | **直接复用** | `Progress` + `ResultScreen` + `typingReducer` |
| 错句本 | 复用+扩展 | `ErrorBook` 页 + `utils/db` 记录类型扩展为含 `sentenceId`；复习模式 `reviewModeInfoAtom` 复用 |
| 初级/高级分级（≤15/>15） | 新增 | 计算 `wordCount = name.split(/\s+/).length`；在 `Dictionary.tags` 或新增 `level` 字段标注；选择器加筛选（`DictChapterButton` 类比） |
| 路由/页面 | 新增（低风险） | 新增 `src/pages/SentenceTyping`（镜像 `Typing`），复用其 `hooks/useWordList`、`components/WordPanel`、store；或新增 `practiceModeAtom('word'|'sentence')` 在 `Typing` 内分支 |
| 快捷键 | 复用 | `react-hotkeys-hook`（Ctrl+J 发音等思路沿用） |

---

## 4. 推荐实现路径（MVP）

**MVP 范围（PRD 第 10 章已定）**：导入 Excel → 显示中文 → 打字 → 小喇叭朗读 → 实时字符反馈 → 统计 + 下一题。

步骤：
1. 新增句子数据层：`sentenceLibraries.ts` + 由 `template.xlsx` 生成的初始句子 JSON（`level` 字段已算好）。
2. 新增 `src/pages/SentenceTyping`，复制 `Typing` 页面骨架，把 `useWordList` 的数据源切到句子库；默认开启 `hideAll`。
3. 新增 `useSentenceTTS` hook + 句子朗读按钮（复用 `SoundIcon`/`VolumeIcon` UI）。
4. 在 `SentenceTyping` 隐藏 `Phonetic`（句子无逐词音标）、关闭逐词音频预取（`usePrefetchPronunciationSound`）。
5. `level` 标注 + 初级/高级筛选器。
6. 错句本：扩展 `utils/db` 记录，复用 `ErrorBook` 页。

**第二阶段**：填空式"提示"、分类筛选、统计页、TTS 设置（美/英音、语速用 `pronunciationConfigAtom.rate`）。
**第三阶段（可选）**：造句模式（用户自写句+AI 评分，参考 EatWords）、替换/形态/转换句型训练（参考 FSI-Type-Drill）、VSCode 插件、Supabase 云同步。

---

## 5. 风险登记

| 风险 | 等级 | 说明 / 缓解 |
|------|------|-------------|
| `Word.tsx` 对超长 `name` 的渲染假设 | 中 | 引擎按字符比对，空格/标点本就是字符，理论上兼容；**实现前需读 `WordPanel/components/Word.tsx` 确认无"单词级"硬假设**（如按空格拆词显示的逻辑）。建议先用 1 句冒烟测试。 |
| 大小写/标点严格匹配 | 低 | 句子含专有名词需大写、需标点。`isIgnoreCaseAtom` 可调；标点容忍策略 MVP 可要求精确输入（强化肌肉记忆），后续可放宽。 |
| TTS 音质因浏览器/OS 而异 | 低 | Web Speech API 离线免费，MVP 够用；用户已有 edge-tts 经验，可二期升级（与 pm-english 项目一致）。 |
| 移动端不支持 | 低 | QL 明确 `IsDesktop()` 拦截移动端；用户场景为桌面键盘工作者，契合。 |
| GPL-3.0 合规 | 低但必须 | fork 须保留 GPL-3.0、开源修改。用户接受开源，但需知会：衍生作品须同样以 GPL 发布。 |
| 仓库复杂度 | 低 | 属中型 React 项目，新增均为"加法"，不破坏现有单词模式。 |

---

## 6. 工作量与可行性评级

- **可行性**：✅ 高（架构与需求高度耦合，关键能力已现成）
- **新增代码量（MVP）**：约 3–4 人日（数据层 ~1d + 页面接线复用 ~1d + TTS hook ~0.5d + 分级/筛选 ~0.5d + 错句本扩展 ~1d）
- **复用比例**：约 70–80%（比对引擎、强制纠错、统计、错词本、快捷键、音频基础设施、xlsx 依赖）
- **最大新增点**：整句 TTS（Web Speech API，约 30 行）+ 句子数据模型与导入。

> 备选方案（仅作对照）：fork **TypeWords**（已有文章跟打底座）接 **EatWords** 造句逻辑；或自研。QL 路径复用度最高、风险最低，故推荐。

---

## 附录：核实过的真实源码事实（避免凭记忆）
- 默认分支：`master`（非 `main`）；仓库近期活跃（2026-08/09 仍有提交）。
- 状态管理是 **jotai**（不是 zustand/redux），全局配置集中在 `src/store/index.ts`。
- 词库加载：`useSWR(currentDictInfo.url, wordListFetcher)` + `wordList.slice(chapter*CHAPTER_LENGTH, ...)`。
- 默写模式枚举：`'hideAll' | 'hideVowel' | 'hideConsonant' | 'randomHide'`。
- 朗读图标组件接收 `word: Word`，内部用 `usePronunciationSound(word.name)`。
- `LanguageType` 含 `'code'`、`'de'`（德语），证明引擎支持非纯英文单词单元。