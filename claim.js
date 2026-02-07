console.log("claim.js โหลดแล้ว");

let claims = JSON.parse(localStorage.getItem("claims")) || [];
renderClaims();

function addClaim() {
  const value = document.getElementById("claimInput").value;
  if (!value) return;

  claims.push(value);
  localStorage.setItem("claims", JSON.stringify(claims));

  document.getElementById("claimInput").value = "";
  renderClaims();
}

function renderClaims() {
  const list = document.getElementById("claimList");
  list.innerHTML = "";

  claims.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${item}`;
    list.appendChild(li);
  });
}
