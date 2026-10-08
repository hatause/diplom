package com.schedule.server.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Запрос на отмену брони от Telegram-бота.
 * <pre>
 * {
 *   "telegram_user_id": 12345,
 *   "auditory_name": "А-201",
 *   "corpus": "А",
 *   "start_time": "11:00",
 *   "end_time": "12:20"
 * }
 * </pre>
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CancelBookingRequest {

    @JsonProperty("telegram_user_id")
    private Long telegramUserId;

    /** Название аудитории (номер кабинета как строка, напр. "201") */
    @JsonProperty("auditory_name")
    private String auditoryName;

    /** Корпус */
    @JsonProperty("corpus")
    private String corpus;

    /** Время начала бронирования (HH:mm) */
    @JsonProperty("start_time")
    private String startTime;

    /** Время конца бронирования (HH:mm) */
    @JsonProperty("end_time")
    private String endTime;
}
