// gen_life_sentences.js
// 基于 life-vocab-app 语料加工生成 SentenceLearner 内置句子语料。
// 产出：
//   1) life_sentences.js  -> window.LIFE_SENTENCES（内置到应用）
//   2) life_sentences.xlsx -> 独立 Excel 备份（列序对齐 App 句子库导入）
// 校验：用 engine.levelOf 复算词数/分级，断言 初级<=15 词、高级>15 词。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Engine = require('./engine.js'); // {compareChars, firstWrongIndex, levelOf, computeStats}

const ROOT = __dirname;

// SL 现有分类（须与 sentences.js 完全一致，保证落进现有分类下拉）
const SL_CATEGORIES = [
  'General Workplace Communication',
  'Meetings and Communication',
  'Email Openings and Closings',
  'Technical Clarification and Engineering Discussion',
  'Project Progress and Schedule',
  'Issues, Risks, and Delays',
  'Requests, Confirmations, and Follow-ups',
  'Site, Installation, and Commissioning',
  'More Natural and Polite Expressions',
  'Opening a Meeting',
  'Meeting Management',
  'Progress Reporting',
  'Chasing and Follow-up',
  'Requesting Confirmation',
  'Technical Clarification',
  'Risk Management',
  'Issue Resolution',
  'Change Management',
  'Assigning Responsibilities',
  'Site Work and Commissioning',
  'When You Do Not Understand',
  'Summarizing a Meeting',
];

// 原始语料（中文->手写英文）。词汇参考 life-vocab-app 的 office/industry/tech/function 等主题。
// 4 个分类（Opening a Meeting / When You Do Not Understand / Requesting Confirmation / Summarizing a Meeting）
// 采用 2 初 + 1 高，其余 18 个分类采用 4 初 + 2 高 => 80 初 + 40 高 = 120 句。
const RAW = [
  // 1. General Workplace Communication
  ['General Workplace Communication', 'Please share the updated timeline with the whole team.', '请把更新后的时间表分享给整个团队。'],
  ['General Workplace Communication', 'We need your approval before we proceed with the change.', '推进变更前我们需要你的批准。'],
  ['General Workplace Communication', 'Could you give me some feedback on the draft report?', '能否就草稿报告给我一些反馈？'],
  ['General Workplace Communication', 'Let us align on the priorities for next week.', '我们对齐一下下周的优先事项。'],
  ['General Workplace Communication', 'I would appreciate it if you could review the attached document and share your feedback by end of day.', '如您能在今天结束前审阅附件文档并反馈，我将不胜感激。'],
  ['General Workplace Communication', 'Since the client changed the requirements, we should realign the project scope and inform all stakeholders as soon as possible.', '由于客户变更了需求，我们应重新对齐项目范围并尽快通知所有相关方。'],

  // 2. Meetings and Communication
  ['Meetings and Communication', 'Let us schedule a short meeting for tomorrow morning.', '我们把简短会议安排到明天上午。'],
  ['Meetings and Communication', 'Could you send me the meeting minutes after the call?', '通话后能把会议纪要发给我吗？'],
  ['Meetings and Communication', 'Who will take notes during the kickoff meeting?', '项目启动会上由谁记录？'],
  ['Meetings and Communication', 'Please confirm the attendee list before the meeting.', '开会前请确认参会人名单。'],
  ['Meetings and Communication', 'Before we wrap up the meeting, let us make sure that every action item has a clear owner and a deadline.', '结束会议前，我们确认每个行动项都有明确的负责人和截止日期。'],
  ['Meetings and Communication', 'To keep everyone on the same page, I will send a short summary of the discussion to all participants this afternoon.', '为了让大家理解一致，我今天下午会把讨论概要发给所有参会者。'],

  // 3. Email Openings and Closings
  ['Email Openings and Closings', 'Please find the report attached to this email.', '请查收本邮件附件中的报告。'],
  ['Email Openings and Closings', 'I am writing to follow up on our last conversation.', '我写这封邮件跟进我们上次的沟通。'],
  ['Email Openings and Closings', 'Could you cc the project manager on your reply?', '回复时能否抄送项目经理？'],
  ['Email Openings and Closings', 'Thank you for your time and I look forward to your reply.', '感谢您的时间，期待您的回复。'],
  ['Email Openings and Closings', 'I am writing to kindly remind you that the signed contract needs to be returned to our office before the end of this week.', '写信善意提醒，签署的合同需在本周末前寄回我方办公室。'],
  ['Email Openings and Closings', 'Please find attached the final version of the specification, and let me know if any section still needs clarification.', '附件是规范的最终版本，若有任何部分仍需澄清请告知。'],

  // 4. Technical Clarification and Engineering Discussion
  ['Technical Clarification and Engineering Discussion', 'The temperature setpoint is set to fifteen fifty degrees.', '温度设定值设为 1550 度。'],
  ['Technical Clarification and Engineering Discussion', 'The alarm appeared on the HMI screen this morning.', '今天早上报警显示在人机界面上。'],
  ['Technical Clarification and Engineering Discussion', 'We need to tune the PID controller parameters.', '我们需要整定 PID 控制器参数。'],
  ['Technical Clarification and Engineering Discussion', 'The sensor signal looks noisy and unstable.', '传感器信号看起来有干扰、不稳定。'],
  ['Technical Clarification and Engineering Discussion', 'After the caster tripped due to an overcurrent fault, the operator restarted the line and monitored the mold level until it stabilized.', '连铸机因过流故障跳闸后，操作工重启了产线并监控结晶器液位直至稳定。'],
  ['Technical Clarification and Engineering Discussion', 'The casting speed should be increased gradually while we watch the cooling water flow and the solidification pattern on the strand.', '拉速应逐步提高，同时观察冷却水流量和铸流上的凝固情况。'],

  // 5. Project Progress and Schedule
  ['Project Progress and Schedule', 'We are currently two weeks behind schedule.', '我们目前比计划落后两周。'],
  ['Project Progress and Schedule', 'Testing has become the bottleneck of the project.', '测试已成为项目的瓶颈。'],
  ['Project Progress and Schedule', 'The first milestone was reached on time.', '第一个里程碑已按时达成。'],
  ['Project Progress and Schedule', 'Please send me a status update every Friday.', '请每周五给我发一次进展汇报。'],
  ['Project Progress and Schedule', 'Although we delivered the first milestone on time, the commissioning phase is now at risk because the lead time of the spare parts is longer than expected.', '虽然我们按时交付了第一个里程碑，但因备件交货周期长于预期，调试阶段现在面临风险。'],
  ['Project Progress and Schedule', 'The overall timeline is tight, but if we ramp up the night shift next month we should still meet the planned acceptance date.', '整体工期很紧，但如果下月增加夜班提产，仍应能赶上计划的验收日期。'],

  // 6. Issues, Risks, and Delays
  ['Issues, Risks, and Delays', 'We identified a potential risk in the interface.', '我们识别到接口上的潜在风险。'],
  ['Issues, Risks, and Delays', 'A near miss was reported on the shop floor.', '生产现场上报了一起未遂事件。'],
  ['Issues, Risks, and Delays', 'The root cause is still under investigation.', '根本原因仍在调查中。'],
  ['Issues, Risks, and Delays', 'Report any hazard to your supervisor at once.', '发现危险源请立即上报主管。'],
  ['Issues, Risks, and Delays', 'Because the hydraulic pressure dropped below the limit, the interlock stopped the line and we opened a corrective action to investigate the root cause.', '因液压压力低于限值，联锁停了产线，我们已开立纠正措施调查根本原因。'],
  ['Issues, Risks, and Delays', 'We should perform a formal risk assessment before the trial run, since any incident at the site could delay the entire commissioning plan.', '试运行前我们应进行正式风险评估，因为现场的任意事故都可能拖延整个调试计划。'],

  // 7. Requests, Confirmations, and Follow-ups
  ['Requests, Confirmations, and Follow-ups', 'Could you confirm the delivery date for us?', '能否为我们确认交货日期？'],
  ['Requests, Confirmations, and Follow-ups', 'I will follow up with an email after the call.', '通话后我会发邮件跟进。'],
  ['Requests, Confirmations, and Follow-ups', 'Please reschedule the review to Thursday.', '请把评审改到周四。'],
  ['Requests, Confirmations, and Follow-ups', 'Just a quick reminder about the client visit.', '简单提醒一下客户来访的事。'],
  ['Requests, Confirmations, and Follow-ups', 'Following our call this morning, could you please confirm whether the revised drawings have been approved and let me know the expected shipment date?', '继今天上午的通话，能否确认修订图纸是否已批准，并告知预计发货日期？'],
  ['Requests, Confirmations, and Follow-ups', 'I will follow up with the supplier next week and keep you posted on the progress of the purchase order.', '我下周会跟进供应商，并就采购订单的进展随时告知您。'],

  // 8. Site, Installation, and Commissioning
  ['Site, Installation, and Commissioning', 'Installation is scheduled to start next month.', '安装计划下月开始。'],
  ['Site, Installation, and Commissioning', 'The site acceptance test has passed.', '现场验收测试已通过。'],
  ['Site, Installation, and Commissioning', 'Only three items remain on the punch list.', '整改清单上只剩三项。'],
  ['Site, Installation, and Commissioning', 'The engineer is on site today.', '工程师今天在现场。'],
  ['Site, Installation, and Commissioning', 'During the commissioning phase, the technician calibrated the sensors, loaded the correct recipe, and verified that the automated inspection system met the specification.', '调试阶段，技术员校准了传感器、加载了正确配方，并验证了自动检测系统符合规范。'],
  ['Site, Installation, and Commissioning', 'Before we sign off the as-built drawings, the team must complete the punch list and pass the final site acceptance test.', '签署竣工图前，团队必须完成整改清单并通过最终现场验收测试。'],

  // 9. More Natural and Polite Expressions
  ['More Natural and Polite Expressions', 'I was wondering if you could help me.', '我想知道您能否帮我一下。'],
  ['More Natural and Polite Expressions', 'Would you mind closing the door?', '您介意关一下门吗？'],
  ['More Natural and Polite Expressions', 'I am afraid I disagree with that point.', '恐怕我不同意那一点。'],
  ['More Natural and Polite Expressions', 'Could you possibly send it today?', '您今天能发过来吗？'],
  ['More Natural and Polite Expressions', 'I was wondering if it would be possible for you to share the latest test report with the European team before our call tomorrow.', '我想知道能否在明天通话前把最新测试报告分享给欧洲团队。'],
  ['More Natural and Polite Expressions', 'If it is not too much trouble, could you kindly review the draft and let me know your thoughts at your earliest convenience?', '若不太打扰，能否请您审阅草稿并在方便时尽早告知您的看法？'],

  // 10. Opening a Meeting (2 初 + 1 高)
  ['Opening a Meeting', 'Good morning, everyone, let us get started.', '大家早上好，我们开始吧。'],
  ['Opening a Meeting', 'Thank you all for joining the call.', '感谢各位参加这次通话。'],
  ['Opening a Meeting', 'Good morning everyone, thank you for joining today’s kickoff meeting, and let us begin by quickly reviewing the agenda and the main goals of this phase.', '大家早上好，感谢参加今天的启动会，我们先快速过一遍议程和本阶段主要目标。'],

  // 11. Meeting Management
  ['Meeting Management', 'Let us move to the next agenda item.', '我们进入下一个议程项。'],
  ['Meeting Management', 'Please keep your update under two minutes.', '请控制更新在两分钟以内。'],
  ['Meeting Management', 'Who is taking the minutes today?', '今天谁做纪要？'],
  ['Meeting Management', 'Let us wrap up and agree on next steps.', '我们收尾并确认下一步。'],
  ['Meeting Management', 'To keep the meeting efficient, please share your status in advance, and we will focus the discussion on the open risks and the action items only.', '为保证会议高效，请提前分享您的状态，我们只聚焦未决风险和行动项讨论。'],
  ['Meeting Management', 'The chair should assign each action item a clear owner and a deadline, so that we can track progress after the meeting ends.', '主持人应为每个行动项指定明确负责人和截止日期，以便会后跟踪进展。'],

  // 12. Progress Reporting
  ['Progress Reporting', 'The project is on track this month.', '本月项目按计划推进。'],
  ['Progress Reporting', 'We reached the second milestone early.', '我们提前达成了第二个里程碑。'],
  ['Progress Reporting', 'Output increased by twelve percent.', '产量提高了百分之十二。'],
  ['Progress Reporting', 'Uptime improved after the upgrade.', '升级后开机率提高了。'],
  ['Progress Reporting', 'Compared with last quarter, our yield improved and the scrap rate dropped, which means the process changes are moving in the right direction.', '与上季度相比，成材率提高、废品率下降，说明工艺改动方向正确。'],
  ['Progress Reporting', 'I am pleased to report that the prototype passed all acceptance tests, and we are now ready to start the ramp-up of production.', '很高兴汇报样机通过了所有验收测试，我们现在可以开始逐步提产。'],

  // 13. Chasing and Follow-up
  ['Chasing and Follow-up', 'Just checking in on the open invoice.', '跟进一下那张未结发票。'],
  ['Chasing and Follow-up', 'Any update on the supplier quote?', '供应商报价有进展吗？'],
  ['Chasing and Follow-up', 'A gentle reminder about the deadline.', '善意提醒一下截止日期。'],
  ['Chasing and Follow-up', 'Could you push the vendor for an answer?', '能否催一下供应商给个答复？'],
  ['Chasing and Follow-up', 'I have not yet received the signed document, so could you please check with the client and let me know as soon as you have an update?', '我尚未收到签署文件，能否请您与客户确认，并在有进展时尽快告知？'],
  ['Chasing and Follow-up', 'To avoid further delay, I will escalate this to the procurement lead and ask them to confirm the order status by tomorrow.', '为避免进一步延误，我会将此上报采购负责人，请其在明天前确认订单状态。'],

  // 14. Requesting Confirmation (2 初 + 1 高)
  ['Requesting Confirmation', 'Please confirm your attendance.', '请确认您是否出席。'],
  ['Requesting Confirmation', 'Can you confirm the meeting time?', '能确认会议时间吗？'],
  ['Requesting Confirmation', 'Before we place the purchase order, please confirm that the technical specification and the delivery date in the quote are exactly what we agreed.', '在下采购订单前，请确认报价中的技术规格和交货日期与我们的约定完全一致。'],

  // 15. Technical Clarification
  ['Technical Clarification', 'Could you clarify the tolerance requirement?', '能否澄清公差要求？'],
  ['Technical Clarification', 'Which grade are we producing now?', '我们现在生产哪个钢种？'],
  ['Technical Clarification', 'Please check the latest revision of the drawing.', '请查看图纸的最新修订版。'],
  ['Technical Clarification', 'The manual explains the startup procedure.', '手册说明了启动步骤。'],
  ['Technical Clarification', 'To avoid confusion, could you clarify whether this dimension refers to the finished part or to the raw billet before the rolling process?', '为避免混淆，能否澄清该尺寸指的是成品件还是轧制前的原料小方坯？'],
  ['Technical Clarification', 'The deviation exceeds the agreed tolerance, so we need to decide together whether to rework the part or to accept it as a concession.', '偏差超出约定公差，我们需要共同决定是返工该件还是按让步接收。'],

  // 16. Risk Management
  ['Risk Management', 'We completed a risk assessment last week.', '我们上周完成了风险评估。'],
  ['Risk Management', 'Always wear your helmet on site.', '在现场请始终佩戴安全帽。'],
  ['Risk Management', 'PPE is mandatory in this area.', '该区域必须穿戴个人防护用品。'],
  ['Risk Management', 'Lockout tagout must be followed strictly.', '必须严格遵守上锁挂牌程序。'],
  ['Risk Management', 'Our risk assessment shows that the main hazard is high-temperature molten steel, so we must enforce PPE and emergency-stop drills during every shift.', '风险评估显示主要危险源是高温钢水，因此每班都必须落实个人防护和急停演练。'],
  ['Risk Management', 'If the vibration exceeds the warning threshold, the machine should be stopped immediately and a preventive maintenance ticket should be raised.', '若振动超过预警阈值，应立即停机并开立预防性维护工单。'],

  // 17. Issue Resolution
  ['Issue Resolution', 'We found a surface defect on the slab.', '我们在板坯上发现一处表面缺陷。'],
  ['Issue Resolution', 'The bearing needs lubrication soon.', '轴承很快需要润滑。'],
  ['Issue Resolution', 'Quality control rejected the batch.', '质量控制拒收了该批次。'],
  ['Issue Resolution', 'The pump failed and stopped the line.', '水泵故障导致产线停机。'],
  ['Issue Resolution', 'After we found the root cause of the false positives, we lowered the detection threshold and retrained the model with more labelled images.', '找到误报根本原因后，我们调低了检测阈值，并用更多标注图像重新训练了模型。'],
  ['Issue Resolution', 'The team raised a corrective action, replaced the worn roller, and added a daily inspection so that the same defect would not happen again.', '团队开立了纠正措施，更换了磨损轧辊，并增加每日检查以防同类缺陷再发生。'],

  // 18. Change Management
  ['Change Management', 'This change is out of scope.', '这项变更超出了范围。'],
  ['Change Management', 'Please submit a change request.', '请提交一份变更申请。'],
  ['Change Management', 'The manager approved the revision.', '经理批准了修订。'],
  ['Change Management', 'We need to update the baseline plan.', '我们需要更新基准计划。'],
  ['Change Management', 'Any change to the agreed scope must go through a formal change request, because unapproved changes can affect the cost, the schedule, and the acceptance criteria.', '对已约定范围的任何变更都必须走正式变更申请，因为未经批准的改变会影响成本、进度和验收标准。'],
  ['Change Management', 'Once the change is approved, we will update the baseline, notify the stakeholders, and revise the related drawings in the document system.', '变更批准后，我们将更新基准、通知相关方，并在文档系统中修订相关图纸。'],

  // 19. Assigning Responsibilities
  ['Assigning Responsibilities', 'Who is responsible for testing?', '谁负责测试？'],
  ['Assigning Responsibilities', 'I assigned the task to Tom.', '我把这个任务分配给了 Tom。'],
  ['Assigning Responsibilities', 'Please take ownership of this issue.', '请负责跟进这个问题。'],
  ['Assigning Responsibilities', 'The shift leader approved the work.', '班组长批准了这项工作。'],
  ['Assigning Responsibilities', 'To avoid gaps, let us clearly assign each work package an owner, a due date, and a defined acceptance criterion before the planning meeting.', '为避免遗漏，我们在计划会前为每个工作包明确负责人、截止日期和验收标准。'],
  ['Assigning Responsibilities', 'Since Anna is responsible for commissioning, she will coordinate the site team and report progress directly to the project manager.', '由于 Anna 负责调试，她将协调现场团队并直接向项目经理汇报进展。'],

  // 20. Site Work and Commissioning
  ['Site Work and Commissioning', 'The operator reported a loud noise.', '操作工报告有异响。'],
  ['Site Work and Commissioning', 'Shift handover takes fifteen minutes.', '交接班需要十五分钟。'],
  ['Site Work and Commissioning', 'The crane is under maintenance now.', '天车正在检修。'],
  ['Site Work and Commissioning', 'The technician fixed the valve.', '技术员修好了阀门。'],
  ['Site Work and Commissioning', 'During the night shift, the operator noticed abnormal vibration, stopped the conveyor, and called the technician who replaced the damaged bearing on site.', '夜班时操作工发现异常振动，停了输送机，并叫来在现场更换了损坏轴承的技术员。'],
  ['Site Work and Commissioning', 'Site work requires strict compliance with safety rules, including helmet, gloves, and lockout tagout before any maintenance on the drive.', '现场作业必须严格遵守安全规程，包括安全帽、手套，以及驱动维护前的上锁挂牌。'],

  // 21. When You Do Not Understand (2 初 + 1 高)
  ['When You Do Not Understand', 'Pardon me, could you repeat that?', '不好意思，能再说一遍吗？'],
  ['When You Do Not Understand', 'I did not catch the last point.', '最后一点我没听清。'],
  ['When You Do Not Understand', 'I am sorry, I did not quite follow the last part, could you please rephrase it or write it down so that I can translate it more accurately?', '抱歉，最后一部分我没太听懂，能否换个说法或写下来，以便我更准确地翻译？'],

  // 22. Summarizing a Meeting (2 初 + 1 高)
  ['Summarizing a Meeting', 'To sum up, we agreed on three points.', '总结一下，我们达成了三点共识。'],
  ['Summarizing a Meeting', 'The next meeting is in two weeks.', '下次会议在两周后。'],
  ['Summarizing a Meeting', 'To sum up, we agreed to revise the timeline, assign the open action items by Friday, and hold the next review once the prototype passes the test.', '总结一下，我们同意修订时间表、周五前分配未决行动项，并在样机通过测试后召开下次评审。'],
];

// ---------- 校验 ----------
const catSet = new Set(SL_CATEGORIES);
const seenEn = new Set();
let errs = [];
const records = RAW.map((r, i) => {
  const [cat, en, zh] = r;
  if (!catSet.has(cat)) errs.push('未知分类: ' + cat);
  const wc = Engine.levelOf(en) === '高级' ? en.trim().split(/\s+/).filter(Boolean).length : en.trim().split(/\s+/).filter(Boolean).length;
  const level = wc <= 15 ? '初级' : '高级';
  if (seenEn.has(en)) errs.push('重复句子: ' + en);
  seenEn.add(en);
  if (level === '初级' && wc > 15) errs.push('分级矛盾(初但>15): ' + en);
  if (level === '高级' && wc <= 15) errs.push('分级矛盾(高但<=15): ' + en);
  return {
    id: 'lf' + String(i + 1).padStart(3, '0'),
    category: cat,
    en: en,
    zh: zh,
    audioUrl: '',
    wordCount: wc,
    level: level,
    wrongCount: 0,
  };
});

const basic = records.filter(r => r.level === '初级').length;
const adv = records.filter(r => r.level === '高级').length;

// 每个分类的句子数分布
const byCat = {};
for (const r of records) byCat[r.category] = (byCat[r.category] || 0) + 1;
const missingCats = SL_CATEGORIES.filter(c => !byCat[c]);

console.log('总句数:', records.length, '| 初级:', basic, '| 高级:', adv);
console.log('覆盖分类数:', Object.keys(byCat).length, '/', SL_CATEGORIES.length);
if (missingCats.length) console.log('未覆盖分类:', missingCats.join('; '));
if (errs.length) {
  console.error('校验失败:');
  errs.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
if (basic < 70 || adv < 30) {
  console.error('数量偏离目标(目标约 80 初 + 40 高)');
  process.exit(1);
}
console.log('校验通过。');

// ---------- 1) 写出 life_sentences.js ----------
const jsContent = 'window.LIFE_SENTENCES = ' + JSON.stringify(records, null, 2) + ';\n';
fs.writeFileSync(path.join(ROOT, 'life_sentences.js'), jsContent, 'utf8');
console.log('已写出 life_sentences.js');

// ---------- 2) 写出 life_sentences.xlsx（零依赖 zip+deflateRaw） ----------
function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function colLetter(idx) { // 0-based -> A,B,...
  let s = ''; let i = idx + 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
const CRC_TABLE = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function buildZip(files) {
  const enc = s => Buffer.from(s, 'utf8');
  const locals = []; const centrals = []; let offset = 0;
  for (const f of files) {
    const nameBuf = enc(f.name);
    const comp = zlib.deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename
    local.writeUInt16LE(8, 8);      // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(f.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, end]);
}

// 列：A=category B=en C=wordCount D=zh E=audioUrl F=level
const header = ['category', 'en', 'wordCount', 'zh', 'audioUrl', 'level'];
const rows = [header].concat(records.map(r => [r.category, r.en, r.wordCount, r.zh, r.audioUrl, r.level]));

function cellXml(col, rowIdx, value, isNum) {
  const ref = col + rowIdx;
  if (isNum) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
}
let sheetRows = '';
rows.forEach((row, ri) => {
  const rowIdx = ri + 1;
  let cells = '';
  row.forEach((val, ci) => { cells += cellXml(colLetter(ci), rowIdx, val, ci === 2); });
  sheetRows += `<row r="${rowIdx}">${cells}</row>`;
});
const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sentences" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const zip = buildZip([
  { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
  { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
  { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
  { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
  { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml, 'utf8') },
]);
fs.writeFileSync(path.join(ROOT, 'life_sentences.xlsx'), zip);
console.log('已写出 life_sentences.xlsx (' + zip.length + ' bytes)');