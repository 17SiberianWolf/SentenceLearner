# 开发记录（Changelog）

按阶段记录 SentenceLearner 的真实开发过程。更细的每日日志见 `.workbuddy/memory/`（不入库）。

## 阶段 0 · 立项与设计（2026-09-18）

- 评估范围：本地优先 SPA（fork Qwerty Learner 思路，无后端），不做企业级全套设计文档。
- 产出精简设计文档：`HLD.md`（模块边界+集成点）、`LLD.md`（练习流程状态机+句子→词适配+分级算法）、`DATA_MODEL.md`（存储 schema+句子 JSON+Excel 映射）、`ADR.md`（fork/GPL/TTS/存储/句子建模决策）、`FEASIBILITY.md`。

## 阶段 1 · MVP（2026-09-18）

- 因无外网，无法 clone QL，改为**自包含可运行 MVP**（忠实实现已核实的引擎逻辑 + 设计文档），易移植到 QL fork。
- 数据：Python/openpyxl 读 `template.xlsx` → `sentences.js`（162 初级句，21 分类，含 id/category/en/zh/audioUrl/wordCount/level/wrongCount）。
- 文件：`index.html` / `styles.css` / `app.js` / `engine.js`（浏览器+node 双用） / `sentences.js` / `smoke.test.js`。
- 流程闭环：中文提示 → 逐字符输入（绿/红+强制纠错）→ 朗读（TTS）→ 提示 → 提交 → 收藏 → 下一题；初/高级筛选；实时正确率/WPM；错句/收藏落 `localStorage`。
- 验证：node `smoke.test.js` 全绿（19 词长句字符流、分级、错误定位、空格处理、partial pending）；`engine.js`/`app.js` 语法检查通过。
- 初版问题修复：① 布局自适应（长句撑出横向滚动条）；② 英文原文默认显示且无输入框 → 改为默认只显示中文、加可见 textarea、答案区默认隐藏。

## 阶段 2 · 体验完善（2026-09-18）

- 语速下拉框（0.5–1.5×，默认 0.9×）；「提交/看答案」拆分为两个独立按钮（显示答案=只展示原文供抄写不判分；提交=判分并锁定）。
- 掌握度判定：不用提示 & 不看答案 & 一次手写正确 = 掌握（不进错句本）；用过提示/看过答案/写错 = 进错句本。
- 新增页面：错句本、统计、句子库。

## 阶段 3 · 句子库与语料扩充（2026-09-18）

- 句子库页：浏览/筛选/导入（手动+JSON+文件 xlsx/csv）/删自定义；`xlsx-read.js` 零依赖自写 xlsx 解析器（DecompressionStream + 手写 zip/deflate）。
- 高级长句材料（`gen_advanced.js` → `advanced.js`，40 句，>15 词，11 分类）。
- life-vocab-app 语料加工（`gen_life_sentences.js` → `life_sentences.js`，120 句=80 初+40 高，22 分类；并导出 `life_sentences.xlsx` 零依赖写入器）。内置池达 162+40+120 = 322 句。

## 阶段 4 · 本地文件存储（2026-09-18）

- 决策：本地文件 > 浏览器缓存；保留缓存兜底 + 一键启动器。
- `serve.js`：零依赖 Node http 服务，落盘 `data/store.json`（原子写）、防路径穿越、监听 127.0.0.1:8787、启动开浏览器。
- `start.bat` / `start.sh` 一键启动器（用受管 Node 绝对路径、无 BOM 纯 ASCII，规避早期 BOM 吃掉命令的坑）。
- app.js 存储层：server 优先 + 防抖 `schedulePersist` + `initStorage()` 服务端权威合并浏览器缓存；右上角 `#storeBadge` 状态徽标。

## 阶段 5 · 间隔重复（2026-09-18）

- 轻量遗忘曲线：未掌握→立即到期且进错句本；掌握→间隔 [1,3,7,15,30,60,120] 天递增，reps 封顶 7。
- 练习页「🔁 复习模式」复选框；新增独立「复习」页签（今日待复习 / 共计划；看原文 / 复习 / 一键开始）。

## 阶段 6 · 句型训练（纯模板版）（2026-09-18）

- 「句型」页签：口头交流 / 商务邮件两方向；完整造句 + 句型填空双模式，约 80 题。
- `patterns.js`：每 pattern 含 title/pattern/note/examples/items；`gap` 为 en 唯一子串（数据层保证）；双模式归一化比对（去大小写/多余空格/结尾标点）。
- 进度自包含（`sl_pat_master` / `sl_pat_wrong`），不污染全局错句本/复习/统计。

## 阶段 7 · 反馈与体验增强（2026-09-18 → 2026-09-20）

- 修复句型页例句 `[object Object]`（examples 是 {en,zh} 对象，原代码误 `escapeHtml(x)` 作用于对象）：改为渲染 `x.en`+`x.zh` 并加小标题层级。
- 修掉「例句」列表中单独分号行（flex 纵向布局下 `join('；')` 被挤出单独一行）→ 改为无分隔符列表 + `.pc-examples-label` 小标题。
- **修复练习页提交无反馈 + 无撒花（关键 bug）**：练习页 answer 卡片漏了 `#answerResult` 元素，`submit()` 里 `res.className` 对 null 抛异常，导致后续撒花/反馈文字/按钮锁定全中断；补元素 + `submit()` 加 null 保护，撒花与锁定移出容错块外必执行。
- 写对自动提交 + 撒花 + 绿字「正确！掌握这句了。」+ 答案高亮，形成正反馈闭环。
- **每句开始练习自动朗读一次**：`resetQuestion()` 出题意图即 `speak()`；新增「🔊 自动朗读」开关（默认开、偏好持久化 `sl_autospeak`）；首题偏好恢复到出题前避免误读。

## 验证说明

- 逻辑层：node `--check` + 各 `verify_*.js` 断言（SR 算法、xlsx 回环、句型比对、服务端回环）全程通过。
- 浏览器层：撒花/动画/自动朗读发声/按钮态等真实 DOM 行为需在浏览器实跑确认（沙箱无法实跑）。首句自动朗读受浏览器 TTS 用户手势策略限制（首次交互后正常）。
