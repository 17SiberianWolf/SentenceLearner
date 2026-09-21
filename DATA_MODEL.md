# SentenceLearner 数据模型设计 (替代"数据库设计") v1.0

> 范围说明: 本地优先, 无 RDBMS, 故无 ER 图/外键。数据存浏览器 IndexedDB (dexie)。下文以前端"数据模型 / 数据字典"形式表达, 等价于数据库设计文档的表结构与数据字典部分。

## 1. IndexedDB 表 (dexie stores)
| store | 主键 | 字段 | 说明 |
|-------|------|------|------|
| sentences | id | category, en, zh, audioUrl, wordCount, level, wrongCount, lastResult | 句子库 (导入生成) |
| errorSentences | id | sentenceId, en, zh, userInput, wrongChars, time | 错句本 |
| progress | pk(auto) | date, typedCount, correctCount, wpm, accuracy | 每日统计 |
| settings | key | ttsRate, ttsVoice(us/uk), theme, levelPref | 用户设置 |

## 2. 句子记录 schema (Sentence)
```
interface Sentence {
  id: string            // 稳定 hash(en)
  category: string      // 原文标题 (分类)
  en: string            // 标准英文句
  zh: string            // 中文意思
  audioUrl?: string     // 预留, 空则 TTS 生成
  wordCount: number     // 内部计算
  level: '初级' | '高级' // ≤15 / >15
  wrongCount: number    // 错次 (复习加权)
  lastResult?: 'ok' | 'wrong'
}
```

## 3. Excel → 句子 导入映射 (template.xlsx)
| Excel 列 | Sentence 字段 | 处理 |
|----------|---------------|------|
| 原文标题 | category | 直用 |
| 原文正文 | en | 直用 (trim) |
| 译文正文 | zh | 直用 |
| 译文标题 | (忽略) | 仅作分类辅助 |
| 音频地址 | audioUrl | 空则留空 → 运行时 TTS |
| — | wordCount | `len(en.split(/\s+/))` |
| — | level | `≤15 → 初级` |
| — | id | `hash(en)` |

## 4. 数据字典 (关键枚举)
- `level`: 初级 (≤15 词) / 高级 (>15 词)
- `ttsVoice`: 'us' | 'uk'
- `lastResult`: 'ok' | 'wrong'

## 5. 持久化策略
- 句子库: 首次导入写 `sentences`; 之后本地优先读 dexie。
- 错句本 / 进度: 实时写入, 供复习与统计页。
- 隐私: 默认不联网、不上传 (见 ADR-004)。