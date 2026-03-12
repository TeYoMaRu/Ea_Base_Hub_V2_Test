const user = await getCurrentUser()

loadTeamKPI(user.area_id)
loadTeamReports(user.area_id)

document.getElementById("teamLooker").src =
  `https://lookerstudio.google.com/embed/reporting/xxxx?page=team&params={"area_id":"${user.area_id}"}`;