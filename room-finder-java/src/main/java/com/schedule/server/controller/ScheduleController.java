package com.schedule.server.controller;

import com.schedule.server.dto.ScheduleFileDto;
import com.schedule.server.model.Subject;
import com.schedule.server.service.ScheduleService;
import com.schedule.server.service.SubjectService;
import com.schedule.server.tcp.SubjectTcpSender;
import kvt.model.Auditory;
import kvt.model.AuditoryJournal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
@RequiredArgsConstructor
@Slf4j
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final SubjectService subjectService;
    private final SubjectTcpSender subjectTcpSender;

    // =============== UPLOAD ===============

    /**
     * POST /api/schedule/upload
     * Принимает JSON расписания, извлекает кабинеты + время → auditory / auditory_journal.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadSchedule(@RequestBody ScheduleFileDto dto) {
        log.info("Received schedule upload: {}", dto.getFileName());

        Map<String, Object> saveResult = scheduleService.saveSchedule(dto);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        response.put("message", "Расписание успешно обработано");
        response.putAll(saveResult);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // =============== AUDITORIES ===============

    /**
     * GET /api/schedule/auditories
     * Список всех аудиторий.
     */
    @GetMapping("/auditories")
    public ResponseEntity<List<Map<String, Object>>> getAllAuditories() {
        List<Auditory> auditories = scheduleService.getAllAuditories();

        List<Map<String, Object>> result = auditories.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.id());
            m.put("name", a.name());
            m.put("number", a.number());
            m.put("corpus", a.corpus());
            m.put("category", a.category());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    // =============== JOURNAL ===============

    /**
     * GET /api/schedule/journal
     * Весь журнал занятости аудиторий.
     */
    @GetMapping("/journal")
    public ResponseEntity<List<Map<String, Object>>> getAllJournal() {
        List<AuditoryJournal> journal = scheduleService.getAllJournal();
        List<Map<String, Object>> result = journal.stream().map(this::mapJournalToResponse).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/schedule/journal/{audId}
     * Журнал занятости конкретной аудитории.
     */
    @GetMapping("/journal/{audId}")
    public ResponseEntity<List<Map<String, Object>>> getJournalByAuditory(@PathVariable int audId) {
        List<AuditoryJournal> journal = scheduleService.getJournalByAuditoryId(audId);
        List<Map<String, Object>> result = journal.stream().map(this::mapJournalToResponse).toList();
        return ResponseEntity.ok(result);
    }

    // =============== Маппинг-утилиты ===============

    private Map<String, Object> mapJournalToResponse(AuditoryJournal j) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", j.id());
        m.put("audId", j.audId());
        m.put("dayOfWeek", j.dayOfWeek());
        m.put("startTime", j.startTime());
        m.put("endTime", j.endTime());
        m.put("duration", j.duration());
        m.put("timeStatus", j.timeStatus());
        return m;
    }

    // =============== SUBJECTS ===============

    /**
     * GET /api/schedule/subjects
     * Возвращает список предметов (sub_name + teacher_name).
     */
    @GetMapping("/subjects")
    public ResponseEntity<List<Map<String, Object>>> getAllSubjects() {
        List<Subject> subjects = subjectService.getAllSubjects();

        List<Map<String, Object>> result = subjects.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getIdSub());
            m.put("subName", s.getSubName());
            m.put("teacherName", s.getTeacherName());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/schedule/subjects/push?ip=...&port=...
     * Вручную инициирует отправку JSON со списком предметов по TCP
     */
    @PostMapping("/subjects/push")
    public ResponseEntity<Map<String, Object>> pushSubjects(@RequestParam String ip, @RequestParam int port) {
        subjectTcpSender.sendSubjects(ip, port);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", "sent");
        resp.put("ip", ip);
        resp.put("port", port);
        return ResponseEntity.ok(resp);
    }
}
