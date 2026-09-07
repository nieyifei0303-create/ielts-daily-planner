(function () {
  "use strict";

  var START = "2026-09-07";
  var EXAM = "2026-10-11";
  var STORE = "ielts-private-planner-v2";
  var DB_NAME = "ielts-private-files";
  var WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  var DAYS = dateRange(START, EXAM);
  var QUOTES = [
    "稳定完成，比偶尔拼命更接近高分。",
    "分数波动不是退步，它在告诉你薄弱点在哪里。",
    "今天留下的错题原因，会成为明天最短的提分路径。",
    "写作先求结构清楚，口语先求真正开口。",
    "疲惫时缩小任务，不要取消任务。",
    "每一次复盘，都在减少下一次的无效努力。"
  ];
  var PHASES = [
    { start: "2026-09-07", end: "2026-09-13", name: "起步周", short: "起步", detail: "建立打卡与复盘节奏" },
    { start: "2026-09-14", end: "2026-09-27", name: "稳定积累", short: "积累", detail: "听阅轮换，写口每日推进" },
    { start: "2026-09-28", end: "2026-09-30", name: "查漏补缺", short: "补缺", detail: "收拢高频问题" },
    { start: "2026-10-01", end: "2026-10-07", name: "国庆冲刺", short: "冲刺", detail: "全天训练与成套复盘" },
    { start: "2026-10-08", end: "2026-10-11", name: "考前调整", short: "调整", detail: "稳住手感与作息" }
  ];

  var state = loadState();
  var activeView = "today";
  var saveTimer;
  var toastTimer;
  var fileDb = null;
  var el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindNavigation();
    bindDates();
    bindTasks();
    bindReviews();
    bindReport();
    bindBackup();
    state.activeDate = validDate(state.activeDate) ? state.activeDate : currentDate();
    ensureDay(state.activeDate);
    renderDay();
    updateHeader();
    openDb().then(function (db) {
      fileDb = db;
      renderFiles();
    }).catch(function () {
      toast("附件存储不可用，其他功能不受影响");
    });
    window.setTimeout(icons, 0);
  }

  function cacheElements() {
    var ids = [
      "phaseLabel", "pageTitle", "countdownDays", "sidebarQuote", "prevDay", "nextDay",
      "dateTrigger", "datePicker", "selectedDateLong", "selectedDateMeta", "dayProgressText",
      "dayProgressDetail", "dayProgressBar", "dayStatusMessage", "taskTimeline", "addTask",
      "reviewWin", "reviewImprove", "autosaveState", "metricOverall", "metricOverallSub",
      "metricHours", "metricHoursSub", "metricStreak", "metricStreakSub", "metricPhase",
      "metricPhaseSub", "weeklyChart", "calendarGrid", "roadmapList", "exportData",
      "importDataButton", "importDataInput", "reportForm", "reportDateLabel", "listeningScore",
      "readingScore", "writingState", "speakingState", "difficultyOptions", "energyRange",
      "energyValue", "studyLog", "attachmentInput", "attachmentList", "coachEmpty",
      "coachResult", "coachEncouragement", "coachDiagnosis", "coachTomorrowTitle",
      "coachPriorities", "coachCaution", "coachGeneratedAt", "toast"
    ];
    ids.forEach(function (id) { el[id] = document.getElementById(id); });
    el.nav = Array.from(document.querySelectorAll(".nav-item"));
    el.views = Array.from(document.querySelectorAll("[data-view-panel]"));
  }

  function bindNavigation() {
    el.nav.forEach(function (button) {
      button.addEventListener("click", function () { switchView(button.dataset.view); });
    });
  }

  function switchView(view) {
    activeView = view;
    el.nav.forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === view);
    });
    el.views.forEach(function (panel) {
      var selected = panel.dataset.viewPanel === view;
      panel.hidden = !selected;
      panel.classList.toggle("active", selected);
    });
    el.pageTitle.textContent = { today: "今日计划", progress: "进度总览", report: "学习汇报" }[view];
    if (view === "progress") renderProgress();
    if (view === "report") renderReport();
    window.scrollTo({ top: 0, behavior: "smooth" });
    icons();
  }

  function bindDates() {
    el.prevDay.addEventListener("click", function () { moveDay(-1); });
    el.nextDay.addEventListener("click", function () { moveDay(1); });
    el.dateTrigger.addEventListener("click", function () {
      if (typeof el.datePicker.showPicker === "function") el.datePicker.showPicker();
      else el.datePicker.click();
    });
    el.datePicker.addEventListener("change", function () {
      if (validDate(el.datePicker.value)) selectDate(el.datePicker.value);
    });
  }

  function moveDay(amount) {
    var next = DAYS[DAYS.indexOf(state.activeDate) + amount];
    if (next) selectDate(next);
  }

  function selectDate(date) {
    if (!validDate(date)) return;
    state.activeDate = date;
    ensureDay(date);
    saveState();
    updateHeader();
    if (activeView === "today") renderDay();
    if (activeView === "progress") renderProgress();
    if (activeView === "report") renderReport();
  }

  function bindTasks() {
    el.addTask.addEventListener("click", function () {
      var day = ensureDay(state.activeDate);
      var last = day.tasks[day.tasks.length - 1];
      day.tasks.push({
        id: uid(),
        time: last ? plusTime(last.time, last.duration) : "20:00",
        title: "自定义任务",
        duration: 30,
        detail: "",
        note: "",
        done: false
      });
      saveState();
      renderDay();
      toast("已添加任务，可直接编辑");
    });

    el.taskTimeline.addEventListener("input", taskChanged);
    el.taskTimeline.addEventListener("change", taskChanged);
    el.taskTimeline.addEventListener("click", function (event) {
      var button = event.target.closest("[data-delete-task]");
      if (!button) return;
      var day = ensureDay(state.activeDate);
      if (day.tasks.length === 1) {
        toast("每天至少保留一个任务");
        return;
      }
      if (!window.confirm("删除这项任务？")) return;
      day.tasks = day.tasks.filter(function (task) { return task.id !== button.dataset.deleteTask; });
      saveState();
      renderDay();
      toast("任务已删除");
    });
  }

  function taskChanged(event) {
    var input = event.target.closest("[data-task-id]");
    if (!input) return;
    var day = ensureDay(state.activeDate);
    var task = day.tasks.find(function (item) { return item.id === input.dataset.taskId; });
    if (!task) return;
    var field = input.dataset.field;
    if (field === "done") task.done = input.checked;
    else if (field === "duration") task.duration = clamp(Number(input.value), 5, 600);
    else task[field] = input.value;
    scheduleSave();
    updateDayProgress(day);
    if (field === "done") {
      input.closest(".task-card").classList.toggle("done", task.done);
      if (task.done) toast("完成一项，进度已经记下");
    }
  }

  function bindReviews() {
    function update() {
      var day = ensureDay(state.activeDate);
      day.review.win = el.reviewWin.value;
      day.review.improve = el.reviewImprove.value;
      scheduleSave();
    }
    el.reviewWin.addEventListener("input", update);
    el.reviewImprove.addEventListener("input", update);
  }

  function bindReport() {
    [el.listeningScore, el.readingScore, el.writingState, el.speakingState, el.energyRange, el.studyLog].forEach(function (input) {
      input.addEventListener("input", saveReport);
      input.addEventListener("change", saveReport);
    });
    el.difficultyOptions.addEventListener("change", saveReport);
    el.energyRange.addEventListener("input", function () {
      el.energyValue.textContent = el.energyRange.value + " / 5";
    });
    el.reportForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveReport();
      var day = ensureDay(state.activeDate);
      day.coach = makeAdvice(state.activeDate, day);
      saveState();
      renderCoach(day.coach);
      toast("复盘建议已生成");
    });
    el.attachmentInput.addEventListener("change", uploadFiles);
    el.attachmentList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-file]");
      if (!button || !fileDb) return;
      if (!window.confirm("从本机删除这个附件？")) return;
      deleteFile(button.dataset.removeFile).then(function () {
        renderFiles();
        toast("附件已删除");
      });
    });
  }

  function bindBackup() {
    el.exportData.addEventListener("click", exportBackup);
    el.importDataButton.addEventListener("click", function () { el.importDataInput.click(); });
    el.importDataInput.addEventListener("change", importBackup);
  }

  function renderDay() {
    var date = state.activeDate;
    var day = ensureDay(date);
    var parsed = parseDate(date);
    el.datePicker.value = date;
    el.selectedDateLong.textContent = (parsed.getMonth() + 1) + " 月 " + parsed.getDate() + " 日 · " + WEEKDAYS[parsed.getDay()];
    el.selectedDateMeta.textContent = focus(date) + "主项 · 目标 " + hours(plannedMinutes(day));
    el.prevDay.disabled = date === START;
    el.nextDay.disabled = date === EXAM;
    el.reviewWin.value = day.review.win || "";
    el.reviewImprove.value = day.review.improve || "";
    el.sidebarQuote.textContent = QUOTES[dateIndex(date) % QUOTES.length];

    el.taskTimeline.innerHTML = day.tasks.map(taskMarkup).join("");
    updateDayProgress(day);
    icons();
  }

  function taskMarkup(task) {
    var checked = task.done ? " checked" : "";
    var doneClass = task.done ? " done" : "";
    return '<article class="task-card' + doneClass + '" data-task-card="' + safe(task.id) + '">' +
      '<label class="task-time"><span class="sr-only">开始时间</span>' +
      '<input class="task-time-input" data-task-id="' + safe(task.id) + '" data-field="time" type="time" value="' + safe(task.time) + '"></label>' +
      '<label class="task-marker" aria-label="切换完成状态"><input data-task-id="' + safe(task.id) + '" data-field="done" type="checkbox"' + checked + '></label>' +
      '<div class="task-content"><div class="task-topline"><label><span class="sr-only">任务名称</span>' +
      '<input class="task-title" data-task-id="' + safe(task.id) + '" data-field="title" value="' + safe(task.title) + '" aria-label="任务名称"></label>' +
      '<label class="duration-field"><span class="sr-only">计划分钟</span><input class="task-duration" data-task-id="' + safe(task.id) + '" data-field="duration" type="number" min="5" max="600" step="5" value="' + Number(task.duration) + '" aria-label="计划分钟"><span>分钟</span></label></div>' +
      '<label><span class="sr-only">具体内容</span><input class="task-detail" data-task-id="' + safe(task.id) + '" data-field="detail" value="' + safe(task.detail) + '" placeholder="填写这段时间具体练什么"></label>' +
      '<label><span class="sr-only">任务备注与复盘</span><textarea class="task-note" data-task-id="' + safe(task.id) + '" data-field="note" rows="2" placeholder="完成后写一句：哪里顺、哪里卡、下次怎么改">' + safe(task.note) + '</textarea></label></div>' +
      '<div class="task-actions"><button class="delete-task" type="button" data-delete-task="' + safe(task.id) + '" aria-label="删除任务" title="删除任务"><i data-lucide="trash-2" aria-hidden="true"></i></button></div></article>';
  }

  function updateDayProgress(day) {
    var total = day.tasks.length;
    var done = day.tasks.filter(function (task) { return task.done; }).length;
    var completed = completedMinutes(day);
    var percent = total ? Math.round(done / total * 100) : 0;
    el.dayProgressText.textContent = "今日完成 " + percent + "%";
    el.dayProgressDetail.textContent = done + " / " + total + " 项 · 已完成 " + completed + " 分钟";
    el.dayProgressBar.style.width = percent + "%";
    el.dayProgressBar.parentElement.setAttribute("aria-valuenow", String(percent));
    el.dayStatusMessage.textContent = statusText(percent, day.report.energy);
    el.selectedDateMeta.textContent = focus(state.activeDate) + "主项 · 目标 " + hours(plannedMinutes(day));
  }

  function renderProgress() {
    var today = currentDate();
    var elapsed = DAYS.filter(function (date) { return date <= today; });
    var planned = 0;
    var completed = 0;
    elapsed.forEach(function (date) {
      planned += plannedMinutes(ensureDay(date));
      completed += completedMinutes(ensureDay(date));
    });
    var overall = planned ? Math.round(completed / planned * 100) : 0;
    var activeDays = elapsed.filter(function (date) { return completion(ensureDay(date)) > 0; }).length;
    var phase = phaseAt(today);
    var streak = streakAt(today);
    el.metricOverall.textContent = overall + "%";
    el.metricOverallSub.textContent = activeDays ? "已有 " + activeDays + " 天留下记录" : "从今天开始记录";
    el.metricHours.textContent = hours(completed, true);
    el.metricHoursSub.textContent = "截至今日计划 " + hours(planned);
    el.metricStreak.textContent = streak + " 天";
    el.metricStreakSub.textContent = streak ? "保持住，不必追求每天满格" : "完成 60% 即计入";
    el.metricPhase.textContent = phase.short;
    el.metricPhaseSub.textContent = phase.detail;
    renderWeekly();
    renderCalendar();
    renderRoadmap(today);
  }

  function renderWeekly() {
    var weeks = [0, 1, 2, 3, 4].map(function (index) {
      var dates = DAYS.slice(index * 7, index * 7 + 7);
      return {
        dates: dates,
        planned: dates.reduce(function (sum, date) { return sum + plannedMinutes(ensureDay(date)); }, 0),
        done: dates.reduce(function (sum, date) { return sum + completedMinutes(ensureDay(date)); }, 0)
      };
    });
    var max = Math.max.apply(null, weeks.map(function (week) { return week.planned; }).concat([1]));
    el.weeklyChart.innerHTML = weeks.map(function (week) {
      var first = parseDate(week.dates[0]);
      var last = parseDate(week.dates[week.dates.length - 1]);
      var plannedHeight = Math.max(2, Math.round(week.planned / max * 155));
      var doneHeight = Math.max(2, Math.round(week.done / max * 155));
      return '<div class="week-column"><div class="week-bars">' +
        '<div class="week-bar planned" style="height:' + plannedHeight + 'px"><span>' + hours(week.planned, true) + '</span></div>' +
        '<div class="week-bar done" style="height:' + doneHeight + 'px"><span>' + hours(week.done, true) + '</span></div></div>' +
        '<span>' + (first.getMonth() + 1) + "." + pad(first.getDate()) + "–" + (last.getMonth() + 1) + "." + pad(last.getDate()) + '</span></div>';
    }).join("");
  }

  function renderCalendar() {
    el.calendarGrid.innerHTML = DAYS.map(function (date) {
      var day = ensureDay(date);
      var pct = completion(day);
      var level = pct === 0 ? 0 : pct < 40 ? 1 : pct < 70 ? 2 : pct < 100 ? 3 : 4;
      var parsed = parseDate(date);
      var isExam = date === EXAM;
      var label = isExam ? "考试 14:00" : pct ? "完成 " + pct + "%" : hours(plannedMinutes(day));
      return '<button class="calendar-day' + (date === state.activeDate ? " current" : "") + (isExam ? " exam" : "") +
        '" type="button" data-calendar-date="' + date + '" data-level="' + level + '" aria-label="' + longDate(date) + '，完成 ' + pct + '%">' +
        '<strong>' + (parsed.getMonth() + 1) + "/" + parsed.getDate() + '</strong><span>' + label + '</span></button>';
    }).join("");
    Array.from(el.calendarGrid.querySelectorAll("[data-calendar-date]")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeDate = button.dataset.calendarDate;
        ensureDay(state.activeDate);
        saveState();
        updateHeader();
        switchView("today");
        renderDay();
      });
    });
  }

  function renderRoadmap(date) {
    var active = phaseAt(date);
    el.roadmapList.innerHTML = PHASES.map(function (phase) {
      return '<div class="roadmap-item' + (phase.name === active.name ? " active" : "") + '"><strong>' + phase.name + '</strong>' +
        '<span>' + shortDate(phase.start) + "–" + shortDate(phase.end) + '<br>' + phase.detail + '</span></div>';
    }).join("");
  }

  function renderReport() {
    var day = ensureDay(state.activeDate);
    var report = day.report;
    el.reportDateLabel.textContent = longDate(state.activeDate);
    el.listeningScore.value = report.listeningScore === null ? "" : report.listeningScore;
    el.readingScore.value = report.readingScore === null ? "" : report.readingScore;
    el.writingState.value = report.writingState;
    el.speakingState.value = report.speakingState;
    el.energyRange.value = report.energy;
    el.energyValue.textContent = report.energy + " / 5";
    el.studyLog.value = report.log || "";
    Array.from(el.difficultyOptions.querySelectorAll("input")).forEach(function (input) {
      input.checked = report.difficulties.indexOf(input.value) >= 0;
    });
    renderCoach(day.coach);
    renderFiles();
  }

  function saveReport() {
    var day = ensureDay(state.activeDate);
    day.report = {
      listeningScore: score(el.listeningScore.value),
      readingScore: score(el.readingScore.value),
      writingState: el.writingState.value,
      speakingState: el.speakingState.value,
      energy: Number(el.energyRange.value),
      difficulties: Array.from(el.difficultyOptions.querySelectorAll("input:checked")).map(function (input) { return input.value; }),
      log: el.studyLog.value
    };
    scheduleSave();
  }

  function makeAdvice(date, day) {
    var report = day.report;
    var pct = completion(day);
    var tomorrow = DAYS[DAYS.indexOf(date) + 1] || null;
    var diff = report.difficulties || [];
    var log = (report.log || "").toLowerCase();
    var weak = { listening: 0, reading: 0, writing: 2, speaking: 3 };
    if (report.listeningScore !== null) weak.listening += Math.max(0, 7 - report.listeningScore) * 2;
    if (report.readingScore !== null) weak.reading += Math.max(0, 7 - report.readingScore) * 2;
    weak.writing += report.writingState === "not-done" ? 3 : report.writingState === "stuck" ? 4 : report.writingState === "good" ? -1 : 0;
    weak.speaking += report.speakingState === "not-done" ? 4 : report.speakingState === "stuck" ? 4 : report.speakingState === "good" ? -1 : 0;
    diff.forEach(function (item) {
      if (/听力|同义/.test(item)) weak.listening += 3;
      if (/阅读|判断|匹配/.test(item)) weak.reading += 3;
      if (/写作|论证/.test(item)) weak.writing += 3;
      if (/口语/.test(item)) weak.speaking += 3;
    });
    if (/section|听力|漏听|连读|拼写|地图题|选择题/.test(log)) weak.listening += 2;
    if (/阅读|heading|判断题|匹配题|长难句|来不及|时间不够/.test(log)) weak.reading += 2;
    if (/写作|task ?1|task ?2|小作文|大作文|语法|审题|论证/.test(log)) weak.writing += 2;
    if (/口语|part ?1|part ?2|part ?3|发音|卡顿|没话说|流利/.test(log)) weak.speaking += 2;
    var weakest = Object.keys(weak).sort(function (a, b) { return weak[b] - weak[a]; })[0];
    var scoreText = [];
    if (report.listeningScore !== null) scoreText.push("听力 " + report.listeningScore);
    if (report.readingScore !== null) scoreText.push("阅读 " + report.readingScore);
    var diagnosis = "今天完成了 " + pct + "% 的计划";
    if (scoreText.length) diagnosis += "，练习分数为" + scoreText.join("、");
    diagnosis += diff.length ? "。你标出的主要卡点是" + diff.join("、") : "。目前记录里的问题还不够集中，明天继续写下具体题型和错误原因";
    diagnosis += "。综合完成度与自评，当前最值得优先处理的是" + skillName(weakest) + "。";
    var encouragement = pct >= 85
      ? "今天的价值不只在于完成得多，而在于你把一整天的节奏变成了可复制的经验。"
      : pct >= 55
        ? "你已经守住了今天最重要的部分。剩下的缺口不需要自责，只需要变成明天更准确的安排。"
        : report.energy <= 2
          ? "低精力日还能留下记录，本身就是在保护长期节奏。今天不代表能力，只代表今天的体力。"
          : "没完成的部分不是欠账，它只是提示计划还需要更贴近真实生活。明天从最小的一块重新启动。";
    var priorities = [];
    if (!tomorrow) {
      priorities.push("考试当天只做熟悉材料的轻量热身，不接触新题型，也不临时加量。");
      priorities.push("提前准备证件与路线，午餐清淡，至少提前 45 分钟到场。");
    } else {
      var nextDay = ensureDay(tomorrow);
      var primary = nextDay.tasks.filter(function (task) { return task.title.indexOf("主项") >= 0; })
        .reduce(function (sum, task) { return sum + Number(task.duration || 0); }, 0);
      priorities.push("主项按轮换做" + focus(tomorrow) + "，预留约 " + (primary || 90) + " 分钟。先限时完成，再把错误分成“知识、定位、时间”三类。");
      priorities.push(specificAdvice(weakest, diff, log));
      if (weakest !== "writing") priorities.push(specificAdvice("writing", diff, log));
      if (weakest !== "speaking") priorities.push(specificAdvice("speaking", diff, log));
    }
    var caution = "周中时间被工作切碎时，把早起 1 小时当成不可挪动的主任务；晚间只补关键缺口，不用补到深夜。";
    if (tomorrow && plannedMinutes(ensureDay(tomorrow)) >= 420) {
      caution = "明天是全天训练日。每 90–120 分钟离桌休息，成套练习后必须留出复盘时间，题量不能替代纠错。";
    } else if (tomorrow && plannedMinutes(ensureDay(tomorrow)) <= 210) {
      caution = "明天可用时间较短，只保留主项、写作、口语三个块；每块结束写一句结论，不追加低价值任务。";
    } else if (tomorrow && phaseAt(tomorrow).short === "调整") {
      caution = "考前阶段优先稳定手感与作息，不再大幅改方法。任何新发现都只记录，不在最后两天重建体系。";
    }
    return {
      encouragement: encouragement,
      diagnosis: diagnosis,
      priorities: priorities.slice(0, 4),
      caution: caution,
      tomorrow: tomorrow,
      generatedAt: new Date().toISOString()
    };
  }

  function specificAdvice(skill, diff, log) {
    if (skill === "listening") {
      if (diff.indexOf("同义替换") >= 0 || /同义/.test(log)) return "听力补洞 35 分钟：重做一组错题，逐题写出题干词、录音替换词和导致失分的原词，只精听错题所在句。";
      return "听力补洞 35 分钟：做一组选择或定位题，审题时圈出预测信息；错题只回听关键句，并记录是漏听、误判还是拼写。";
    }
    if (skill === "reading") {
      if (diff.indexOf("判断匹配") >= 0 || /heading|判断|匹配/.test(log)) return "阅读补洞 40 分钟：限时做一组判断或匹配题，每题保留定位句；把“原文证据”和“错误判断”并排写下。";
      return "阅读补洞 40 分钟：限时完成一篇，先记各题结束时间；复盘只处理耗时最长的题型和两个最典型错因。";
    }
    if (skill === "writing") {
      if (diff.indexOf("写作审题") >= 0 || /审题/.test(log)) return "写作推进 30 分钟：选 2 道 Task 2，只做 5 分钟审题和双边提纲；检查每个主体段能否用一句中心句概括。";
      if (diff.indexOf("论证结构") >= 0 || /论证|展开/.test(log)) return "写作推进 35 分钟：围绕一个观点写“主张—解释—例子—回扣”完整段落，删掉与中心句无关的句子。";
      return "写作推进 30 分钟：完成一个主体段或一份 Task 1 结构提纲；目标是逻辑完整，不追求生词密度。";
    }
    if (diff.indexOf("口语素材") >= 0 || /没话说|素材/.test(log)) return "口语推进 30 分钟：围绕一个 Part 2 话题整理 4 个故事节点，连续录音两遍；第二遍只改停顿和内容顺序。";
    return "口语推进 25 分钟：做 1 次 Part 2 计时录音，回听标出三处卡顿；用更短的句子重说一次，不逐句背稿。";
  }

  function renderCoach(coach) {
    if (!coach) {
      el.coachEmpty.hidden = false;
      el.coachResult.hidden = true;
      return;
    }
    el.coachEmpty.hidden = true;
    el.coachResult.hidden = false;
    el.coachEncouragement.textContent = coach.encouragement;
    el.coachDiagnosis.textContent = coach.diagnosis;
    el.coachTomorrowTitle.textContent = coach.tomorrow ? longDate(coach.tomorrow) + "侧重点" : "考试日提醒";
    el.coachPriorities.innerHTML = coach.priorities.map(function (item) { return "<li>" + safe(item) + "</li>"; }).join("");
    el.coachCaution.textContent = coach.caution;
    el.coachGeneratedAt.textContent = "生成于 " + new Date(coach.generatedAt).toLocaleString("zh-CN", { hour12: false });
  }

  function updateHeader() {
    el.phaseLabel.textContent = phaseAt(state.activeDate).name;
    el.countdownDays.textContent = String(Math.max(0, dateIndex(EXAM) - dateIndex(state.activeDate)));
    if (activeView === "today") el.pageTitle.textContent = "今日计划";
  }

  function defaultDay(date) {
    var target = targetHours(date);
    return {
      targetHours: target,
      tasks: taskTemplate(target, focus(date), date),
      review: { win: "", improve: "" },
      report: { listeningScore: null, readingScore: null, writingState: "not-done", speakingState: "not-done", energy: 3, difficulties: [], log: "" },
      coach: null
    };
  }

  function taskTemplate(target, mainFocus, date) {
    var specs;
    if (date === EXAM) {
      specs = [["09:00", "轻量热身", 30], ["09:40", "口语状态校准", 30], ["10:20", "写作结构回顾", 30], ["11:00", "听阅手感保持", 30]];
    } else if (target >= 7.5) {
      specs = [["08:30", mainFocus + "主项 · 第一块", 120], ["10:45", mainFocus + "主项 · 复盘块", 90], ["14:00", "写作推进", 120], ["16:15", "口语推进", 90], ["19:30", "薄弱项补洞", 30], ["20:15", "当日归档", 30]];
    } else if (target >= 5.5) {
      specs = [["08:30", mainFocus + "主项 · 限时训练", 120], ["10:45", "写作推进", 90], ["14:00", "口语推进", 60], ["15:15", "错题与薄弱项", 60], ["16:30", "考前归档", 30]];
    } else if (target >= 3.25 && target < 4) {
      specs = [["09:00", mainFocus + "主项", 120], ["11:15", "写作推进", 45], ["14:30", "口语推进", 30], ["15:10", "快速复盘", 15]];
    } else if (target < 3) {
      specs = [["09:30", mainFocus + "主项", 90], ["11:10", "写作推进", 30], ["20:00", "口语推进", 30]];
    } else {
      specs = [["07:00", mainFocus + "主项 · 早间", 60], ["12:20", "写作推进", 30], ["18:20", "口语推进", 30], ["20:30", mainFocus + "主项 · 晚间", 90], ["22:05", "错题与当日复盘", 30]];
    }
    return specs.map(function (spec) {
      return { id: uid(), time: spec[0], title: spec[1], duration: spec[2], detail: "", note: "", done: false };
    });
  }

  function targetHours(date) {
    if (date === EXAM) return 2;
    if (date >= "2026-10-01" && date <= "2026-10-07") return 8;
    if (date === "2026-10-10") return 6;
    if (date === "2026-09-12" || date === "2026-09-13") return 8;
    if (date === "2026-09-19" || date === "2026-09-20") return 2.5;
    if (date >= "2026-09-25" && date <= "2026-09-27") return 3.5;
    return 4;
  }

  function focus(date) {
    return dateIndex(date) % 2 === 0 ? "听力" : "阅读";
  }

  function phaseAt(date) {
    return PHASES.find(function (phase) { return date >= phase.start && date <= phase.end; }) || PHASES[0];
  }

  function ensureDay(date) {
    if (!state.days[date]) state.days[date] = defaultDay(date);
    var day = state.days[date];
    day.review = day.review || { win: "", improve: "" };
    day.report = Object.assign({ listeningScore: null, readingScore: null, writingState: "not-done", speakingState: "not-done", energy: 3, difficulties: [], log: "" }, day.report || {});
    day.tasks = Array.isArray(day.tasks) && day.tasks.length ? day.tasks : defaultDay(date).tasks;
    return day;
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE));
      if (saved && saved.days && typeof saved.days === "object") return { version: 1, activeDate: saved.activeDate || currentDate(), days: saved.days };
    } catch (error) {
      console.warn("Could not read local state", error);
    }
    return { version: 1, activeDate: currentDate(), days: {} };
  }

  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (error) {
      toast("本地存储空间不足，请先导出备份");
    }
    if (el.autosaveState) el.autosaveState.textContent = "已自动保存";
  }

  function scheduleSave() {
    if (el.autosaveState) el.autosaveState.textContent = "正在保存…";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveState, 220);
  }

  function exportBackup() {
    saveState();
    var payload = Object.assign({ exportedAt: new Date().toISOString(), note: "Attachments stay in this browser." }, state);
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "ielts-backup-" + iso(new Date()) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("备份已导出（不含附件）");
  }

  function importBackup(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    file.text().then(function (text) {
      var parsed = JSON.parse(text);
      if (!parsed.days || typeof parsed.days !== "object") throw new Error("invalid");
      if (!window.confirm("导入会覆盖当前计划与打卡数据，继续吗？")) return;
      state = { version: 1, activeDate: validDate(parsed.activeDate) ? parsed.activeDate : currentDate(), days: parsed.days };
      saveState();
      renderDay();
      updateHeader();
      renderProgress();
      toast("备份已导入");
    }).catch(function () { toast("无法识别这份备份文件"); });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("files")) {
          var files = db.createObjectStore("files", { keyPath: "id" });
          files.createIndex("date", "date", { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function uploadFiles() {
    var files = Array.from(el.attachmentInput.files || []);
    if (!files.length) return;
    if (!fileDb) {
      toast("附件存储尚未准备好，请稍后再试");
      return;
    }
    Promise.all(files.map(function (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast(file.name + " 超过 25MB，未添加");
        return Promise.resolve();
      }
      return putFile(state.activeDate, file);
    })).then(function () {
      el.attachmentInput.value = "";
      renderFiles();
      toast("附件已保存在本机");
    });
  }

  function putFile(date, file) {
    return new Promise(function (resolve, reject) {
      var transaction = fileDb.transaction("files", "readwrite");
      transaction.objectStore("files").put({
        id: date + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        date: date, name: file.name, type: file.type, size: file.size, blob: file, createdAt: new Date().toISOString()
      });
      transaction.oncomplete = resolve;
      transaction.onerror = function () { reject(transaction.error); };
    });
  }

  function getFiles(date) {
    return new Promise(function (resolve, reject) {
      if (!fileDb) {
        resolve([]);
        return;
      }
      var request = fileDb.transaction("files", "readonly").objectStore("files").index("date").getAll(date);
      request.onsuccess = function () { resolve(request.result || []); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function deleteFile(id) {
    return new Promise(function (resolve, reject) {
      var transaction = fileDb.transaction("files", "readwrite");
      transaction.objectStore("files").delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = function () { reject(transaction.error); };
    });
  }

  function renderFiles() {
    if (!el.attachmentList) return;
    var date = state.activeDate;
    getFiles(date).then(function (files) {
      if (date !== state.activeDate) return;
      el.attachmentList.innerHTML = files.map(function (file) {
        return '<div class="attachment-item"><div><strong>' + safe(file.name) + '</strong><small>' + fileSize(file.size) + ' · 已保存到本机</small></div>' +
          '<button type="button" data-remove-file="' + safe(file.id) + '" aria-label="删除附件" title="删除附件"><i data-lucide="x" aria-hidden="true"></i></button></div>';
      }).join("");
      icons();
    }).catch(function () {});
  }

  function streakAt(date) {
    var cursor = DAYS.indexOf(date);
    var count = 0;
    while (cursor >= 0 && completion(ensureDay(DAYS[cursor])) >= 60) {
      count += 1;
      cursor -= 1;
    }
    return count;
  }

  function completion(day) {
    return day.tasks.length ? Math.round(day.tasks.filter(function (task) { return task.done; }).length / day.tasks.length * 100) : 0;
  }

  function plannedMinutes(day) {
    return day.tasks.reduce(function (sum, task) { return sum + Number(task.duration || 0); }, 0);
  }

  function completedMinutes(day) {
    return day.tasks.filter(function (task) { return task.done; }).reduce(function (sum, task) { return sum + Number(task.duration || 0); }, 0);
  }

  function statusText(percent, energy) {
    if (percent === 100) return "今天收口了。复盘一句，比立刻加题更有价值。";
    if (percent >= 75) return "主体已经完成，剩下的任务只求清楚收尾。";
    if (percent >= 40) return "节奏已经建立，继续完成下一块就够了。";
    if (Number(energy) <= 2) return "精力低就缩小任务，但保留一次真正的开始。";
    return "先完成第一小块，让今天动起来。";
  }

  function skillName(key) {
    return { listening: "听力定位与辨音", reading: "阅读速度与证据定位", writing: "写作结构与展开", speaking: "口语流利度与素材" }[key];
  }

  function currentDate() {
    var today = iso(new Date());
    if (today < START) return START;
    if (today > EXAM) return EXAM;
    return today;
  }

  function validDate(date) {
    return typeof date === "string" && DAYS.indexOf(date) >= 0;
  }

  function dateRange(start, end) {
    var result = [];
    var cursor = parseDate(start);
    var last = parseDate(end);
    while (cursor <= last) {
      result.push(iso(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12);
    }
    return result;
  }

  function parseDate(value) {
    var parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }

  function iso(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function dateIndex(date) {
    return Math.round((parseDate(date) - parseDate(START)) / 86400000);
  }

  function shortDate(date) {
    var parsed = parseDate(date);
    return (parsed.getMonth() + 1) + "." + pad(parsed.getDate());
  }

  function longDate(date) {
    var parsed = parseDate(date);
    return (parsed.getMonth() + 1) + " 月 " + parsed.getDate() + " 日 · " + WEEKDAYS[parsed.getDay()];
  }

  function hours(minutes, compact) {
    var value = Math.round(minutes / 60 * 10) / 10;
    return compact ? value + "h" : value + " 小时";
  }

  function plusTime(time, minutes) {
    var parts = String(time || "20:00").split(":").map(Number);
    var total = ((parts[0] || 0) * 60 + (parts[1] || 0) + Number(minutes || 0)) % 1440;
    return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
  }

  function score(value) {
    return value === "" ? null : clamp(Number(value), 0, 9);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function fileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function uid() {
    return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function safe(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function icons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.toast.classList.remove("show"); }, 2200);
  }
})();
