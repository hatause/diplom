package com.schedule.server.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Корневой DTO для входящего JSON файла расписания.
 * <p>
 * Реальный формат от сайта:
 * <pre>
 * {
 *   "fileName": "Расписание_КВТ-23-9.xlsx",
 *   "sheet": "Расписание КВТ-23-9",
 *   "rows": [
 *     ["День", "Время", "Предмет", "Преподаватель", "Кабинет"],
 *     ["Понедельник", "09:30-10:50", "Технологии разработки ПО", "Серсенбай А.С.", "А-201"],
 *     ...
 *   ]
 * }
 * </pre>
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleFileDto {

    @JsonProperty("fileName")
    private String fileName;

    @JsonProperty("sheet")
    private String sheet;

    /**
     * Строки расписания. Первая строка — заголовок (День, Время, Предмет, Преподаватель, Кабинет),
     * остальные — данные.
     */
    @JsonProperty("rows")
    private List<List<String>> rows;
}
