package com.schedule.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.schedule.server.dto.FindRoomRequest;
import com.schedule.server.dto.FindRoomResponse;
import com.schedule.server.tcp.CppTcpClient;
import com.schedule.server.util.TimeUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BotBridgeServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private StubCppClient cpp;
    private BotBridgeService service;

    @BeforeEach
    void setUp() {
        cpp = new StubCppClient();
        service = new BotBridgeService(cpp, null, null, null);
    }

    @AfterEach
    void tearDown() {
        cpp.shutdown();
    }

    private static class StubCppClient extends CppTcpClient {
        JsonNode response;
        int calls;

        StubCppClient() {
            super("localhost", 0);
        }

        @Override
        public JsonNode send(Map<String, Object> payload) {
            calls++;
            return response;
        }
    }

    private FindRoomRequest request() {
        FindRoomRequest request = new FindRoomRequest();
        request.setLocationId("corp_a");
        request.setDurationMinutes(60);
        return request;
    }

    private FindRoomResponse findAt(LocalTime now, FindRoomRequest request) {
        try (MockedStatic<TimeUtil> clock = mockStatic(TimeUtil.class)) {
            clock.when(TimeUtil::currentLocalTime).thenReturn(now);
            clock.when(() -> TimeUtil.formatTime(any(LocalTime.class))).thenAnswer(
                    call -> ((LocalTime) call.getArgument(0)).format(DateTimeFormatter.ofPattern("HH:mm")));
            return service.findRooms(request);
        }
    }

    @Test
    void validRoomAndEmptyResultRemainDistinctFromUpstreamFailure() throws Exception {
        cpp.response = mapper.readTree("{\"status\":\"answer\",\"cabinet\":301}");
        FindRoomResponse found = findAt(LocalTime.of(10, 45), request());
        assertEquals(1, found.getFreeRooms().size());
        assertEquals("301", found.getFreeRooms().get(0).getName());
        assertEquals("11:00", found.getFreeRooms().get(0).getAvailableFrom());
        assertEquals("12:00", found.getFreeRooms().get(0).getAvailableUntil());
        assertNull(found.getReason());
        cpp.response = mapper.readTree("{\"status\":\"answer\",\"cabinet\":0}");
        FindRoomResponse empty = findAt(LocalTime.of(10, 45), request());
        assertTrue(empty.getFreeRooms().isEmpty());
        assertTrue(empty.getReason().startsWith("C++ сервер не нашёл"));
    }

    @Test
    void invalidUpstreamResponsesNeverBecomeSuccessfulEmptySearches() throws Exception {
        for (String response : new String[]{"{\"status\":\"error\"}", "{}", "null", "[]",
                "{\"status\":\"answer\",\"cabinet\":\"bad\"}",
                "{\"status\":\"answer\",\"cabinet\":\"301\"}",
                "{\"status\":\"answer\",\"cabinet\":-1}",
                "{\"status\":\"answer\",\"cabinet\":1.5}",
                "{\"status\":\"answer\",\"cabinet\":999999999999}"}) {
            cpp.response = mapper.readTree(response);
            FindRoomResponse result = findAt(LocalTime.of(10, 0), request());
            assertTrue(result.getFreeRooms().isEmpty(), response);
            assertTrue(result.getReason().startsWith("Ошибка при запросе к C++ серверу:"), response);
        }
    }

    @Test
    void afterWorkingHoursDoesNotCallTheCppServer() {
        FindRoomResponse result = findAt(LocalTime.of(16, 1), request());
        assertTrue(result.getFreeRooms().isEmpty());
        assertTrue(result.getReason().contains("На сегодня пар больше нет"));
        assertEquals(0, cpp.calls);
    }

    @Test
    void gracePeriodIncludesItsBoundaryAndThenMovesToTheNextClass() {
        assertEquals(LocalTime.of(8, 0), service.findNearestClassStart(LocalTime.of(8, 30)));
        assertEquals(LocalTime.of(9, 30), service.findNearestClassStart(LocalTime.of(8, 30, 1)));
        assertNull(service.findNearestClassStart(LocalTime.of(16, 0, 1)));
    }

    @Test
    void invalidRequestsAreRejectedBeforeCallingCpp() {
        for (int duration : new int[]{-1, 0, 14, 241, Integer.MAX_VALUE}) {
            FindRoomRequest request = request();
            request.setDurationMinutes(duration);
            assertThrows(IllegalArgumentException.class, () -> service.findRooms(request));
        }
        for (String location : new String[]{null, "", "   "}) {
            FindRoomRequest request = request();
            request.setLocationId(location);
            assertThrows(IllegalArgumentException.class, () -> service.findRooms(request));
        }
        assertEquals(0, cpp.calls);
    }
}
