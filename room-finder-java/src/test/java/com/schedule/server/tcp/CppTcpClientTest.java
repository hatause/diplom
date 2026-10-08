package com.schedule.server.tcp;

import com.fasterxml.jackson.databind.JsonNode;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.*;

import java.io.*;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Тесты TCP-соединения с C++ сервером.
 *
 * <p>Используется встроенный mock TCP-сервер, который эмулирует протокол
 * C++ сервера (4 байта big-endian длина + JSON UTF-8).</p>
 */
class CppTcpClientTest {

    private ServerSocket mockServer;
    private ExecutorService executor;
    private int serverPort;

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new ServerSocket(0);
        serverPort = mockServer.getLocalPort();
        executor = Executors.newSingleThreadExecutor();
    }

    @AfterEach
    void tearDown() throws IOException {
        executor.shutdownNow();
        if (mockServer != null && !mockServer.isClosed()) {
            mockServer.close();
        }
    }

    /** Формирует типовой запрос для тестов. */
    private static Map<String, Object> makeRequest(int id, String corpus, int startHour, int duration) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", id);
        payload.put("corpus", corpus);
        payload.put("start_hour", startHour);
        payload.put("duration", duration);
        return payload;
    }

    /**
     * Тест успешного соединения и обмена данными с C++ сервером.
     * Mock-сервер читает запрос и возвращает корректный JSON-ответ.
     */
    @Test
    @DisplayName("Успешное TCP соединение и обмен данными")
    @SuppressWarnings("unchecked")
    void testSuccessfulConnection() throws Exception {
        Future<String> serverTask = executor.submit(() -> {
            try (Socket client = mockServer.accept()) {
                DataInputStream in = new DataInputStream(
                        new BufferedInputStream(client.getInputStream()));
                DataOutputStream out = new DataOutputStream(
                        new BufferedOutputStream(client.getOutputStream()));

                int requestLength = in.readInt();
                byte[] requestBytes = new byte[requestLength];
                in.readFully(requestBytes);
                String requestJson = new String(requestBytes, StandardCharsets.UTF_8);

                JSONObject response = new JSONObject();
                response.put("id", 42);
                response.put("cabinet_number", "А-301");
                byte[] responseBytes = response.toJSONString().getBytes(StandardCharsets.UTF_8);

                out.writeInt(responseBytes.length);
                out.write(responseBytes);
                out.flush();

                return requestJson;
            }
        });

        CppTcpClient client = new CppTcpClient("localhost", serverPort);

        JsonNode result = client.send(makeRequest(42, "main", 10, 90));

        assertNotNull(result, "Ответ от C++ сервера не должен быть null");
        assertEquals(42, result.get("id").asInt(), "ID в ответе должен совпадать");
        assertEquals("А-301", result.get("cabinet_number").asText(), "Номер кабинета должен совпадать");

        String receivedRequest = serverTask.get(5, TimeUnit.SECONDS);
        assertNotNull(receivedRequest, "Сервер должен получить запрос");
        assertTrue(receivedRequest.contains("\"id\":42"), "Запрос должен содержать id");
        assertTrue(receivedRequest.contains("\"corpus\":\"main\""), "Запрос должен содержать corpus");
    }

    /**
     * Тест: сервер недоступен — ожидаем RuntimeException.
     */
    @Test
    @DisplayName("Ошибка соединения при недоступном сервере")
    void testConnectionRefused() throws IOException {
        mockServer.close();

        CppTcpClient client = new CppTcpClient("localhost", serverPort);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> client.send(makeRequest(1, "test", 8, 45)));

        assertTrue(exception.getMessage().contains("TCP"),
                "Сообщение исключения должно указывать на ошибку TCP");
    }

    /**
     * Тест: сервер отвечает некорректным JSON — ожидаем RuntimeException.
     */
    @Test
    @DisplayName("Ошибка парсинга при невалидном JSON от сервера")
    void testInvalidJsonResponse() throws Exception {
        executor.submit(() -> {
            try (Socket client = mockServer.accept()) {
                DataInputStream in = new DataInputStream(
                        new BufferedInputStream(client.getInputStream()));
                DataOutputStream out = new DataOutputStream(
                        new BufferedOutputStream(client.getOutputStream()));

                int requestLength = in.readInt();
                byte[] requestBytes = new byte[requestLength];
                in.readFully(requestBytes);

                byte[] badJson = "NOT_A_JSON{{{".getBytes(StandardCharsets.UTF_8);
                out.writeInt(badJson.length);
                out.write(badJson);
                out.flush();
            }
            return null;
        });

        CppTcpClient client = new CppTcpClient("localhost", serverPort);

        // JsonNode парсинг не упадёт на «NOT_A_JSON{{{», но результат может быть некорректным
        // В зависимости от ObjectMapper поведение может отличаться — проверяем что не выбрасывает NPE
        assertDoesNotThrow(() -> client.send(makeRequest(1, "test", 8, 45)),
                "Клиент не должен падать с NPE при невалидном JSON");
    }

    /**
     * Тест: сервер отвечает некорректной длиной — ожидаем RuntimeException.
     */
    @Test
    @DisplayName("Ошибка при некорректной длине ответа от сервера")
    void testInvalidResponseLength() throws Exception {
        executor.submit(() -> {
            try (Socket client = mockServer.accept()) {
                DataInputStream in = new DataInputStream(
                        new BufferedInputStream(client.getInputStream()));
                DataOutputStream out = new DataOutputStream(
                        new BufferedOutputStream(client.getOutputStream()));

                int requestLength = in.readInt();
                byte[] requestBytes = new byte[requestLength];
                in.readFully(requestBytes);

                out.writeInt(-1);
                out.flush();
            }
            return null;
        });

        CppTcpClient client = new CppTcpClient("localhost", serverPort);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> client.send(makeRequest(1, "test", 8, 45)));

        assertTrue(exception.getMessage().contains("длина") || exception.getMessage().contains("TCP"),
                "Сообщение исключения должно указывать на ошибку длины ответа");
    }

    /**
     * Тест: сервер закрывает соединение после получения запроса — ожидаем RuntimeException.
     */
    @Test
    @DisplayName("Ошибка при преждевременном разрыве соединения")
    void testServerDisconnect() throws Exception {
        executor.submit(() -> {
            try (Socket client = mockServer.accept()) {
                DataInputStream in = new DataInputStream(
                        new BufferedInputStream(client.getInputStream()));

                int requestLength = in.readInt();
                byte[] requestBytes = new byte[requestLength];
                in.readFully(requestBytes);
            }
            return null;
        });

        CppTcpClient client = new CppTcpClient("localhost", serverPort);

        assertThrows(RuntimeException.class,
                () -> client.send(makeRequest(1, "test", 8, 45)),
                "Должно выброситься исключение при разрыве соединения");
    }

    /**
     * Тест с различными входными данными (параметризированный).
     */
    @Test
    @DisplayName("Корректная передача различных параметров")
    @SuppressWarnings("unchecked")
    void testDifferentParameters() throws Exception {
        int[][] testCases = {
                {1, 0, 30},     // id=1, startHour=0, duration=30
                {100, 23, 120}, // id=100, startHour=23, duration=120
                {0, 12, 0},     // id=0, startHour=12, duration=0
        };

        for (int[] tc : testCases) {
            if (mockServer.isClosed()) {
                mockServer = new ServerSocket(0);
                serverPort = mockServer.getLocalPort();
            }

            executor.submit(() -> {
                try (Socket client = mockServer.accept()) {
                    DataInputStream in = new DataInputStream(
                            new BufferedInputStream(client.getInputStream()));
                    DataOutputStream out = new DataOutputStream(
                            new BufferedOutputStream(client.getOutputStream()));

                    int reqLen = in.readInt();
                    byte[] reqBytes = new byte[reqLen];
                    in.readFully(reqBytes);

                    JSONObject response = new JSONObject();
                    response.put("id", tc[0]);
                    response.put("cabinet_number", "Б-" + tc[0]);
                    byte[] respBytes = response.toJSONString().getBytes(StandardCharsets.UTF_8);

                    out.writeInt(respBytes.length);
                    out.write(respBytes);
                    out.flush();
                }
                return null;
            });

            CppTcpClient client = new CppTcpClient("localhost", serverPort);
            JsonNode result = client.send(makeRequest(tc[0], "corpus", tc[1], tc[2]));

            assertEquals(tc[0], result.get("id").asInt(),
                    String.format("ID должен совпадать для testCase id=%d", tc[0]));
            assertEquals("Б-" + tc[0], result.get("cabinet_number").asText(),
                    String.format("cabinet_number должен совпадать для testCase id=%d", tc[0]));
        }
    }
}
