// 句型训练数据 — 纯模板版
// 两组：oral（日常/工作口头交流）、email（工作邮件商务沟通）
// 每个 pattern：title 短名、pattern 公式、note 用法、examples 例句、items 练习句
// 每个 item：zh 中文提示、en 完整模型句、gap 需填的开放部分（必须是 en 的字面子串）
// 说明：本文件只产出数据，id 与扁平化查表在 app.js 装载时完成。
window.SENTENCE_PATTERNS = {
  oral: [
    {
      title: '提出建议',
      pattern: 'I suggest (that) + 主语 + (should) + 动词…',
      note: '委婉地给出建议；口语中 that / should 常可省略。',
      examples: [
        { en: 'I suggest that we hold a meeting next week.', zh: '我建议我们下周开个会。' },
        { en: 'I suggest you double-check the settings.', zh: '我建议你再核对一下设置。' }
      ],
      items: [
        { zh: '我建议我们明天再讨论这个问题。', en: 'I suggest that we discuss this issue tomorrow.', gap: 'discuss this issue tomorrow' },
        { zh: '我建议你先备份数据。', en: 'I suggest that you back up the data first.', gap: 'back up the data first' },
        { zh: '我建议团队改用更简单的方案。', en: 'I suggest that the team switch to a simpler approach.', gap: 'switch to a simpler approach' },
        { zh: '我建议咱们午饭后碰一下。', en: 'I suggest that we touch base after lunch.', gap: 'touch base after lunch' }
      ]
    },
    {
      title: '请求帮助/许可',
      pattern: 'Could you + 动词…? / Would you mind + 动名词…?',
      note: '客气地请求；Would you mind 后接动名词（doing）。',
      examples: [
        { en: 'Could you give me a hand with this?', zh: '你能帮我一下这个吗？' },
        { en: 'Would you mind closing the door?', zh: '你介意把门关上吗？' }
      ],
      items: [
        { zh: '你能帮我看一下这个报错吗？', en: 'Could you help me look at this error?', gap: 'help me look at this error' },
        { zh: '你介意我把会议改到三点吗？', en: 'Would you mind moving the meeting to three o\'clock?', gap: 'moving the meeting to three o\'clock' },
        { zh: '能麻烦你发一下会议纪要吗？', en: 'Could you send me the meeting minutes?', gap: 'send me the meeting minutes' },
        { zh: '你方便明天上午打个电话吗？', en: 'Would you mind a quick call tomorrow morning?', gap: 'a quick call tomorrow morning' }
      ]
    },
    {
      title: '同意/不同意',
      pattern: 'I agree (that)… / I am afraid I do not agree (that)…',
      note: '表达立场；不同意时用 I am afraid 缓冲，更显礼貌。',
      examples: [
        { en: 'I agree that safety comes first.', zh: '我同意安全是第一位的。' },
        { en: 'I am afraid I do not agree with the timeline.', zh: '恐怕我不太同意这个时间安排。' }
      ],
      items: [
        { zh: '我同意你的看法。', en: 'I agree with your point.', gap: 'with your point' },
        { zh: '恐怕我不太同意这个方案。', en: 'I am afraid I do not agree with this approach.', gap: 'with this approach' },
        { zh: '我完全同意我们需要先测试。', en: 'I agree that we need to test it first.', gap: 'that we need to test it first' },
        { zh: '你说的有道理，但我还有顾虑。', en: 'You have a point, but I still have concerns.', gap: 'but I still have concerns' }
      ]
    },
    {
      title: '确认理解',
      pattern: 'Do you mean (that)…? / Just to clarify, …?',
      note: '没听清/想确认时澄清，避免误会。',
      examples: [
        { en: 'Do you mean we should start over?', zh: '你的意思是我们应该重来？' },
        { en: 'Just to clarify, the budget is fixed.', zh: '确认一下，预算是固定的。' }
      ],
      items: [
        { zh: '你的意思是说截止日期提前了？', en: 'Do you mean that the deadline has been moved up?', gap: 'that the deadline has been moved up' },
        { zh: '也就是说我们要重做这部分？', en: 'Just to clarify, we need to redo this part.', gap: 'we need to redo this part' },
        { zh: '你能再解释一下这个术语吗？', en: 'Could you explain this term again?', gap: 'explain this term again' },
        { zh: '我想确认一下，你是说周五前要交付？', en: 'Just to clarify, you mean it is due before Friday?', gap: 'you mean it is due before Friday' }
      ]
    },
    {
      title: '表达进度/状态',
      pattern: 'So far, + 主语 + have/has + 过去分词…',
      note: '汇报到目前为止的进展，常用现在完成时。',
      examples: [
        { en: 'So far, everything is on track.', zh: '到目前为止，一切顺利。' },
        { en: 'So far, the client has approved the plan.', zh: '目前为止，客户已批准方案。' }
      ],
      items: [
        { zh: '到目前为止，我们已经完成了 80% 的测试。', en: 'So far, we have completed eighty percent of the testing.', gap: 'we have completed eighty percent of the testing' },
        { zh: '目前系统运行稳定。', en: 'So far, the system has been running stably.', gap: 'the system has been running stably' },
        { zh: '到现在为止还没发现新问题。', en: 'So far, no new issues have been found.', gap: 'no new issues have been found' },
        { zh: '我们已经把代码合并到了主分支。', en: 'So far, we have merged the code into the main branch.', gap: 'we have merged the code into the main branch' }
      ]
    },
    {
      title: '道歉/致歉',
      pattern: 'I am sorry for + 名词/动名词… / I am sorry that…',
      note: '为某事致歉；for 后接名词或动名词。',
      examples: [
        { en: 'I am sorry for the confusion.', zh: '很抱歉造成了混乱。' },
        { en: 'I am sorry that I was late.', zh: '对不起我迟到了。' }
      ],
      items: [
        { zh: '很抱歉回复晚了。', en: 'I am sorry for the late reply.', gap: 'the late reply' },
        { zh: '对不起，我误解了你的意思。', en: 'I am sorry that I misunderstood you.', gap: 'that I misunderstood you' },
        { zh: '抱歉造成了这个麻烦。', en: 'I am sorry for causing this trouble.', gap: 'causing this trouble' },
        { zh: '很抱歉会议超时了。', en: 'I am sorry that the meeting ran over.', gap: 'that the meeting ran over' }
      ]
    },
    {
      title: '表达感谢',
      pattern: 'Thanks for + 名词/动名词… / I (really) appreciate + 名词/动名词…',
      note: '口头致谢的两种常见说法。',
      examples: [
        { en: 'Thanks for your patience.', zh: '感谢你的耐心。' },
        { en: 'I really appreciate your flexibility.', zh: '非常感谢你的灵活配合。' }
      ],
      items: [
        { zh: '谢谢你及时通知我。', en: 'Thanks for letting me know in time.', gap: 'letting me know in time' },
        { zh: '非常感谢你的帮助。', en: 'I really appreciate your help.', gap: 'your help' },
        { zh: '多谢你抽时间 review 我的代码。', en: 'Thanks for taking the time to review my code.', gap: 'taking the time to review my code' },
        { zh: '感谢你把这个澄清了。', en: 'I really appreciate you clarifying this.', gap: 'you clarifying this' }
      ]
    },
    {
      title: '提出观点',
      pattern: 'In my opinion, + 句子 / I think (that) + 句子',
      note: '给出自己的看法；In my opinion 比 I think 稍正式。',
      examples: [
        { en: 'In my opinion, the design is solid.', zh: '在我看来，这个设计是扎实的。' },
        { en: 'I think we can ship it this week.', zh: '我想我们这周可以发布。' }
      ],
      items: [
        { zh: '在我看来，这个风险可以接受。', en: 'In my opinion, this risk is acceptable.', gap: 'this risk is acceptable' },
        { zh: '我认为我们应该先和用户确认。', en: 'I think that we should confirm with the user first.', gap: 'that we should confirm with the user first' },
        { zh: '我觉得这个方案更简单。', en: 'I think this approach is simpler.', gap: 'this approach is simpler' },
        { zh: '依我看，我们需要更多数据。', en: 'In my opinion, we need more data.', gap: 'we need more data' }
      ]
    },
    {
      title: '安排/计划',
      pattern: "Let's + 动词… / How about + 动名词…?",
      note: '提议一起做某事；How about 后接动名词。',
      examples: [
        { en: 'Let\'s wrap up by five.', zh: '咱们五点前收尾吧。' },
        { en: 'How about we split the work?', zh: '要不我们把工作分一下？' }
      ],
      items: [
        { zh: '我们明早十点碰一下吧。', en: 'Let\'s touch base at ten tomorrow morning.', gap: 'touch base at ten tomorrow morning' },
        { zh: '要不我们先开个短会？', en: 'How about we start with a short meeting?', gap: 'we start with a short meeting' },
        { zh: '咱们把这个任务拆分一下。', en: 'Let\'s break this task down.', gap: 'break this task down' },
        { zh: '我建议周五前完成初稿。', en: 'Let\'s aim to finish the draft before Friday.', gap: 'aim to finish the draft before Friday' }
      ]
    },
    {
      title: '请重复/放慢',
      pattern: 'Could you say that again? / Could you speak a bit slower?',
      note: '没听清时礼貌请求重复或放慢语速。',
      examples: [
        { en: 'Could you repeat the last part?', zh: '你能重复一下最后那部分吗？' },
        { en: 'Could you say it more slowly?', zh: '你能说得更慢一点吗？' }
      ],
      items: [
        { zh: '你能再说一遍吗？', en: 'Could you say that again?', gap: 'say that again' },
        { zh: '能麻烦你讲慢一点吗？', en: 'Could you speak a bit slower?', gap: 'speak a bit slower' },
        { zh: '不好意思，我没听清。', en: 'Sorry, I did not catch that.', gap: 'I did not catch that' },
        { zh: '你能拼写一下这个词吗？', en: 'Could you spell that word?', gap: 'spell that word' }
      ]
    }
  ],

  email: [
    {
      title: '邮件开场',
      pattern: 'I am writing to + 动词…',
      note: '商务邮件最常用的开场，直接说明写信目的。',
      examples: [
        { en: 'I am writing to share the update.', zh: '我写邮件是想同步一下进展。' },
        { en: 'I am writing to ask about the schedule.', zh: '我写信是想问一下进度。' }
      ],
      items: [
        { zh: '我写这封邮件是为了跟进昨天的讨论。', en: 'I am writing to follow up on yesterday\'s discussion.', gap: 'follow up on yesterday\'s discussion' },
        { zh: '我写邮件是想确认一下交付时间。', en: 'I am writing to confirm the delivery time.', gap: 'confirm the delivery time' },
        { zh: '我写信是想邀请你参加周四的评审。', en: 'I am writing to invite you to the review on Thursday.', gap: 'invite you to the review on Thursday' },
        { zh: '我写这封邮件是想同步一下项目状态。', en: 'I am writing to update you on the project status.', gap: 'update you on the project status' }
      ]
    },
    {
      title: '邮件中请求',
      pattern: 'Could you please + 动词…?',
      note: '比 Could you 更客气，适合正式请求。',
      examples: [
        { en: 'Could you please review the proposal?', zh: '能否请你审阅一下方案？' },
        { en: 'Could you please let me know by Friday?', zh: '能否请你在周五前告知？' }
      ],
      items: [
        { zh: '能否请你提供最新的测试报告？', en: 'Could you please provide the latest test report?', gap: 'provide the latest test report' },
        { zh: '麻烦你确认一下规格书里的参数。', en: 'Could you please confirm the parameters in the spec?', gap: 'confirm the parameters in the spec' },
        { zh: '能否请你把合同发给我？', en: 'Could you please send me the contract?', gap: 'send me the contract' },
        { zh: '请帮忙安排一次线上 demo。', en: 'Could you please arrange an online demo?', gap: 'arrange an online demo' }
      ]
    },
    {
      title: '确认安排',
      pattern: 'I would like to confirm (that)… / Please confirm (that)…',
      note: '邮件中确认信息或请对方确认。',
      examples: [
        { en: 'I would like to confirm the meeting time.', zh: '我想确认一下会议时间。' },
        { en: 'Please confirm your attendance.', zh: '请确认你是否出席。' }
      ],
      items: [
        { zh: '我想确认一下会议改到了周五。', en: 'I would like to confirm that the meeting has been moved to Friday.', gap: 'that the meeting has been moved to Friday' },
        { zh: '请确认你已收到附件。', en: 'Please confirm that you have received the attachment.', gap: 'that you have received the attachment' },
        { zh: '我想确认交付日期是下月五号。', en: 'I would like to confirm that the delivery date is the fifth of next month.', gap: 'that the delivery date is the fifth of next month' },
        { zh: '请确认参会人员名单。', en: 'Please confirm the list of attendees.', gap: 'the list of attendees' }
      ]
    },
    {
      title: '跟进/催办',
      pattern: 'Just a gentle reminder that… / I wanted to follow up on…',
      note: '礼貌地提醒或跟进，不显得冒犯。',
      examples: [
        { en: 'Just a gentle reminder that the report is due.', zh: '温馨提醒一下报告要交了。' },
        { en: 'I wanted to follow up on your decision.', zh: '我想跟进一下你的决定。' }
      ],
      items: [
        { zh: '温馨提醒一下，明天是截止日。', en: 'Just a gentle reminder that tomorrow is the deadline.', gap: 'tomorrow is the deadline' },
        { zh: '我想跟进一下上周提到的那个问题。', en: 'I wanted to follow up on the issue mentioned last week.', gap: 'the issue mentioned last week' },
        { zh: '顺便提醒，发票还没收到。', en: 'Just a gentle reminder that the invoice has not been received.', gap: 'the invoice has not been received' },
        { zh: '想确认一下你那边进度如何。', en: 'I wanted to follow up on your progress.', gap: 'your progress' }
      ]
    },
    {
      title: '致歉延误',
      pattern: 'I apologize for + 名词/动名词…',
      note: '正式邮件中为延误或失误致歉。',
      examples: [
        { en: 'I apologize for the inconvenience.', zh: '对造成的不便我深表歉意。' },
        { en: 'I apologize for the oversight.', zh: '对这次疏忽我深表歉意。' }
      ],
      items: [
        { zh: '很抱歉回复延误了。', en: 'I apologize for the delay in my reply.', gap: 'the delay in my reply' },
        { zh: '对交付延迟，我深表歉意。', en: 'I apologize for the delay in delivery.', gap: 'the delay in delivery' },
        { zh: '抱歉这么晚才提供数据。', en: 'I apologize for providing the data so late.', gap: 'providing the data so late' },
        { zh: '很抱歉没能按时参加。', en: 'I apologize for not attending on time.', gap: 'not attending on time' }
      ]
    },
    {
      title: '附件说明',
      pattern: 'Please find + 名词 + attached. / I have attached + 名词.',
      note: '告知对方附件内容。',
      examples: [
        { en: 'Please find the schedule attached.', zh: '请查收附件中的日程表。' },
        { en: 'I have attached the updated file.', zh: '我已附上更新后的文件。' }
      ],
      items: [
        { zh: '请查收附件中的报价单。', en: 'Please find the quotation attached.', gap: 'the quotation attached' },
        { zh: '我已附上最新的设计稿。', en: 'I have attached the latest design draft.', gap: 'the latest design draft' },
        { zh: '相关文档见附件。', en: 'Please find the related document attached.', gap: 'the related document attached' },
        { zh: '我把会议纪要附在邮件里了。', en: 'I have attached the meeting minutes to this email.', gap: 'the meeting minutes to this email' }
      ]
    },
    {
      title: '抄送/转发',
      pattern: 'I am copying + 人 + on this email. / I have forwarded + 名词 + to + 人.',
      note: '说明抄送或转发对象。',
      examples: [
        { en: 'I am copying the client on this email.', zh: '我把这封邮件抄送给了客户。' },
        { en: 'I have forwarded the email to the team.', zh: '我已把这封邮件转发给了团队。' }
      ],
      items: [
        { zh: '我把这封邮件抄送给了经理。', en: 'I am copying the manager on this email.', gap: 'the manager on this email' },
        { zh: '我已经把请求转发给技术团队了。', en: 'I have forwarded the request to the technical team.', gap: 'the request to the technical team' },
        { zh: '我抄送了财务以便备案。', en: 'I am copying finance for their records.', gap: 'finance for their records' },
        { zh: '我把你的回复转发给了客户。', en: 'I have forwarded your reply to the client.', gap: 'your reply to the client' }
      ]
    },
    {
      title: '邮件致谢',
      pattern: 'Thank you for + 名词/动名词… / I appreciate your + 名词.',
      note: '邮件结尾前的感谢。',
      examples: [
        { en: 'Thank you for your understanding.', zh: '感谢你的理解。' },
        { en: 'I appreciate your prompt action.', zh: '感谢你的迅速处理。' }
      ],
      items: [
        { zh: '感谢你这么快回复。', en: 'Thank you for your quick reply.', gap: 'your quick reply' },
        { zh: '多谢你抽出时间评审。', en: 'Thank you for taking the time to review.', gap: 'taking the time to review' },
        { zh: '非常感谢你的支持。', en: 'I appreciate your support.', gap: 'your support' },
        { zh: '谢谢你们团队的配合。', en: 'Thank you for your team\'s cooperation.', gap: 'your team\'s cooperation' }
      ]
    },
    {
      title: '下一步',
      pattern: 'The next step is to + 动词… / Moving forward, + 句子',
      note: '邮件中说明后续动作。',
      examples: [
        { en: 'The next step is to finalize the spec.', zh: '下一步是敲定规格。' },
        { en: 'Moving forward, we will monitor the logs.', zh: '接下来我们会监控日志。' }
      ],
      items: [
        { zh: '下一步是更新测试计划。', en: 'The next step is to update the test plan.', gap: 'update the test plan' },
        { zh: '接下来我们会准备上线。', en: 'Moving forward, we will prepare for the release.', gap: 'we will prepare for the release' },
        { zh: '后续我会把结果汇总给你。', en: 'The next step is to summarize the results for you.', gap: 'summarize the results for you' },
        { zh: '接下来由你负责对接客户。', en: 'Moving forward, you will be responsible for the client.', gap: 'you will be responsible for the client' }
      ]
    },
    {
      title: '邮件结尾',
      pattern: 'Looking forward to + 名词/动名词… / Please let me know if you have any questions.',
      note: '常见商务邮件收尾。',
      examples: [
        { en: 'Looking forward to your feedback.', zh: '期待你的反馈。' },
        { en: 'Please let me know if anything changes.', zh: '如有任何变动请告诉我。' }
      ],
      items: [
        { zh: '期待你的回复。', en: 'Looking forward to your reply.', gap: 'your reply' },
        { zh: '如有任何问题请随时告诉我。', en: 'Please let me know if you have any questions.', gap: 'if you have any questions' },
        { zh: '期待周五的会议。', en: 'Looking forward to our meeting on Friday.', gap: 'our meeting on Friday' },
        { zh: '期待进一步合作。', en: 'Looking forward to further cooperation.', gap: 'further cooperation' }
      ]
    }
  ]
};
