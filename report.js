// ==============================
// อ่านข้อมูลจาก localStorage
// ==============================
const trips = JSON.parse(localStorage.getItem("trips")) || [];
const claims = JSON.parse(localStorage.getItem("claims")) || [];

const tbody = document.getElementById("reportBody");
const totalEl = document.getElementById("total");

// ตัวแปรเก็บยอดรวม
let total = 0;

// ==============================
// แสดงข้อมูล Trip
// ==============================
trips.forEach((trip, index) => {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${index + 1}</td>
    <td>Trip</td>
    <td>${trip.place}</td>
    <td>${trip.cost}</td>
  `;

  total += Number(trip.cost);
  tbody.appendChild(row);
});

// ==============================
// แสดงข้อมูล Claim
// ==============================
claims.forEach((claim, index) => {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${trips.length + index + 1}</td>
    <td>Claim</td>
    <td>${claim}</td>
    <td>-</td>
  `;

  tbody.appendChild(row);
});

// ==============================
// แสดงยอดรวม
// ==============================
totalEl.textContent = "รวมค่าใช้จ่ายทั้งหมด: " + total;
