package com.schedule.server.service;

import com.schedule.server.dto.CancelBookingRequest;
import com.schedule.server.util.TimeUtil;
import kvt.db.AuditoryJournalRepository;
import kvt.db.AuditoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BookingCancellationTest {
    private JdbcTemplate jdbc;
    private BotBridgeService service;

    @BeforeEach
    void setUp() {
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE SCHEMA dbo");
        jdbc.execute("CREATE TABLE dbo.auditory (id INT PRIMARY KEY, name VARCHAR(100), "
                + "number INT, corpus VARCHAR(10), category VARCHAR(100))");
        jdbc.execute("CREATE TABLE dbo.auditory_journal (id INT PRIMARY KEY, aud_id INT, "
                + "dayOfWeek INT, startTime TIME, endTime TIME, timeStatus INT)");
        jdbc.update("INSERT INTO dbo.auditory VALUES (7, 'А-201', 201, 'А', NULL)");
        int today = TimeUtil.currentDayOfWeek();
        addBooking(1, 7, today, "11:00", "12:20");
        addBooking(2, 7, today % 7 + 1, "11:00", "12:20");
        addBooking(3, 7, today, "14:10", "15:30");
        addBooking(4, 8, today, "11:00", "12:20");
        service = new BotBridgeService(null, new AuditoryRepository(jdbc),
                new AuditoryJournalRepository(jdbc), null);
    }

    private void addBooking(int id, int room, int day, String start, String end) {
        jdbc.update("INSERT INTO dbo.auditory_journal VALUES (?, ?, ?, CAST(? AS TIME), CAST(? AS TIME), 1)",
                id, room, day, start, end);
    }

    private CancelBookingRequest request(String start, String end) {
        var request = new CancelBookingRequest();
        request.setAuditoryName("201");
        request.setCorpus("А");
        request.setStartTime(start);
        request.setEndTime(end);
        return request;
    }

    private List<Integer> remainingBookings() {
        return jdbc.queryForList("SELECT id FROM dbo.auditory_journal ORDER BY id", Integer.class);
    }

    @Test
    void cancellingOneBookingKeepsOtherDaysTimesAndRooms() {
        var result = service.cancelBooking(request("11:00", "12:20"));
        assertEquals("ok", result.get("status"));
        assertEquals(1, result.get("deleted_count"));
        assertEquals(List.of(2, 3, 4), remainingBookings());
    }

    @Test
    void missingIntervalDoesNotDeleteOtherBookings() {
        var result = service.cancelBooking(request("09:30", "10:50"));
        assertEquals("not_found", result.get("status"));
        assertEquals(0, result.get("deleted_count"));
        assertEquals(List.of(1, 2, 3, 4), remainingBookings());
    }

    @Test
    void invalidIntervalDoesNotDeleteOtherBookings() {
        var result = service.cancelBooking(request("12:20", "11:00"));
        assertEquals("error", result.get("status"));
        assertEquals(List.of(1, 2, 3, 4), remainingBookings());
    }
}
