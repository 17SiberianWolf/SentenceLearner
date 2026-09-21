# SentenceLearner · 本地 Ollama 集成规划（第三期 · 修订版 v2）

> 状态：P0 已上线（2026-09-20），P1 已上线（2026-09-21）。P2（自适应生成 / 可选 AI 评分）待实施。
> 修订要点：从「AI 评分」**重心转为「AI 辅助造句学习」**——Ollama 主要扮演** drills 教练 / 句型拆解讲师 / 薄弱点诊断师**，AI 评分降级为可选子功能（锦上添花）。
> 目标：不联网、不依赖云端 API，用本机 Ollama 帮用户**真的学会造句**，而非仅仅判对错。

---

## 1. 为什么重写：从"裁判"到"教练"

上一版把 Ollama 定位成"智能评分器"（分数 + 改写 + 逐错 + 评语）。用户指出：

> 对于 Ollama 的应用，更重要的是如何**专注于使用它更好地辅助用户学习造句**。AI 评分属于锦上添花。

这一定位调整是关键。精确字符匹配（写对/写错二值）已经能"判分"；但"学会造句"需要的是**方法、重复、反馈、诊断**，而非一个分数。调研开源项目后确认：最贴合"辅助造句学习"的范式是 **FSI（Foreign Service Institute） drills 法**——通过同一句型的反复替换/转换操练，把语法变成"语言反射"。

本版规划据此重排优先级（见第 4 节）。

---

## 2. 开源调研结论（参考项目与可借鉴点）

| 项目 | 栈 | 对本项目的启发 |
|---|---|---|
| **[FSI-Type-Drill](https://github.com/rtyrtyrtyqw/FSI-Type-Drill)** | 单 `index.html` + 本地 Ollama | **核心范式**。灵感来自 Qwerty Learner + FSI 教学法。三大训练级：① Simple（替换词）② Morphology（换人称/时态）③ Transformation（肯定↔否定↔疑问）；**闭环补强**：模型检测到错误即生成针对性练习；薄弱点看板（时态/语序/介词/冠词/词汇 5 类）；TTS 听打合一；模型自动探测+一键切换 |
| **[/fsi (phunterlau)](https://github.com/phunterlau/fsi)** | Claude Code skill | **drills 设计哲学**：5 阶段生命周期（引导→换题→替换操练→情境输出→复盘）；约束"Wrong. Repeat."式短反馈、drill 响应单行、无评判压力、被动进步、SRS 穿插复习、每轮变换 chunk 避免重复 |
| **[SentenceMaker](https://github.com/Performant-Labs/sentence-maker)** | Python + Ollama + spaCy | **自适应生成**：本地 LLM 从词表 + 54 个语法模板生成语义连贯、覆盖词汇的练习句；启发"按薄弱点生成新句" |
| **ChatGPT 语言学习 Prompt 法** | Prompt 工程 | **关键认知**："只纠错不解释不产生学习，解释过的纠错才会"；语法导师 prompt = 解释规则 + 公式 + 高亮例句 + 常见错误 + 记忆口诀 + 即时小测 |
| **[FluentU 语言学习法](https://fluentu.com/blog/learn/chatgpt-for-language-learning)** | 方法论 | **逐词拆解**（给一句怪句，解释每个词角色+整体结构）、**生成测验/翻译练习**、分级阅读材料 |
| **[Companion](https://github.com/shakedzy/companion)** | 生成式 AI 私教 | "写/说/读/听"四位一体私人导师；印证"导师问答"形态 |
| **[grammar-fixer-ollama-gemma3](https://github.com/64BitAsura/grammar-fixer-ollama-gemma3)** | **Node + Ollama** | `fixGrammar(text,{model,host})` → `localhost:11434`，结构化 JSON —— 印证本项目用 Node 零依赖代理可行（上一版已确认） |
| **Qwerty Learner（原型）** | React+TS | 已内置离线 AI 口语 Leo；证明"本地模型 + 英语学习"路线可行 |

**核心结论**：
1. 本项目的"教练"能力应建立在 **FSI drills（替换/转换操练）+ 闭环补强 + 薄弱点诊断** 之上，AI 评分只是其副产品。
2. 延续"零依赖原生前端 + 零依赖 Node 代理（serve.js）"路线；浏览器只调同源 `8787`，由 Node 转发 `11434`，免 CORS、数据不出本机。
3. prompts 与 UI 上下文强相关，放前端 `coach.js`；serve.js 只做传输 + 探活 + 统一选项。

---

## 3. 架构与数据流

```
┌──────────────────────────────────────────────────────────────┐
│ 浏览器 (index.html + app.js + coach.js，serve.js 同源 :8787)   │
│                                                                │
│  练习页 / 句型训练页(升级为 FSI Drills 主场)                    │
│   ├─ 卡壳 → 【渐进提示梯】 coach.hint()                        │
│   ├─ 提交 → 精确判分(现有) + 【句型拆解讲解】 coach.breakdown() │
│   ├─ 写错 → 【闭环补强】 coach.remedial() 生成针对性变体        │
│   ├─ 句型页 → 【FSI Drills】 同句型无限变体逐个敲              │
│   └─ 任意时刻 → 【导师问答】 coach.tutor() 追问"为什么"         │
│         │  fetch  POST /api/ollama/chat  (同源，无 CORS)       │
│         ▼                                                      │
├──────────────────────────────────────────────────────────────┤
│ serve.js  (Node 零依赖)                                        │
│   /api/ollama/chat   → body {model, messages, task, json, temp}│
│   /api/ollama/status → 探活 + 列出已装模型                      │
│         │  Node 全局 fetch (Node 22)                           │
│         ▼                                                      │
│   Ollama 本机  http://127.0.0.1:11434                          │
│     POST /api/chat (model, format≈json, temperature 按 task)   │
│         │  结构化 JSON                                         │
│         ▼                                                      │
│   serve.js 透传 → 前端 coach.js 解析渲染                        │
└──────────────────────────────────────────────────────────────┘
```

- **Ollama 端点**：默认 `http://127.0.0.1:11434`，可用 `OLLAMA_HOST` 覆盖（服务端，前端不感知）。
- **通用 chat 端点**：前端 `coach.js` 按 `task` 组装 `messages`，serve.js 仅转发并统一 `temperature`/`format`。结构化任务（`drill/hint/breakdown/remedial/generate/grade`）请求 `json:true`。
- **模型名**：默认 `qwen2.5:7b`（讲解/教练质量优先）；高频 drill 生成可用 `qwen2.5:3b`（延迟更低）。由设置传入。

---

## 4. 功能地图（按学习价值重排优先级）

### P0 — 核心：辅助造句（必做）
| 功能 | 说明 | 来源范式 |
|---|---|---|
| **1. 渐进提示梯（Scaffolding）** | 用户卡壳/留空时，AI 给**升级式提示**而非直接给答案：①关键词 → ②句型骨架(带空) → ③近完整句。教"怎么想出来" | FluentU 拆解 + ChatGPT 导师法 |
| **2. 句型拆解讲解（Pattern Breakdown）** | 显示答案时，AI 解释该句：语法结构/公式、各词角色、常见错误、记忆口诀。对应"explain why" | ChatGPT 语法导师 prompt |
| **3. FSI Drills（替换/转换操练）** | 句型训练页升级：AI 围绕一个句型生成**无限变体**（换主语/时态/肯否疑），用户逐个敲，形成语感。三种模式：Substitution / Morphology / Transformation | FSI-Type-Drill 三大级 |

### P1 — 强化：闭环与诊断
| 功能 | 说明 | 来源范式 |
|---|---|---|
| **4. 闭环补强（Remedial）** | 用户写错 → AI 诊断薄弱点类别 → 自动生成针对该类的变体练习，"从错误中即时修正" | FSI-Type-Drill 闭环补强 |
| **5. 薄弱点诊断看板** | 错误按 5 类（时态/语序/介词/冠词/词汇）归类统计，驱动"接下来练什么" | FSI-Type-Drill 看板 |
| **6. 导师问答（Tutor Q&A）** | 对任意句子/知识点追问"为什么这么写"，AI 自然解释（可多轮） | Companion / /fsi |

### P2 — 增强（可选）
| 功能 | 说明 | 来源范式 |
|---|---|---|
| **7. 自适应练习句生成** | 按用户水平/薄弱点，AI 用模板生成新练习句，扩充句子库（离线模板为兜底） | SentenceMaker |
| **8. AI 评分（锦上添花）** | 分数+改写+逐错+中文评语；仅在用户主动需要时触发，不阻塞主流程 | 上一版规划（降级为此） |

---

## 5. 前端改动概览

### 5.1 新增 `coach.js`（前端，零依赖）
- **状态**：`coachState`（当前 drill session / 当前 hint 梯级 / 薄弱点计数）。
- **Prompt 库**：`buildMessages(task, payload)`（`task` ∈ drill/hint/breakdown/remedial/tutor/generate/grade）。
- **调用**：`callCoach(task, payload)` → POST `/api/ollama/chat` → 防御性解析 JSON → 回调。
- **设置**：`aiEnabled`、`ollamaModel`（默认 `qwen2.5:7b`）、持久化 `localStorage`（`sl_ai_*`）。
- **探活**：启动 + 设置变更时 `fetch('/api/ollama/status')` → 更新状态灯。

### 5.2 练习页（app.js / index.html）
- 卡壳 → 「提示」按钮触发 `coach.hint()`，分 3 级展示（骨架用 `.pc-ex` 类复用）。
- 提交（精确判分后）→ 自动 `coach.breakdown()` 渲染"句型拆解"面板（与现有 `.answer-card` 复用）。
- 写错 → 自动 `coach.remedial()` 生成 1–3 个针对性变体，作为"再来一题"选项。
- 答案区新增「问 AI 教练」输入框（导师问答）。

### 5.3 句型训练页（升级为 FSI Drills 主场）
- 选一个 pattern → 「开始 Drill」→ AI 生成变体 cue 序列（Substitution/Morphology/Transformation 三模式可选）。
- 逐题敲：精确匹配（忽略大小写/空格）判对 → 撒花进入下一变体；判错 → 显示期望句 + 可选 remedial。
- `patterns.js` 现有固定模板保留为**离线兜底**；联网时由 AI 生成无限变体。
- TTS 复用：`听打合一`（每题自动朗读目标变体）。

### 5.4 styles.css
- `.coach-panel` / `.hint-ladder`(3 级) / `.breakdown`(结构/公式/口诀分区) / `.weakness-board`(5 类进度条) / `.drill-cue` / `.ai-status-dot`(绿/灰)。

---

## 6. Prompt 模板（coach.js 内）

> 所有结构化任务要求"**只输出一个 JSON 对象，无额外文字**"；服务端做防御性括号配对解析。

### 6.1 渐进提示梯 `hint`
```
System: 你是英文造句教练。用户看到中文想写英文但卡住了。
给定目标中文与(可选)参考答案，输出 3 级提示 JSON：
{ "level1_keywords": "本句必须用到的核心英文词/短语，逗号分隔",
  "level2_skeleton": "句型骨架，用 ___ 表示待填词，如 'I ___ a book yesterday.'",
  "level3_near": "补全到只剩 1-2 个词，如 'I read a ___ yesterday.'" }
User: 目标中文：{target}  参考答案：{reference}
```

### 6.2 句型拆解讲解 `breakdown`
```
System: 你是语法讲师。给定中文含义与用户写出的英文句，输出拆解 JSON：
{ "pattern": "句型公式，如 'Subj. + be + V-ing + Obj.'",
  "structure": ["逐词/短语的角色说明，如 'I=主语', 'am reading=现在进行时谓语'"],
  "mnemonic": "一句记忆口诀",
  "pitfalls": ["学习者常犯的错误 1-2 条"] }
User: 目标中文：{target}  我的英文：{text}  参考答案：{reference}
```

### 6.3 FSI Drills 生成 `drill`
```
System: 你是 FSI 操练设计师。给定基础句与模式(mode)，生成 5-8 个同句型变体。
mode=substitution: 仅换词汇; morphology: 换主语(I/He/They)或时态; transformation: 肯定↔否定↔疑问。
输出 JSON：{ "base": "...", "mode": "...",
  "cues": [ {"transform":"改成过去式","expect":"..."}, ... ] }
User: 基础句：{base}  模式：{mode}
```

### 6.4 闭环补强 `remedial`
```
System: 用户在某类错误上反复出错(category∈时态/语序/介词/冠词/词汇)。
基于原句与该类别，生成 3 个针对练习的小句(同错误类型)。
输出 JSON：{ "category":"...", "drills":[ {"zh":"中文","en":"参考答案"}, ... ] }
User: 原句：{text}  错误类别：{category}
```

### 6.5 导师问答 `tutor`（非结构化，自然语言多轮）
```
System: 你是耐心的英文教练，用中文解释，必要时给公式+高亮例句+口诀。
保持简短(≤120 字)，鼓励为主。
User: {用户问题，可附带当前句子上下文}
```

### 6.6 自适应生成 `generate`（P2）
```
System: 给定用户水平(CEFR)与薄弱类别，用语法模板生成 5 个新练习句。
输出 JSON：{ "sentences":[ {"zh":"中文提示","en":"参考","level":"A2"} ] }
```

### 6.7 AI 评分 `grade`（P2，可选）
沿用上一版评分 prompt（verdict/score/corrected/errors/comment），仅在用户主动触发时调用。

---

## 7. 后端改动：serve.js（通用代理，替换原 /grade）

```js
// ---- Ollama 代理（通用） ----
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

if (p === '/api/ollama/status') {
  (async () => {
    try {
      const r = await fetch(OLLAMA_HOST + '/api/tags', { signal: AbortSignal.timeout(3000) });
      const j = await r.json();
      sendJson(res, 200, { ok: true, models: (j.models || []).map(m => m.name) });
    } catch (e) { sendJson(res, 200, { ok: false, error: String(e.message || e) }); }
  })();
  return;
}

if (p === '/api/ollama/chat') {
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > MAX_BODY) req.destroy(); });
  req.on('end', () => {
    let body; try { body = JSON.parse(raw); } catch (e) { sendJson(res, 400, { error: 'invalid json' }); return; }
    const model = body.model || 'qwen2.5:7b';
    const temp = (typeof body.temp === 'number') ? body.temp : 0.3;
    (async () => {
      try {
        const r = await fetch(OLLAMA_HOST + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: false, temperature: temp,
            messages: body.messages,
            format: body.json ? 'json' : undefined,
          }),
          signal: AbortSignal.timeout(60000),
        });
        const j = await r.json();
        sendJson(res, 200, { ok: true, content: (j.message && j.message.content) || '' });
      } catch (e) { sendJson(res, 200, { ok: false, error: String(e.message || e) }); }
    })();
  });
  return;
}
```

> 即使 Ollama 连不上也返回 `200 + {ok:false,error}`，前端据此降级，不抛网络异常。

---

## 8. 与现有功能的关系

- **patterns.js**：保留为离线兜底；联网时 `drill` 任务生成无限变体，二者并存。
- **精确判分 / 撒花**：仍是主流程判分与正反馈；AI 讲解/提示/补强**叠加其上**，不替代。
- **间隔重复(SR) / 错句本**：
  - **AI 评分 verdict 不写入 SR**（保持间隔重复逻辑干净）。
  - **新增**：薄弱点类别计数（5 类）存 `localStorage(sl_weakness)`，**仅用于驱动"接下来练什么"的排序**，不污染 SR 掌握度。
  - *（此点为相对上版的调整，需对齐确认，见第 10 节）*
- **TTS 自动朗读**：复用于 FSI drills 的"听打合一"。

---

## 9. 默认模型与配置

- 默认 `qwen2.5:7b`（讲解/教练质量）；高频 drill 生成可用 `qwen2.5:3b`（延迟更低）。
- 设置面板：AI 开关、模型名、端点（展示用）。持久化 `sl_ai_*`。
- 状态灯：绿点+模型名 / 灰点+"Ollama 未连接，请先 `ollama pull qwen2.5:7b`"。

---

## 10. 决策记录（已对齐 ✅，2026-09-20 Grill Me）

上版 Grill Me 已对齐 7 项；范式调整后经本次 Grill Me 重新确认如下（其余 4 项不变）：

| # | 分支 | 决定 |
|---|---|---|
| 1 | 架构 | serve.js 代理（浏览器→8787→Node fetch→11434），零前端依赖、免 CORS |
| 2 | 触发/评分定位 | **AI 评分降级为可选触发**；主交互改为提示梯/拆解/FSI Drills（教练而非裁判） |
| 3 | 范围 | 练习页 + 句型训练页都接 |
| 4 | 默认模型 | qwen2.5:7b（讲解质量优先）；drill 高频生成可用 qwen2.5:3b |
| 5 | 反馈默认 | **显示答案时默认展示句型拆解（可折叠）** |
| 6 | 入库 | 评分 verdict 不写 SR；**薄弱点 5 类计数允许入库**（localStorage `sl_weakness`，仅诊断、不记对错、不污染掌握度，用于驱动练习排序） |
| 7 | 设置/降级 | 设置面板 + 状态灯 |
| 8 | 首版范围 | **P0 全做**：serve.js 代理 + 设置/状态灯 + 渐进提示梯 + 句型拆解 + FSI Drills（三模式）；P1 闭环补强/看板/问答、P2 自适应生成/评分 后续迭代 |

---

## 11. 降级与错误处理（4 条路径）

- Ollama 未装/未启 → `/status` 返回 `ok:false` → 状态灯灰 + 按钮禁用 + 提示安装命令。
- 模型未拉取 → chat 返回 `ok:false` → 提示 `ollama pull <model>`。
- JSON 解析失败 → 防御性括号配对 + 回退友好文案（"AI 暂未返回规范结果，请重试/换模型"）。
- 超时(60s) → 提示换更小模型或重试。
- **离线兜底**：`patterns.js` 固定模板 + 现有精确判分始终可用，AI 全挂也不影响基本练习。

---

## 12. 验收标准（按优先级）

1. **P0-提示梯**：练习页卡壳点「提示」，出现 3 级升级提示，且最后一级接近答案但不直接给全句。
2. **P0-拆解**：提交后答案区展示句型公式+词角色+口诀，中文准确。
3. **P0-FSI Drills**：句型页可选模式生成变体，逐题敲、精确匹配判对撒花、错显期望句。
4. **P1-补强**：写错后自动生成 1–3 个同类变体"再来一题"可练。
5. **P1-看板**：5 类薄弱点计数正确累加并显示。
6. **P2-评分（可选）**：主动触发可得分数+改写+逐错+评语，且不写入 SR。
7. 状态灯正确反映连接/模型；设置刷新保持；`node --check serve.js`/`app.js`/`coach.js` 通过；无新增 npm 依赖。

---

## 13. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 小模型 JSON 不稳 | 防御性解析 + 回退；讲解类任务容忍度更高（可非严格 JSON） |
| 本地推理延迟(数秒) | 异步 + 加载态；drill 生成可预取下一题 |
| 中文 prompt/评语乱码 | 全程 UTF-8；serve.js 已设 charset |
| 用户没装 Ollama | 状态灯 + 安装指引；离线兜底保证基本功能 |
| 代理被滥用 | 仅 127.0.0.1 监听，不外网暴露；仅转发白名单 task |

---

## 14. 实施阶段（建议顺序，确认后编码）

1. **serve.js 通用代理**：`/api/ollama/status` + `/api/ollama/chat`（替换 /grade）；`node --check`。
2. **coach.js 骨架 + 设置/状态灯**：prompt 库 + `callCoach` + 探活 + `localStorage`。
3. **P0-提示梯**：练习页「提示」按钮 + 3 级渲染（风险最低、学习价值最高，先做）。
4. **P0-句型拆解**：提交后 `breakdown` 面板。
5. **P0-FSI Drills**：句型页升级为三模式变体操练 + remedial 入口。
6. **P1-薄弱点看板 + 导师问答**。
7. **P2-自适应生成 + AI 评分（可选）**。
8. **联调与降级**：浏览器走通"装好/未装/未拉模型/超时"四路径。

---

## 15. 参考项目链接

- FSI-Type-Drill：https://github.com/rtyrtyrtyqw/FSI-Type-Drill
- /fsi (phunterlau)：https://github.com/phunterlau/fsi
- SentenceMaker：https://github.com/Performant-Labs/sentence-maker
- ChatGPT 语言学习 Prompt 法：https://plugmonkey.xyz/prompt/chatgpt-prompts-for-language-learning
- FluentU 语言学习法：https://fluentu.com/blog/learn/chatgpt-for-language-learning
- Companion：https://github.com/shakedzy/companion
- grammar-fixer-ollama-gemma3：https://github.com/64BitAsura/grammar-fixer-ollama-gemma3
- Qwerty Learner（原型）：https://github.com/RealKai42/qwerty-learner

---

## 16. 实现进度（与决策记录）

### P0（2026-09-20 上线）
- `serve.js` 通用 Ollama 代理：`/api/ollama/status`（探活）+ `/api/ollama/chat`（透传）；`store` 白名单加 `sl_weakness`。
- `coach.js`（新增）：`window.Coach` 模块，含 hint / breakdown / drill / remedial / tutor / generate / grade 七类 prompt；防御性 JSON 解析；状态灯。
- 练习页：渐进提示梯 + 句型拆解（默认可折叠）；写错自动归类薄弱点。
- 句型页：FSI Drills（替换/换人称时态/肯否疑转换）+ 写错闭环补强。
- 统计页：薄弱点诊断看板（时态/语序/介词/冠词/词汇 5 类计数）。
- 设置 + 状态灯联动。

### P1（2026-09-21 上线，经 Grill Me 对齐：三项全做 / 补强手动触发 / 导师多轮 / 看板一键开练）
- **④ 练习页闭环补强**：写错后答案区出现「🔧 智能补强」按钮，手动点才调 `remedial` 生成 1–3 个同类变体，作为内联小测（写完点「检查」看答案，无 SR 副作用）。
- **⑤ 薄弱点看板驱动开练**：看板顶部按最弱类别推荐对应 FSI Drill 模式（时态→Transformation / 语序→Morphology / 介词·冠词·词汇→Substitution），「针对最弱项开练」按钮一键跳句型页自动开 Drill。
- **⑥ 导师问答**：练习页答案区折叠面板 `askTutor`（多轮，history 存内存、刷新清空），自动带当前句中文/标准英文/用户原写作为上下文。
- `coach.js` 重构：`callCoach` 拆出 `rawChat`，新增 `buildTutorMessages` / `askTutor` 支持多轮；`window.Coach` 暴露 `askTutor`。

### P2（待实施）
- ④ 自适应生成（`generate`）：按薄弱点 + 水平生成新练习句。
- ⑥ 可选 AI 评分（`grade`）：仅作锦上添花，默认关闭。
- 闭环补强 UI 进一步打磨、薄弱点看板与 SRS 联动细化。

