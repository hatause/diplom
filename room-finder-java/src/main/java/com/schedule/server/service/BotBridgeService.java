package com.schedule.server.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.schedule.server.dto.CancelBookingRequest;
import com.schedule.server.dto.FindRoomRequest;
import com.schedule.server.dto.FindRoomResponse;
import com.schedule.server.dto.RoomInfo;
import com.schedule.server.tcp.CppTcpClient;
import com.schedule.server.util.TimeUtil;
import kvt.db.AuditoryJournalRepository;
import kvt.db.AuditoryRepository;
import kvt.model.Auditory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Сервис-мост: принимает данные от Telegram-бота,
 * вычисляет ближайшее оптимальное время начала пары
 * из фиксированного расписания и отправляет JSON на C++ сервер.
 *
 * <p>Алгоритм:
 * <ol>
 *   <li>Определяем текущее время (Asia/Almaty)</li>
 *   <li>Находим ближайшее валидное время начала пары из расписания
 *       (08:00, 09:30, 11:00, 12:40, 14:00, 15:30).
 *       Время считается валидным, если от него прошло не более 30 минут.</li>
 *   <li>Отправляем рассчитанное время + корпус на C++ сервер</li>
 *   <li>Формируем FindRoomResponse для бота из ответа C++</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BotBridgeService {

    private final CppTcpClient cppTcpClient;
    private final AuditoryRepository auditoryRepository;
    private final AuditoryJournalRepository auditoryJournalRepository;
    private final SubjectService subjectService;

    /**
     * Фиксированное расписание начала пар.
     * Если от начала пары прошло более 30 минут — она считается недоступной,
     * берётся следующая.
     */
    private static final List<LocalTime> CLASS_START_TIMES = List.of(
            LocalTime.of(8, 0),
            LocalTime.of(9, 30),
            LocalTime.of(11, 0),
            LocalTime.of(12, 40),
            LocalTime.of(14, 10),
            LocalTime.of(15, 30)
    );

    /** Максимальное количество минут после начала пары, в течение которых она ещё считается доступной. */
    private static final int GRACE_PERIOD_MINUTES = 30;

    /**
     * Маппинг location_id (из конфига бота) → corpus (строка для C++ сервера).
     */
    private static final Map<String, String> LOCATION_TO_CORPUS = Map.of(
            "corp_a", "А",
            "corp_b", "Б",
            "corp_d", "Д"
    );

    /** Счётчик запросов для генерации id. */
    private final AtomicInteger requestIdCounter = new AtomicInteger(0);

    /**
     * Основной метод: вычисляет ближайшее время начала пары и отправляет на C++.
     */
    public FindRoomResponse findRooms(FindRoomRequest request) {
        log.info("findRooms: location_id={}, duration={}, floor={}, user={}",
                request.getLocationId(), request.getDurationMinutes(),
                request.getFloor(), request.getTelegramUserId());

        String corpus = resolveCorpus(request.getLocationId());
        int durationMinutes = request.getDurationMinutes();

        // --- 1. Определяем текущее время ---
        LocalTime now = TimeUtil.currentLocalTime();
        log.info("Current time: {}", TimeUtil.formatTime(now));

        // --- 2. Вычисляем ближайшее валидное время начала пары ---
        LocalTime classStart = findNearestClassStart(now);

        if (classStart == null) {
            log.info("No more classes today after {}", TimeUtil.formatTime(now));
            return FindRoomResponse.builder()
                    .freeRooms(Collections.emptyList())
                    .alternatives(Collections.emptyList())
                    .reason("На сегодня пар больше нет. Последняя пара начинается в 15:30.")
                    .build();
        }

        log.info("Nearest valid class start: {} (now={})", TimeUtil.formatTime(classStart), TimeUtil.formatTime(now));

        // --- 3. Добавление предметов из расписания (пример вызова)
        // subjectService.addOrUpdateSubject("Математика", "Иванов И.И.");

        // --- 4. Отправляем на C++ ---
        return sendToCpp(request, corpus, classStart, durationMinutes);
    }

    /**
     * Добавляет предмет из расписания.
     * @param subName название предмета
     * @param teacherName имя преподавателя
     */
    public void addSubjectFromSchedule(String subName, String teacherName) {
        subjectService.addOrUpdateSubject(subName, teacherName);
    }

    // ========================= Расчёт времени =========================

    /**
     * Находит ближайшее валидное время начала пары.
     * <p>
     * Пара считается доступной, если:
     * <ul>
     *   <li>Она ещё не началась (now < classStart), или</li>
     *   <li>Она началась, но прошло не более {@value GRACE_PERIOD_MINUTES} минут
     *       (now <= classStart + 30 мин)</li>
     * </ul>
     *
     * Пример: сейчас 11:51 → 11:00 + 30 = 11:30 < 11:51, значит 11:00 не подходит → берём 12:40.
     *
     * @param now текущее время
     * @return ближайшее валидное время начала пары, или null если пар больше нет
     */
    LocalTime findNearestClassStart(LocalTime now) {
        for (LocalTime classStart : CLASS_START_TIMES) {
            // Пара доступна, если сейчас <= classStart + GRACE_PERIOD_MINUTES
            LocalTime deadline = classStart.plusMinutes(GRACE_PERIOD_MINUTES);
            if (!now.isAfter(deadline)) {
                return classStart;
            }
        }
        return null; // все пары уже прошли
    }

    // ========================= C++ интеграция =========================

    /**
     * Отправляет рассчитанное время на C++ сервер и формирует ответ.
     */
    private FindRoomResponse sendToCpp(FindRoomRequest request, String corpus,
                                        LocalTime classStart, int durationMinutes) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", requestIdCounter.incrementAndGet());
            payload.put("start_time", TimeUtil.formatTime(classStart));
            payload.put("duration", durationMinutes);
            payload.put("corpus", corpus);

            log.info("Sending to C++: {}", payload);
            JsonNode cppResponse = cppTcpClient.send(payload);
            log.info("C++ response: {}", cppResponse);

            int cabinetNumber = cppResponse.has("cabinet") ? cppResponse.get("cabinet").asInt(0) : 0;
            String status = cppResponse.has("status") ? cppResponse.get("status").asText("") : "";

            if (cabinetNumber > 0 && "answer".equals(status)) {
                RoomInfo room = RoomInfo.builder()
                        .name(String.valueOf(cabinetNumber))
                        .locationName(corpus)
                        .locationId(request.getLocationId())
                        .floor(cabinetNumber / 100)
                        .cameraFree(cppResponse.has("camera_free") && cppResponse.get("camera_free").isBoolean() ? cppResponse.get("camera_free").asBoolean() : null)
                        .cameraStatus(cppResponse.has("camera_status") ? cppResponse.get("camera_status").asText() : "нет данных камеры")
                        .scheduleFree(true)
                        .availableFrom(TimeUtil.formatTime(classStart))
                        .availableUntil(TimeUtil.formatTime(classStart.plusMinutes(durationMinutes)))
                        .build();

                return FindRoomResponse.builder()
                        .freeRooms(List.of(room))
                        .alternatives(Collections.emptyList())
                        .reason(null)
                        .build();
            }

            return FindRoomResponse.builder()
                    .freeRooms(Collections.emptyList())
                    .alternatives(Collections.emptyList())
                    .reason("C++ сервер не нашёл свободный кабинет на " + TimeUtil.formatTime(classStart))
                    .build();

        } catch (Exception e) {
            log.error("C++ request failed: {}", e.getMessage(), e);
            return FindRoomResponse.builder()
                    .freeRooms(Collections.emptyList())
                    .alternatives(Collections.emptyList())
                    .reason("Ошибка при запросе к C++ серверу: " + e.getMessage())
                    .build();
        }
    }

    // ========================= Вспомогательные методы =========================

    /**
     * Маппинг location_id бота → строка corpus.
     */
    private String resolveCorpus(String locationId) {
        if (locationId == null) return "Главный";
        String corpus = LOCATION_TO_CORPUS.get(locationId.toLowerCase());
        return corpus != null ? corpus : locationId;
    }

    // ========================= Отмена бронирования =========================

    /**
     * Отмена бронирования: удаляет запись из auditory_journal по имени кабинета и времени.
     *
     * @return Map с результатом: status ("ok"/"not_found"/"error"), message, deleted_count
     */
    @Transactional
    public Map<String, Object> cancelBooking(CancelBookingRequest request) {
        log.info("cancelBooking: user={}, auditory={}, corpus={}, time={}-{}",
                request.getTelegramUserId(), request.getAuditoryName(),
                request.getCorpus(), request.getStartTime(), request.getEndTime());

        Map<String, Object> result = new LinkedHashMap<>();

        try {
            String auditoryName = request.getAuditoryName();
            if (auditoryName == null || auditoryName.isBlank()) {
                result.put("status", "error");
                result.put("message", "Не указано имя аудитории.");
                return result;
            }

            // Find auditory by name
            Optional<Auditory> auditoryOpt = auditoryRepository.findByName(auditoryName);

            if (auditoryOpt.isEmpty()) {
                // Try to find by corpus + number
                String corpus = request.getCorpus();
                if (corpus != null && !corpus.isBlank()) {
                    String fullName = corpus + "-" + auditoryName;
                    auditoryOpt = auditoryRepository.findByName(fullName);
                }
            }

            if (auditoryOpt.isEmpty()) {
                log.warn("cancelBooking: auditory not found: {}", auditoryName);
                result.put("status", "not_found");
                result.put("message", "Аудитория " + auditoryName + " не найдена в базе данных.");
                result.put("deleted_count", 0);
                return result;
            }

            Auditory auditory = auditoryOpt.get();

            // Parse times
            LocalTime start = LocalTime.parse(request.getStartTime());
            LocalTime end = LocalTime.parse(request.getEndTime());

            // Get current day of week (1=Monday, 7=Sunday)
            int dayOfWeek = TimeUtil.currentDayOfWeek();
            log.info("Found auditory: id={}, name={}", auditory.id(), auditory.name());
            int deleted = auditoryJournalRepository.deleteById(auditory.id());
            log.info("DELETE WHERE audId={}, day={}, start={}, end={}", auditory.id(), dayOfWeek, start, end);
            if (deleted > 0) {
                log.info("cancelBooking: deleted {} record(s) for auditory {} (id={}), day={}, {}-{}",
                        deleted, auditory.name(), auditory.id(), dayOfWeek, start, end);
                result.put("status", "ok");
                result.put("message", "Бронь аудитории " + auditory.name() + " успешно отменена.");
                result.put("deleted_count", deleted);
            } else {
                log.info("cancelBooking: no matching records for auditory {} (id={}), day={}, {}-{}",
                        auditory.name(), auditory.id(), dayOfWeek, start, end);
                result.put("status", "not_found");
                result.put("message", "Запись о бронировании не найдена в журнале.");
                result.put("deleted_count", 0);
            }

            return result;

        } catch (Exception e) {
            log.error("cancelBooking failed: {}", e.getMessage(), e);
            result.put("status", "error");
            result.put("message", "Ошибка при отмене: " + e.getMessage());
            result.put("deleted_count", 0);
            return result;
        }
    }
}
