package com.schedule.server.util;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Утилита для работы со временем (зона Asia/Almaty).
 */
public final class TimeUtil {

    private static final ZoneId ALMATY_ZONE = ZoneId.of("Asia/Almaty");
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private TimeUtil() {
    }

    /**
     * Возвращает текущий час (0..23) в зоне Asia/Almaty без округления.
     */
    public static int currentStartHour() {
        return ZonedDateTime.now(ALMATY_ZONE).getHour();
    }

    /**
     * Возвращает текущее время в формате "HH:mm" (зона Asia/Almaty).
     */
    public static String currentStartTime() {
        return ZonedDateTime.now(ALMATY_ZONE).format(HH_MM);
    }

    /**
     * Возвращает текущее LocalTime в зоне Asia/Almaty.
     */
    public static LocalTime currentLocalTime() {
        return ZonedDateTime.now(ALMATY_ZONE).toLocalTime();
    }

    /**
     * Возвращает текущую дату в зоне Asia/Almaty.
     */
    public static LocalDate currentDate() {
        return ZonedDateTime.now(ALMATY_ZONE).toLocalDate();
    }

    /**
     * Возвращает день недели (1 = пн, ..., 7 = вс) в зоне Asia/Almaty.
     */
    public static int currentDayOfWeek() {
        return ZonedDateTime.now(ALMATY_ZONE).getDayOfWeek().getValue();
    }

    /**
     * Форматирует LocalTime в "HH:mm".
     */
    public static String formatTime(LocalTime time) {
        return time.format(HH_MM);
    }
}
