const user = await getCurrentUser()

// KPI
loadMyKPI(user.id)
loadMyShops(user.id)
loadMyClaims(user.id)

// ฝัง Looker (กรองตาม email)
document.getElementById("lookerFrame").src =
  `https://lookerstudio.google.com/embed/reporting/xxxx?page=1&params={"sales_email":"${user.email}"}`;