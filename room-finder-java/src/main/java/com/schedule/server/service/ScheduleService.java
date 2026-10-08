package com.schedule.server.service;

import com.schedule.server.dto.ScheduleFileDto;
import kvt.db.AuditoryRepository;
import kvt.db.AuditoryJournalRepository;
import kvt.model.Auditory;
import kvt.model.AuditoryJournal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleService {
    private final AuditoryRepository auditoryRepository;
    private final AuditoryJournalRepository auditoryJournalRepository;
    private final SubjectService subjectService;

    /**
     * Принимает JSON расписания, извлекает кабинеты и время занятий,
     * сохраняет в существующие таблицы auditory + auditory_journal.
     */
    @Transactional
    public Map<String, Object> saveSchedule(ScheduleFileDto dto) {
        log.info("Saving schedule from file: {}", dto.getFileName());

        int auditoriesAdded = 0;
        int journalEntriesAdded = 0;
        int rowsSkipped = 0;

        List<List<String>> rows = dto.getRows();
        if (rows == null || rows.size() < 2) {
            log.warn("No data rows in schedule file: {}", dto.getFileName());
        } else {
            // Определяем индексы колонок из заголовка
            List<String> header = rows.get(0);
            int colDay = findColumnIndex(header, "день");
            int colTime = findColumnIndex(header, "время");
            int colSubject = findColumnIndex(header, "предмет");
            int colTeacher = findColumnIndex(header, "преподаватель");
            int colRoom = findColumnIndex(header, "кабинет");

            log.info("Header columns detected: day={}, time={}, subject={}, teacher={}, room={}",
                    colDay, colTime, colSubject, colTeacher, colRoom);

            if (colDay < 0 || colTime < 0 || colRoom < 0) {
                log.error("Missing required columns (День/Время/Кабинет) in header: {}", header);
            } else {
                // Кэш существующих аудиторий по имени
                Map<String, Auditory> auditoryCache = new HashMap<>();
                for (Auditory a : auditoryRepository.findAll()) {
                    auditoryCache.put(a.name(), a);
                }

                // Обрабатываем строки данных (пропускаем заголовок)
                for (int i = 1; i < rows.size(); i++) {
                    List<String> row = rows.get(i);

                    // Безопасно извлекаем значения
                    String dayStr = safeGet(row, colDay);
                    String timeStr = safeGet(row, colTime);
                    String roomStr = safeGet(row, colRoom);

                    if (dayStr == null || dayStr.isBlank()) {
                        log.debug("Row {} skipped: empty day", i);
                        rowsSkipped++;
                        continue;
                    }
                    if (roomStr == null || roomStr.isBlank()) {
                        log.debug("Row {} skipped: empty room", i);
                        rowsSkipped++;
                        continue;
                    }

                    int dayOfWeek = parseDayOfWeek(dayStr);
                    if (dayOfWeek == 0) {
                        log.debug("Row {} skipped: unknown day '{}'", i, dayStr);
                        rowsSkipped++;
                        continue;
                    }

                    String roomName = roomStr.trim();

                    // Извлекаем корпус из имени кабинета (напр. "А-201" → "А", "Б-409" → "Б", "Д-310" → "Д")
                    String corpus = extractCorpus(roomName);

                    // Найти или создать аудиторию
                    Auditory auditory = auditoryCache.get(roomName);
                    if (auditory == null) {
                        Integer roomNumber = extractNumber(roomName);
                        Auditory toInsert = new Auditory(0, roomName, roomNumber, corpus, null);
                        int generatedId = auditoryRepository.insert(toInsert);
                        auditory = new Auditory(generatedId, roomName, roomNumber, corpus, null);
                        auditoryCache.put(roomName, auditory);
                        auditoriesAdded++;
                        log.debug("Created auditory: id={}, name={}, corpus={}", generatedId, roomName, corpus);
                    }

                    // Получаем предмет и преподавателя (если в файле есть колонки)
                    String subjectName = colSubject >= 0 ? safeGet(row, colSubject) : null;
                    String teacherName = colTeacher >= 0 ? safeGet(row, colTeacher) : null;

                    // Сохраняем предмет в таблицу subjects (если указано название)
                    if (subjectName != null && !subjectName.isBlank()) {
                        try {
                            subjectService.addOrUpdateSubject(subjectName.trim(), teacherName == null ? null : teacherName.trim());
                        } catch (Exception e) {
                            log.warn("Failed to save subject '{}' teacher='{}' : {}", subjectName, teacherName, e.getMessage());
                        }
                    }

                    // Парсим время урока и создаём запись в журнале
                    LocalTime[] times = parseTime(timeStr);
                    if (times != null) {
                        int duration = (int) Duration.between(times[0], times[1]).toMinutes();
                        AuditoryJournal journal = new AuditoryJournal(
                                0,
                                auditory.id(),
                                dayOfWeek,
                                times[0],
                                times[1],
                                duration,
                                1  // timeStatus = 1 (активно)
                        );
                        auditoryJournalRepository.insert(journal);
                        journalEntriesAdded++;
                    } else {
                        log.warn("Row {} skipped time: could not parse '{}'", i, timeStr);
                    }
                }
            }
        }

        log.info("Schedule saved: {} auditories added, {} journal entries added, {} rows skipped",
                auditoriesAdded, journalEntriesAdded, rowsSkipped);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileName", dto.getFileName());
        result.put("sheet", dto.getSheet());
        result.put("totalRows", rows != null ? rows.size() - 1 : 0);
        result.put("auditoriesAdded", auditoriesAdded);
        result.put("journalEntriesAdded", journalEntriesAdded);
        result.put("rowsSkipped", rowsSkipped);
        return result;
    }

    /**
     * Список всех аудиторий.
     */
    public List<Auditory> getAllAuditories() {
        return auditoryRepository.findAll();
    }

    /**
     * Журнал занятости конкретной аудитории.
     */
    public List<AuditoryJournal> getJournalByAuditoryId(int audId) {
        return auditoryJournalRepository.findByAudId(audId);
    }

    /**
     * Весь журнал занятости.
     */
    public List<AuditoryJournal> getAllJournal() {
        return auditoryJournalRepository.findAll();
    }

    // =============== Утилиты ===============

    /**
     * Ищет индекс колонки в заголовке по подстроке (регистронезависимо).
     * Напр. findColumnIndex(["День","Время","Кабинет"], "день") → 0
     */
    private int findColumnIndex(List<String> header, String keyword) {
        for (int i = 0; i < header.size(); i++) {
            if (header.get(i) != null && header.get(i).toLowerCase().contains(keyword)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Безопасно извлекает элемент из списка по индексу.
     */
    private String safeGet(List<String> row, int index) {
        if (index < 0 || index >= row.size()) return null;
        return row.get(index);
    }

    /**
     * Извлекает корпус из названия кабинета.
     * Примеры: "А-201" → "А", "Б-409" → "Б", "Д-301а" → "Д",
     *          "спортзал" → null, "Лаб Д корпус" → "Д"
     */
    private String extractCorpus(String roomName) {
        if (roomName == null || roomName.isBlank()) return null;
        // Паттерн "X-NNN" где X — буква корпуса
        Matcher m = CORPUS_PATTERN.matcher(roomName.trim());
        if (m.find()) {
            return m.group(1).toUpperCase();
        }
        // Паттерн "Лаб X корпус" или подобные
        Matcher m2 = CORPUS_ALT_PATTERN.matcher(roomName.trim());
        if (m2.find()) {
            return m2.group(1).toUpperCase();
        }
        return null;
    }

    private static final Pattern CORPUS_PATTERN =
            Pattern.compile("^([А-Яа-яA-Za-z])\\s*[-–—]");

    private static final Pattern CORPUS_ALT_PATTERN =
            Pattern.compile("(?:лаб|корпус)\\s+([А-Яа-яA-Za-z])", Pattern.CASE_INSENSITIVE);

    private static final Pattern TIME_PATTERN =
            Pattern.compile("(\\d{1,2}[.:;]\\d{2})\\s*[-–—]\\s*(\\d{1,2}[.:;]\\d{2})");

    /**
     * Парсит строку вида "8:30-10:00" или "8.30–10.00" в пару LocalTime.
     */
    private LocalTime[] parseTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return null;
        Matcher m = TIME_PATTERN.matcher(timeStr.trim());
        if (!m.find()) return null;
        try {
            String startStr = m.group(1).replaceAll("[.;]", ":");
            String endStr = m.group(2).replaceAll("[.;]", ":");
            // LocalTime.parse требует формат HH:mm, дополняем ведущий ноль
            if (startStr.length() == 4) startStr = "0" + startStr;
            if (endStr.length() == 4) endStr = "0" + endStr;
            LocalTime start = LocalTime.parse(startStr);
            LocalTime end = LocalTime.parse(endStr);
            return new LocalTime[]{start, end};
        } catch (Exception e) {
            log.warn("Cannot parse time: {}", timeStr);
            return null;
        }
    }

    /**
     * Конвертирует название дня недели в число 1-7.
     */
    private int parseDayOfWeek(String day) {
        if (day == null) return 0;
        return switch (day.trim().toLowerCase()) {
            case "понедельник" -> 1;
            case "вторник" -> 2;
            case "среда" -> 3;
            case "четверг" -> 4;
            case "пятница" -> 5;
            case "суббота" -> 6;
            case "воскресенье" -> 7;
            default -> 0;
        };
    }

    /**
     * Извлекает числовую часть из названия кабинета, напр. "301а" -> 301.
     */
    private Integer extractNumber(String roomName) {
        if (roomName == null) return null;
        Matcher m = Pattern.compile("(\\d+)").matcher(roomName);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }
}
