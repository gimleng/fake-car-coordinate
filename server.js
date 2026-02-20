const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

/**
 * Shared path (loop)
 */
const PATH = [
  { lon: 101.119146, lat: 12.688903 },
  { lon: 101.118602, lat: 12.689261 },
  { lon: 101.1177763, lat: 12.6895659 },
  { lon: 101.1182391, lat: 12.690386515 },
  { lon: 101.119258, lat: 12.689816 },
  { lon: 101.118836, lat: 12.68912555 },
  { lon: 101.1191712, lat: 12.688914 },
];

/**
 * Cars
 */
const cars = [
  {
    id: "car-1",
    name: "Tesla Model Y",
    driver: "Fang",
    pathIndex: 0,
    progress: 0,
    speed: 0.005,
    startDelay: 0,
    started: false,
    lat: PATH[0].lat,
    lon: PATH[0].lon,
    prevLat: PATH[0].lat,
    prevLon: PATH[0].lon,
    lastUpdate: Date.now(),
    velocity: 0,
  },
  {
    id: "car-2",
    name: "Toyota Corolla",
    driver: "Pang",
    pathIndex: 0,
    progress: 0,
    speed: 0.003,
    startDelay: 4000,
    started: false,
    lat: PATH[0].lat,
    lon: PATH[0].lon,
    prevLat: PATH[0].lat,
    prevLon: PATH[0].lon,
    lastUpdate: Date.now(),
    velocity: 0,
  },
];

function calculateHeading(p1, p2) {
  const dx = p2.lon - p1.lon;
  const dy = p2.lat - p1.lat;

  // atan2(dx, dy) because heading is from north
  let heading = Math.atan2(dx, dy) * (180 / Math.PI);

  if (heading < 0) heading += 360;

  return heading;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversine(p1, p2) {
  const R = 6371000; // Earth radius (meters)

  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Start delay handler
 */
cars.forEach((car) => {
  setTimeout(() => {
    car.started = true;
  }, car.startDelay);
});

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Move car along path
 */
function updateCar(car) {
  if (!car.started) return;

  const now = Date.now();

  car.progress += car.speed;

  if (car.progress >= 1) {
    car.progress -= 1; // keep remainder for smoothness
    car.pathIndex = (car.pathIndex + 1) % PATH.length;
  }

  const p1 = PATH[car.pathIndex];
  const p2 = PATH[(car.pathIndex + 1) % PATH.length];

  // store previous position
  car.prevLat = car.lat;
  car.prevLon = car.lon;

  // update position
  car.lat = lerp(p1.lat, p2.lat, car.progress);
  car.lon = lerp(p1.lon, p2.lon, car.progress);

  // heading
  car.heading = calculateHeading(p1, p2);

  // speed
  const dt = (now - car.lastUpdate) / 1000;
  if (dt > 0) {
    const dist = haversine(
      { lat: car.prevLat, lon: car.prevLon },
      { lat: car.lat, lon: car.lon },
    );
    car.velocity = dist / dt;
  }

  car.lastUpdate = now;
}

/**
 * Update loop (smooth)
 */
setInterval(() => {
  cars.forEach(updateCar);

  io.emit("location:update", {
    timestamp: Date.now(),
    cars: cars.map((c) => ({
      id: c.id,
      name: c.name,
      driver: c.driver,
      lat: +c.lat.toFixed(6),
      lon: +c.lon.toFixed(6),
      heading: Math.round(c.heading),
      speed: +(c.velocity * 3.6).toFixed(1), // 👈 km/h
    })),
  });
}, 100);

/**
 * REST (initial state)
 */
app.get("/cars", (req, res) => {
  res.json(cars);
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit(
    "location:init",
    cars.map((c) => ({
      id: c.id,
      name: c.name,
      driver: c.driver,
      lat: c.lat,
      lon: c.lon,
      heading: c.heading ?? 0,
      speed: +(c.velocity * 3.6).toFixed(1) ?? 0,
    })),
  );
});

PORT = 8001;

server.listen(PORT, () => {
  console.log(`Fake real-time car GPS running on port ${PORT}`);
});
