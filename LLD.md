# SentenceLearner 详细设计说明书 (LLD-lite) v1.0

> 范围说明: 前端 React 应用, 无重型类层级, 故不画 UML 类图。本 LLD 聚焦唯一需要设计的算法核心: 练习流程状态机 + 句子→词适配 + 分级 + 整句 TTS, 以伪代码/状态机表达。

## 1. 练习流程状态机
```
状态: IDLE → SHOWING_ZH → TYPING → (LISTENING) → CHECKING → RESULT → (NEXT | COLLECT | ERRORBOOK)
事件:
  start              : IDLE      → SHOWING_ZH
  user types         : SHOWING_ZH → TYPING        (实时字符比对)
  click speaker      : *         → LISTENING      (播放 TTS) → 回到 TYPING
  submit/章节结束     : TYPING     → CHECKING → RESULT
  RESULT 选 收藏      : RESULT     → COLLECT → NEXT
  RESULT 选 错误      : RESULT     → ERRORBOOK → NEXT
  RESULT 选 下一题    : RESULT     → NEXT → SHOWING_ZH (下一句)
```

## 2. 核心算法

### 2.1 句子→词适配 (复用 QL 引擎)
```
function toWord(s: Sentence): Word {
  return {
    name:    s.en,        // 整句作为超长 word 的 name
    trans:   [s.zh],      // 中文义
    usphone: '',          // 整句不显示逐词音标
    ukphone: ''
  }
}
```
引擎对 `name` 逐字符比对, 句子天然适配 (见 ADR-005)。

### 2.2 字符级比对 + 强制纠错 (复用 Word.tsx)
```
for i in 0 .. len(target):
  if input[i] === target[i]:
      status[i] = OK          // 绿
  else:
      status[i] = WRONG        // 红 + 下划线
      block advance until fixed // 强制重打, 防止错误肌肉记忆
// 大小写/标点: MVP 严格匹配 (可配置忽略尾标点, 后续)
```

### 2.3 难度分级 (level)
```
words  = en.trim().split(/\s+/).length
level  = words <= 15 ? '初级' : '高级'
```
注意: 现有 `template.xlsx` 162 句全部 ≤14 词 → 暂全为初级; 高级阶段需另补料或组合长句。

### 2.4 整句 TTS (useSentenceTTS)
```
const synth = window.speechSynthesis
function speak(text, { rate, voice }) {
  synth.cancel()                       // 避免叠加
  const u = new SpeechSynthesisUtterance(text)
  u.rate  = rate                       // 来自 pronunciationConfigAtom
  u.voice = pickVoice(voice)           // 'us' | 'uk'
  synth.speak(u)
}
// 触发: 点击朗读按钮; 可选"显示即读"
```

### 2.5 进度统计 (复用 QL)
```
WPM      = 正确字符数 / 用时(分钟)
accuracy = 正确句数 / 总句数
错句     → 写入 errorSentences store (供错句本/复习)
```

## 3. 数据流转
```
sentences.json
  → useSentenceList
  → toWord
  → typingReducer
  → SentencePanel 渲染
  → 输入事件 → 字符比对 → 统计
  → (收藏 | 错句本)
  → dexie 持久化
```

## 4. 待验证风险 (中)
- 须冒烟测试 `Word.tsx` 对超长 `name` (句子) 无"按空格拆词渲染"硬假设; 先用 1 句验证即可消解。
- 标点/大小写匹配策略需在 MVP 编码时最终确认 (影响正确率口径)。
