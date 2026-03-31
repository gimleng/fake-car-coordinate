const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const BACKEND = "http://192.168.7.8:8000/api/v1";

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

const PATH_UTAPAO = [
  { lat: 12.683024, lon: 100.999069 },
  { lat: 12.683280, lon: 100.996014 },
  { lat: 12.679769, lon: 100.995677 },
  { lat: 12.679586, lon: 100.997949 },
  { lat: 12.681444, lon: 100.998099 },
  { lat: 12.683142, lon: 100.998272 },
  { lat: 12.683089, lon: 100.998900 },
];

/**
 * Cars
 */
const liveCars = {};
const cars = [
  {
    id: "car-1",
    name: "Tesla Model Y",
    deviceType: "car",
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
    path: PATH,
  },
  {
    id: "car-2",
    name: "Toyota Corolla",
    deviceType: "car",
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
    path: PATH,
  },
  {
    id: "car-3",
    name: "Toyota Corolla",
    deviceType: "car",
    driver: "Earth",
    pathIndex: 0,
    progress: 0,
    speed: 0.002,
    startDelay: 2000,
    started: false,
    lat: PATH_UTAPAO[0].lat,
    lon: PATH_UTAPAO[0].lon,
    prevLat: PATH_UTAPAO[0].lat,
    prevLon: PATH_UTAPAO[0].lon,
    lastUpdate: Date.now(),
    velocity: 0,
    path: PATH_UTAPAO,
  },
  {
    id: "car-4",
    name: "Toyota Corolla",
    deviceType: "car",
    driver: "Few",
    pathIndex: 0,
    progress: 0,
    speed: 0.0010,
    startDelay: 4000,
    started: false,
    lat: PATH_UTAPAO[0].lat,
    lon: PATH_UTAPAO[0].lon,
    prevLat: PATH_UTAPAO[0].lat,
    prevLon: PATH_UTAPAO[0].lon,
    lastUpdate: Date.now(),
    velocity: 0,
    path: PATH_UTAPAO,
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
  const path = car.path; // ✅ use car-specific path

  car.progress += car.speed;

  if (car.progress >= 1) {
    car.progress -= 1;
    car.pathIndex = (car.pathIndex + 1) % path.length;
  }

  const p1 = path[car.pathIndex];
  const p2 = path[(car.pathIndex + 1) % path.length];

  car.prevLat = car.lat;
  car.prevLon = car.lon;

  car.lat = lerp(p1.lat, p2.lat, car.progress);
  car.lon = lerp(p1.lon, p2.lon, car.progress);

  car.heading = calculateHeading(p1, p2);

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
  // 1️⃣ Update fake cars
  cars.forEach(updateCar);

  // 2️⃣ Cleanup inactive real cars
  const TIMEOUT = 10000; // 10 sec

  Object.keys(liveCars).forEach((id) => {
    if (Date.now() - liveCars[id].updatedAt > TIMEOUT) {
      delete liveCars[id];
    }
  });

  // 3️⃣ Prepare fake cars
  const fakeCars = cars.map((c) => ({
    id: c.id,
    name: c.name,
    deviceType: "car",
    driver: c.driver,
    lat: +c.lat.toFixed(6),
    lon: +c.lon.toFixed(6),
    heading: Math.round(c.heading),
    speed: +(c.velocity * 3.6).toFixed(1),
  }));

  // 4️⃣ Get real cars
  const realCars = Object.values(liveCars);

  // 5️⃣ Emit everything together
  io.emit("location:update", {
    timestamp: Date.now(),
    cars: [...fakeCars, ...realCars],
  });
}, 100);

setInterval(async () => {
  const cars = Object.values(liveCars);

  for (const car of cars) {
    try {
      await axios.put(
        `${BACKEND}/streamings/${car.id}`,
        {
          latitude: car.lat,
          longitude: car.lon,
        },
        {
          headers: {
            "x-api-key": "skyviv@dmin0nly",
          },
        },
      );
    } catch (err) {
      console.error("Backend sync error:", err.message);
    }
  }

  if (cars.length > 0) {
    console.log("Synced to backend:", cars.length);
  }
}, 3000);

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
      deviceType: "car",
      driver: c.driver,
      lat: c.lat,
      lon: c.lon,
      heading: c.heading ?? 0,
      speed: +(c.velocity * 3.6).toFixed(1) ?? 0,
    })),
  );

  // real car location
  socket.on("car:location", (data) => {
    const { id, name, driver, lat, lon, heading, speed } = data;

    if (!id || typeof lat !== "number" || typeof lon !== "number") {
      return;
    }

    const prev = liveCars[id];

    let computedHeading = heading ?? 0;

    if (prev) {
      computedHeading = calculateHeading(
        { lat: prev.lat, lon: prev.lon },
        { lat, lon },
      );
    }

    liveCars[id] = {
      id,
      name: name ?? "Real Car",
      deviceType: "car",
      driver: driver ?? "Unknown",
      lat,
      lon,
      prevLat: prev?.lat ?? lat,
      prevLon: prev?.lon ?? lon,
      heading: computedHeading,
      speed: speed ?? 0,
      updatedAt: Date.now(),
    };
  });
});

PORT = 8001;

server.listen(PORT, () => {
  console.log(`Real-time car GPS running on port ${PORT}`);
});
