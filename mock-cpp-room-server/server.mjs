// Local stand-in for the C++ free-room server (not in any repository).
// Speaks the protocol of CppTcpClient.java from team-ENERGO: 4-byte big-endian length + UTF-8 JSON.
//   request:  {"id": 1, "start_time": "11:00", "duration": 80, "corpus": "А"}
//   response: {"id": 1, "status": "answer", "cabinet": 301}   (cabinet 0 = nothing free)
// Run: node mock-cpp-room-server/server.mjs   (MOCK_CPP_PORT=2222, MOCK_CPP_DELAY_MS=0)
import net from 'node:net';

const PORT = Number(process.env.MOCK_CPP_PORT || 2222);
const DELAY_MS = Number(process.env.MOCK_CPP_DELAY_MS || 0);

// Rooms per corpus with the class starts at which they are busy. Corpus Д is fully booked.
const rooms = {
  'А': [{ cabinet: 301, busy: ['08:00', '09:30'] }, { cabinet: 205, busy: ['11:00'] }, { cabinet: 412, busy: [] }],
  'Б': [{ cabinet: 215, busy: ['12:40'] }, { cabinet: 108, busy: [] }],
  'Д': [{ cabinet: 101, busy: ['08:00', '09:30', '11:00', '12:40', '14:10', '15:30'] }],
};

function findCabinet({ corpus, start_time: startTime }) {
  const free = (rooms[corpus] || []).find((room) => !room.busy.includes(startTime));
  return free ? free.cabinet : 0;
}

function writeFrame(socket, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(4);
  header.writeInt32BE(body.length);
  socket.end(Buffer.concat([header, body]));
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length < 4) return;
    const length = buffer.readInt32BE(0);
    if (buffer.length < 4 + length) return;

    let request;
    try {
      request = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
    } catch {
      writeFrame(socket, { status: 'error', message: 'invalid json' });
      return;
    }
    const cabinet = findCabinet(request);
    console.log(`🔎 request ${JSON.stringify(request)} -> cabinet ${cabinet}`);
    setTimeout(() => writeFrame(socket, { id: request.id, status: 'answer', cabinet }), DELAY_MS);
  });
  socket.on('error', (err) => console.error('TCP error:', err.message));
});

server.listen(PORT, () => {
  console.log(`🧮 Mock C++ room server on port ${PORT} (delay ${DELAY_MS} ms)`);
});
