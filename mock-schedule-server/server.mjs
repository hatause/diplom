import http from 'node:http';
import net from 'node:net';

const PORT_HTTP = 3500;
const PORT_TCP = 3501;

const schedule = [
  { id: 1, subjectName: 'Математический анализ', teacherName: 'Петров П.П.', groupCode: 'CS-101', room: 'А-301', dayOfWeek: 1, startTime: '09:00', endTime: '10:30' },
  { id: 2, subjectName: 'Программирование', teacherName: 'Сидорова Е.В.', groupCode: 'CS-101', room: 'Б-215', dayOfWeek: 1, startTime: '10:45', endTime: '12:15' },
  { id: 3, subjectName: 'Линейная алгебра', teacherName: 'Петров П.П.', groupCode: 'CS-101', room: 'А-301', dayOfWeek: 2, startTime: '09:00', endTime: '10:30' },
  { id: 4, subjectName: 'Физика', teacherName: 'Сидорова Е.В.', groupCode: 'CS-101', room: 'В-102', dayOfWeek: 2, startTime: '10:45', endTime: '12:15' },
  { id: 5, subjectName: 'Дискретная математика', teacherName: 'Петров П.П.', groupCode: 'CS-101', room: 'А-205', dayOfWeek: 3, startTime: '09:00', endTime: '10:30' },
];

// ── HTTP Server ──
const httpServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET' && req.url?.includes('/api/schedule/subjects')) {
    res.writeHead(200);
    res.end(JSON.stringify(schedule));
  } else if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

httpServer.listen(PORT_HTTP, () => {
  console.log(`📡 Mock HTTP schedule server running on port ${PORT_HTTP}`);
  console.log(`   GET http://localhost:${PORT_HTTP}/api/schedule/subjects`);
});

// ── TCP Server ──
const tcpServer = net.createServer((socket) => {
  console.log('🔌 TCP client connected');

  socket.on('data', (data) => {
    try {
      const request = JSON.parse(data.toString().trim());
      if (request.action === 'getSchedule') {
        socket.write(JSON.stringify(schedule));
        socket.end();
      }
    } catch {
      socket.write(JSON.stringify({ error: 'Invalid request' }));
      socket.end();
    }
  });

  socket.on('error', (err) => console.error('TCP error:', err.message));
});

tcpServer.listen(PORT_TCP, () => {
  console.log(`🔌 Mock TCP schedule server running on port ${PORT_TCP}`);
});

// ── Push simulator ──
function sendPush() {
  const pushData = JSON.stringify(schedule);
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/schedule/push',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pushData) },
  };

  const req = http.request(options, (res) => {
    console.log(`📤 Push sent, status: ${res.statusCode}`);
  });
  req.on('error', (e) => console.log(`📤 Push failed (backend may not be running): ${e.message}`));
  req.write(pushData);
  req.end();
}

// Send push every 60 seconds
setInterval(sendPush, 60000);
console.log('📤 Push mode: will send schedule to backend every 60s');
