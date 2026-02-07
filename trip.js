// ==============================
// โหลดข้อมูล Trip จาก localStorage
// ถ้าไม่มีข้อมูลเลย ให้เป็น array ว่าง
// ==============================
let trips = JSON.parse(localStorage.getItem("trips")) || [];

// เรียกวาดตารางทันที เมื่อเปิดหน้า
renderTrips();

// ==============================
// เพิ่ม Trip ใหม่
// ==============================
function addTrip() {
  // อ่านค่าจาก input
  const place = document.getElementById("placeInput").value;
  const cost = document.getElementById("costInput").value;

  // ถ้าไม่ได้กรอกอะไรเลย ให้หยุด ไม่ทำต่อ
  if (!place || !cost) {
  alert("กรุณากรอกสถานที่และค่าใช้จ่าย");
  return;
}


  // เพิ่ม object ใหม่เข้าไปใน array
  trips.push({
    place: place,
    cost: cost
  });

  // บันทึก array trips ลง localStorage
  localStorage.setItem("trips", JSON.stringify(trips));

  // ล้างช่องกรอก
  document.getElementById("placeInput").value = "";
  document.getElementById("costInput").value = "";

  // วาดตารางใหม่
  renderTrips();
}

// ==============================
// วาดตาราง Trip ใหม่ทั้งหมด
// ==============================
function renderTrips() {
  const tbody = document.getElementById("tripBody");

  // ล้างแถวเก่าทั้งหมดก่อน
  tbody.innerHTML = "";

  // วนข้อมูล trips ทีละรายการ
  trips.forEach((trip, index) => {
    const row = document.createElement("tr");

    // สร้าง HTML ของแถว
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${trip.place}</td>
      <td>${trip.cost}</td>
      <td>
        <button onclick="editTrip(${index})">แก้ไข</button>
        <button onclick="deleteTrip(${index})">ลบ</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// ==============================
// ลบ Trip ตาม index
// ==============================
function deleteTrip(index) {
  // ลบข้อมูล 1 ตัว ที่ตำแหน่ง index
  trips.splice(index, 1);

  // บันทึกข้อมูลใหม่ลง localStorage
  localStorage.setItem("trips", JSON.stringify(trips));

  // วาดตารางใหม่
  renderTrips();
}

// ==============================
// แก้ไข Trip
// ==============================
function editTrip(index) {
  // ดึงข้อมูลเดิมมาใส่ใน input
  document.getElementById("placeInput").value = trips[index].place;
  document.getElementById("costInput").value = trips[index].cost;

  // ลบข้อมูลเดิมออกก่อน
  trips.splice(index, 1);

  // บันทึกข้อมูลที่ถูกลบแล้ว
  localStorage.setItem("trips", JSON.stringify(trips));

  // วาดตารางใหม่ (แถวที่แก้ไขจะหายไปก่อน)
  renderTrips();
}
