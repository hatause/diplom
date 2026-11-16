package com.schedule.server.tcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class CppTcpCancellationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode readRequest(Socket socket) throws Exception {
        socket.setSoTimeout(2000);
        DataInputStream input = new DataInputStream(socket.getInputStream());
        return mapper.readTree(input.readNBytes(input.readInt()));
    }

    private void answer(Socket socket, int id) throws Exception {
        byte[] data = ("{\"id\":" + id + "}").getBytes(StandardCharsets.UTF_8);
        DataOutputStream output = new DataOutputStream(socket.getOutputStream());
        output.writeInt(data.length);
        output.write(data);
        output.flush();
    }

    @Test
    void interruptedQueuedRequestIsNotSentAndDoesNotLeakPendingCount() throws Exception {
        CountDownLatch firstRead = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        ExecutorService server = Executors.newSingleThreadExecutor();
        ExecutorService callers = Executors.newSingleThreadExecutor();
        AtomicReference<Throwable> cancelledError = new AtomicReference<>();
        try (ServerSocket listener = new ServerSocket(0)) {
            listener.setSoTimeout(2000);
            CppTcpClient client = new CppTcpClient("localhost", listener.getLocalPort());
            Thread cancelled = new Thread(() -> {
                try {
                    client.send(Map.of("id", 2));
                } catch (Throwable error) {
                    cancelledError.set(error);
                }
            });
            try {
                Future<List<Integer>> received = server.submit(() -> {
                    int firstId;
                    try (Socket socket = listener.accept()) {
                        firstId = readRequest(socket).path("id").asInt();
                        firstRead.countDown();
                        assertTrue(releaseFirst.await(2, TimeUnit.SECONDS));
                        answer(socket, firstId);
                    }
                    try (Socket socket = listener.accept()) {
                        int nextId = readRequest(socket).path("id").asInt();
                        answer(socket, nextId);
                        return List.of(firstId, nextId);
                    }
                });
                Future<JsonNode> first = callers.submit(() -> client.send(Map.of("id", 1)));
                assertTrue(firstRead.await(2, TimeUnit.SECONDS));
                cancelled.start();
                assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
                    while (client.getPendingCount() != 2 || cancelled.getState() != Thread.State.TIMED_WAITING) {
                        Thread.sleep(2);
                    }
                });
                cancelled.interrupt();
                cancelled.join(2000);
                assertFalse(cancelled.isAlive());
                assertInstanceOf(RuntimeException.class, cancelledError.get());
                assertEquals(1, client.getPendingCount());
                releaseFirst.countDown();
                assertEquals(1, first.get(2, TimeUnit.SECONDS).path("id").asInt());
                assertEquals(3, client.send(Map.of("id", 3)).path("id").asInt());
                assertEquals(List.of(1, 3), received.get(2, TimeUnit.SECONDS));
                assertEquals(0, client.getPendingCount());
            } finally {
                releaseFirst.countDown();
                cancelled.interrupt();
                client.shutdown();
            }
        } finally {
            callers.shutdownNow();
            server.shutdownNow();
        }
    }

    @Test
    void rejectedRequestAfterShutdownDoesNotLeakPendingCount() {
        CppTcpClient client = new CppTcpClient("localhost", 0);
        client.shutdown();
        assertThrows(RuntimeException.class, () -> client.send(Map.of("id", 1)));
        assertEquals(0, client.getPendingCount());
    }
}
