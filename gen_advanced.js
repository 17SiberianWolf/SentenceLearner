// One-off generator for SentenceLearner advanced (高级) sentence material.
// Validates every sentence is >15 words (engine.levelOf => 高级) before emitting advanced.js.
// Run: node gen_advanced.js
const fs = require('fs');
const path = require('path');

// Word-count algorithm must match engine.js levelOf exactly:
// en.trim().split(/\s+/).filter(Boolean).length
function wordCount(en) {
  return en.trim().split(/\s+/).filter(Boolean).length;
}
function levelOf(en) {
  return wordCount(en) <= 15 ? '初级' : '高级';
}

const raw = [
  // ---- Progress Reporting ----
  { category: 'Progress Reporting', en: 'I would like to give you a comprehensive update on the overall progress of the project, covering the milestones we have completed and the activities that are currently in progress.', zh: '我想就项目整体进展向您做一份全面汇报，涵盖我们已完成的里程碑以及当前正在进行的工作。' },
  { category: 'Progress Reporting', en: 'Although we are generally on track with the schedule, we have identified a few minor deviations that we are actively managing and that should not affect the final delivery date.', zh: '虽然总体进度符合计划，但我们也发现了一些正在积极处理的轻微偏差，预计不会影响最终交付日期。' },
  { category: 'Progress Reporting', en: 'The mechanical installation has been fully completed and inspected, while the electrical commissioning is expected to start next week once the required permits have been obtained from the local authorities.', zh: '机械安装已全部完成并通过检查，而电气调试预计在下周、从当地主管部门取得所需许可后开始。' },
  { category: 'Progress Reporting', en: 'We have made significant progress on the documentation package, and the final version will be submitted to the customer for review and approval before the end of this month.', zh: '我们已在文件包方面取得重大进展，最终版本将在本月底前提交客户审阅并批准。' },

  // ---- Project Progress and Schedule ----
  { category: 'Project Progress and Schedule', en: 'The current forecast indicates that the project will be completed approximately two weeks ahead of the original baseline schedule, provided that the remaining procurement items arrive on time.', zh: '当前预测表明，在原定基准计划基础上项目将提前约两周完成，前提是剩余采购项按时到货。' },
  { category: 'Project Progress and Schedule', en: 'We have updated the master schedule to reflect the recent changes in scope, and the new critical path now runs through the system integration and factory acceptance testing phases.', zh: '我们已更新总体计划以反映近期范围变更，新的关键路径现在贯穿系统集成与工厂验收测试阶段。' },
  { category: 'Project Progress and Schedule', en: 'Please note that any further delay in the approval of the detailed design could directly impact the start of the site installation and therefore the overall project completion date.', zh: '请注意，详细设计的批准若再有任何延误，将直接影响现场安装的开始时间，进而影响项目整体完工日期。' },
  { category: 'Project Progress and Schedule', en: 'The procurement lead time for the main transformer has been extended by the supplier, which means we need to revise the equipment delivery plan and inform the customer as soon as possible.', zh: '主变压器的采购交货期被供应商延长，这意味着我们需要修订设备交付计划，并尽快通知客户。' },

  // ---- Risk Management ----
  { category: 'Risk Management', en: 'We have identified a potential risk related to the availability of skilled labor during the peak construction period, and we are developing a contingency plan to mitigate its possible impact on the schedule.', zh: '我们已识别出在建设高峰期间熟练劳动力可用性方面的潜在风险，并正在制定应急预案以减轻其对进度的影响。' },
  { category: 'Risk Management', en: 'The main risk we are currently monitoring is the delayed delivery of the long-lead equipment, which could cause a ripple effect across several downstream activities if it is not resolved within the next two weeks.', zh: '我们当前重点监控的主要风险是长周期设备交付延迟，若未来两周内未解决，可能对多项下游活动造成连锁影响。' },
  { category: 'Risk Management', en: 'To reduce the overall project risk, we recommend holding a dedicated risk review meeting with all key stakeholders before the end of the month to align on the mitigation actions and the responsible owners.', zh: '为降低项目整体风险，我们建议在月底前与所有关键干系人召开专门的风险评审会，以对齐缓解措施及责任人。' },
  { category: 'Risk Management', en: 'A formal risk register has been established and is being updated on a weekly basis, so that any new threats to cost, schedule, or quality can be captured and addressed at an early stage.', zh: '我们已建立正式的风险登记册并每周更新，以便尽早识别并处置任何对成本、进度或质量构成的新威胁。' },

  // ---- Change Management ----
  { category: 'Change Management', en: 'We have received a formal change request from the customer regarding the layout of the control room, and we are currently assessing its impact on cost, schedule, and the existing design documentation.', zh: '我们已收到客户关于控制室布置的正式变更请求，目前正在评估其对成本、进度及现有设计文件的影响。' },
  { category: 'Change Management', en: 'Before we can approve and implement this change, we need a clear statement of the technical justification, an updated cost estimate, and the written confirmation from the responsible engineering discipline.', zh: '在批准并实施该变更之前，我们需要清晰的技术合理性说明、更新后的成本估算，以及相关工程专业的书面确认。' },
  { category: 'Change Management', en: 'All approved changes will be documented in the configuration management system and reflected in the next revision of the drawings, so that the site team always works with the latest and correct information.', zh: '所有已批准的变更都将记录于配置管理系统并体现在图纸的下一版次中，确保现场团队始终依据最新且正确的信息工作。' },
  { category: 'Change Management', en: 'Please be aware that implementing this scope change without proper authorization may lead to rework, additional cost, and potential disputes during the final acceptance of the project.', zh: '请注意，未经适当授权即实施该范围变更，可能导致返工、额外成本，并在项目最终验收时引发潜在争议。' },

  // ---- Meeting Management ----
  { category: 'Meeting Management', en: 'At the beginning of the meeting, I would like to briefly walk you through the agenda and confirm that we all share the same understanding of the objectives for today’s discussion.', zh: '会议开始时，我想简要向您介绍议程，并确认我们对于今天讨论的目标有着一致的理解。' },
  { category: 'Meeting Management', en: 'Let us try to keep the discussion focused on the open action items from the last meeting, so that we can close them today and avoid carrying the same topics into the next review.', zh: '让我们尽量把讨论聚焦于上次会议的未决行动项，以便今天将其关闭，避免相同议题拖到下一次评审。' },
  { category: 'Meeting Management', en: 'If we cannot reach a decision on this particular topic today, I suggest that we assign a small task force to investigate the options and report back with a clear recommendation by next Friday.', zh: '如果今天无法就该议题做出决定，我建议成立一个小组去研究各方案，并在下周五前带回明确建议。' },
  { category: 'Meeting Management', en: 'Before we finish, I would like to summarize the key decisions we have made and the action items with their owners, so that everyone leaves the meeting with the same record.', zh: '结束前，我想总结我们所做的关键决定以及各项行动项及其负责人，确保大家离会时记录一致。' },

  // ---- Email Openings and Closings ----
  { category: 'Email Openings and Closings', en: 'Further to our telephone conversation earlier this morning, I am writing to confirm the main points we discussed and to outline the next steps that we agreed to take before the end of the week.', zh: '继今早电话沟通之后，我写此邮件确认我们讨论的要点，并列出我们约定在本周结束前采取的后续步骤。' },
  { category: 'Email Openings and Closings', en: 'I would like to thank you and your team for the productive meeting yesterday, and I am pleased to confirm that we are aligned on the overall approach for the next phase of the work.', zh: '我想感谢您及您的团队昨天的富有成效的会议，并很高兴确认我们就下一阶段工作的总体思路已达成一致。' },
  { category: 'Email Openings and Closings', en: 'Please find attached the revised specification together with a cover note that explains the main changes compared with the previous version, and let us know if you have any comments or questions.', zh: '请查收附件中的修订规范及说明函，其中解释了相对上一版本的主要变更，如有任何意见或疑问请告知。' },
  { category: 'Email Openings and Closings', en: 'Should you require any additional information or clarification on the points raised in this email, please do not hesitate to contact me directly and I will respond as soon as possible.', zh: '若您需要就本邮件所提要点获取更多信息或澄清，请随时直接联系我，我将尽快回复。' },

  // ---- Technical Clarification and Engineering Discussion ----
  { category: 'Technical Clarification and Engineering Discussion', en: 'Could you please clarify the design basis for the cooling water system, in particular the assumptions regarding the ambient temperature and the maximum allowable operating pressure?', zh: '请您澄清冷却水系统的设计依据，尤其是关于环境温度与最大允许工作压力的各项假设。' },
  { category: 'Technical Clarification and Engineering Discussion', en: 'We believe that the current interface definition between the PLC and the SCADA system is incomplete, and we would like to schedule a technical workshop to resolve the open points with your engineering team.', zh: '我们认为 PLC 与 SCADA 系统之间的当前接口定义尚不完整，希望能安排一次技术研讨会与贵方工程团队解决未决问题。' },
  { category: 'Technical Clarification and Engineering Discussion', en: 'Based on our analysis of the process data, the measured vibration levels on the main drive exceed the vendor’s recommended limit, which may indicate a misalignment that needs to be corrected during the next shutdown.', zh: '根据我们对过程数据的分析，主传动实测振动值已超出供应商建议限值，可能表明存在对中偏差，需在下次停机时校正。' },
  { category: 'Technical Clarification and Engineering Discussion', en: 'The proposed modification to the control logic will improve the stability of the casting process, but it requires a careful review of the safety functions to ensure that no interlock is inadvertently disabled.', zh: '所提议的控制逻辑修改将提升连铸工艺的稳定性，但需仔细评审安全功能，以确保没有任何联锁被意外禁用。' },

  // ---- Issues, Risks, and Delays ----
  { category: 'Issues, Risks, and Delays', en: 'We have encountered an unexpected problem with the hydraulic unit during the site test, and our technicians are currently performing a root-cause analysis to determine whether a component needs to be replaced.', zh: '我们在现场测试期间遇到了液压单元的意外问题，技术人员正在进行根因分析，以确定是否需要更换部件。' },
  { category: 'Issues, Risks, and Delays', en: 'The delivery of the spare parts has been delayed by the logistics provider, which means the planned maintenance window next week may have to be postponed until the items are available on site.', zh: '备件交付因物流服务商而延误，这意味着下周计划的维护窗口可能不得不推迟，直至现场收到货物。' },
  { category: 'Issues, Risks, and Delays', en: 'We sincerely apologize for the inconvenience caused by this delay, and we are taking immediate corrective actions together with the supplier to prevent a similar situation from happening again.', zh: '对于此次延误造成的不便我们深表歉意，并正与供应商一起立即采取纠正措施，以防类似情况再次发生。' },
  { category: 'Issues, Risks, and Delays', en: 'This issue has been classified as high priority because it affects the safe operation of the equipment, and we will keep you informed of every significant development until it is fully resolved.', zh: '该问题已被列为高优先级，因为它影响设备安全运行，在彻底解决前我们将及时向您通报每一项重要进展。' },

  // ---- Summarizing a Meeting ----
  { category: 'Summarizing a Meeting', en: 'To summarize the outcome of today’s meeting, we have agreed to proceed with option B, to assign the detailed engineering to your team, and to review the first draft at our next weekly call.', zh: '总结今天的会议成果，我们已同意采用方案 B，将详细设计分配给贵方团队，并在下次周会上评审初稿。' },
  { category: 'Summarizing a Meeting', en: 'As agreed, I will circulate the official meeting minutes by tomorrow noon, including the list of action items, their owners, and the target dates that we confirmed during the discussion.', zh: '按约定，我将于明天中午前分发正式会议纪要，包含行动项清单、负责人及我们在讨论中确认的目标日期。' },
  { category: 'Summarizing a Meeting', en: 'We concluded that the original schedule was no longer realistic given the recent changes, and we therefore decided to re-baseline the plan with the new milestones approved by both parties.', zh: '我们得出结论，鉴于近期变更原定计划已不再现实，因此决定以双方批准的新里程碑对计划重新设定基线。' },

  // ---- Assigning Responsibilities ----
  { category: 'Assigning Responsibilities', en: 'Could you please take ownership of the interface coordination between the mechanical and electrical disciplines, and provide a short status update at our daily stand-up meeting?', zh: '能否请您负责机械与电气专业之间的接口协调，并在每日站会上做一个简短的状态更新？' },
  { category: 'Assigning Responsibilities', en: 'I will be responsible for preparing the monthly progress report, while my colleague will handle the risk register and the associated mitigation actions for the coming period.', zh: '我将负责编制月度进展报告，而我的同事将负责风险登记册及下一阶段的相应缓解措施。' },
  { category: 'Assigning Responsibilities', en: 'We propose to assign the site supervision to a senior engineer from our local office, who has extensive experience with similar continuous casting projects in the region.', zh: '我们建议将现场监督指派给我们当地办公室的一名高级工程师，他在该地区类似连铸项目方面经验丰富。' },

  // ---- Requesting Confirmation ----
  { category: 'Requesting Confirmation', en: 'Could you please confirm that the attached technical proposal accurately reflects your requirements, and let us know whether we may proceed to the detailed engineering phase?', zh: '请您确认所附技术方案是否准确反映了贵方需求，并告知我们是否可以进入详细设计阶段？' },
  { category: 'Requesting Confirmation', en: 'We would appreciate it if you could formally confirm the agreed delivery dates in writing, so that we can finalize the construction sequence and release the corresponding purchase orders.', zh: '如能书面正式确认已商定的交付日期，我们将不胜感激，以便我们敲定施工顺序并下达相应的采购订单。' },
];

let ok = true;
const seen = new Set();
const out = raw.map(function (s, i) {
  const wc = wordCount(s.en);
  const lv = levelOf(s.en);
  if (wc <= 15) { console.error('TOO SHORT (' + wc + ' words): ' + s.en); ok = false; }
  if (lv !== '高级') { console.error('LEVEL MISMATCH: ' + s.en); ok = false; }
  const id = 'adv' + String(i).padStart(3, '0');
  if (seen.has(id)) { console.error('DUP ID: ' + id); ok = false; }
  seen.add(id);
  return {
    id: id,
    category: s.category,
    en: s.en.trim(),
    zh: s.zh.trim(),
    audioUrl: '',
    wordCount: wc,
    level: lv,
    wrongCount: 0,
  };
});

if (!ok) {
  console.error('VALIDATION FAILED — advanced.js NOT written.');
  process.exit(1);
}

const lines = out.map(function (s) {
  return ' {\n' +
    '  "id": "' + s.id + '",\n' +
    '  "category": ' + JSON.stringify(s.category) + ',\n' +
    '  "en": ' + JSON.stringify(s.en) + ',\n' +
    '  "zh": ' + JSON.stringify(s.zh) + ',\n' +
    '  "audioUrl": "",\n' +
    '  "wordCount": ' + s.wordCount + ',\n' +
    '  "level": "高级",\n' +
    '  "wrongCount": 0\n' +
    ' }';
});

const header = '// SentenceLearner advanced (高级) sentences — auto-generated by gen_advanced.js.\n' +
  '// All sentences are >15 words and classified as 高级 by engine.levelOf().\n' +
  '// Merged into the sentence pool via app.js effectiveSentences().\n';
const fileContent = header + 'window.ADVANCED_SENTENCES = [\n' + lines.join(',\n') + '\n];\n';

const target = path.join(__dirname, 'advanced.js');
fs.writeFileSync(target, fileContent, 'utf8');

// Report category distribution
const byCat = {};
out.forEach(function (s) { byCat[s.category] = (byCat[s.category] || 0) + 1; });
console.log('OK: wrote ' + out.length + ' advanced sentences to advanced.js');
console.log('Categories:');
Object.keys(byCat).sort().forEach(function (c) { console.log('  ' + byCat[c] + '  ' + c); });